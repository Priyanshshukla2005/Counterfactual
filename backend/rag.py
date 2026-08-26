"""
Counterfactual Phase 11 — RAG API Blueprint
Exposes authenticated, tenant-isolated endpoints for:
- Hybrid Context Search (/api/rag/search)
- Grounded AI Explanation with Locked Financial Numbers (/api/rag/explain)
- Source Chunk & Provenance Lookup (/api/rag/sources/<chunk_id>)
- Knowledge Document Ingestion & Management (/api/rag/documents)
"""

import os
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from pymongo.errors import PyMongoError

from auth import require_auth, log_audit_event
from database import get_rag_chunks_collection
from rag_engine import (
    is_rag_enabled,
    retrieve_context,
    generate_grounded_rag_explanation,
    ingest_knowledge_document,
    seed_foundational_rag_knowledge,
)

rag_bp = Blueprint("rag", __name__, url_prefix="/api/rag")


def sanitize_doc(doc):
    """Recursively converts MongoDB BSON ObjectIds to strings."""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [sanitize_doc(item) for item in doc]
    if isinstance(doc, dict):
        return {k: sanitize_doc(v) for k, v in doc.items()}
    if isinstance(doc, ObjectId):
        return str(doc)
    return doc


# ====================================================================
# 1. HYBRID CONTEXT SEARCH ENDPOINT
# ====================================================================

@rag_bp.route("/search", methods=["POST"])
@require_auth
def search_knowledge():
    """
    POST /api/rag/search
    Searches financial policies, fee schedules, settlement rules, and historical patterns.
    Enforces multi-tenant isolation: User A cannot search User B's private history.
    """
    if not is_rag_enabled():
        return jsonify({
            "enabled": False,
            "message": "RAG engine is currently disabled via feature flag.",
            "results": [],
            "total_found": 0
        }), 200

    user_id = g.user_id
    data = request.get_json(silent=True) or {}

    query = str(data.get("query", "")).strip()
    transaction_id = str(data.get("transactionId") or data.get("transaction_id") or "").strip()
    exception_type = str(data.get("exceptionType") or data.get("exception_type") or "").strip()
    source_type = str(data.get("sourceType") or data.get("source_type") or "ALL").strip()

    try:
        top_k = int(data.get("topK") or data.get("top_k") or 5)
    except (ValueError, TypeError):
        top_k = 5

    try:
        results = retrieve_context(
            query=query,
            tenant_id=user_id,
            transaction_id=transaction_id or None,
            exception_type=exception_type or None,
            source_type=source_type if source_type != "ALL" else None,
            top_k=top_k
        )

        return jsonify({
            "success": True,
            "enabled": True,
            "query": query,
            "results": sanitize_doc(results.get("results", [])),
            "total_found": results.get("total_found", 0)
        }), 200
    except Exception as e:
        return jsonify({"error": "Search Failed", "message": str(e)}), 500


# ====================================================================
# 2. GROUNDED AI EXPLANATION ENDPOINT
# ====================================================================

@rag_bp.route("/explain", methods=["POST"])
@require_auth
def explain_financial_event():
    """
    POST /api/rag/explain
    Generates a grounded, zero-hallucination explanation combining locked deterministic numbers
    with retrieved policy, fee schedule, and historical evidence.
    """
    user_id = g.user_id
    data = request.get_json(silent=True) or {}

    transaction_id = str(data.get("transactionId") or data.get("transaction_id") or "TXN_UNKNOWN").strip()
    query = str(data.get("query") or f"Explain settlement variance for transaction {transaction_id}").strip()
    exception_type = str(data.get("exceptionType") or data.get("exception_type") or "").strip()

    try:
        predicted = float(data.get("predictedAmount") if "predictedAmount" in data else data.get("predicted_amount", 0.0))
        actual = float(data.get("actualAmount") if "actualAmount" in data else data.get("actual_amount", 0.0))
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid numerical parameters."}), 400

    diff = round(predicted - actual, 2)
    dev_pct = round((abs(diff) / max(0.0001, abs(predicted))) * 100.0, 2) if predicted != 0 else (0.0 if actual == 0 else 100.0)
    accuracy_score = round(max(0.0, min(100.0, 100.0 - dev_pct)), 2)

    try:
        explanation = generate_grounded_rag_explanation(
            transaction_id=transaction_id,
            predicted_amount=predicted,
            actual_amount=actual,
            deviation_amount=diff,
            deviation_pct=dev_pct,
            accuracy_score=accuracy_score,
            exception_type=exception_type,
            query=query,
            tenant_id=user_id
        )

        return jsonify({
            "success": True,
            "explanation": sanitize_doc(explanation)
        }), 200
    except Exception as e:
        return jsonify({"error": "Explanation Failed", "message": str(e)}), 500


# ====================================================================
# 3. SOURCE CHUNK & PROVENANCE LOOKUP
# ====================================================================

@rag_bp.route("/sources/<chunk_id>", methods=["GET"])
@require_auth
def get_source_chunk(chunk_id):
    """
    GET /api/rag/sources/<chunk_id>
    Fetches the full text and metadata for a specific cited source chunk.
    Enforces multi-tenant access control: User A cannot view User B's private documents.
    """
    user_id = g.user_id

    try:
        col = get_rag_chunks_collection()
        doc = col.find_one({
            "chunk_id": chunk_id,
            "$or": [{"tenant_id": user_id}, {"tenant_id": "SYSTEM"}]
        })
    except Exception:
        return jsonify({"error": "Database Query Failed"}), 503

    if not doc:
        return jsonify({
            "error": "Not Found",
            "message": f"Source chunk '{chunk_id}' not found or access denied."
        }), 404

    # Sanitize embedding vector from response to keep payload lightweight
    doc.pop("embedding", None)

    return jsonify({
        "success": True,
        "source": sanitize_doc(doc)
    }), 200


# ====================================================================
# 4. KNOWLEDGE DOCUMENT MANAGEMENT (INGESTION & LISTING)
# ====================================================================

@rag_bp.route("/documents", methods=["POST"])
@require_auth
def create_knowledge_document():
    """
    POST /api/rag/documents
    Ingests a custom knowledge document for the authenticated tenant.
    """
    user_id = g.user_id
    data = request.get_json(silent=True) or {}

    title = str(data.get("title", "")).strip()
    if not title:
        return jsonify({"error": "Missing Title", "message": "Field 'title' is required."}), 400

    content = str(data.get("content", "")).strip()
    if not content:
        return jsonify({"error": "Missing Content", "message": "Field 'content' is required."}), 400

    source_type = str(data.get("sourceType") or data.get("source_type") or "FINANCIAL_POLICY").strip().upper()
    metadata = data.get("metadata") or {}

    try:
        result = ingest_knowledge_document(
            title=title,
            content=content,
            source_type=source_type,
            tenant_id=user_id,
            metadata=metadata
        )

        log_audit_event(
            user_id=user_id,
            action="RAG_DOCUMENT_INGESTED",
            metadata={"document_id": result["document_id"], "title": title}
        )

        return jsonify(result), 201
    except Exception as e:
        return jsonify({"error": "Ingestion Failed", "message": str(e)}), 500


@rag_bp.route("/documents", methods=["GET"])
@require_auth
def list_knowledge_documents():
    """
    GET /api/rag/documents
    Lists all knowledge documents accessible by current user (SYSTEM public + tenant private).
    """
    user_id = g.user_id
    seed_foundational_rag_knowledge()

    try:
        col = get_rag_chunks_collection()
        raw_chunks = list(col.find({
            "$or": [{"tenant_id": user_id}, {"tenant_id": "SYSTEM"}]
        }, {"embedding": 0}))

        # Group by document_id
        docs_by_id = {}
        for c in raw_chunks:
            d_id = c.get("document_id")
            if d_id not in docs_by_id:
                docs_by_id[d_id] = {
                    "document_id": d_id,
                    "title": c.get("title"),
                    "source_type": c.get("source_type"),
                    "tenant_id": c.get("tenant_id"),
                    "metadata": c.get("metadata", {}),
                    "chunks_count": 0,
                    "created_at": c.get("created_at"),
                }
            docs_by_id[d_id]["chunks_count"] += 1

        return jsonify({
            "success": True,
            "documents": sanitize_doc(list(docs_by_id.values())),
            "total_documents": len(docs_by_id)
        }), 200
    except Exception as e:
        return jsonify({"error": "Failed to list documents", "message": str(e)}), 500


@rag_bp.route("/documents/<document_id>", methods=["DELETE"])
@require_auth
def delete_knowledge_document(document_id):
    """
    DELETE /api/rag/documents/<document_id>
    Deletes custom knowledge document owned by the tenant. System documents cannot be deleted.
    """
    user_id = g.user_id

    try:
        col = get_rag_chunks_collection()
        del_res = col.delete_many({"document_id": document_id, "tenant_id": user_id})

        if del_res.deleted_count == 0:
            return jsonify({
                "error": "Not Found or Unauthorized",
                "message": f"Document '{document_id}' not found or cannot delete system documents."
            }), 404

        return jsonify({
            "success": True,
            "message": f"Document '{document_id}' deleted successfully.",
            "deleted_chunks": del_res.deleted_count
        }), 200
    except Exception as e:
        return jsonify({"error": "Delete Failed", "message": str(e)}), 500
