"""
Razorpay Sandbox Execution Module
Centralized, server-side Razorpay client service.
Safely executes Payment Links, Refunds, and Invoices using Sandbox credentials.
Never exposes secret keys to the frontend or logs.
"""

import os
import re
import logging
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Ensure environment variables are loaded
basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, "..", ".env"), override=False)
load_dotenv(os.path.join(basedir, ".env"), override=True)

logger = logging.getLogger("counterfactual.razorpay")

try:
    import razorpay
    import razorpay.errors as rzp_errors
    RAZORPAY_SDK_AVAILABLE = True
except ImportError:
    razorpay = None
    rzp_errors = None
    RAZORPAY_SDK_AVAILABLE = False


def _get_credentials():
    """Retrieves Razorpay credentials from environment without whitespace."""
    key_id = (os.getenv("RAZORPAY_KEY_ID") or "").strip()
    key_secret = (os.getenv("RAZORPAY_KEY_SECRET") or "").strip()
    return key_id, key_secret


def is_razorpay_configured() -> bool:
    """Returns True if valid Razorpay test credentials are set."""
    key_id, key_secret = _get_credentials()
    return bool(key_id and key_secret and RAZORPAY_SDK_AVAILABLE)


def get_razorpay_public_config() -> Dict[str, Any]:
    """
    Returns public diagnostic status of Razorpay sandbox without leaking secrets.
    """
    key_id, key_secret = _get_credentials()
    configured = bool(key_id and key_secret)
    masked_key = ""
    if key_id:
        if len(key_id) > 8:
            masked_key = key_id[:6] + "..." + key_id[-4:]
        else:
            masked_key = key_id[:3] + "..."

    return {
        "configured": configured,
        "mode": "test_sandbox" if key_id.startswith("rzp_test_") else "live" if configured else "unconfigured",
        "key_id_masked": masked_key,
        "sdk_available": RAZORPAY_SDK_AVAILABLE,
        "supported_actions": ["PAYMENT_LINK", "REFUND", "INVOICE"],
    }


def get_razorpay_client():
    """
    Initializes and returns an official Razorpay Client instance.
    Raises ValueError if credentials are missing or SDK is not installed.
    """
    if not RAZORPAY_SDK_AVAILABLE:
        raise RuntimeError("Razorpay Python SDK is not installed.")

    key_id, key_secret = _get_credentials()
    if not key_id or not key_secret:
        raise ValueError("Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured.")

    return razorpay.Client(auth=(key_id, key_secret))


def _sanitize_rzp_error(exc: Exception) -> Dict[str, str]:
    """Sanitizes Razorpay exceptions to safe merchant-friendly error codes and messages."""
    raw_msg = str(exc)
    # Strip any potential keys/passwords/auth tokens
    clean_msg = re.sub(r":([^:@/]+)@", ":****@", raw_msg)
    clean_msg = re.sub(r"(rzp_live_[A-Za-z0-9]+|rzp_test_[A-Za-z0-9]+)", "rzp_***", clean_msg)

    error_code = "RAZORPAY_API_ERROR"
    if "BadRequestError" in str(type(exc)) or "BAD_REQUEST" in raw_msg.upper():
        error_code = "BAD_REQUEST_ERROR"
    elif "GatewayError" in str(type(exc)) or "GATEWAY" in raw_msg.upper():
        error_code = "GATEWAY_TIMEOUT"
    elif "AuthenticationError" in str(type(exc)) or "unauthorized" in raw_msg.lower():
        error_code = "AUTHENTICATION_FAILED"
        clean_msg = "Razorpay authentication failed. Verify API Key ID and Secret."
    elif "SignatureVerificationError" in str(type(exc)):
        error_code = "SIGNATURE_VERIFICATION_FAILED"

    return {
        "error_code": error_code,
        "error_message": clean_msg[:240] if len(clean_msg) > 240 else clean_msg
    }


def create_payment_link(
    amount_inr: float,
    description: str = "Counterfactual settlement resolution",
    reference_id: Optional[str] = None,
    customer_name: Optional[str] = None,
    customer_email: Optional[str] = None,
    customer_contact: Optional[str] = None,
    notes: Optional[Dict[str, Any]] = None,
    currency: str = "INR"
) -> Dict[str, Any]:
    """
    Creates a Payment Link via Razorpay Sandbox API.
    Amount in INR is converted to Paise (amount * 100).
    """
    client = get_razorpay_client()
    amount_paise = int(round(amount_inr * 100))

    payload = {
        "amount": amount_paise,
        "currency": currency.upper(),
        "description": description[:250],
        "reminder_enable": False,
        "notes": notes or {},
    }

    if reference_id:
        payload["reference_id"] = str(reference_id)[:40]

    customer_info = {}
    if customer_name:
        customer_info["name"] = customer_name
    if customer_email:
        customer_info["email"] = customer_email
    if customer_contact:
        customer_info["contact"] = customer_contact
    if customer_info:
        payload["customer"] = customer_info

    try:
        response = client.payment_link.create(payload)
        return {
            "success": True,
            "razorpay_id": response.get("id"),
            "short_url": response.get("short_url"),
            "status": response.get("status", "created").upper(),
            "amount": amount_inr,
            "currency": currency.upper(),
            "reference_id": response.get("reference_id"),
            "raw_response": {
                "id": response.get("id"),
                "short_url": response.get("short_url"),
                "status": response.get("status"),
                "amount": response.get("amount"),
                "created_at": response.get("created_at"),
            }
        }
    except Exception as e:
        logger.error("Razorpay Payment Link creation failed: %s", str(e))
        err = _sanitize_rzp_error(e)
        return {
            "success": False,
            "error_code": err["error_code"],
            "error_message": err["error_message"]
        }


def create_refund(
    payment_id: str,
    amount_inr: float,
    notes: Optional[Dict[str, Any]] = None,
    speed: str = "normal",
    receipt: Optional[str] = None
) -> Dict[str, Any]:
    """
    Issues a full or partial refund for an existing captured payment.
    Amount in INR is converted to Paise (amount * 100).
    """
    client = get_razorpay_client()
    amount_paise = int(round(amount_inr * 100))

    payload = {
        "amount": amount_paise,
        "speed": speed,
        "notes": notes or {},
    }
    if receipt:
        payload["receipt"] = str(receipt)[:40]

    try:
        # Calls client.payment.refund(payment_id, payload)
        response = client.payment.refund(payment_id, payload)
        return {
            "success": True,
            "razorpay_id": response.get("id"),
            "payment_id": response.get("payment_id", payment_id),
            "amount": amount_inr,
            "currency": response.get("currency", "INR"),
            "status": response.get("status", "processed").upper(),
            "speed_processed": response.get("speed_processed"),
            "receipt": response.get("receipt"),
            "raw_response": {
                "id": response.get("id"),
                "payment_id": response.get("payment_id"),
                "amount": response.get("amount"),
                "status": response.get("status"),
                "created_at": response.get("created_at"),
            }
        }
    except Exception as e:
        logger.error("Razorpay refund execution failed: %s", str(e))
        err = _sanitize_rzp_error(e)
        return {
            "success": False,
            "error_code": err["error_code"],
            "error_message": err["error_message"]
        }


def create_invoice(
    customer_name: str,
    customer_email: str,
    line_items: list,
    description: str = "Counterfactual Settlement Invoice",
    currency: str = "INR",
    notes: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Creates an Invoice via Razorpay Invoice API.
    If the account permissions or configuration do not support Invoices,
    returns a clear, structured unsupported response without crashing.
    """
    if not is_razorpay_configured():
        return {
            "success": False,
            "error_code": "RAZORPAY_NOT_CONFIGURED",
            "error_message": "Razorpay sandbox credentials are not configured."
        }

    client = get_razorpay_client()
    payload = {
        "type": "invoice",
        "description": description[:200],
        "customer": {
            "name": customer_name,
            "email": customer_email,
        },
        "line_items": line_items,
        "currency": currency.upper(),
        "notes": notes or {},
    }

    try:
        response = client.invoice.create(payload)
        return {
            "success": True,
            "razorpay_id": response.get("id"),
            "invoice_number": response.get("invoice_number"),
            "short_url": response.get("short_url"),
            "status": response.get("status", "issued").upper(),
            "amount": response.get("amount", 0) / 100.0,
            "raw_response": {
                "id": response.get("id"),
                "invoice_number": response.get("invoice_number"),
                "short_url": response.get("short_url"),
                "status": response.get("status"),
            }
        }
    except Exception as e:
        logger.warning("Razorpay Invoice API operation notice: %s", str(e))
        err = _sanitize_rzp_error(e)
        return {
            "success": False,
            "error_code": err["error_code"],
            "error_message": err["error_message"]
        }
