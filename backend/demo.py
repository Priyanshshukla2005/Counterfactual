"""
Counterfactual Phase 10 — Demo Engineering Blueprint
Provides:
- Deterministic 20% Discount Primary Merchant Demo Scenario
- Interactive 8-Stage Lifecycle Telemetry:
  1. PREDICT -> 2. RECOMMEND -> 3. APPROVE -> 4. EXECUTE ->
  5. OBSERVE -> 6. COMPARE -> 7. EXPLAIN -> 8. LEARN
- Isolated Demo Fixtures (DEMO_TXN_001, DEMO_SIM_001, DEMO_EXEC_001, DEMO_OUT_001)
- Safe Reset Endpoint that cleans only demo records without corrupting user data
- Razorpay Sandbox Safety (Zero real financial movement)
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Dict, Any

from flask import Blueprint, request, jsonify, g
from bson import ObjectId

from auth import require_auth, log_audit_event
from database import (
    get_simulations_collection,
    get_executions_collection,
    get_outcomes_collection,
)
from counterfactual_engine import calculate_counterfactual
from monitoring import calculate_deviation, analyze_root_cause, build_outcome_record
import razorpay_service

demo_bp = Blueprint("demo", __name__, url_prefix="/api/demo")

# Primary Deterministic Demo Parameters
DEMO_TXN_ID = "DEMO_TXN_001"
DEMO_SIM_ID = "DEMO_SIM_001"
DEMO_EXEC_ID = "DEMO_EXEC_001"
DEMO_OUT_ID = "DEMO_OUT_001"
DEMO_GROSS_AMOUNT = 50000.0
DEMO_BASELINE_DISCOUNT_PCT = 5.0
DEMO_PROPOSED_DISCOUNT_PCT = 20.0
DEMO_GATEWAY_FEE_PCT = 1.8
DEMO_TAX_PCT = 18.0


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


def get_demo_simulation_data() -> Dict[str, Any]:
    """Generates the deterministic 20% discount simulation data using the core engine."""
    return calculate_counterfactual(
        gross_amount=DEMO_GROSS_AMOUNT,
        current_discount_pct=DEMO_BASELINE_DISCOUNT_PCT,
        new_discount_pct=DEMO_PROPOSED_DISCOUNT_PCT,
        fee_pct=DEMO_GATEWAY_FEE_PCT,
        tax_pct=DEMO_TAX_PCT,
        settlement_recovery_pct=100.0,
        settlement_timing_days=1,
        transaction_id=DEMO_TXN_ID
    )


# ====================================================================
# 1. GET DEMO SCENARIO DATA
# ====================================================================

@demo_bp.route("/scenario", methods=["GET"])
@require_auth
def get_demo_scenario():
    """
    GET /api/demo/scenario
    Returns the complete deterministic 8-stage demo story data.
    """
    sim_data = get_demo_simulation_data()

    predicted_payout = sim_data["counterfactual"]["merchant_payout"]
    actual_payout = predicted_payout - 250.0  # ₹38,812.00 (Minor variance of 0.64%)

    comp = calculate_deviation(predicted_payout, actual_payout)
    root = analyze_root_cause(
        transaction_id=DEMO_TXN_ID,
        predicted=predicted_payout,
        actual=actual_payout,
        deviation_pct=comp["deviation_percentage"],
        metadata={"exception_type": "FEE_MISMATCH", "order_id": "ORD_DEMO_9981"}
    )

    scenario_payload = {
        "story": {
            "hook_title": "Every merchant makes decisions with incomplete information.",
            "hook_subhead": "What if you could see the consequences before you acted?",
            "merchant_request": "I want to run a 20% discount this weekend.",
            "scenario_name": "Weekend Flash Sale 20% Commercial Discount",
            "transaction_id": DEMO_TXN_ID,
            "gross_amount": DEMO_GROSS_AMOUNT,
        },
        "simulation": sim_data,
        "stages": [
            {
                "stage_number": 1,
                "id": "PREDICT",
                "name": "Predict",
                "title": "Counterfactual Prediction",
                "description": "Evaluate current 5% baseline vs proposed 20% discount before modifying pricing.",
                "data": {
                    "gross_amount": DEMO_GROSS_AMOUNT,
                    "baseline_discount": sim_data["baseline"]["discount"],
                    "proposed_discount": sim_data["counterfactual"]["discount"],
                    "baseline_settlement": sim_data["baseline"]["merchant_payout"],
                    "predicted_settlement": sim_data["counterfactual"]["merchant_payout"],
                    "platform_revenue": sim_data["counterfactual"]["platform_revenue"],
                }
            },
            {
                "stage_number": 2,
                "id": "RECOMMEND",
                "name": "Recommend",
                "title": "Decision Guidance",
                "description": "System evaluates merchant trade-off and highlights ₹7,500 payout reduction.",
                "data": {
                    "decision_guidance": sim_data["decision_guidance"],
                    "guidance_type": sim_data["guidance_type"],
                    "merchant_delta": sim_data["deltas"]["merchant_delta"],
                    "platform_delta": sim_data["deltas"]["platform_delta"],
                    "action_type": "PAYMENT_LINK",
                    "action_amount": sim_data["counterfactual"]["merchant_payout"],
                }
            },
            {
                "stage_number": 3,
                "id": "APPROVE",
                "name": "Approve",
                "title": "Human Approval Gate",
                "description": "Action is staged as PENDING_APPROVAL. Operator reviews guardrails and decides.",
                "data": {
                    "status": "PENDING_APPROVAL",
                    "action_type": "PAYMENT_LINK",
                    "amount": sim_data["counterfactual"]["merchant_payout"],
                    "currency": "INR",
                    "risk": "Low (Bounds Verified)",
                }
            },
            {
                "stage_number": 4,
                "id": "EXECUTE",
                "name": "Execute",
                "title": "Razorpay Sandbox Execution",
                "description": "Action is dispatched securely through Razorpay Sandbox Test Mode.",
                "data": {
                    "mode": "RAZORPAY_SANDBOX (TEST MODE)",
                    "execution_id": DEMO_EXEC_ID,
                    "razorpay_id": "plink_demo_test_rzp20pct",
                    "status": "EXECUTED",
                    "amount": sim_data["counterfactual"]["merchant_payout"],
                    "short_url": "https://rzp.io/i/demo20pct",
                }
            },
            {
                "stage_number": 5,
                "id": "OBSERVE",
                "name": "Observe",
                "title": "Actual Financial Outcome",
                "description": "System ingests actual clearing settlement outcome side-by-side with prediction.",
                "data": {
                    "predicted_payout": predicted_payout,
                    "actual_payout": actual_payout,
                    "source": "RAZORPAY_SANDBOX / SETTLEMENT_LEDGER",
                    "observed_status": "EXECUTED",
                }
            },
            {
                "stage_number": 6,
                "id": "COMPARE",
                "name": "Compare",
                "title": "Prediction vs Actual Engine",
                "description": "Deterministic delta comparison, deviation %, and mathematical accuracy score.",
                "data": comp
            },
            {
                "stage_number": 7,
                "id": "EXPLAIN",
                "name": "Explain",
                "title": "Grounded Root Cause Diagnostic",
                "description": "Zero-hallucination explanation citing stored evidence and exact numbers.",
                "data": root
            },
            {
                "stage_number": 8,
                "id": "LEARN",
                "name": "Learn",
                "title": "Closed-Loop Historical Feedback",
                "description": "Past outcomes feed into continuous decision intelligence for future pricing policies.",
                "data": {
                    "recurring_pattern": "Commercial Discount Revenue Trade-off",
                    "historical_frequency": "94.2% Policy Adherence",
                    "guidance": "High commercial discounts (>15%) require automated merchant margin warnings."
                }
            }
        ]
    }

    return jsonify(scenario_payload), 200


# ====================================================================
# 2. INITIALIZE DEMO STATE IN DATABASE
# ====================================================================

@demo_bp.route("/initialize", methods=["POST"])
@require_auth
def initialize_demo():
    """
    POST /api/demo/initialize
    Seeds isolated demo documents into MongoDB collections for the authenticated user.
    """
    user_id = g.user_id
    now_iso = datetime.now(timezone.utc).isoformat()
    sim_data = get_demo_simulation_data()

    predicted_payout = sim_data["counterfactual"]["merchant_payout"]
    actual_payout = predicted_payout - 250.0

    try:
        # 1. Seed Simulation
        sim_col = get_simulations_collection()
        sim_doc = {
            "id": DEMO_SIM_ID,
            "name": f"Demo 20% Discount Scenario - {DEMO_TXN_ID}",
            "user_id": user_id,
            "transaction_id": DEMO_TXN_ID,
            "created_at": now_iso,
            "scenario": {
                "discount": DEMO_PROPOSED_DISCOUNT_PCT,
                "current_discount": DEMO_BASELINE_DISCOUNT_PCT,
                "gateway_fee": DEMO_GATEWAY_FEE_PCT,
            },
            "baseline": sim_data["baseline"],
            "counterfactual": sim_data["counterfactual"],
            "financial_delta": sim_data["deltas"],
            "recommendation": sim_data["decision_guidance"]
        }
        sim_col.update_one({"id": DEMO_SIM_ID, "user_id": user_id}, {"$set": sim_doc}, upsert=True)

        # 2. Seed Execution Record
        exec_col = get_executions_collection()
        exec_doc = {
            "execution_id": DEMO_EXEC_ID,
            "id": DEMO_EXEC_ID,
            "user_id": user_id,
            "tenant_id": user_id,
            "simulation_id": DEMO_SIM_ID,
            "target_transaction_id": DEMO_TXN_ID,
            "action_type": "PAYMENT_LINK",
            "amount": predicted_payout,
            "currency": "INR",
            "status": "EXECUTED",
            "description": "Demo 20% discount payment link execution",
            "requested_at": now_iso,
            "approved_at": now_iso,
            "approved_by": user_id,
            "executed_at": now_iso,
            "razorpay_id": "plink_demo_test_rzp20pct",
            "short_url": "https://rzp.io/i/demo20pct",
            "metadata": {"demo": True}
        }
        exec_col.update_one({"execution_id": DEMO_EXEC_ID, "user_id": user_id}, {"$set": exec_doc}, upsert=True)

        # 3. Seed Outcome Record
        out_col = get_outcomes_collection()
        out_doc = build_outcome_record(
            user_id=user_id,
            transaction_id=DEMO_TXN_ID,
            predicted_amount=predicted_payout,
            actual_amount=actual_payout,
            simulation_id=DEMO_SIM_ID,
            execution_id=DEMO_EXEC_ID,
            razorpay_id="plink_demo_test_rzp20pct",
            action_type="PAYMENT_LINK",
            observed_status="EXECUTED",
            source="RAZORPAY_SANDBOX",
            metadata={"demo": True, "exception_type": "COMMERCIAL_DISCOUNT"}
        )
        out_doc["outcome_id"] = DEMO_OUT_ID
        out_doc["id"] = DEMO_OUT_ID
        out_col.update_one({"outcome_id": DEMO_OUT_ID, "user_id": user_id}, {"$set": out_doc}, upsert=True)

        log_audit_event(
            user_id=user_id,
            action="DEMO_INITIALIZED",
            transaction_id=DEMO_TXN_ID,
            metadata={"scenario": "20% Discount Flash Sale"}
        )

        return jsonify({
            "success": True,
            "message": "Demo scenario initialized successfully with isolated fixtures.",
            "demo_ids": {
                "transaction_id": DEMO_TXN_ID,
                "simulation_id": DEMO_SIM_ID,
                "execution_id": DEMO_EXEC_ID,
                "outcome_id": DEMO_OUT_ID
            }
        }), 200
    except Exception as e:
        return jsonify({"error": "Initialization Failed", "message": str(e)}), 500


# ====================================================================
# 3. SAFE DEMO RESET (CLEANS ONLY DEMO RECORDS)
# ====================================================================

@demo_bp.route("/reset", methods=["POST"])
@require_auth
def reset_demo():
    """
    POST /api/demo/reset
    Cleans only DEMO_* records for the authenticated session, returning to initial state.
    Guarantees no real user data is modified or deleted.
    """
    user_id = g.user_id

    try:
        sim_col = get_simulations_collection()
        exec_col = get_executions_collection()
        out_col = get_outcomes_collection()

        sim_del = sim_col.delete_many({"user_id": user_id, "$or": [{"id": {"$regex": "^DEMO_"}}, {"transaction_id": {"$regex": "^DEMO_"}}]})
        exec_del = exec_col.delete_many({"user_id": user_id, "$or": [{"execution_id": {"$regex": "^DEMO_"}}, {"target_transaction_id": {"$regex": "^DEMO_"}}]})
        out_del = out_col.delete_many({"user_id": user_id, "$or": [{"outcome_id": {"$regex": "^DEMO_"}}, {"transaction_id": {"$regex": "^DEMO_"}}]})

        log_audit_event(
            user_id=user_id,
            action="DEMO_RESET",
            transaction_id=DEMO_TXN_ID,
            metadata={"cleaned_simulations": sim_del.deleted_count, "cleaned_executions": exec_del.deleted_count}
        )

        return jsonify({
            "success": True,
            "message": "Demo state reset cleanly to initial baseline.",
            "cleaned_records": {
                "simulations": sim_del.deleted_count,
                "executions": exec_del.deleted_count,
                "outcomes": out_del.deleted_count
            }
        }), 200
    except Exception as e:
        return jsonify({"error": "Reset Failed", "message": str(e)}), 500
