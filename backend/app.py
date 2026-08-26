import os
import uuid
from datetime import datetime, timezone
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from pymongo.errors import PyMongoError
from bson import ObjectId

from reconciliation import reconcile
from explanation_engine import generate_explanation
from counterfactual_engine import calculate_counterfactual, generate_multi_scenario_comparison
from auth import auth_bp, require_auth, log_audit_event
from execution import execution_bp
from monitoring import monitoring_bp
from demo import demo_bp
from rag import rag_bp
from database import (
    init_database,
    is_mongodb_live,
    get_simulations_collection,
    get_audit_events_collection,
    get_executions_collection,
    get_outcomes_collection,
    get_rag_chunks_collection,
)

app = Flask(__name__)

# Production-configured CORS origin
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:3000")
CORS(
    app,
    origins=[o.strip() for o in CORS_ORIGIN.split(",") if o.strip()],
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)

app.register_blueprint(auth_bp)
app.register_blueprint(execution_bp)
app.register_blueprint(monitoring_bp)
app.register_blueprint(demo_bp)
app.register_blueprint(rag_bp)

CSV_PATH = os.path.join(os.path.dirname(__file__), "data", "counterfactual_phase1_transactions.csv")

# Initialize database on startup (never silently fall back to local storage)
try:
    init_database(strict=False)
except Exception:
    pass


def sanitize_mongo_doc(doc):
    """
    Recursively converts BSON ObjectId and other non-JSON-serializable types to strings.
    Ensures that any MongoDB document can be safely serialized by Flask's jsonify().
    """
    if doc is None:
        return None
    if isinstance(doc, list):
        return [sanitize_mongo_doc(item) for item in doc]
    if isinstance(doc, dict):
        return {k: sanitize_mongo_doc(v) for k, v in doc.items()}
    if isinstance(doc, ObjectId):
        return str(doc)
    return doc


# Global JSON error handlers (Never expose raw stack traces)
@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": "Bad Request", "message": str(e)}), 400


@app.errorhandler(401)
def unauthorized(e):
    return jsonify({"error": "Unauthorized", "message": "Authentication required."}), 401


@app.errorhandler(403)
def forbidden(e):
    return jsonify({"error": "Forbidden", "message": "Access to this resource is denied."}), 403


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not Found", "message": "Requested resource not found."}), 404


@app.errorhandler(500)
def internal_server_error(e):
    return jsonify({"error": "Internal Server Error", "message": "An unexpected server error occurred."}), 500


@app.route("/")
def home():
    return jsonify({
        "name": "Counterfactual Fintech Intelligence API",
        "version": "5.0.0",
        "status": "running",
        "mongodb": "connected" if is_mongodb_live() else "disconnected"
    })


@app.route("/api/health", methods=["GET"])
def health():
    """
    Explicit Database Health Endpoint (Task 9).
    Returns 200 OK when MongoDB is connected and 503 when disconnected.
    """
    if is_mongodb_live():
        return jsonify({
            "status": "healthy",
            "database": "mongodb",
            "mongodb": "connected"
        }), 200
    return jsonify({
        "status": "unhealthy",
        "database": "mongodb",
        "mongodb": "disconnected"
    }), 503


# ====================================================================
# PROTECTED FINANCIAL & LEDGER ENDPOINTS
# ====================================================================

@app.route("/api/dashboard", methods=["GET"])
@require_auth
def dashboard():
    """Returns aggregated settlement metrics and active exception items (Protected)."""
    try:
        results, metrics, report, matrix, all_labels, ai_records = reconcile(CSV_PATH)
        exceptions = results[results["exception_type"] != "NONE"].copy()
        exception_data = []

        for _, row in exceptions.iterrows():
            exception_data.append({
                "transaction_id": str(row["transaction_id"]),
                "order_id": str(row.get("order_id", "")),
                "payment_id": str(row.get("payment_id", "")),
                "customer_id": str(row.get("customer_id", "")),
                "payment_date": str(row.get("payment_date", "")),
                "payment_method": str(row.get("payment_method", "CARD")),
                "exception_type": str(row["exception_type"]),
                "difference": float(row["difference"]),
                "expected_settlement": float(row["expected_settlement"]),
                "actual_settlement": float(row["actual_settlement"]),
                "refund_amount": float(row["refund_amount"]),
                "fee": float(row.get("fee", 0)),
                "tax": float(row.get("tax", 0)),
                "settlement_status": str(row["settlement_status"]),
                "settlement_date": str(row.get("settlement_date", "")),
                "settlement_events": row.get("settlement_events", [])
            })

        return jsonify({
            "metrics": metrics,
            "exceptions": exception_data
        })
    except Exception:
        return jsonify({"error": "Unable to calculate dashboard metrics."}), 500


@app.route("/api/transactions", methods=["GET"])
@require_auth
def transactions():
    """Returns consolidated unique transaction entities (Protected)."""
    try:
        results, metrics, report, matrix, all_labels, ai_records = reconcile(CSV_PATH)
        transaction_data = []

        for _, row in results.iterrows():
            transaction_data.append({
                "transaction_id": str(row["transaction_id"]),
                "order_id": str(row.get("order_id", "")),
                "payment_id": str(row.get("payment_id", "")),
                "customer_id": str(row.get("customer_id", "")),
                "payment_date": str(row.get("payment_date", "")),
                "payment_method": str(row.get("payment_method", "CARD")),
                "status": "Reconciled" if str(row["exception_type"]) == "NONE" else "Exception",
                "amount": float(row.get("amount", row.get("expected_settlement", 0))),
                "settlement_date": str(row.get("settlement_date", "")),
                "expected_settlement": float(row["expected_settlement"]),
                "actual_settlement": float(row["actual_settlement"]),
                "difference": float(row["difference"]),
                "refund_amount": float(row["refund_amount"]),
                "fee": float(row["fee"]),
                "tax": float(row["tax"]),
                "settlement_status": str(row["settlement_status"]),
                "exception_type": str(row["exception_type"]),
                "settlement_events": row.get("settlement_events", []),
            })

        return jsonify(transaction_data)
    except Exception:
        return jsonify({"error": "Unable to retrieve transaction ledger."}), 500


@app.route("/api/counterfactual/<transaction_id>", methods=["GET"])
@require_auth
def counterfactual(transaction_id):
    """Returns deterministic counterfactual explanation for an exception transaction (Protected)."""
    try:
        results, metrics, report, matrix, all_labels, ai_records = reconcile(CSV_PATH)
        transaction = results[results["transaction_id"].astype(str) == str(transaction_id)]

        if transaction.empty:
            return jsonify({"error": "Transaction not found."}), 404

        row = transaction.iloc[0]
        exception = {
            "transaction_id": str(row["transaction_id"]),
            "exception_type": str(row["exception_type"]),
            "expected_settlement": float(row["expected_settlement"]),
            "actual_settlement": float(row["actual_settlement"]),
            "difference": float(row["difference"]),
            "refund_amount": float(row["refund_amount"]),
            "fee": float(row["fee"]),
            "tax": float(row["tax"]),
            "settlement_status": str(row["settlement_status"]),
            "confidence": 0.98 if str(row["exception_type"]) == "DUPLICATE" else 0.95,
        }

        explanation = generate_explanation(exception)
        return jsonify(explanation)
    except Exception:
        return jsonify({"error": "Unable to generate counterfactual explanation."}), 500


@app.route("/api/counterfactual/simulate", methods=["POST"])
@require_auth
def simulate_counterfactual():
    """
    Phase 4 & 5 Core Feature: True Deterministic Counterfactual Financial Simulation.
    Validates input ranges and returns live mathematical impact analysis (Protected).
    """
    data = request.get_json(silent=True) or {}

    try:
        gross_amount = float(data.get("gross_amount", 10000.0))
        current_discount_pct = float(data.get("current_discount_pct", 5.0))
        new_discount_pct = float(data.get("new_discount_pct", 3.0))
        fee_pct = float(data.get("fee_pct", 1.8))
        tax_pct = float(data.get("tax_pct", 18.0))
        refund_amount = float(data.get("refund_amount", 0.0))
        settlement_recovery_pct = float(data.get("settlement_recovery_pct", 100.0))
        settlement_timing_days = int(data.get("settlement_timing_days", 1))
        transaction_id = str(data.get("transaction_id", "TXN_SIMULATION")).strip()
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid numerical parameters provided."}), 400

    # Strict input boundary validation
    if gross_amount <= 0:
        return jsonify({"error": "Gross amount must be greater than zero."}), 400
    if not (0 <= current_discount_pct <= 100):
        return jsonify({"error": "Current discount percentage must be between 0% and 100%."}), 400
    if not (0 <= new_discount_pct <= 100):
        return jsonify({"error": "New discount percentage must be between 0% and 100%."}), 400
    if fee_pct < 0 or fee_pct > 50:
        return jsonify({"error": "Gateway fee percentage must be between 0% and 50%."}), 400
    if tax_pct < 0 or tax_pct > 100:
        return jsonify({"error": "Tax percentage must be between 0% and 100%."}), 400
    if refund_amount < 0:
        return jsonify({"error": "Refund amount cannot be negative."}), 400
    if not (0 <= settlement_recovery_pct <= 100):
        return jsonify({"error": "Settlement recovery percentage must be between 0% and 100%."}), 400
    if settlement_timing_days not in (0, 1, 2):
        return jsonify({"error": "Settlement timing days must be 0 (T+0), 1 (T+1), or 2 (T+2)."}), 400

    simulation = calculate_counterfactual(
        gross_amount=gross_amount,
        current_discount_pct=current_discount_pct,
        new_discount_pct=new_discount_pct,
        fee_pct=fee_pct,
        tax_pct=tax_pct,
        refund_amount=refund_amount,
        settlement_recovery_pct=settlement_recovery_pct,
        settlement_timing_days=settlement_timing_days,
        transaction_id=transaction_id
    )

    multi_scenarios = generate_multi_scenario_comparison(
        gross_amount=gross_amount,
        custom_discount_pct=new_discount_pct,
        fee_pct=fee_pct,
        tax_pct=tax_pct,
        refund_amount=refund_amount
    )

    return jsonify({
        "simulation": simulation,
        "multi_scenarios": multi_scenarios
    })


# ====================================================================
# PERSISTENT SAVED SIMULATIONS (USER ISOLATED)
# ====================================================================

@app.route("/api/simulations", methods=["POST"])
@require_auth
def save_simulation():
    """
    Persists a counterfactual simulation scenario to MongoDB Atlas.
    User ID is strictly derived from the authenticated session.
    """
    data = request.get_json(silent=True) or {}

    try:
        gross_amount = float(data.get("gross_amount", 10000.0))
        current_discount_pct = float(data.get("current_discount_pct", 5.0))
        new_discount_pct = float(data.get("new_discount_pct", 3.0))
        fee_pct = float(data.get("fee_pct", 1.8))
        tax_pct = float(data.get("tax_pct", 18.0))
        refund_amount = float(data.get("refund_amount", 0.0))
        settlement_recovery_pct = float(data.get("settlement_recovery_pct", 100.0))
        settlement_timing = str(data.get("settlement_timing", "T+1")).strip().upper()
        transaction_id = str(data.get("transaction_id", "TXN_SIMULATION")).strip()
        scenario_name = str(data.get("name", f"Pricing Simulation - {transaction_id}")).strip()
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid simulation parameters."}), 400

    timing_map = {"T+0": 0, "T+1": 1, "T+2": 2}
    if settlement_timing not in timing_map:
        return jsonify({"error": "Settlement timing must be 'T+0', 'T+1', or 'T+2'."}), 400

    timing_days = timing_map[settlement_timing]

    calc = calculate_counterfactual(
        gross_amount=gross_amount,
        current_discount_pct=current_discount_pct,
        new_discount_pct=new_discount_pct,
        fee_pct=fee_pct,
        tax_pct=tax_pct,
        refund_amount=refund_amount,
        settlement_recovery_pct=settlement_recovery_pct,
        settlement_timing_days=timing_days,
        transaction_id=transaction_id
    )

    sim_id = f"sim_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    authenticated_user_id = g.user_id

    simulation_doc = {
        "id": sim_id,
        "name": scenario_name,
        "user_id": authenticated_user_id,
        "transaction_id": transaction_id,
        "exception_type": str(data.get("exception_type", "COMMERCIAL_PRICING")),
        "created_at": now_iso,
        "scenario": {
            "discount": new_discount_pct,
            "current_discount": current_discount_pct,
            "gateway_fee": fee_pct,
            "recovery_percentage": settlement_recovery_pct,
            "settlement_timing": settlement_timing
        },
        "baseline": calc["baseline"],
        "counterfactual": calc["counterfactual"],
        "financial_delta": calc["deltas"],
        "recommendation": calc["decision_guidance"]
    }

    try:
        sim_col = get_simulations_collection()
        sim_col.insert_one(simulation_doc)
    except (ConnectionError, PyMongoError) as ce:
        return jsonify({"error": "Database Connection Failed", "message": "Unable to reach MongoDB Atlas. Please try again shortly."}), 503

    log_audit_event(
        user_id=authenticated_user_id,
        action="SIMULATION_CREATED",
        transaction_id=transaction_id,
        metadata={"simulation_id": sim_id, "scenario_name": scenario_name}
    )

    return jsonify({
        "message": "Simulation scenario saved successfully.",
        "simulation": sanitize_mongo_doc(simulation_doc)
    }), 201


@app.route("/api/simulations", methods=["GET"])
@require_auth
def get_saved_simulations():
    """Retrieves saved simulations belonging strictly to the authenticated user."""
    try:
        sim_col = get_simulations_collection()
        user_simulations = list(sim_col.find({"user_id": g.user_id}))
    except (ConnectionError, PyMongoError) as ce:
        return jsonify({"error": "Database Connection Failed", "message": "Unable to reach MongoDB Atlas. Please try again shortly."}), 503

    clean_sims = sanitize_mongo_doc(user_simulations)
    sorted_sims = sorted(clean_sims, key=lambda s: s.get("created_at", ""), reverse=True)

    return jsonify({
        "simulations": sorted_sims,
        "count": len(sorted_sims)
    }), 200


@app.route("/api/simulations/<simulation_id>", methods=["GET"])
@require_auth
def get_simulation_by_id(simulation_id):
    """Retrieves a specific simulation document by ID (Strict User Isolation)."""
    try:
        sim_col = get_simulations_collection()
        sim_doc = sim_col.find_one({"id": simulation_id, "user_id": g.user_id}) or sim_col.find_one({"_id": simulation_id, "user_id": g.user_id})
    except (ConnectionError, PyMongoError) as ce:
        return jsonify({"error": "Database Connection Failed", "message": "Unable to reach MongoDB Atlas. Please try again shortly."}), 503

    if not sim_doc:
        return jsonify({"error": "Simulation not found or access unauthorized."}), 404

    return jsonify({"simulation": sanitize_mongo_doc(sim_doc)}), 200


@app.route("/api/simulations/<simulation_id>", methods=["DELETE"])
@require_auth
def delete_simulation(simulation_id):
    """Deletes a saved simulation owned by the authenticated user."""
    try:
        sim_col = get_simulations_collection()
        sim_doc = sim_col.find_one({"id": simulation_id, "user_id": g.user_id}) or sim_col.find_one({"_id": simulation_id, "user_id": g.user_id})
    except (ConnectionError, PyMongoError) as ce:
        return jsonify({"error": "Database Connection Failed", "message": "Unable to reach MongoDB Atlas. Please try again shortly."}), 503

    if not sim_doc:
        return jsonify({"error": "Simulation not found or access unauthorized."}), 404

    target_id = sim_doc.get("_id") or sim_doc.get("id")
    sim_col.delete_one({"_id": target_id})

    log_audit_event(
        user_id=g.user_id,
        action="SIMULATION_DELETED",
        transaction_id=sim_doc.get("transaction_id"),
        metadata={"simulation_id": simulation_id}
    )

    return jsonify({
        "status": "deleted",
        "message": "Simulation scenario removed successfully."
    }), 200


@app.route("/api/audit-trail", methods=["GET"])
@require_auth
def get_audit_trail():
    """Retrieves the audit log history for the authenticated user."""
    try:
        audit_col = get_audit_events_collection()
        user_events = list(audit_col.find({"user_id": g.user_id}))
    except (ConnectionError, PyMongoError) as ce:
        return jsonify({"error": "Database Connection Failed", "message": "Unable to reach MongoDB Atlas. Please try again shortly."}), 503

    clean_events = sanitize_mongo_doc(user_events)
    sorted_events = sorted(clean_events, key=lambda e: e.get("timestamp", ""), reverse=True)

    return jsonify({
        "audit_events": sorted_events,
        "count": len(sorted_events)
    }), 200


# ====================================================================
# PHASE 12: MERCHANT CSV PAYMENT INGESTION (TENANT ISOLATED)
# ====================================================================

@app.route("/api/import-csv", methods=["POST"])
@require_auth
def import_csv_payments():
    """
    POST /api/import-csv
    Ingests validated merchant payment records.
    Strictly binds all imported records to the authenticated tenant (g.user_id).
    """
    data = request.get_json(silent=True) or {}
    records = data.get("records")

    if not isinstance(records, list) or len(records) == 0:
        return jsonify({"error": "Invalid Data", "message": "Payload must contain a non-empty 'records' list."}), 400

    authenticated_user_id = g.user_id
    now_iso = datetime.now(timezone.utc).isoformat()
    valid_records = []
    warnings = []

    for idx, r in enumerate(records):
        if not isinstance(r, dict):
            warnings.append(f"Row {idx + 1}: Malformed record skipped.")
            continue

        raw_id = str(r.get("transaction_id") or r.get("id") or f"TXN_IMP_{uuid.uuid4().hex[:8].upper()}").strip()

        try:
            amount = float(r.get("amount", 0.0))
            expected = float(r.get("expected_settlement", r.get("expected_amount", amount)))
            actual = float(r.get("actual_settlement", r.get("actual_amount", expected)))
            refund = float(r.get("refund_amount", 0.0))
            fee = float(r.get("fee", 0.0))
        except (ValueError, TypeError):
            warnings.append(f"Row {idx + 1} ({raw_id}): Invalid numerical values skipped.")
            continue

        if amount < 0 or expected < 0 or actual < 0 or refund < 0 or fee < 0:
            warnings.append(f"Row {idx + 1} ({raw_id}): Negative amounts are not permitted.")
            continue

        payment_method = str(r.get("payment_method") or r.get("rail") or "CARD").strip().upper()
        date_str = str(r.get("date") or r.get("payment_date") or now_iso[:10]).strip()
        diff = round(expected - actual, 2)
        status = "Reconciled" if diff == 0 else "Exception"

        valid_records.append({
            "transaction_id": raw_id,
            "user_id": authenticated_user_id,
            "tenant_id": authenticated_user_id,
            "amount": amount,
            "expected_settlement": expected,
            "actual_settlement": actual,
            "difference": diff,
            "refund_amount": refund,
            "fee": fee,
            "payment_method": payment_method,
            "payment_date": date_str,
            "status": status,
            "imported_at": now_iso,
        })

    if not valid_records:
        return jsonify({
            "error": "Validation Failed",
            "message": "No valid payment records found.",
            "warnings": warnings
        }), 400

    # Persist records under tenant collection
    try:
        from database import get_database
        db = get_database()
        col = db["tenant_imported_transactions"]
        for vr in valid_records:
            col.update_one(
                {"transaction_id": vr["transaction_id"], "user_id": authenticated_user_id},
                {"$set": vr},
                upsert=True
            )
    except Exception as e:
        return jsonify({"error": "Persistence Failed", "message": str(e)}), 500

    log_audit_event(
        user_id=authenticated_user_id,
        action="CSV_PAYMENTS_IMPORTED",
        metadata={"imported_count": len(valid_records), "total_submitted": len(records)}
    )

    return jsonify({
        "success": True,
        "message": f"Successfully imported {len(valid_records)} payment records.",
        "imported_count": len(valid_records),
        "total_records": len(records),
        "warnings": warnings
    }), 201


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        debug=False,
        threaded=True,
    )