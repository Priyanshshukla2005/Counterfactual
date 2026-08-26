"""
Counterfactual Financial Execution Engine API Blueprint
Handles:
- Staging recommendations (PENDING_APPROVAL)
- Human approval & rejection state machine
- Deterministic guardrail enforcement
- Razorpay Sandbox Payment Link, Refund & Invoice execution
- Multi-tenant execution audit history
"""

import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from pymongo.errors import PyMongoError
from bson import ObjectId

from auth import require_auth, log_audit_event
from database import get_executions_collection, get_simulations_collection, is_mongodb_live
import razorpay_service
from guardrails import (
    validate_amount,
    validate_currency,
    validate_action_type,
    validate_state_transition,
    validate_guardrails_for_execution,
    compute_idempotency_key,
)

execution_bp = Blueprint("execution", __name__, url_prefix="/api/execution")


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
# 1. RAZORPAY CONFIGURATION & HEALTH CHECK
# ====================================================================

@execution_bp.route("/config", methods=["GET"])
@require_auth
def get_config():
    """Returns safe diagnostic configuration without exposing secret keys."""
    config = razorpay_service.get_razorpay_public_config()
    return jsonify(config), 200


# ====================================================================
# 2. RECOMMENDATION STAGING (PENDING_APPROVAL)
# ====================================================================

@execution_bp.route("/recommend", methods=["POST"])
@require_auth
def stage_recommendation():
    """
    Stages an operational recommendation into the execution state machine.
    Initial state: PENDING_APPROVAL.
    """
    data = request.get_json(silent=True) or {}
    user_id = g.user_id

    action_type = str(data.get("action_type") or data.get("actionType") or "REFUND").strip().upper()
    raw_amount = data.get("amount", 0)
    currency = str(data.get("currency", "INR")).strip().upper()
    simulation_id = str(data.get("simulation_id") or data.get("simulationId") or "").strip()
    recommendation_id = str(data.get("recommendation_id") or data.get("recommendationId") or "").strip()
    target_tx_id = str(data.get("target_transaction_id") or data.get("transactionId") or "").strip()
    description = str(data.get("description") or f"Counterfactual {action_type} execution").strip()
    metadata_in = data.get("metadata") or {}

    amt_ok, amount, amt_err = validate_amount(raw_amount)
    if not amt_ok:
        return jsonify({"error": "Invalid Amount", "message": amt_err}), 400

    curr_ok, curr_err = validate_currency(currency)
    if not curr_ok:
        return jsonify({"error": "Invalid Currency", "message": curr_err}), 400

    action_ok, action_err = validate_action_type(action_type)
    if not action_ok:
        return jsonify({"error": "Invalid Action Type", "message": action_err}), 400

    exec_id = f"exec_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    idemp_key = compute_idempotency_key(
        tenant_id=user_id,
        action_type=action_type,
        amount=amount,
        simulation_id=simulation_id,
        recommendation_id=recommendation_id,
        payment_id=data.get("payment_id") or data.get("paymentId")
    )

    execution_doc = {
        "execution_id": exec_id,
        "id": exec_id,
        "user_id": user_id,
        "tenant_id": user_id,
        "simulation_id": simulation_id,
        "recommendation_id": recommendation_id or f"rec_{uuid.uuid4().hex[:8]}",
        "target_transaction_id": target_tx_id,
        "action_type": action_type,
        "amount": amount,
        "currency": currency,
        "status": "PENDING_APPROVAL",
        "description": description,
        "idempotency_key": idemp_key,
        "requested_at": now_iso,
        "approved_at": None,
        "approved_by": None,
        "executed_at": None,
        "rejected_at": None,
        "razorpay_id": None,
        "razorpay_reference": None,
        "short_url": None,
        "error_code": None,
        "error_message": None,
        "metadata": {
            **metadata_in,
            "payment_id": data.get("payment_id") or data.get("paymentId", ""),
            "customer_name": data.get("customer_name") or data.get("customerName", ""),
            "customer_email": data.get("customer_email") or data.get("customerEmail", ""),
        }
    }

    try:
        col = get_executions_collection()
        col.insert_one(execution_doc)
    except (ConnectionError, PyMongoError):
        return jsonify({
            "error": "Database Connection Failed",
            "message": "Unable to persist execution record in MongoDB Atlas."
        }), 503

    log_audit_event(
        user_id=user_id,
        action="EXECUTION_STAGED",
        transaction_id=target_tx_id,
        metadata={"execution_id": exec_id, "action_type": action_type, "amount": amount}
    )

    return jsonify({
        "success": True,
        "execution": sanitize_doc(execution_doc)
    }), 201


# ====================================================================
# 3. APPROVAL API (PENDING_APPROVAL -> APPROVED)
# ====================================================================

@execution_bp.route("/<execution_id>/approve", methods=["POST"])
@require_auth
def approve_execution(execution_id):
    """
    Approves a staged execution item.
    Enforces tenant ownership and valid PENDING_APPROVAL status.
    """
    user_id = g.user_id
    try:
        col = get_executions_collection()
        doc = col.find_one({"execution_id": execution_id, "user_id": user_id}) or col.find_one({"id": execution_id, "user_id": user_id})
    except (ConnectionError, PyMongoError):
        return jsonify({"error": "Database Connection Failed", "message": "Unable to query MongoDB Atlas."}), 503

    if not doc:
        return jsonify({"error": "Not Found", "message": "Execution record not found or access denied."}), 404

    current_status = doc.get("status", "RECOMMENDED")
    transition_ok, trans_err = validate_state_transition(current_status, "APPROVED")
    if not transition_ok:
        return jsonify({
            "error": "Invalid State Transition",
            "message": f"Cannot approve an execution with status '{current_status}'. Must be 'PENDING_APPROVAL'."
        }), 400

    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        col.update_one(
            {"_id": doc["_id"]},
            {"$set": {
                "status": "APPROVED",
                "approved_at": now_iso,
                "approved_by": user_id,
                "updated_at": now_iso
            }}
        )
        doc["status"] = "APPROVED"
        doc["approved_at"] = now_iso
        doc["approved_by"] = user_id
    except Exception:
        return jsonify({"error": "Database Error", "message": "Failed to update execution record."}), 500

    log_audit_event(
        user_id=user_id,
        action="EXECUTION_APPROVED",
        transaction_id=doc.get("target_transaction_id"),
        metadata={"execution_id": execution_id, "amount": doc.get("amount"), "action_type": doc.get("action_type")}
    )

    return jsonify({
        "success": True,
        "message": "Execution action successfully approved.",
        "execution": sanitize_doc(doc)
    }), 200


# ====================================================================
# 4. REJECTION API (PENDING_APPROVAL -> REJECTED)
# ====================================================================

@execution_bp.route("/<execution_id>/reject", methods=["POST"])
@require_auth
def reject_execution(execution_id):
    """
    Rejects a staged execution item.
    """
    user_id = g.user_id
    data = request.get_json(silent=True) or {}
    reason = str(data.get("reason", "Rejected by operator")).strip()

    try:
        col = get_executions_collection()
        doc = col.find_one({"execution_id": execution_id, "user_id": user_id}) or col.find_one({"id": execution_id, "user_id": user_id})
    except (ConnectionError, PyMongoError):
        return jsonify({"error": "Database Connection Failed", "message": "Unable to query MongoDB Atlas."}), 503

    if not doc:
        return jsonify({"error": "Not Found", "message": "Execution record not found or access denied."}), 404

    current_status = doc.get("status", "RECOMMENDED")
    transition_ok, trans_err = validate_state_transition(current_status, "REJECTED")
    if not transition_ok:
        return jsonify({
            "error": "Invalid State Transition",
            "message": f"Cannot reject execution in '{current_status}' state."
        }), 400

    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        col.update_one(
            {"_id": doc["_id"]},
            {"$set": {
                "status": "REJECTED",
                "rejected_at": now_iso,
                "rejection_reason": reason,
                "updated_at": now_iso
            }}
        )
        doc["status"] = "REJECTED"
        doc["rejected_at"] = now_iso
    except Exception:
        return jsonify({"error": "Database Error", "message": "Failed to update execution record."}), 500

    log_audit_event(
        user_id=user_id,
        action="EXECUTION_REJECTED",
        transaction_id=doc.get("target_transaction_id"),
        metadata={"execution_id": execution_id, "reason": reason}
    )

    return jsonify({
        "success": True,
        "message": "Execution action rejected.",
        "execution": sanitize_doc(doc)
    }), 200


# ====================================================================
# 5. DEDICATED EXECUTION API (APPROVED -> EXECUTING -> EXECUTED / FAILED)
# ====================================================================

@execution_bp.route("/<execution_id>/execute", methods=["POST"])
@require_auth
def execute_approved_action(execution_id):
    """
    Executes an APPROVED action via Razorpay Sandbox.
    Enforces idempotency, tenant isolation, and deterministic guardrails.
    """
    user_id = g.user_id
    try:
        col = get_executions_collection()
        doc = col.find_one({"execution_id": execution_id, "user_id": user_id}) or col.find_one({"id": execution_id, "user_id": user_id})
    except (ConnectionError, PyMongoError):
        return jsonify({"error": "Database Connection Failed", "message": "Unable to query MongoDB Atlas."}), 503

    if not doc:
        return jsonify({"error": "Not Found", "message": "Execution record not found or access denied."}), 404

    # Idempotency check: if already executed, return successful existing record
    if doc.get("status") == "EXECUTED":
        return jsonify({
            "success": True,
            "idempotent": True,
            "message": "This action has already been executed successfully.",
            "execution": sanitize_doc(doc)
        }), 200

    # Must be in APPROVED status
    if doc.get("status") != "APPROVED":
        return jsonify({
            "error": "Approval Required",
            "message": f"Cannot execute action with status '{doc.get('status')}'. Action must be APPROVED first."
        }), 400

    # Guardrails validation
    passed, err_msg, guard_meta = validate_guardrails_for_execution(
        user_id=user_id,
        action_type=doc.get("action_type", "PAYMENT_LINK"),
        amount=doc.get("amount", 0),
        currency=doc.get("currency", "INR"),
        current_status="APPROVED",
        execution_doc=doc
    )
    if not passed:
        return jsonify({"error": "Guardrail Violation", "message": err_msg}), 400

    # Transition atomically to EXECUTING
    now_iso = datetime.now(timezone.utc).isoformat()
    col.update_one({"_id": doc["_id"]}, {"$set": {"status": "EXECUTING", "updated_at": now_iso}})

    action_type = doc.get("action_type", "PAYMENT_LINK")
    amount = float(doc.get("amount", 0))
    currency = doc.get("currency", "INR")
    meta = doc.get("metadata") or {}

    rzp_result = None
    if action_type == "PAYMENT_LINK":
        rzp_result = razorpay_service.create_payment_link(
            amount_inr=amount,
            description=doc.get("description", "Counterfactual settlement payment link"),
            reference_id=execution_id,
            customer_name=meta.get("customer_name"),
            customer_email=meta.get("customer_email"),
            customer_contact=meta.get("customer_contact"),
            currency=currency,
            notes={"execution_id": execution_id, "user_id": user_id, "simulation_id": doc.get("simulation_id", "")}
        )
    elif action_type == "REFUND":
        payment_id = meta.get("payment_id") or doc.get("target_transaction_id") or ""
        rzp_result = razorpay_service.create_refund(
            payment_id=payment_id,
            amount_inr=amount,
            notes={"execution_id": execution_id, "user_id": user_id},
            receipt=f"rcpt_{execution_id}"
        )
    elif action_type == "INVOICE":
        rzp_result = razorpay_service.create_invoice(
            customer_name=meta.get("customer_name") or "Merchant Customer",
            customer_email=meta.get("customer_email") or "finance@merchant.io",
            line_items=[{
                "name": doc.get("description", "Counterfactual Settlement Invoice"),
                "amount": int(round(amount * 100)),
                "currency": currency,
                "quantity": 1
            }],
            notes={"execution_id": execution_id}
        )
    else:
        rzp_result = {"success": False, "error_code": "UNSUPPORTED_ACTION", "error_message": f"Unsupported action {action_type}"}

    executed_iso = datetime.now(timezone.utc).isoformat()

    if rzp_result and rzp_result.get("success"):
        update_fields = {
            "status": "EXECUTED",
            "executed_at": executed_iso,
            "razorpay_id": rzp_result.get("razorpay_id") or rzp_result.get("refund_id"),
            "razorpay_reference": rzp_result.get("payment_id") or rzp_result.get("reference_id"),
            "short_url": rzp_result.get("short_url"),
            "error_code": None,
            "error_message": None,
            "updated_at": executed_iso,
        }
        col.update_one({"_id": doc["_id"]}, {"$set": update_fields})
        doc.update(update_fields)

        log_audit_event(
            user_id=user_id,
            action="EXECUTION_SUCCESSFUL",
            transaction_id=doc.get("target_transaction_id"),
            metadata={
                "execution_id": execution_id,
                "action_type": action_type,
                "amount": amount,
                "razorpay_id": doc.get("razorpay_id")
            }
        )

        return jsonify({
            "success": True,
            "executionId": execution_id,
            "status": "EXECUTED",
            "razorpayId": doc.get("razorpay_id"),
            "shortUrl": doc.get("short_url"),
            "execution": sanitize_doc(doc)
        }), 200
    else:
        err_code = rzp_result.get("error_code") if rzp_result else "UNKNOWN_ERROR"
        err_msg = rzp_result.get("error_message") if rzp_result else "Execution failed with Razorpay."
        update_fields = {
            "status": "FAILED",
            "error_code": err_code,
            "error_message": err_msg,
            "updated_at": executed_iso,
        }
        col.update_one({"_id": doc["_id"]}, {"$set": update_fields})
        doc.update(update_fields)

        log_audit_event(
            user_id=user_id,
            action="EXECUTION_FAILED",
            transaction_id=doc.get("target_transaction_id"),
            metadata={"execution_id": execution_id, "error_code": err_code, "error_message": err_msg}
        )

        return jsonify({
            "success": False,
            "executionId": execution_id,
            "status": "FAILED",
            "errorCode": err_code,
            "errorMessage": err_msg,
            "execution": sanitize_doc(doc)
        }), 400


# ====================================================================
# 6. DIRECT PAYMENT LINK EXECUTION (TASK 6.2)
# ====================================================================

@execution_bp.route("/payment-link", methods=["POST"])
@require_auth
def execute_direct_payment_link():
    """
    Phase 6.2: Direct endpoint to create a Razorpay Payment Link in Sandbox mode.
    Follows: Authenticate -> Guardrails -> Validation -> Razorpay Call -> Persist Audit -> Return Safe Response.
    """
    user_id = g.user_id
    data = request.get_json(silent=True) or {}

    raw_amount = data.get("amount")
    if raw_amount is None:
        return jsonify({"error": "Missing Amount", "message": "Field 'amount' is required."}), 400

    amt_ok, amount, amt_err = validate_amount(raw_amount)
    if not amt_ok:
        return jsonify({"error": "Invalid Amount", "message": amt_err}), 400

    currency = str(data.get("currency", "INR")).strip().upper()
    curr_ok, curr_err = validate_currency(currency)
    if not curr_ok:
        return jsonify({"error": "Invalid Currency", "message": curr_err}), 400

    raw_description = data.get("description")
    if raw_description is None or not str(raw_description).strip():
        return jsonify({"error": "Missing Description", "message": "Field 'description' is required."}), 400
    description = str(raw_description).strip()

    simulation_id = str(data.get("simulationId") or data.get("simulation_id") or "").strip()
    recommendation_id = str(data.get("recommendationId") or data.get("recommendation_id") or "").strip()

    # Verify simulation ownership if simulationId is provided
    if simulation_id:
        try:
            sim_col = get_simulations_collection()
            sim_doc = sim_col.find_one({"id": simulation_id}) or sim_col.find_one({"_id": simulation_id})
            if sim_doc and str(sim_doc.get("user_id")) != str(user_id):
                return jsonify({
                    "error": "Forbidden",
                    "message": "You do not own the simulation associated with this execution."
                }), 403
        except Exception:
            pass

    # Guardrails check
    passed, err_msg, _ = validate_guardrails_for_execution(
        user_id=user_id,
        action_type="PAYMENT_LINK",
        amount=amount,
        currency=currency
    )
    if not passed:
        return jsonify({"error": "Guardrail Violation", "message": err_msg}), 400

    # Check for duplicate idempotency
    idemp_key = compute_idempotency_key(
        tenant_id=user_id,
        action_type="CREATE_PAYMENT_LINK",
        amount=amount,
        simulation_id=simulation_id,
        recommendation_id=recommendation_id,
        custom_key=data.get("idempotencyKey") or data.get("idempotency_key")
    )

    try:
        col = get_executions_collection()
        existing_dup = col.find_one({"idempotency_key": idemp_key, "user_id": user_id, "status": "EXECUTED"})
        if existing_dup:
            return jsonify({
                "success": True,
                "executionId": str(existing_dup.get("execution_id") or existing_dup.get("id")),
                "status": "EXECUTED",
                "razorpayId": existing_dup.get("razorpay_id"),
                "shortUrl": existing_dup.get("short_url"),
                "idempotent": True
            }), 200
    except Exception:
        pass

    exec_id = f"exec_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    # Call Razorpay Sandbox
    rzp_res = razorpay_service.create_payment_link(
        amount_inr=amount,
        description=description,
        reference_id=exec_id,
        customer_name=data.get("customerName") or data.get("customer_name"),
        customer_email=data.get("customerEmail") or data.get("customer_email"),
        customer_contact=data.get("customerContact") or data.get("customer_contact"),
        currency=currency,
        notes={"simulation_id": simulation_id, "recommendation_id": recommendation_id, "user_id": user_id}
    )

    status = "EXECUTED" if rzp_res.get("success") else "FAILED"
    execution_doc = {
        "execution_id": exec_id,
        "id": exec_id,
        "user_id": user_id,
        "tenant_id": user_id,
        "simulation_id": simulation_id,
        "recommendation_id": recommendation_id or f"rec_{uuid.uuid4().hex[:8]}",
        "action_type": "CREATE_PAYMENT_LINK",
        "amount": amount,
        "currency": currency,
        "status": status,
        "description": description,
        "idempotency_key": idemp_key,
        "requested_at": now_iso,
        "created_at": now_iso,
        "approved_at": now_iso,
        "approved_by": user_id,
        "executed_at": now_iso if status == "EXECUTED" else None,
        "razorpay_id": rzp_res.get("razorpay_id"),
        "razorpay_reference": rzp_res.get("reference_id"),
        "short_url": rzp_res.get("short_url"),
        "error_code": rzp_res.get("error_code"),
        "error_message": rzp_res.get("error_message"),
        "metadata": {
            "customer_name": data.get("customerName") or data.get("customer_name", ""),
            "customer_email": data.get("customerEmail") or data.get("customer_email", ""),
        }
    }

    try:
        col = get_executions_collection()
        col.insert_one(execution_doc)
    except Exception:
        pass

    log_audit_event(
        user_id=user_id,
        action="PAYMENT_LINK_EXECUTED" if status == "EXECUTED" else "PAYMENT_LINK_FAILED",
        metadata={"execution_id": exec_id, "amount": amount, "status": status}
    )

    if status == "EXECUTED":
        return jsonify({
            "success": True,
            "executionId": exec_id,
            "status": "EXECUTED",
            "razorpayId": rzp_res.get("razorpay_id"),
            "shortUrl": rzp_res.get("short_url")
        }), 201
    else:
        return jsonify({
            "success": False,
            "executionId": exec_id,
            "status": "FAILED",
            "errorCode": rzp_res.get("error_code"),
            "errorMessage": rzp_res.get("error_message")
        }), 400


# ====================================================================
# ====================================================================
# 7. REFUND EXECUTION (TASK 6.3)
# ====================================================================

@execution_bp.route("/refund", methods=["POST"])
@require_auth
def execute_direct_refund():
    """
    Phase 6.3: Direct endpoint to issue a full or partial refund via Razorpay Sandbox.
    Follows: Authenticate -> Guardrails -> Validation -> Razorpay Call -> Persist Audit -> Return Safe Response.
    """
    user_id = g.user_id
    data = request.get_json(silent=True) or {}

    payment_id = str(data.get("paymentId") or data.get("payment_id") or "").strip()
    if not payment_id:
        return jsonify({"error": "Missing Payment ID", "message": "Field 'paymentId' is required for issuing refunds."}), 400

    raw_amount = data.get("amount")
    if raw_amount is None:
        return jsonify({"error": "Missing Amount", "message": "Field 'amount' is required."}), 400

    amt_ok, amount, amt_err = validate_amount(raw_amount)
    if not amt_ok:
        return jsonify({"error": "Invalid Amount", "message": amt_err}), 400

    currency = str(data.get("currency", "INR")).strip().upper()
    curr_ok, curr_err = validate_currency(currency)
    if not curr_ok:
        return jsonify({"error": "Invalid Currency", "message": curr_err}), 400

    simulation_id = str(data.get("simulationId") or data.get("simulation_id") or "").strip()
    recommendation_id = str(data.get("recommendationId") or data.get("recommendation_id") or "").strip()
    notes_in = data.get("notes") or {}

    # Verify simulation ownership if simulationId is provided
    if simulation_id:
        try:
            sim_col = get_simulations_collection()
            sim_doc = sim_col.find_one({"id": simulation_id}) or sim_col.find_one({"_id": simulation_id})
            if sim_doc and str(sim_doc.get("user_id")) != str(user_id):
                return jsonify({
                    "error": "Forbidden",
                    "message": "You do not own the simulation associated with this execution."
                }), 403
        except Exception:
            pass

    # Optional refundable upper bound check against transaction record
    target_gross = None
    tx_id = str(data.get("transactionId") or data.get("transaction_id") or "").strip()
    if tx_id or payment_id:
        try:
            from database import get_transactions_collection
            tx_col = get_transactions_collection()
            q = {"transaction_id": tx_id} if tx_id else {"payment_id": payment_id}
            tx_doc = tx_col.find_one(q)
            if tx_doc:
                target_gross = float(tx_doc.get("gross_amount") or tx_doc.get("amount") or tx_doc.get("expected_settlement") or 0)
        except Exception:
            pass

    # Guardrails validation
    passed, err_msg, _ = validate_guardrails_for_execution(
        user_id=user_id,
        action_type="REFUND",
        amount=amount,
        currency=currency,
        payment_gross_amount=target_gross
    )
    if not passed:
        return jsonify({"error": "Guardrail Violation", "message": err_msg}), 400

    # Deduplication idempotency check
    idemp_key = compute_idempotency_key(
        tenant_id=user_id,
        action_type="REFUND",
        amount=amount,
        simulation_id=simulation_id,
        recommendation_id=recommendation_id,
        payment_id=payment_id,
        custom_key=data.get("idempotencyKey") or data.get("idempotency_key")
    )

    try:
        col = get_executions_collection()
        existing_dup = col.find_one({"idempotency_key": idemp_key, "user_id": user_id, "status": "EXECUTED"})
        if existing_dup:
            return jsonify({
                "success": True,
                "executionId": str(existing_dup.get("execution_id") or existing_dup.get("id")),
                "status": "EXECUTED",
                "refundId": existing_dup.get("razorpay_id"),
                "paymentId": existing_dup.get("razorpay_reference") or payment_id,
                "amount": float(existing_dup.get("amount", amount)),
                "currency": currency,
                "actionType": "REFUND",
                "message": "This refund has already been executed successfully.",
                "idempotent": True,
                "execution": sanitize_doc(existing_dup)
            }), 200
    except Exception:
        pass

    exec_id = f"exec_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    # Call Razorpay Sandbox
    rzp_res = razorpay_service.create_refund(
        payment_id=payment_id,
        amount_inr=amount,
        notes=notes_in,
        receipt=f"rcpt_{exec_id}"
    )

    status = "EXECUTED" if rzp_res.get("success") else "FAILED"
    execution_doc = {
        "execution_id": exec_id,
        "id": exec_id,
        "user_id": user_id,
        "tenant_id": user_id,
        "simulation_id": simulation_id,
        "recommendation_id": recommendation_id or f"rec_{uuid.uuid4().hex[:8]}",
        "action_type": "REFUND",
        "amount": amount,
        "currency": currency,
        "status": status,
        "description": f"Partial/Full refund for payment {payment_id}",
        "idempotency_key": idemp_key,
        "requested_at": now_iso,
        "created_at": now_iso,
        "approved_at": now_iso,
        "approved_by": user_id,
        "executed_at": now_iso if status == "EXECUTED" else None,
        "razorpay_id": rzp_res.get("razorpay_id") or rzp_res.get("refund_id") or rzp_res.get("id"),
        "razorpay_reference": payment_id,
        "short_url": None,
        "error_code": rzp_res.get("error_code"),
        "error_message": rzp_res.get("error_message"),
        "metadata": {
            "payment_id": payment_id,
            "receipt": rzp_res.get("receipt"),
            "refund_type": "FULL" if target_gross and amount >= target_gross else "PARTIAL",
            "notes": notes_in
        }
    }

    try:
        col = get_executions_collection()
        col.insert_one(execution_doc)
    except Exception:
        pass

    log_audit_event(
        user_id=user_id,
        action="REFUND_EXECUTED" if status == "EXECUTED" else "REFUND_FAILED",
        transaction_id=payment_id,
        metadata={"execution_id": exec_id, "amount": amount, "status": status}
    )

    if status == "EXECUTED":
        return jsonify({
            "success": True,
            "status": "EXECUTED",
            "executionId": exec_id,
            "refundId": rzp_res.get("razorpay_id") or rzp_res.get("refund_id") or rzp_res.get("id"),
            "paymentId": payment_id,
            "amount": amount,
            "currency": currency,
            "actionType": "REFUND",
            "message": "Refund executed successfully via Razorpay Sandbox.",
            "execution": sanitize_doc(execution_doc)
        }), 201
    else:
        return jsonify({
            "success": False,
            "status": "FAILED",
            "executionId": exec_id,
            "errorCode": rzp_res.get("error_code"),
            "errorMessage": rzp_res.get("error_message"),
            "execution": sanitize_doc(execution_doc)
        }), 400


# ====================================================================
# 8. INVOICE EXECUTION (TASK 6.4)
# ====================================================================

@execution_bp.route("/invoice", methods=["POST"])
@require_auth
def execute_direct_invoice():
    """
    Phase 6.4: Direct endpoint to create a Razorpay Sandbox Invoice.
    Follows: Authenticate -> Guardrails -> Validation -> Razorpay Call -> Persist Audit -> Return Safe Response.
    """
    user_id = g.user_id
    data = request.get_json(silent=True) or {}

    raw_amount = data.get("amount")
    if raw_amount is None:
        return jsonify({"error": "Missing Amount", "message": "Field 'amount' is required."}), 400

    amt_ok, amount, amt_err = validate_amount(raw_amount)
    if not amt_ok:
        return jsonify({"error": "Invalid Amount", "message": amt_err}), 400

    currency = str(data.get("currency", "INR")).strip().upper()
    curr_ok, curr_err = validate_currency(currency)
    if not curr_ok:
        return jsonify({"error": "Invalid Currency", "message": curr_err}), 400

    customer_name = str(data.get("customerName") or data.get("customer_name") or "").strip()
    customer_email = str(data.get("customerEmail") or data.get("customer_email") or "").strip()
    customer_contact = str(data.get("customerContact") or data.get("customer_contact") or "").strip()
    description = str(data.get("description", "Counterfactual Settlement Invoice")).strip()

    if not customer_name:
        return jsonify({"error": "Missing Customer Name", "message": "Field 'customerName' is required."}), 400

    if not customer_email or "@" not in customer_email or "." not in customer_email:
        return jsonify({"error": "Invalid Customer Email", "message": "Valid 'customerEmail' is required."}), 400

    simulation_id = str(data.get("simulationId") or data.get("simulation_id") or "").strip()
    recommendation_id = str(data.get("recommendationId") or data.get("recommendation_id") or "").strip()

    # Verify simulation ownership if simulationId is provided
    if simulation_id:
        try:
            sim_col = get_simulations_collection()
            sim_doc = sim_col.find_one({"id": simulation_id}) or sim_col.find_one({"_id": simulation_id})
            if sim_doc and str(sim_doc.get("user_id")) != str(user_id):
                return jsonify({
                    "error": "Forbidden",
                    "message": "You do not own the simulation associated with this execution."
                }), 403
        except Exception:
            pass

    passed, err_msg, _ = validate_guardrails_for_execution(
        user_id=user_id,
        action_type="INVOICE",
        amount=amount,
        currency=currency
    )
    if not passed:
        return jsonify({"error": "Guardrail Violation", "message": err_msg}), 400

    # Deduplication idempotency check
    idemp_key = compute_idempotency_key(
        tenant_id=user_id,
        action_type="INVOICE",
        amount=amount,
        simulation_id=simulation_id,
        recommendation_id=recommendation_id,
        custom_key=data.get("idempotencyKey") or data.get("idempotency_key")
    )

    try:
        col = get_executions_collection()
        existing_dup = col.find_one({"idempotency_key": idemp_key, "user_id": user_id, "status": "EXECUTED"})
        if existing_dup:
            return jsonify({
                "success": True,
                "executionId": str(existing_dup.get("execution_id") or existing_dup.get("id")),
                "status": "EXECUTED",
                "invoiceId": existing_dup.get("razorpay_id"),
                "amount": float(existing_dup.get("amount", amount)),
                "currency": currency,
                "actionType": "INVOICE",
                "invoiceUrl": existing_dup.get("short_url"),
                "message": "This invoice has already been created successfully.",
                "idempotent": True,
                "execution": sanitize_doc(existing_dup)
            }), 200
    except Exception:
        pass

    line_items = data.get("lineItems") or data.get("line_items") or [{
        "name": description or "Counterfactual Settlement Invoice",
        "amount": int(round(amount * 100)),
        "currency": currency,
        "quantity": 1
    }]

    rzp_res = razorpay_service.create_invoice(
        customer_name=customer_name,
        customer_email=customer_email,
        line_items=line_items,
        description=description,
        currency=currency
    )

    exec_id = f"exec_{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    status = "EXECUTED" if rzp_res.get("success") else "FAILED"

    execution_doc = {
        "execution_id": exec_id,
        "id": exec_id,
        "user_id": user_id,
        "tenant_id": user_id,
        "simulation_id": simulation_id,
        "recommendation_id": recommendation_id or f"rec_{uuid.uuid4().hex[:8]}",
        "action_type": "INVOICE",
        "amount": amount,
        "currency": currency,
        "status": status,
        "description": description,
        "idempotency_key": idemp_key,
        "requested_at": now_iso,
        "created_at": now_iso,
        "approved_at": now_iso,
        "approved_by": user_id,
        "executed_at": now_iso if status == "EXECUTED" else None,
        "razorpay_id": rzp_res.get("razorpay_id") or rzp_res.get("invoice_id") or rzp_res.get("id"),
        "razorpay_reference": rzp_res.get("invoice_number"),
        "short_url": rzp_res.get("short_url"),
        "error_code": rzp_res.get("error_code"),
        "error_message": rzp_res.get("error_message"),
        "metadata": {
            "customer_name": customer_name,
            "customer_email": customer_email,
            "customer_contact": customer_contact,
            "invoice_number": rzp_res.get("invoice_number"),
        }
    }

    try:
        col = get_executions_collection()
        col.insert_one(execution_doc)
    except Exception:
        pass

    log_audit_event(
        user_id=user_id,
        action="INVOICE_EXECUTED" if status == "EXECUTED" else "INVOICE_FAILED",
        metadata={"execution_id": exec_id, "amount": amount, "status": status}
    )

    if status == "EXECUTED":
        return jsonify({
            "success": True,
            "status": "EXECUTED",
            "executionId": exec_id,
            "invoiceId": rzp_res.get("razorpay_id") or rzp_res.get("invoice_id") or rzp_res.get("id"),
            "amount": amount,
            "currency": currency,
            "actionType": "INVOICE",
            "invoiceUrl": rzp_res.get("short_url"),
            "message": "Invoice created successfully via Razorpay Sandbox.",
            "execution": sanitize_doc(execution_doc)
        }), 201
    else:
        return jsonify({
            "success": False,
            "status": "FAILED",
            "executionId": exec_id,
            "errorCode": rzp_res.get("error_code"),
            "errorMessage": rzp_res.get("error_message"),
            "execution": sanitize_doc(execution_doc)
        }), 400


# ====================================================================
# 9. EXECUTION AUDIT HISTORY (TASK 6.11)
# ====================================================================

@execution_bp.route("/history", methods=["GET"])
@require_auth
def get_execution_history():
    """
    Returns user-isolated execution records.
    Supports filtering by status (EXECUTED, FAILED, PENDING_APPROVAL, APPROVED, REJECTED).
    """
    user_id = g.user_id
    status_filter = request.args.get("status", "").strip().upper()
    action_filter = request.args.get("action_type", "").strip().upper()

    query = {"user_id": user_id}
    if status_filter and status_filter != "ALL":
        query["status"] = status_filter
    if action_filter and action_filter != "ALL":
        query["action_type"] = action_filter

    try:
        col = get_executions_collection()
        records = list(col.find(query).sort("requested_at", -1).limit(100))
    except (ConnectionError, PyMongoError):
        return jsonify({"error": "Database Connection Failed", "message": "Unable to query MongoDB Atlas."}), 503

    sanitized = sanitize_doc(records)
    return jsonify({
        "executions": sanitized,
        "count": len(sanitized)
    }), 200


@execution_bp.route("/<execution_id>", methods=["GET"])
@require_auth
def get_execution_by_id(execution_id):
    """
    Returns a single execution record with strict tenant isolation.
    """
    user_id = g.user_id
    try:
        col = get_executions_collection()
        doc = col.find_one({"execution_id": execution_id, "user_id": user_id}) or col.find_one({"id": execution_id, "user_id": user_id})
    except (ConnectionError, PyMongoError):
        return jsonify({"error": "Database Connection Failed", "message": "Unable to query MongoDB Atlas."}), 503

    if not doc:
        return jsonify({"error": "Not Found", "message": "Execution record not found or access denied."}), 404

    return jsonify({"execution": sanitize_doc(doc)}), 200
