"""
Deterministic Financial Guardrails Engine
Enforces strict pre-execution mathematical and policy validations before any Razorpay Sandbox call.
Ensures the LLM cannot directly trigger financial operations or bypass approval gates.
"""

import hashlib
import json
import math
from typing import Dict, Any, Tuple, Optional
import razorpay_service

# Financial policy constants
SUPPORTED_CURRENCIES = {"INR"}
MAX_STANDARD_TRANSACTION_LIMIT = 50000.00  # Standard automated limit (₹50,000)
MAX_HARD_TRANSACTION_CAP = 500000.00       # Absolute hard limit (₹500,000)
VALID_ACTION_TYPES = {"PAYMENT_LINK", "REFUND", "INVOICE"}

# State machine valid transitions
VALID_STATE_TRANSITIONS = {
    "RECOMMENDED": {"PENDING_APPROVAL", "REJECTED"},
    "PENDING_APPROVAL": {"APPROVED", "REJECTED"},
    "APPROVED": {"EXECUTING", "REJECTED"},
    "EXECUTING": {"EXECUTED", "FAILED"},
    "FAILED": {"PENDING_APPROVAL", "REJECTED"},  # Allow retry staging
    "EXECUTED": set(),  # Terminal state
    "REJECTED": set(),  # Terminal state
}


def compute_idempotency_key(
    tenant_id: str,
    action_type: str,
    amount: float,
    simulation_id: Optional[str] = None,
    recommendation_id: Optional[str] = None,
    payment_id: Optional[str] = None,
    custom_key: Optional[str] = None
) -> str:
    """Computes a deterministic SHA-256 hash for idempotency deduplication."""
    if custom_key and str(custom_key).strip():
        return f"idemp_{hashlib.sha256(str(custom_key).strip().encode()).hexdigest()[:24]}"

    seed = f"{tenant_id}:{action_type}:{amount:.2f}:{simulation_id or ''}:{recommendation_id or ''}:{payment_id or ''}"
    return f"idemp_{hashlib.sha256(seed.encode()).hexdigest()[:24]}"


def validate_amount(amount: Any) -> Tuple[bool, Optional[float], Optional[str]]:
    """Validates that amount is a positive, non-zero, finite numerical value."""
    try:
        val = float(amount)
    except (ValueError, TypeError):
        return False, None, "Amount must be a valid numerical value."

    if math.isnan(val) or math.isinf(val):
        return False, None, "Amount cannot be NaN or Infinity."

    if val <= 0:
        return False, None, "Amount must be greater than zero."

    if val > MAX_HARD_TRANSACTION_CAP:
        return False, None, f"Amount ₹{val:,.2f} exceeds maximum system ceiling of ₹{MAX_HARD_TRANSACTION_CAP:,.2f}."

    return True, round(val, 2), None


def validate_currency(currency: str) -> Tuple[bool, Optional[str]]:
    """Validates currency is supported."""
    curr = str(currency or "INR").strip().upper()
    if curr not in SUPPORTED_CURRENCIES:
        return False, f"Currency '{curr}' is not supported. Supported currencies: {', '.join(SUPPORTED_CURRENCIES)}."
    return True, None


def validate_action_type(action_type: str) -> Tuple[bool, Optional[str]]:
    """Validates execution action type."""
    action = str(action_type or "").strip().upper()
    if action not in VALID_ACTION_TYPES:
        return False, f"Action type '{action}' is invalid. Supported: {', '.join(sorted(VALID_ACTION_TYPES))}."
    return True, None


def validate_state_transition(current_status: str, target_status: str) -> Tuple[bool, Optional[str]]:
    """Enforces deterministic state machine transition rules."""
    curr = str(current_status or "").strip().upper()
    target = str(target_status or "").strip().upper()

    allowed = VALID_STATE_TRANSITIONS.get(curr, set())
    if target not in allowed:
        return False, f"Illegal state transition from '{curr}' to '{target}'."
    return True, None


def validate_guardrails_for_execution(
    user_id: str,
    action_type: str,
    amount: float,
    currency: str = "INR",
    current_status: Optional[str] = None,
    execution_doc: Optional[Dict[str, Any]] = None,
    payment_gross_amount: Optional[float] = None
) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """
    Comprehensive pre-execution guardrail evaluation.
    Returns: (passed: bool, error_message: str | None, metadata: dict)
    """
    metadata = {}

    # 1. User authentication verification
    if not user_id:
        return False, "Unauthorized: User identification is required for financial execution.", metadata

    # 2. Action type validation
    action_ok, action_err = validate_action_type(action_type)
    if not action_ok:
        return False, action_err, metadata

    # 3. Numerical amount validation
    amt_ok, validated_amt, amt_err = validate_amount(amount)
    if not amt_ok:
        return False, amt_err, metadata
    metadata["validated_amount"] = validated_amt

    # 4. Currency validation
    curr_ok, curr_err = validate_currency(currency)
    if not curr_ok:
        return False, curr_err, metadata

    # 5. Risk classification
    if validated_amt > MAX_STANDARD_TRANSACTION_LIMIT:
        metadata["risk_level"] = "HIGH"
        metadata["risk_warning"] = f"Amount ₹{validated_amt:,.2f} exceeds standard ₹{MAX_STANDARD_TRANSACTION_LIMIT:,.2f} threshold."
    elif validated_amt > 10000.0:
        metadata["risk_level"] = "MEDIUM"
    else:
        metadata["risk_level"] = "LOW"

    # 6. Refund specific bounds checking
    if action_type.upper() == "REFUND" and payment_gross_amount is not None:
        if validated_amt > payment_gross_amount:
            return False, f"Refund amount ₹{validated_amt:,.2f} cannot exceed original payment amount ₹{payment_gross_amount:,.2f}.", metadata

    # 7. State machine verification (if existing execution record is provided)
    if execution_doc:
        doc_user = execution_doc.get("user_id") or execution_doc.get("tenant_id")
        if doc_user and str(doc_user) != str(user_id):
            return False, "Tenant Isolation: You cannot access or execute an action belonging to another organization.", metadata

        status = execution_doc.get("status", "RECOMMENDED")
        if status == "EXECUTED":
            return False, "Idempotency Guard: This action has already been successfully executed.", metadata
        if status == "REJECTED":
            return False, "Policy Guard: Rejected actions cannot be executed.", metadata
        if current_status and status != current_status:
            return False, f"Execution status mismatch. Expected '{current_status}', found '{status}'.", metadata

    # 8. Razorpay configuration check
    if not razorpay_service.is_razorpay_configured():
        return False, "Razorpay Sandbox is not configured with active credentials.", metadata

    return True, None, metadata
