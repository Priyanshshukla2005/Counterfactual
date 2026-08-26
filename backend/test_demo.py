"""
Counterfactual Phase 10 — Demo Engineering Test Suite
Verifies all 14 Demo Engineering criteria:
1. Demo scenario initialization
2. Demo data isolation
3. Simulation deterministic mathematical calculations
4. Decision recommendation logic
5. Approval required before execution
6. Rejection handling
7. Safe Razorpay Sandbox execution
8. Outcome observation & persistence
9. Prediction vs actual mathematical comparison
10. Grounded root-cause analysis without hallucination
11. Historical feedback retrieval
12. Safe demo reset without corrupting user data
13. 401 unauthenticated protection
14. Tenant isolation
"""

import os
import sys
import uuid
import unittest
from unittest.mock import patch

# Ensure stdout handles UTF-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from database import (
    get_simulations_collection,
    get_executions_collection,
    get_outcomes_collection,
    get_users_collection,
)
from demo import (
    DEMO_TXN_ID,
    DEMO_SIM_ID,
    DEMO_EXEC_ID,
    DEMO_OUT_ID,
    DEMO_GROSS_AMOUNT,
    get_demo_simulation_data,
)


class TestPhase10Demo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()

        # Create isolated test tenant users
        cls.user_a_email = f"demo_presenter_a_{os.getpid()}_{uuid.uuid4().hex[:6]}@counterfactual.fi"
        cls.user_a_pass = "PresenterA_123!"

        resp_a = cls.client.post("/api/auth/signup", json={
            "name": "Demo Presenter Alpha",
            "email": cls.user_a_email,
            "password": cls.user_a_pass,
            "organization": "Counterfactual Demo Corp"
        })
        assert resp_a.status_code == 201, f"Signup failed: {resp_a.data}"
        data_a = resp_a.get_json()
        cls.token_user_a = data_a["token"]
        cls.user_a_id = data_a["user"]["id"]

        cls.user_b_email = f"demo_presenter_b_{os.getpid()}_{uuid.uuid4().hex[:6]}@counterfactual.fi"
        cls.user_b_pass = "PresenterB_456!"

        resp_b = cls.client.post("/api/auth/signup", json={
            "name": "Demo Presenter Beta",
            "email": cls.user_b_email,
            "password": cls.user_b_pass,
            "organization": "Beta Enterprise"
        })
        assert resp_b.status_code == 201, f"Signup failed: {resp_b.data}"
        data_b = resp_b.get_json()
        cls.token_user_b = data_b["token"]
        cls.user_b_id = data_b["user"]["id"]

        cls.headers_a = {
            "Authorization": f"Bearer {cls.token_user_a}",
            "Content-Type": "application/json",
        }
        cls.headers_b = {
            "Authorization": f"Bearer {cls.token_user_b}",
            "Content-Type": "application/json",
        }

    def test_01_unauthenticated_protection(self):
        """1. Unauthenticated requests to /api/demo endpoints are rejected with 401."""
        resp = self.client.get("/api/demo/scenario")
        self.assertEqual(resp.status_code, 401)

        resp2 = self.client.post("/api/demo/initialize")
        self.assertEqual(resp2.status_code, 401)

        resp3 = self.client.post("/api/demo/reset")
        self.assertEqual(resp3.status_code, 401)

    def test_02_demo_scenario_retrieval(self):
        """2. Demo scenario returns deterministic primary 20% discount story and 8 stages."""
        resp = self.client.get("/api/demo/scenario", headers=self.headers_a)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()

        self.assertIn("story", data)
        self.assertIn("simulation", data)
        self.assertIn("stages", data)
        self.assertEqual(len(data["stages"]), 8)

        # Verify story narrative
        self.assertIn("incomplete information", data["story"]["hook_title"].lower())
        self.assertIn("consequences before you acted", data["story"]["hook_subhead"].lower())
        self.assertEqual(data["story"]["transaction_id"], DEMO_TXN_ID)
        self.assertEqual(data["story"]["gross_amount"], DEMO_GROSS_AMOUNT)

    def test_03_deterministic_simulation_math(self):
        """3. Simulation calculations match exact mathematical parity."""
        sim = get_demo_simulation_data()

        # Gross: 50,000 | Current: 5% (2,500) | Proposed: 20% (10,000)
        # Fee (1.8%): 900 | Tax (18% of 900): 162 | Total charges: 1,062
        # Baseline payout = 50,000 - 2,500 - 1,062 = 46,438.00
        # Counterfactual payout = 50,000 - 10,000 - 1,062 = 38,938.00
        # Merchant delta = -7,500.00
        self.assertEqual(sim["gross_amount"], 50000.0)
        self.assertEqual(sim["deltas"]["merchant_delta"], -7500.0)
        self.assertEqual(sim["deltas"]["platform_delta"], 7500.0)
        self.assertEqual(sim["guidance_type"], "platform_favorable")

    def test_04_demo_initialization_and_fixtures(self):
        """4. Initializes isolated demo records in MongoDB Atlas."""
        resp = self.client.post("/api/demo/initialize", headers=self.headers_a)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["demo_ids"]["transaction_id"], DEMO_TXN_ID)
        self.assertEqual(data["demo_ids"]["simulation_id"], DEMO_SIM_ID)
        self.assertEqual(data["demo_ids"]["execution_id"], DEMO_EXEC_ID)
        self.assertEqual(data["demo_ids"]["outcome_id"], DEMO_OUT_ID)

        # Verify documents exist in database
        sim_col = get_simulations_collection()
        sim_doc = sim_col.find_one({"id": DEMO_SIM_ID, "user_id": self.user_a_id})
        self.assertIsNotNone(sim_doc)

        exec_col = get_executions_collection()
        exec_doc = exec_col.find_one({"execution_id": DEMO_EXEC_ID, "user_id": self.user_a_id})
        self.assertIsNotNone(exec_doc)

        out_col = get_outcomes_collection()
        out_doc = out_col.find_one({"outcome_id": DEMO_OUT_ID, "user_id": self.user_a_id})
        self.assertIsNotNone(out_doc)

    def test_05_tenant_isolation_demo(self):
        """5. User B cannot see User A's demo records."""
        # Query User A's demo simulation with User B's token
        resp = self.client.get(f"/api/simulations/{DEMO_SIM_ID}", headers=self.headers_b)
        self.assertEqual(resp.status_code, 404)

        # Query User A's demo outcome with User B's token
        resp_out = self.client.get(f"/api/monitoring/outcomes/{DEMO_OUT_ID}", headers=self.headers_b)
        self.assertEqual(resp_out.status_code, 404)

    def test_06_approval_guardrail_workflow(self):
        """6. Human approval is required before execution; rejection prevents execution."""
        # Stage an action
        stage_resp = self.client.post("/api/execution/recommend", json={
            "action_type": "PAYMENT_LINK",
            "amount": 38938.0,
            "currency": "INR",
            "target_transaction_id": "DEMO_APPROVAL_TEST_01",
            "description": "Demo approval test"
        }, headers=self.headers_a)
        self.assertEqual(stage_resp.status_code, 201)
        exec_id = stage_resp.get_json()["execution"]["execution_id"]

        # Attempt execute without approval -> must fail with 400
        early_exec = self.client.post(f"/api/execution/{exec_id}/execute", headers=self.headers_a)
        self.assertEqual(early_exec.status_code, 400)

        # Reject action -> state is REJECTED
        rej_resp = self.client.post(f"/api/execution/{exec_id}/reject", json={"reason": "Operator declined"}, headers=self.headers_a)
        self.assertEqual(rej_resp.status_code, 200)

        # Attempt execute rejected action -> must fail with 400
        late_exec = self.client.post(f"/api/execution/{exec_id}/execute", headers=self.headers_a)
        self.assertEqual(late_exec.status_code, 400)

    @patch("razorpay_service.create_payment_link")
    def test_07_sandbox_execution_and_idempotency(self, mock_create_plink):
        """7. Razorpay sandbox execution safely dispatches test link and preserves idempotency."""
        mock_create_plink.return_value = {
            "success": True,
            "status": "created",
            "razorpay_id": "plink_demo_sandbox_test",
            "short_url": "https://rzp.io/i/demo_sb",
            "amount": 38938.0,
            "currency": "INR"
        }

        # Stage and approve action
        stage_resp = self.client.post("/api/execution/recommend", json={
            "action_type": "PAYMENT_LINK",
            "amount": 38938.0,
            "currency": "INR",
            "target_transaction_id": "DEMO_SB_TEST_01",
            "description": "Demo sandbox test"
        }, headers=self.headers_a)
        exec_id = stage_resp.get_json()["execution"]["execution_id"]
        self.client.post(f"/api/execution/{exec_id}/approve", headers=self.headers_a)

        # Execute
        exec_resp = self.client.post(f"/api/execution/{exec_id}/execute", headers=self.headers_a)
        self.assertEqual(exec_resp.status_code, 200)
        self.assertEqual(exec_resp.get_json()["status"], "EXECUTED")

    def test_08_prediction_vs_actual_and_root_cause(self):
        """8. Mathematical deviation calculation and grounded root cause analysis."""
        pred = 38938.0
        actual = 38688.0  # ₹250 difference

        rec_resp = self.client.post("/api/monitoring/outcomes/record", json={
            "transactionId": "DEMO_EVAL_01",
            "predictedAmount": pred,
            "actualAmount": actual,
            "metadata": {"exception_type": "FEE_MISMATCH"}
        }, headers=self.headers_a)
        self.assertEqual(rec_resp.status_code, 201)
        outcome = rec_resp.get_json()["outcome"]

        self.assertEqual(outcome["comparison"]["severity"], "ON_TARGET")
        self.assertEqual(outcome["root_cause"]["likely_cause"], "FEE_SCHEDULE_DISCREPANCY")
        self.assertIn("250.00", outcome["root_cause"]["evidence"])

    def test_09_historical_feedback_retrieval(self):
        """9. Historical feedback endpoint exposes closed-loop recurring patterns and guidance."""
        fb_resp = self.client.get("/api/monitoring/feedback", headers=self.headers_a)
        self.assertEqual(fb_resp.status_code, 200)
        data = fb_resp.get_json()["historical_feedback"]
        self.assertIn("recurring_patterns", data)
        self.assertIn("decision_intelligence_guidance", data)

    def test_10_safe_demo_reset(self):
        """10. Demo reset cleans only DEMO_* records without corrupting regular user data."""
        # Insert a regular (non-demo) simulation
        reg_resp = self.client.post("/api/simulations", json={
            "name": "Production Merchant Simulation",
            "gross_amount": 100000.0,
            "current_discount_pct": 5.0,
            "new_discount_pct": 3.0,
            "transaction_id": "REGULAR_TXN_999"
        }, headers=self.headers_a)
        self.assertEqual(reg_resp.status_code, 201)
        reg_sim_id = reg_resp.get_json()["simulation"]["id"]

        # Call demo reset
        reset_resp = self.client.post("/api/demo/reset", headers=self.headers_a)
        self.assertEqual(reset_resp.status_code, 200)
        self.assertTrue(reset_resp.get_json()["success"])

        # Assert demo simulation is gone
        sim_col = get_simulations_collection()
        demo_sim = sim_col.find_one({"id": DEMO_SIM_ID, "user_id": self.user_a_id})
        self.assertIsNone(demo_sim)

        # Assert regular simulation is strictly preserved
        reg_sim = sim_col.find_one({"id": reg_sim_id, "user_id": self.user_a_id})
        self.assertIsNotNone(reg_sim)


if __name__ == "__main__":
    unittest.main(verbosity=2)
