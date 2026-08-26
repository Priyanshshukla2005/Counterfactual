"""
Counterfactual Phase 12 — Merchant-Friendly UX & Hypothetical What-If Test Suite
Verifies:
1. Hypothetical scenario with custom gross amount (₹50,000)
2. Custom current discount calculation (5% = ₹2,500)
3. Proposed discount calculation (20% = ₹10,000)
4. Processing fee & GST calculation (1.8% + 18% GST)
5. Merchant payout parity (₹38,938)
6. Merchant delta parity (-₹7,500)
7. Platform revenue delta parity (+₹7,500)
8. Boundary validation (negative amounts rejected)
9. Boundary validation (discount > 100% rejected)
10. Non-destructive simulation isolation (no real ledger mutation)
11. Multi-tenant simulation isolation
12. Deterministic numerical source-of-truth preservation in AI explanations
13. RAG supporting information retrieval
14. RAG insufficient evidence safe fallback
15. Simulation does not automatically execute anything
16. Human approval gate requirement before execution
17. Existing transaction-based simulation parity
18. CSV payment ingestion validation & tenant isolation
"""

import os
import sys
import uuid
import unittest

# Ensure stdout handles UTF-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from database import get_simulations_collection, get_database
from counterfactual_engine import calculate_counterfactual, generate_multi_scenario_comparison
from rag_engine import generate_grounded_rag_explanation


class TestPhase12MerchantWhatIf(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()

        # Create isolated test tenant users
        cls.user_a_email = f"merchant_a_{os.getpid()}_{uuid.uuid4().hex[:6]}@counterfactual.fi"
        cls.user_a_pass = "MerchantSecureA123!"

        resp_a = cls.client.post("/api/auth/signup", json={
            "name": "Merchant Retailer Alpha",
            "email": cls.user_a_email,
            "password": cls.user_a_pass,
            "organization": "Alpha Retail Direct"
        })
        assert resp_a.status_code == 201, f"Signup failed: {resp_a.data}"
        data_a = resp_a.get_json()
        cls.token_user_a = data_a["token"]
        cls.user_a_id = data_a["user"]["id"]

        cls.user_b_email = f"merchant_b_{os.getpid()}_{uuid.uuid4().hex[:6]}@counterfactual.fi"
        cls.user_b_pass = "MerchantSecureB456!"

        resp_b = cls.client.post("/api/auth/signup", json={
            "name": "Merchant Competitor Beta",
            "email": cls.user_b_email,
            "password": cls.user_b_pass,
            "organization": "Beta Enterprise Direct"
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

    def test_01_hypothetical_simulation_math(self):
        """1. Hypothetical scenario calculates exact 20% vs 5% discount on ₹50,000."""
        calc = calculate_counterfactual(
            gross_amount=50000.0,
            current_discount_pct=5.0,
            new_discount_pct=20.0,
            fee_pct=1.8,
            tax_pct=18.0,
            refund_amount=0.0,
            settlement_recovery_pct=100.0,
            settlement_timing_days=1,
            transaction_id="HYPOTHETICAL_SCENARIO"
        )
        self.assertEqual(calc["current_state"]["discount_amount"], 2500.0)
        self.assertEqual(calc["counterfactual_state"]["discount_amount"], 10000.0)
        self.assertEqual(calc["current_state"]["merchant_settlement"], 46438.0)
        self.assertEqual(calc["counterfactual_state"]["merchant_settlement"], 38938.0)
        self.assertEqual(calc["deltas"]["merchant_delta"], -7500.0)
        self.assertEqual(calc["deltas"]["platform_delta"], 7500.0)

    def test_02_simulate_endpoint_hypothetical(self):
        """2. POST /api/counterfactual/simulate accepts custom hypothetical sales."""
        resp = self.client.post("/api/counterfactual/simulate", json={
            "gross_amount": 50000.0,
            "current_discount_pct": 5.0,
            "new_discount_pct": 20.0,
            "fee_pct": 1.8,
            "tax_pct": 18.0,
            "transaction_id": "HYPOTHETICAL_SCENARIO"
        }, headers=self.headers_a)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        sim = data["simulation"]
        self.assertEqual(sim["deltas"]["merchant_delta"], -7500.0)
        self.assertEqual(sim["counterfactual_state"]["merchant_settlement"], 38938.0)

    def test_03_boundary_validation_negative_gross(self):
        """3. Rejects negative gross amount with 400 Bad Request."""
        resp = self.client.post("/api/counterfactual/simulate", json={
            "gross_amount": -500.0,
            "current_discount_pct": 5.0,
            "new_discount_pct": 10.0
        }, headers=self.headers_a)
        self.assertEqual(resp.status_code, 400)

    def test_04_boundary_validation_invalid_discount(self):
        """4. Rejects discount > 100% with 400 Bad Request."""
        resp = self.client.post("/api/counterfactual/simulate", json={
            "gross_amount": 10000.0,
            "current_discount_pct": 5.0,
            "new_discount_pct": 150.0
        }, headers=self.headers_a)
        self.assertEqual(resp.status_code, 400)

    def test_05_multi_scenario_comparison_options(self):
        """5. Multi-scenario matrix returns comparison options for merchant."""
        matrix = generate_multi_scenario_comparison(
            gross_amount=50000.0,
            custom_discount_pct=20.0,
            fee_pct=1.8,
            tax_pct=18.0,
            refund_amount=0.0
        )
        self.assertGreaterEqual(len(matrix), 3)
        option_names = [o["name"] for o in matrix]
        self.assertTrue(any("Custom" in n for n in option_names))

    def test_06_save_hypothetical_simulation(self):
        """6. POST /api/simulations saves hypothetical scenario to MongoDB Atlas."""
        resp = self.client.post("/api/simulations", json={
            "name": "Weekend 20% Flash Sale What-If",
            "gross_amount": 50000.0,
            "current_discount_pct": 5.0,
            "new_discount_pct": 20.0,
            "fee_pct": 1.8,
            "tax_pct": 18.0,
            "transaction_id": "HYPOTHETICAL_WEEKEND_SALE",
            "settlement_timing": "T+1"
        }, headers=self.headers_a)
        self.assertEqual(resp.status_code, 201)
        sim_id = resp.get_json()["simulation"]["id"]

        # Verify in database
        col = get_simulations_collection()
        doc = col.find_one({"id": sim_id, "user_id": self.user_a_id})
        self.assertIsNotNone(doc)
        self.assertEqual(doc["baseline"]["merchant_payout"], 46438.0)
        self.assertEqual(doc["counterfactual"]["merchant_payout"], 38938.0)

    def test_07_tenant_isolation_simulations(self):
        """7. User B cannot see User A's saved simulations."""
        resp_b = self.client.get("/api/simulations", headers=self.headers_b)
        self.assertEqual(resp_b.status_code, 200)
        sims_b = resp_b.get_json()["simulations"]
        for s in sims_b:
            self.assertNotEqual(s.get("user_id"), self.user_a_id)

    def test_08_ai_explanation_uses_deterministic_numbers(self):
        """8. Grounded AI explanation preserves locked deterministic numbers."""
        exp = generate_grounded_rag_explanation(
            transaction_id="HYP_TEST_01",
            predicted_amount=38938.0,
            actual_amount=38688.0,
            deviation_amount=250.0,
            deviation_pct=0.64,
            accuracy_score=99.36,
            exception_type="FEE_SCHEDULE_DISCREPANCY",
            query="Explain discount impact",
            tenant_id=self.user_a_id
        )
        self.assertTrue(exp["is_grounded"])
        self.assertEqual(exp["numerical_source_of_truth"]["predicted_amount"], 38938.0)
        self.assertEqual(exp["numerical_source_of_truth"]["actual_amount"], 38688.0)

    def test_09_rag_insufficient_evidence_fallback(self):
        """9. Query without matching policy returns safe insufficient evidence message."""
        exp = generate_grounded_rag_explanation(
            transaction_id="HYP_TEST_02",
            predicted_amount=100.0,
            actual_amount=100.0,
            deviation_amount=0.0,
            deviation_pct=0.0,
            accuracy_score=100.0,
            exception_type="UNKNOWN_FABRICATED_CATEGORY_999",
            query="What is the Martian solar settlement rebate?",
            tenant_id=self.user_a_id
        )
        self.assertFalse(exp["is_grounded"])
        self.assertIn("insufficient evidence", exp["grounded_explanation"].lower())

    def test_10_simulation_does_not_execute_automatically(self):
        """10. Running a simulation creates 0 execution records."""
        db = get_database()
        exec_col = db["execution_records"]
        count_before = exec_col.count_documents({"user_id": self.user_a_id})

        self.client.post("/api/counterfactual/simulate", json={
            "gross_amount": 50000.0,
            "current_discount_pct": 5.0,
            "new_discount_pct": 20.0
        }, headers=self.headers_a)

        count_after = exec_col.count_documents({"user_id": self.user_a_id})
        self.assertEqual(count_before, count_after)

    def test_11_human_approval_required_for_execution(self):
        """11. Action center requires explicit APPROVED state before gateway execution."""
        # Stage recommendation as PENDING_APPROVAL
        stage_resp = self.client.post("/api/execution/recommend", json={
            "actionType": "PAYMENT_LINK",
            "transactionId": "HYP_ACTION_01",
            "amount": 38938.0,
            "description": "Commercial Payment Link"
        }, headers=self.headers_a)
        self.assertEqual(stage_resp.status_code, 201)
        exec_id = stage_resp.get_json()["execution"]["execution_id"]

        # Attempt to execute directly without approval -> 400
        exec_attempt = self.client.post(f"/api/execution/{exec_id}/execute", headers=self.headers_a)
        self.assertEqual(exec_attempt.status_code, 400)

    def test_12_csv_import_success(self):
        """12. POST /api/import-csv validates and ingests merchant payment records."""
        sample_records = [
            {
                "transaction_id": f"TXN_CSV_01_{uuid.uuid4().hex[:6]}",
                "amount": 2500.0,
                "expected_settlement": 2420.0,
                "actual_settlement": 2420.0,
                "payment_method": "UPI",
                "fee": 45.0,
                "date": "2026-08-26"
            },
            {
                "transaction_id": f"TXN_CSV_02_{uuid.uuid4().hex[:6]}",
                "amount": 5000.0,
                "expected_settlement": 4850.0,
                "actual_settlement": 4250.0,
                "payment_method": "CARD",
                "refund_amount": 600.0,
                "date": "2026-08-26"
            }
        ]

        resp = self.client.post("/api/import-csv", json={"records": sample_records}, headers=self.headers_a)
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["imported_count"], 2)

    def test_13_csv_import_validation_rejection(self):
        """13. POST /api/import-csv rejects empty list or negative amounts."""
        resp1 = self.client.post("/api/import-csv", json={"records": []}, headers=self.headers_a)
        self.assertEqual(resp1.status_code, 400)

        bad_records = [
            {"transaction_id": "TXN_BAD", "amount": -100.0, "expected_settlement": -100.0}
        ]
        resp2 = self.client.post("/api/import-csv", json={"records": bad_records}, headers=self.headers_a)
        self.assertEqual(resp2.status_code, 400)

    def test_14_csv_import_tenant_isolation(self):
        """14. User B cannot see User A's imported CSV payments in database."""
        db = get_database()
        col = db["tenant_imported_transactions"]
        user_a_records = list(col.find({"user_id": self.user_a_id}))
        self.assertGreaterEqual(len(user_a_records), 2)

        user_b_records = list(col.find({"user_id": self.user_b_id}))
        self.assertEqual(len(user_b_records), 0)

    def test_15_existing_transaction_counterfactual_route(self):
        """15. GET /api/counterfactual/<tx_id> still works for existing disputed transactions."""
        resp = self.client.get("/api/counterfactual/TXN_1003", headers=self.headers_a)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data["transaction_id"], "TXN_1003")
        self.assertIn("Missing Settlement", data["title"])

    def test_16_settlement_timing_days_boundary(self):
        """16. Simulation rejects invalid settlement timing days (>2)."""
        resp = self.client.post("/api/counterfactual/simulate", json={
            "gross_amount": 10000.0,
            "settlement_timing_days": 5
        }, headers=self.headers_a)
        self.assertEqual(resp.status_code, 400)

    def test_17_refund_negative_boundary(self):
        """17. Simulation rejects negative refund amount."""
        resp = self.client.post("/api/counterfactual/simulate", json={
            "gross_amount": 10000.0,
            "refund_amount": -50.0
        }, headers=self.headers_a)
        self.assertEqual(resp.status_code, 400)

    def test_18_unauthenticated_csv_import_protection(self):
        """18. POST /api/import-csv without auth token returns 401 Unauthorized."""
        resp = self.client.post("/api/import-csv", json={"records": [{"transaction_id": "TXN_1"}]})
        self.assertEqual(resp.status_code, 401)


if __name__ == "__main__":
    unittest.main(verbosity=2)
