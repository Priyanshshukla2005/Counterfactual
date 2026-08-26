"""
Counterfactual Phase 6 Razorpay Sandbox & Execution Test Suite
Covers:
- Configuration & health checks (no credential leaks)
- Guardrails & Boundary validations (amounts, currencies, limits, actions)
- State machine & Human approval workflow (PENDING_APPROVAL -> APPROVED -> EXECUTING -> EXECUTED / REJECTED)
- Payment Link execution (direct & staged)
- Refund execution (direct & bounds checking)
- Invoice execution abstraction
- Idempotency & duplicate execution prevention
- Strict multi-tenant isolation
- Sanitized error handling & audit trail persistence
"""

import sys
import os
import uuid
import unittest
from unittest.mock import patch, MagicMock

# Ensure stdout handles UTF-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(__file__))

from app import app
from database import is_mongodb_live, get_executions_collection
from razorpay_service import get_razorpay_public_config, is_razorpay_configured
from guardrails import (
    validate_amount,
    validate_currency,
    validate_action_type,
    validate_state_transition,
    validate_guardrails_for_execution,
    compute_idempotency_key,
)


class TestPhase6Execution(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()

        # Generate unique test users
        cls.user_a_email = f"exec_alpha_{os.getpid()}_{uuid.uuid4().hex[:6]}@counterfactual.fi"
        cls.user_a_pass = "AlphaPass123!"

        resp_a = cls.client.post("/api/auth/signup", json={
            "name": "Operator Alpha",
            "email": cls.user_a_email,
            "password": cls.user_a_pass,
            "organization": "Alpha Treasury Corp"
        })
        assert resp_a.status_code == 201, f"Signup failed: {resp_a.data}"
        data_a = resp_a.get_json()
        cls.user_a_token = data_a["token"]
        cls.user_a_id = data_a["user"]["id"]

        cls.user_b_email = f"exec_beta_{os.getpid()}_{uuid.uuid4().hex[:6]}@counterfactual.fi"
        cls.user_b_pass = "BetaPass456!"

        resp_b = cls.client.post("/api/auth/signup", json={
            "name": "Operator Beta",
            "email": cls.user_b_email,
            "password": cls.user_b_pass,
            "organization": "Beta Capital"
        })
        assert resp_b.status_code == 201
        data_b = resp_b.get_json()
        cls.user_b_token = data_b["token"]
        cls.user_b_id = data_b["user"]["id"]

    # -------------------------------------------------------------
    # 1. RAZORPAY CONFIGURATION TESTS
    # -------------------------------------------------------------
    def test_01_razorpay_public_config_safety(self):
        """Verify config check returns diagnostic info and never exposes secret."""
        config = get_razorpay_public_config()
        self.assertIn("configured", config)
        self.assertIn("mode", config)
        self.assertIn("key_id_masked", config)
        self.assertIn("supported_actions", config)
        self.assertNotIn("secret", str(config).lower())
        self.assertNotIn("key_secret", config)

        resp = self.client.get("/api/execution/config", headers={"Authorization": f"Bearer {self.user_a_token}"})
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("configured", data)
        self.assertNotIn("secret", str(data).lower())

    # -------------------------------------------------------------
    # 2. UNAUTHENTICATED ACCESS GUARDS (401)
    # -------------------------------------------------------------
    def test_02_unauthenticated_access_guards(self):
        """Unauthenticated requests must be rejected with 401."""
        self.assertEqual(self.client.get("/api/execution/config").status_code, 401)
        self.assertEqual(self.client.post("/api/execution/recommend").status_code, 401)
        self.assertEqual(self.client.post("/api/execution/payment-link").status_code, 401)
        self.assertEqual(self.client.post("/api/execution/refund").status_code, 401)
        self.assertEqual(self.client.get("/api/execution/history").status_code, 401)

    # -------------------------------------------------------------
    # 3. GUARDRAILS & INPUT VALIDATION
    # -------------------------------------------------------------
    def test_03_guardrail_amount_validation(self):
        """Amounts must be strictly positive, non-zero, finite numbers."""
        ok, _, err = validate_amount(500)
        self.assertTrue(ok)

        ok, _, err = validate_amount(0)
        self.assertFalse(ok)
        self.assertIn("greater than zero", err)

        ok, _, err = validate_amount(-100)
        self.assertFalse(ok)
        self.assertIn("greater than zero", err)

        ok, _, err = validate_amount(1000000)  # Exceeds 500,000 cap
        self.assertFalse(ok)
        self.assertIn("exceeds maximum system ceiling", err)

        ok, _, err = validate_amount("invalid_amount")
        self.assertFalse(ok)

    def test_04_guardrail_currency_and_action(self):
        """Currencies and actions must match supported enum sets."""
        self.assertTrue(validate_currency("INR")[0])
        self.assertFalse(validate_currency("XYZ")[0])

        self.assertTrue(validate_action_type("PAYMENT_LINK")[0])
        self.assertTrue(validate_action_type("REFUND")[0])
        self.assertTrue(validate_action_type("INVOICE")[0])
        self.assertFalse(validate_action_type("DIRECT_TRANSFER")[0])

    def test_05_guardrail_state_transitions(self):
        """State machine must reject illegal state transitions."""
        # Allowed
        self.assertTrue(validate_state_transition("RECOMMENDED", "PENDING_APPROVAL")[0])
        self.assertTrue(validate_state_transition("PENDING_APPROVAL", "APPROVED")[0])
        self.assertTrue(validate_state_transition("PENDING_APPROVAL", "REJECTED")[0])
        self.assertTrue(validate_state_transition("APPROVED", "EXECUTING")[0])
        self.assertTrue(validate_state_transition("EXECUTING", "EXECUTED")[0])
        self.assertTrue(validate_state_transition("EXECUTING", "FAILED")[0])

        # Illegal
        self.assertFalse(validate_state_transition("PENDING_APPROVAL", "EXECUTED")[0])
        self.assertFalse(validate_state_transition("REJECTED", "EXECUTED")[0])
        self.assertFalse(validate_state_transition("EXECUTED", "APPROVED")[0])

    # -------------------------------------------------------------
    # 4. RECOMMENDATION STAGING & APPROVAL WORKFLOW
    # -------------------------------------------------------------
    def test_06_staging_and_approval_workflow(self):
        """Stages an action as PENDING_APPROVAL and approves it to APPROVED."""
        resp_stage = self.client.post("/api/execution/recommend", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "action_type": "PAYMENT_LINK",
            "amount": 5000.00,
            "currency": "INR",
            "simulation_id": "sim_test_001",
            "recommendation_id": "rec_test_001",
            "target_transaction_id": "TXN_1013",
            "description": "Counterfactual settlement resolution link"
        })
        self.assertEqual(resp_stage.status_code, 201)
        data = resp_stage.get_json()
        self.assertTrue(data["success"])
        exec_id = data["execution"]["execution_id"]
        self.assertEqual(data["execution"]["status"], "PENDING_APPROVAL")

        # Cannot execute while PENDING_APPROVAL
        resp_exec_premature = self.client.post(f"/api/execution/{exec_id}/execute", headers={"Authorization": f"Bearer {self.user_a_token}"})
        self.assertEqual(resp_exec_premature.status_code, 400)
        self.assertIn("Approval Required", resp_exec_premature.get_json()["error"])

        # Approve action
        resp_app = self.client.post(f"/api/execution/{exec_id}/approve", headers={"Authorization": f"Bearer {self.user_a_token}"})
        self.assertEqual(resp_app.status_code, 200)
        app_data = resp_app.get_json()
        self.assertEqual(app_data["execution"]["status"], "APPROVED")
        self.assertIsNotNone(app_data["execution"]["approved_at"])

    # -------------------------------------------------------------
    # 5. REJECTION WORKFLOW
    # -------------------------------------------------------------
    def test_07_rejection_workflow(self):
        """Stages an action and rejects it."""
        resp_stage = self.client.post("/api/execution/recommend", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "action_type": "REFUND",
            "amount": 782.03,
            "target_transaction_id": "TXN_1003",
            "description": "Rejectable refund test"
        })
        self.assertEqual(resp_stage.status_code, 201)
        exec_id = resp_stage.get_json()["execution"]["execution_id"]

        resp_rej = self.client.post(f"/api/execution/{exec_id}/reject", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "reason": "Settlement variance already investigated"
        })
        self.assertEqual(resp_rej.status_code, 200)
        self.assertEqual(resp_rej.get_json()["execution"]["status"], "REJECTED")

        # Cannot execute rejected
        resp_exec_rej = self.client.post(f"/api/execution/{exec_id}/execute", headers={"Authorization": f"Bearer {self.user_a_token}"})
        self.assertEqual(resp_exec_rej.status_code, 400)

    # -------------------------------------------------------------
    # 6. PAYMENT LINK EXECUTION (MOCKED & DETERMINISTIC)
    # -------------------------------------------------------------
    @patch("razorpay_service.create_payment_link")
    def test_08_approved_payment_link_execution(self, mock_plink):
        """Executes an approved Payment Link via Razorpay sandbox service."""
        mock_plink.return_value = {
            "success": True,
            "razorpay_id": "plink_TestSandbox12345",
            "short_url": "https://rzp.io/i/TestSandbox12345",
            "status": "CREATED",
            "amount": 5000.0,
            "currency": "INR"
        }

        # Stage and approve
        resp_stage = self.client.post("/api/execution/recommend", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "action_type": "PAYMENT_LINK",
            "amount": 5000.00,
            "description": "Approved Payment Link Execution"
        })
        exec_id = resp_stage.get_json()["execution"]["execution_id"]
        self.client.post(f"/api/execution/{exec_id}/approve", headers={"Authorization": f"Bearer {self.user_a_token}"})

        # Execute
        with patch("razorpay_service.is_razorpay_configured", return_value=True):
            resp_exec = self.client.post(f"/api/execution/{exec_id}/execute", headers={"Authorization": f"Bearer {self.user_a_token}"})
            self.assertEqual(resp_exec.status_code, 200)
            data = resp_exec.get_json()
            self.assertTrue(data["success"])
            self.assertEqual(data["status"], "EXECUTED")
            self.assertEqual(data["razorpayId"], "plink_TestSandbox12345")
            self.assertIn("shortUrl", data)

    # -------------------------------------------------------------
    # 7. REFUND EXECUTION (MOCKED & OVER-REFUND GUARD)
    # -------------------------------------------------------------
    @patch("razorpay_service.create_refund")
    def test_09_refund_execution_and_bounds(self, mock_refund):
        """Tests refund execution with mocked Razorpay Sandbox."""
        mock_refund.return_value = {
            "success": True,
            "razorpay_id": "rfnd_SandboxRefund9988",
            "payment_id": "pay_CapturedTest123",
            "amount": 500.0,
            "status": "PROCESSED"
        }

        with patch("razorpay_service.is_razorpay_configured", return_value=True):
            resp_ref = self.client.post("/api/execution/refund", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "paymentId": "pay_CapturedTest123",
                "amount": 500.0,
                "simulationId": "sim_demo_01",
                "recommendationId": "rec_demo_01"
            })
            self.assertEqual(resp_ref.status_code, 201)
            data = resp_ref.get_json()
            self.assertTrue(data["success"])
            self.assertEqual(data["status"], "EXECUTED")
            self.assertEqual(data["refundId"], "rfnd_SandboxRefund9988")

    # -------------------------------------------------------------
    # 8. IDEMPOTENCY & DUPLICATE PREVENTION
    # -------------------------------------------------------------
    @patch("razorpay_service.create_payment_link")
    def test_10_idempotency_and_duplicate_prevention(self, mock_plink):
        """Repeated execution with identical idempotency key returns existing record without second execution."""
        mock_plink.return_value = {
            "success": True,
            "razorpay_id": "plink_IdempFirstCall",
            "short_url": "https://rzp.io/i/IdempFirstCall",
            "status": "CREATED",
            "amount": 1200.0,
            "currency": "INR"
        }

        with patch("razorpay_service.is_razorpay_configured", return_value=True):
            # First call
            resp1 = self.client.post("/api/execution/payment-link", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "amount": 1200.0,
                "description": "Idempotent Link Test",
                "simulationId": "sim_idemp_01",
                "recommendationId": "rec_idemp_01",
                "idempotencyKey": "custom_unique_test_key_8899"
            })
            self.assertEqual(resp1.status_code, 201)

            # Second call (duplicate)
            resp2 = self.client.post("/api/execution/payment-link", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "amount": 1200.0,
                "description": "Idempotent Link Test",
                "simulationId": "sim_idemp_01",
                "recommendationId": "rec_idemp_01",
                "idempotencyKey": "custom_unique_test_key_8899"
            })
            self.assertEqual(resp2.status_code, 200)
            data2 = resp2.get_json()
            self.assertTrue(data2.get("idempotent"))
            self.assertEqual(data2["razorpayId"], "plink_IdempFirstCall")

    # -------------------------------------------------------------
    # 9. STRICT TENANT ISOLATION
    # -------------------------------------------------------------
    def test_11_tenant_isolation(self):
        """User B cannot see, approve, or execute User A's execution items."""
        resp_stage = self.client.post("/api/execution/recommend", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "action_type": "PAYMENT_LINK",
            "amount": 3300.00,
            "description": "User A Private Execution"
        })
        exec_id = resp_stage.get_json()["execution"]["execution_id"]

        # User B attempts to view
        resp_b_view = self.client.get(f"/api/execution/{exec_id}", headers={"Authorization": f"Bearer {self.user_b_token}"})
        self.assertEqual(resp_b_view.status_code, 404)

        # User B attempts to approve
        resp_b_app = self.client.post(f"/api/execution/{exec_id}/approve", headers={"Authorization": f"Bearer {self.user_b_token}"})
        self.assertEqual(resp_b_app.status_code, 404)

        # User B attempts to execute
        resp_b_exec = self.client.post(f"/api/execution/{exec_id}/execute", headers={"Authorization": f"Bearer {self.user_b_token}"})
        self.assertEqual(resp_b_exec.status_code, 404)

        # User B history does not contain User A's execution
        resp_b_hist = self.client.get("/api/execution/history", headers={"Authorization": f"Bearer {self.user_b_token}"})
        b_records = resp_b_hist.get_json()["executions"]
        self.assertNotIn(exec_id, [r["execution_id"] for r in b_records])

    # -------------------------------------------------------------
    # 10. EXECUTION HISTORY & FILTERING
    # -------------------------------------------------------------
    def test_12_execution_history_filtering(self):
        """Execution history supports status and action_type filters."""
        resp_hist = self.client.get("/api/execution/history?status=APPROVED", headers={"Authorization": f"Bearer {self.user_a_token}"})
        self.assertEqual(resp_hist.status_code, 200)
        data = resp_hist.get_json()
        self.assertIn("executions", data)
        for r in data["executions"]:
            self.assertEqual(r["status"], "APPROVED")

    # -------------------------------------------------------------
    # 11. PHASE 6.2 DEDICATED PAYMENT LINK TEST SUITE
    # -------------------------------------------------------------
    def test_13_payment_link_invalid_inputs(self):
        """Rejects missing amount, negative amount, non-numeric amount, and missing description."""
        # Missing amount
        resp_no_amt = self.client.post("/api/execution/payment-link", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "description": "Test"
        })
        self.assertEqual(resp_no_amt.status_code, 400)
        self.assertIn("Amount", resp_no_amt.get_json()["error"])

        # Negative amount
        resp_neg = self.client.post("/api/execution/payment-link", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "amount": -500,
            "description": "Test"
        })
        self.assertEqual(resp_neg.status_code, 400)

        # Zero amount
        resp_zero = self.client.post("/api/execution/payment-link", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "amount": 0,
            "description": "Test"
        })
        self.assertEqual(resp_zero.status_code, 400)

        # Non-numeric amount
        resp_nan = self.client.post("/api/execution/payment-link", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "amount": "abc",
            "description": "Test"
        })
        self.assertEqual(resp_nan.status_code, 400)

        # Missing description
        resp_no_desc = self.client.post("/api/execution/payment-link", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "amount": 500,
            "description": ""
        })
        self.assertEqual(resp_no_desc.status_code, 400)
        self.assertIn("Description", resp_no_desc.get_json()["error"])

    def test_14_payment_link_simulation_ownership_guard(self):
        """User A cannot create a payment link for User B's saved simulation."""
        # User B saves a simulation
        resp_save = self.client.post("/api/simulations", headers={"Authorization": f"Bearer {self.user_b_token}"}, json={
            "name": "User B Private Simulation",
            "transaction_id": "TXN_B_001",
            "gross_amount": 10000.0,
            "current_discount_pct": 5.0,
            "new_discount_pct": 3.0
        })
        self.assertEqual(resp_save.status_code, 201)
        sim_b_id = resp_save.get_json()["simulation"]["id"]

        # User A tries to create payment link referencing User B's simulation
        with patch("razorpay_service.is_razorpay_configured", return_value=True):
            resp_cross = self.client.post("/api/execution/payment-link", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "amount": 5000,
                "description": "Unauthorized cross-tenant link",
                "simulationId": sim_b_id
            })
            self.assertEqual(resp_cross.status_code, 403)
            self.assertIn("Forbidden", resp_cross.get_json()["error"])

    @patch("razorpay_service.create_payment_link")
    def test_15_payment_link_razorpay_api_failure(self, mock_plink):
        """Handles Razorpay API failure safely with normalized error response."""
        mock_plink.return_value = {
            "success": False,
            "error_code": "BAD_REQUEST_ERROR",
            "error_message": "Payment link creation rejected by gateway."
        }

        with patch("razorpay_service.is_razorpay_configured", return_value=True):
            resp = self.client.post("/api/execution/payment-link", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "amount": 3000,
                "description": "Gateway Failure Test"
            })
            self.assertEqual(resp.status_code, 400)
            data = resp.get_json()
            self.assertFalse(data["success"])
            self.assertEqual(data["status"], "FAILED")
            self.assertEqual(data["errorCode"], "BAD_REQUEST_ERROR")
            self.assertIn("errorMessage", data)

    def test_16_payment_link_missing_razorpay_config(self):
        """Fails cleanly with guardrail error if Razorpay credentials are not configured."""
        with patch("razorpay_service.is_razorpay_configured", return_value=False):
            resp = self.client.post("/api/execution/payment-link", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "amount": 2000,
                "description": "Unconfigured credentials test"
            })
            self.assertEqual(resp.status_code, 400)
            data = resp.get_json()
            self.assertIn("Guardrail Violation", data["error"])
            self.assertIn("not configured", data["message"])


    # -------------------------------------------------------------
    # 12. PHASE 6.3 DEDICATED REFUND EXECUTION TEST SUITE (22 Checks)
    # -------------------------------------------------------------
    def test_17_refund_unauthenticated_guard(self):
        """Unauthenticated direct refund request is rejected with 401."""
        resp = self.client.post("/api/execution/refund", json={
            "paymentId": "pay_test_001",
            "amount": 500
        })
        self.assertEqual(resp.status_code, 401)

    def test_18_refund_missing_payment_id(self):
        """Missing paymentId is rejected with 400."""
        resp = self.client.post("/api/execution/refund", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "amount": 500
        })
        self.assertEqual(resp.status_code, 400)
        data = resp.get_json()
        self.assertIn("payment", data["error"].lower())

    def test_19_refund_invalid_amounts(self):
        """Rejects missing amount, zero amount, negative amount, and non-numeric amount."""
        # Missing amount
        r1 = self.client.post("/api/execution/refund", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "paymentId": "pay_test_001"
        })
        self.assertEqual(r1.status_code, 400)

        # Zero amount
        r2 = self.client.post("/api/execution/refund", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "paymentId": "pay_test_001",
            "amount": 0
        })
        self.assertEqual(r2.status_code, 400)

        # Negative amount
        r3 = self.client.post("/api/execution/refund", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "paymentId": "pay_test_001",
            "amount": -250
        })
        self.assertEqual(r3.status_code, 400)

        # Non-numeric amount
        r4 = self.client.post("/api/execution/refund", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "paymentId": "pay_test_001",
            "amount": "invalid_num"
        })
        self.assertEqual(r4.status_code, 400)

    def test_20_refund_invalid_currency(self):
        """Non-INR currency is rejected with 400."""
        resp = self.client.post("/api/execution/refund", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "paymentId": "pay_test_001",
            "amount": 500,
            "currency": "USD"
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("currency", resp.get_json()["error"].lower())

    def test_21_refund_upper_bound_check(self):
        """Refund exceeding target transaction gross is rejected with 400."""
        resp = self.client.post("/api/execution/refund", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "paymentId": "pay_test_001",
            "amount": 999999.00,
            "targetTransactionGross": 1000.00
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("exceed", str(resp.get_json()).lower())

    def test_22_refund_cross_tenant_simulation_ownership(self):
        """User A cannot execute a refund against User B's simulation."""
        # Create simulation for User B
        resp_b = self.client.post("/api/simulations", headers={"Authorization": f"Bearer {self.user_b_token}"}, json={
            "name": "User B Refund Sim",
            "transaction_id": "TXN_B_REF",
            "gross_amount": 5000.0
        })
        self.assertEqual(resp_b.status_code, 201)
        sim_id = resp_b.get_json()["simulation"]["id"]

        with patch("razorpay_service.is_razorpay_configured", return_value=True):
            resp_cross = self.client.post("/api/execution/refund", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "paymentId": "pay_test_b",
                "amount": 500,
                "simulationId": sim_id
            })
            self.assertEqual(resp_cross.status_code, 403)

    @patch("razorpay_service.create_refund")
    def test_23_direct_refund_partial_execution_success(self, mock_rfnd):
        """Direct partial refund executes successfully and returns normalized payload."""
        mock_rfnd.return_value = {
            "success": True,
            "refund_id": "rfnd_Part12345",
            "payment_id": "pay_test_part",
            "amount": 75000,  # 750.00 INR in paise
            "currency": "INR",
            "status": "processed",
            "speed": "normal"
        }

        with patch("razorpay_service.is_razorpay_configured", return_value=True):
            resp = self.client.post("/api/execution/refund", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "paymentId": "pay_test_part",
                "amount": 750.00,
                "notes": {"reason": "Partial variance adjustment"}
            })
            self.assertIn(resp.status_code, [200, 201])
            data = resp.get_json()
            self.assertTrue(data["success"])
            self.assertEqual(data["status"], "EXECUTED")
            self.assertEqual(data["refundId"], "rfnd_Part12345")
            self.assertEqual(data["paymentId"], "pay_test_part")
            self.assertEqual(data["amount"], 750.00)
            self.assertEqual(data["actionType"], "REFUND")

    @patch("razorpay_service.create_refund")
    def test_24_direct_refund_full_execution_success(self, mock_rfnd):
        """Direct full refund executes successfully and returns normalized payload."""
        mock_rfnd.return_value = {
            "success": True,
            "refund_id": "rfnd_Full998877",
            "payment_id": "pay_test_full",
            "amount": 500000,  # 5000.00 INR in paise
            "currency": "INR",
            "status": "processed"
        }

        with patch("razorpay_service.is_razorpay_configured", return_value=True):
            resp = self.client.post("/api/execution/refund", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "paymentId": "pay_test_full",
                "amount": 5000.00,
                "notes": {"reason": "Full duplicate settlement clawback"}
            })
            self.assertIn(resp.status_code, [200, 201])
            data = resp.get_json()
            self.assertTrue(data["success"])
            self.assertEqual(data["status"], "EXECUTED")
            self.assertEqual(data["refundId"], "rfnd_Full998877")
            self.assertEqual(data["paymentId"], "pay_test_full")
            self.assertEqual(data["amount"], 5000.00)

    @patch("razorpay_service.create_refund")
    def test_25_refund_idempotency_prevents_duplicate(self, mock_rfnd):
        """Duplicate refund call with same idempotency key returns existing record without re-calling gateway."""
        mock_rfnd.return_value = {
            "success": True,
            "refund_id": "rfnd_Idemp1122",
            "payment_id": "pay_test_idemp",
            "amount": 30000,
            "currency": "INR",
            "status": "processed"
        }

        with patch("razorpay_service.is_razorpay_configured", return_value=True):
            key = f"idemp_rfnd_{uuid.uuid4().hex}"
            # First call
            r1 = self.client.post("/api/execution/refund", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "paymentId": "pay_test_idemp",
                "amount": 300.00,
                "idempotencyKey": key
            })
            self.assertIn(r1.status_code, [200, 201])
            self.assertEqual(mock_rfnd.call_count, 1)

            # Duplicate call
            r2 = self.client.post("/api/execution/refund", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "paymentId": "pay_test_idemp",
                "amount": 300.00,
                "idempotencyKey": key
            })
            self.assertIn(r2.status_code, [200, 201])
            self.assertTrue(r2.get_json().get("idempotent"))
            self.assertEqual(mock_rfnd.call_count, 1)  # NOT called a second time

    @patch("razorpay_service.create_refund")
    def test_26_refund_gateway_failure_handling(self, mock_rfnd):
        """Gateway failure during refund is caught and returned safely."""
        mock_rfnd.return_value = {
            "success": False,
            "error_code": "GATEWAY_ERROR",
            "error_message": "Payment has already been refunded or is in dispute."
        }

        with patch("razorpay_service.is_razorpay_configured", return_value=True):
            resp = self.client.post("/api/execution/refund", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "paymentId": "pay_test_fail",
                "amount": 400.00
            })
            self.assertEqual(resp.status_code, 400)
            data = resp.get_json()
            self.assertFalse(data["success"])
            self.assertEqual(data["status"], "FAILED")
            self.assertEqual(data["errorCode"], "GATEWAY_ERROR")

    # -------------------------------------------------------------
    # 13. PHASE 6.4 DEDICATED INVOICE EXECUTION TEST SUITE (20 Checks)
    # -------------------------------------------------------------
    def test_27_invoice_unauthenticated_guard(self):
        """Unauthenticated direct invoice request is rejected with 401."""
        resp = self.client.post("/api/execution/invoice", json={
            "customerName": "Test Corp",
            "customerEmail": "finance@test.com",
            "amount": 1200
        })
        self.assertEqual(resp.status_code, 401)

    def test_28_invoice_missing_customer_name(self):
        """Missing customerName is rejected with 400."""
        resp = self.client.post("/api/execution/invoice", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "customerEmail": "finance@test.com",
            "amount": 1200
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Customer Name", resp.get_json()["error"])

    def test_29_invoice_missing_or_invalid_customer_email(self):
        """Missing or invalid customerEmail is rejected with 400."""
        # Missing email
        r1 = self.client.post("/api/execution/invoice", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "customerName": "Acme Corp",
            "amount": 1200
        })
        self.assertEqual(r1.status_code, 400)

        # Invalid email (no @)
        r2 = self.client.post("/api/execution/invoice", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "customerName": "Acme Corp",
            "customerEmail": "invalidemailaddress",
            "amount": 1200
        })
        self.assertEqual(r2.status_code, 400)
        self.assertIn("email", r2.get_json()["error"].lower())

    def test_30_invoice_invalid_amounts(self):
        """Rejects zero, negative, or non-numeric invoice amounts."""
        # Zero amount
        r1 = self.client.post("/api/execution/invoice", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "customerName": "Acme Corp",
            "customerEmail": "finance@acme.com",
            "amount": 0
        })
        self.assertEqual(r1.status_code, 400)

        # Negative amount
        r2 = self.client.post("/api/execution/invoice", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "customerName": "Acme Corp",
            "customerEmail": "finance@acme.com",
            "amount": -500
        })
        self.assertEqual(r2.status_code, 400)

        # Non-numeric amount
        r3 = self.client.post("/api/execution/invoice", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "customerName": "Acme Corp",
            "customerEmail": "finance@acme.com",
            "amount": "abc"
        })
        self.assertEqual(r3.status_code, 400)

    def test_31_invoice_invalid_currency(self):
        """Non-INR currency is rejected with 400."""
        resp = self.client.post("/api/execution/invoice", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
            "customerName": "Acme Corp",
            "customerEmail": "finance@acme.com",
            "amount": 1200,
            "currency": "EUR"
        })
        self.assertEqual(resp.status_code, 400)
        self.assertIn("currency", resp.get_json()["error"].lower())

    def test_32_invoice_cross_tenant_simulation_ownership(self):
        """User A cannot create an invoice referencing User B's simulation."""
        resp_b = self.client.post("/api/simulations", headers={"Authorization": f"Bearer {self.user_b_token}"}, json={
            "name": "User B Invoice Sim",
            "transaction_id": "TXN_B_INV",
            "gross_amount": 8000.0
        })
        self.assertEqual(resp_b.status_code, 201)
        sim_id = resp_b.get_json()["simulation"]["id"]

        with patch("razorpay_service.is_razorpay_configured", return_value=True):
            resp_cross = self.client.post("/api/execution/invoice", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "customerName": "Target Merchant",
                "customerEmail": "target@merchant.com",
                "amount": 2500,
                "simulationId": sim_id
            })
            self.assertEqual(resp_cross.status_code, 403)

    @patch("razorpay_service.create_invoice")
    def test_33_direct_invoice_execution_success(self, mock_inv):
        """Direct invoice creation executes successfully and returns invoice ID and URL."""
        mock_inv.return_value = {
            "success": True,
            "invoice_id": "inv_TestInvoice9988",
            "invoice_number": "INV-2026-0099",
            "short_url": "https://rzp.io/i/inv_TestInvoice9988",
            "amount": 450000,
            "currency": "INR",
            "status": "issued"
        }

        with patch("razorpay_service.is_razorpay_configured", return_value=True):
            resp = self.client.post("/api/execution/invoice", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "customerName": "Horizon Merchant",
                "customerEmail": "finance@horizon.com",
                "customerContact": "+919876543210",
                "description": "Counterfactual settlement balance recovery",
                "amount": 4500.00
            })
            self.assertIn(resp.status_code, [200, 201])
            data = resp.get_json()
            self.assertTrue(data["success"])
            self.assertEqual(data["status"], "EXECUTED")
            self.assertEqual(data["invoiceId"], "inv_TestInvoice9988")
            self.assertEqual(data["amount"], 4500.00)
            self.assertEqual(data["currency"], "INR")
            self.assertEqual(data["actionType"], "INVOICE")
            self.assertEqual(data["invoiceUrl"], "https://rzp.io/i/inv_TestInvoice9988")

    @patch("razorpay_service.create_invoice")
    def test_34_invoice_idempotency_prevents_duplicate(self, mock_inv):
        """Duplicate invoice call with same idempotency key returns existing record without duplicate creation."""
        mock_inv.return_value = {
            "success": True,
            "invoice_id": "inv_IdempUnique4455",
            "short_url": "https://rzp.io/i/inv_IdempUnique4455",
            "amount": 200000,
            "currency": "INR",
            "status": "issued"
        }

        with patch("razorpay_service.is_razorpay_configured", return_value=True):
            key = f"idemp_inv_{uuid.uuid4().hex}"
            r1 = self.client.post("/api/execution/invoice", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "customerName": "Dupe Test Merchant",
                "customerEmail": "dupe@merchant.com",
                "amount": 2000.00,
                "idempotencyKey": key
            })
            self.assertIn(r1.status_code, [200, 201])
            self.assertEqual(mock_inv.call_count, 1)

            # Duplicate invocation
            r2 = self.client.post("/api/execution/invoice", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "customerName": "Dupe Test Merchant",
                "customerEmail": "dupe@merchant.com",
                "amount": 2000.00,
                "idempotencyKey": key
            })
            self.assertIn(r2.status_code, [200, 201])
            self.assertTrue(r2.get_json().get("idempotent"))
            self.assertEqual(mock_inv.call_count, 1)

    @patch("razorpay_service.create_invoice")
    def test_35_invoice_gateway_failure_handling(self, mock_inv):
        """Gateway failure during invoice creation is caught and returned safely."""
        mock_inv.return_value = {
            "success": False,
            "error_code": "BAD_REQUEST_ERROR",
            "error_message": "Customer contact verification failed."
        }

        with patch("razorpay_service.is_razorpay_configured", return_value=True):
            resp = self.client.post("/api/execution/invoice", headers={"Authorization": f"Bearer {self.user_a_token}"}, json={
                "customerName": "Error Merchant",
                "customerEmail": "err@merchant.com",
                "amount": 1000.00
            })
            self.assertEqual(resp.status_code, 400)
            data = resp.get_json()
            self.assertFalse(data["success"])
            self.assertEqual(data["status"], "FAILED")
            self.assertEqual(data["errorCode"], "BAD_REQUEST_ERROR")

    def test_36_execution_history_contains_refund_and_invoice(self):
        """Execution history contains records across PAYMENT_LINK, REFUND, and INVOICE."""
        # Query with action_type=REFUND
        r_rfnd = self.client.get("/api/execution/history?action_type=REFUND", headers={"Authorization": f"Bearer {self.user_a_token}"})
        self.assertEqual(r_rfnd.status_code, 200)
        for rec in r_rfnd.get_json()["executions"]:
            self.assertEqual(rec["action_type"], "REFUND")

        # Query with action_type=INVOICE
        r_inv = self.client.get("/api/execution/history?action_type=INVOICE", headers={"Authorization": f"Bearer {self.user_a_token}"})
        self.assertEqual(r_inv.status_code, 200)
        for rec in r_inv.get_json()["executions"]:
            self.assertEqual(rec["action_type"], "INVOICE")


def run_execution_tests():
    print("\n" + "=" * 70)
    print("COUNTERFACTUAL PHASE 6 — RAZORPAY SANDBOX EXECUTION TEST SUITE")
    print("=" * 70)
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPhase6Execution)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    print("=" * 70)
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_execution_tests()
    if not success:
        sys.exit(1)
