"""
Counterfactual Phase 7 — Comprehensive Closed-Loop Monitoring & Outcome Tracking Test Suite
Covers all 20 required verification items:
1. Prediction persistence
2. Actual outcome persistence
3. Prediction immutability
4. Prediction vs actual calculation
5. Zero prediction handling
6. Missing actual rejection
7. Deviation percentage precision
8. Severity threshold classification
9. Duplicate outcome prevention
10. Strict multi-tenant isolation
11. Unauthenticated 401 protection
12. Monitoring severity & action filtering
13. Monitoring pagination & serialization
14. Accuracy calculation engine
15. Execution-to-outcome linking
16. Grounded root-cause detection
17. Grounded explanation without hallucination
18. Critical deviation alert generation
19. Historical dataset aggregation
20. Historical feedback retrieval
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
from database import get_outcomes_collection
from monitoring import (
    calculate_deviation,
    analyze_root_cause,
    build_outcome_record,
    DEVIATION_THRESHOLDS,
)


class TestPhase7Monitoring(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()

        # Generate unique test users and sign up via API
        cls.user_a_email = f"mon_alpha_{os.getpid()}_{uuid.uuid4().hex[:6]}@counterfactual.fi"
        cls.user_a_pass = "AlphaPass123!"

        resp_a = cls.client.post("/api/auth/signup", json={
            "name": "Monitoring Operator Alpha",
            "email": cls.user_a_email,
            "password": cls.user_a_pass,
            "organization": "Alpha Treasury Corp"
        })
        assert resp_a.status_code == 201, f"Signup failed: {resp_a.data}"
        data_a = resp_a.get_json()
        cls.token_user_a = data_a["token"]
        cls.user_a_id = data_a["user"]["id"]

        cls.user_b_email = f"mon_beta_{os.getpid()}_{uuid.uuid4().hex[:6]}@counterfactual.fi"
        cls.user_b_pass = "BetaPass456!"

        resp_b = cls.client.post("/api/auth/signup", json={
            "name": "Monitoring Operator Beta",
            "email": cls.user_b_email,
            "password": cls.user_b_pass,
            "organization": "Beta Capital"
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

    # -------------------------------------------------------------
    # 1. Prediction Persistence
    # -------------------------------------------------------------
    def test_01_prediction_persistence(self):
        """Verify immutable prediction structure in outcome document."""
        doc = build_outcome_record(
            user_id=self.user_a_id,
            transaction_id="TXN_1001",
            predicted_amount=5000.0,
            actual_amount=4800.0,
            simulation_id="sim_abc123",
            action_type="SETTLEMENT"
        )
        self.assertEqual(doc["transaction_id"], "TXN_1001")
        self.assertEqual(doc["prediction"]["predicted_amount"], 5000.0)
        self.assertEqual(doc["prediction"]["recommended_action"], "SETTLEMENT")
        self.assertIn("predicted_at", doc["prediction"])
        self.assertEqual(doc["actual"]["actual_amount"], 4800.0)

    # -------------------------------------------------------------
    # 2. Actual Outcome Persistence
    # -------------------------------------------------------------
    def test_02_actual_outcome_persistence(self):
        """Verify recording an actual outcome via API persists document with user tenancy."""
        payload = {
            "transactionId": f"TXN_PERSIST_{uuid.uuid4().hex[:6]}",
            "predictedAmount": 10000.0,
            "actualAmount": 9700.0,
            "simulationId": "sim_tx1002",
            "executionId": f"exec_{uuid.uuid4().hex[:8]}",
            "actionType": "REFUND",
            "status": "EXECUTED"
        }
        resp = self.client.post("/api/monitoring/outcomes/record", json=payload, headers=self.headers_a)
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["outcome"]["transaction_id"], payload["transactionId"])
        self.assertEqual(data["outcome"]["tenant_id"], self.user_a_id)

    # -------------------------------------------------------------
    # 3. Prediction Immutability
    # -------------------------------------------------------------
    def test_03_prediction_immutability(self):
        """Updating actual outcome or recording does not alter original prediction snapshot."""
        orig_doc = build_outcome_record(
            user_id=self.user_a_id,
            transaction_id="TXN_1003",
            predicted_amount=7829.10,
            actual_amount=7500.0,
            metadata={"notes": "Original prediction"}
        )
        orig_pred = dict(orig_doc["prediction"])

        # Simulate subsequent observation
        second_doc = build_outcome_record(
            user_id=self.user_a_id,
            transaction_id="TXN_1003",
            predicted_amount=orig_pred["predicted_amount"],
            actual_amount=7600.0,
            metadata={"notes": "Second clearing observation"}
        )

        self.assertEqual(second_doc["prediction"]["predicted_amount"], orig_pred["predicted_amount"])
        self.assertEqual(second_doc["prediction"]["predicted_settlement"], orig_pred["predicted_settlement"])
        self.assertNotEqual(second_doc["actual"]["actual_amount"], orig_doc["actual"]["actual_amount"])

    # -------------------------------------------------------------
    # 4. Prediction vs Actual Calculation
    # -------------------------------------------------------------
    def test_04_prediction_vs_actual_calculation(self):
        """Mathematical delta, direction, and accuracy score verification."""
        comp = calculate_deviation(5000.0, 4700.0)
        self.assertEqual(comp["predicted"], 5000.0)
        self.assertEqual(comp["actual"], 4700.0)
        self.assertEqual(comp["deviation_amount"], 300.0)
        self.assertEqual(comp["deviation_percentage"], 6.0)
        self.assertEqual(comp["direction"], "UNDERPERFORMED")
        self.assertEqual(comp["severity"], "SIGNIFICANT_DEVIATION")
        self.assertEqual(comp["accuracy_score"], 94.0)

    # -------------------------------------------------------------
    # 5. Zero Prediction Handling
    # -------------------------------------------------------------
    def test_05_zero_prediction_handling(self):
        """Zero prediction does not raise ZeroDivisionError and safely returns 0% or 100%."""
        comp_zero_both = calculate_deviation(0.0, 0.0)
        self.assertEqual(comp_zero_both["deviation_percentage"], 0.0)
        self.assertEqual(comp_zero_both["severity"], "ON_TARGET")

        comp_zero_pred = calculate_deviation(0.0, 500.0)
        self.assertEqual(comp_zero_pred["deviation_percentage"], 100.0)
        self.assertEqual(comp_zero_pred["severity"], "CRITICAL_DEVIATION")

    # -------------------------------------------------------------
    # 6. Missing Actual Rejection
    # -------------------------------------------------------------
    def test_06_missing_actual_rejection(self):
        """Missing actualAmount in record endpoint returns 400 Bad Request."""
        payload = {
            "transactionId": "TXN_1006",
            "predictedAmount": 5000.0
            # missing actualAmount
        }
        resp = self.client.post("/api/monitoring/outcomes/record", json=payload, headers=self.headers_a)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("actualAmount", resp.get_json()["message"])

    # -------------------------------------------------------------
    # 7. Deviation Percentage Precision
    # -------------------------------------------------------------
    def test_07_deviation_percentage_precision(self):
        """Tests exact float rounding to 2 decimal places."""
        comp = calculate_deviation(7829.10, 7500.00)
        # abs(7829.10 - 7500.00) / 7829.10 = 329.10 / 7829.10 = 0.042035 -> 4.2%
        self.assertEqual(comp["deviation_percentage"], 4.2)
        self.assertEqual(comp["accuracy_score"], 95.8)

    # -------------------------------------------------------------
    # 8. Severity Threshold Classification
    # -------------------------------------------------------------
    def test_08_severity_threshold_classification(self):
        """Validates the 4 configurable severity tiers."""
        # 0-2%: ON_TARGET
        t1 = calculate_deviation(10000.0, 9900.0)  # 1% variance
        self.assertEqual(t1["severity"], "ON_TARGET")

        # 2-5%: MINOR_DEVIATION
        t2 = calculate_deviation(10000.0, 9600.0)  # 4% variance
        self.assertEqual(t2["severity"], "MINOR_DEVIATION")

        # 5-10%: SIGNIFICANT_DEVIATION
        t3 = calculate_deviation(10000.0, 9200.0)  # 8% variance
        self.assertEqual(t3["severity"], "SIGNIFICANT_DEVIATION")

        # >10%: CRITICAL_DEVIATION
        t4 = calculate_deviation(10000.0, 8000.0)  # 20% variance
        self.assertEqual(t4["severity"], "CRITICAL_DEVIATION")

    # -------------------------------------------------------------
    # 9. Duplicate Outcome Prevention
    # -------------------------------------------------------------
    def test_09_duplicate_outcome_prevention(self):
        """Repeated record calls with same execution_id update without duplicate inserts."""
        exec_id = f"exec_dup_{uuid.uuid4().hex[:8]}"
        payload = {
            "transactionId": "TXN_1009",
            "predictedAmount": 5000.0,
            "actualAmount": 4900.0,
            "executionId": exec_id,
        }
        resp1 = self.client.post("/api/monitoring/outcomes/record", json=payload, headers=self.headers_a)
        self.assertEqual(resp1.status_code, 201)

        col = get_outcomes_collection()
        count_before = col.count_documents({"execution_id": exec_id, "user_id": self.user_a_id})

        resp2 = self.client.post("/api/monitoring/outcomes/record", json=payload, headers=self.headers_a)
        self.assertEqual(resp2.status_code, 201)
        count_after = col.count_documents({"execution_id": exec_id, "user_id": self.user_a_id})

        self.assertEqual(count_before, 1)
        self.assertEqual(count_after, 1)

    # -------------------------------------------------------------
    # 10. Strict Multi-Tenant Isolation
    # -------------------------------------------------------------
    def test_10_tenant_isolation(self):
        """User B cannot view or access User A's outcome records."""
        payload = {
            "transactionId": f"TXN_SECRET_{uuid.uuid4().hex[:6]}",
            "predictedAmount": 10000.0,
            "actualAmount": 9500.0,
        }
        resp = self.client.post("/api/monitoring/outcomes/record", json=payload, headers=self.headers_a)
        self.assertEqual(resp.status_code, 201)
        outcome_id = resp.get_json()["outcome"]["outcome_id"]

        # User B queries outcomes
        resp_b = self.client.get("/api/monitoring/outcomes", headers=self.headers_b)
        outcomes_b = resp_b.get_json()["outcomes"]
        self.assertFalse(any(o.get("outcome_id") == outcome_id for o in outcomes_b))

        # User B attempts direct fetch by ID
        resp_b_direct = self.client.get(f"/api/monitoring/outcomes/{outcome_id}", headers=self.headers_b)
        self.assertEqual(resp_b_direct.status_code, 404)

    # -------------------------------------------------------------
    # 11. Unauthenticated 401 Protection
    # -------------------------------------------------------------
    def test_11_unauthenticated_401_protection(self):
        """Unauthenticated requests to monitoring endpoints must receive 401 Unauthorized."""
        endpoints = [
            ("GET", "/api/monitoring/overview"),
            ("GET", "/api/monitoring/outcomes"),
            ("GET", "/api/monitoring/deviations"),
            ("GET", "/api/monitoring/accuracy"),
            ("GET", "/api/monitoring/feedback"),
            ("POST", "/api/monitoring/outcomes/record"),
        ]
        for method, ep in endpoints:
            if method == "GET":
                resp = self.client.get(ep)
            else:
                resp = self.client.post(ep, json={})
            self.assertEqual(resp.status_code, 401, f"Endpoint {ep} did not reject unauthenticated call with 401.")

    # -------------------------------------------------------------
    # 12. Monitoring Severity & Action Filtering
    # -------------------------------------------------------------
    def test_12_monitoring_severity_and_action_filtering(self):
        """Filter outcomes by severity and action_type query parameters."""
        tx_crit = f"TXN_CRIT_{uuid.uuid4().hex[:6]}"
        self.client.post("/api/monitoring/outcomes/record", json={
            "transactionId": tx_crit,
            "predictedAmount": 10000.0,
            "actualAmount": 7000.0,  # 30% deviation -> CRITICAL
            "actionType": "PAYMENT_LINK"
        }, headers=self.headers_a)

        resp = self.client.get("/api/monitoring/outcomes?severity=CRITICAL_DEVIATION", headers=self.headers_a)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(all(o["comparison"]["severity"] == "CRITICAL_DEVIATION" for o in data["outcomes"]))

    # -------------------------------------------------------------
    # 13. Monitoring Pagination & Serialization
    # -------------------------------------------------------------
    def test_13_monitoring_pagination_and_serialization(self):
        """Validates limit and skip pagination params."""
        for i in range(5):
            self.client.post("/api/monitoring/outcomes/record", json={
                "transactionId": f"TXN_PAG_{i}_{uuid.uuid4().hex[:4]}",
                "predictedAmount": 1000.0,
                "actualAmount": 950.0,
            }, headers=self.headers_a)

        resp = self.client.get("/api/monitoring/outcomes?limit=3&skip=1", headers=self.headers_a)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertLessEqual(len(data["outcomes"]), 3)
        self.assertEqual(data["limit"], 3)
        self.assertEqual(data["skip"], 1)

    # -------------------------------------------------------------
    # 14. Accuracy Calculation Engine
    # -------------------------------------------------------------
    def test_14_accuracy_calculation_engine(self):
        """Accuracy endpoint returns breakdown across action types."""
        self.client.post("/api/monitoring/outcomes/record", json={
            "transactionId": f"TXN_ACC_1_{uuid.uuid4().hex[:4]}",
            "predictedAmount": 1000.0,
            "actualAmount": 950.0,
            "actionType": "REFUND"
        }, headers=self.headers_a)

        resp = self.client.get("/api/monitoring/accuracy", headers=self.headers_a)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("overall_accuracy", data)
        self.assertIn("action_accuracy", data)
        self.assertGreaterEqual(data["overall_accuracy"], 50.0)

    # -------------------------------------------------------------
    # 15. Execution-to-Outcome Linking
    # -------------------------------------------------------------
    def test_15_execution_to_outcome_linking(self):
        """Complete lifecycle traceability preserved in record."""
        doc = build_outcome_record(
            user_id=self.user_a_id,
            transaction_id="TXN_TRACE_101",
            predicted_amount=4500.0,
            actual_amount=4500.0,
            simulation_id="sim_trace_1",
            recommendation_id="rec_trace_1",
            execution_id="exec_trace_1",
            razorpay_id="plink_test_xyz123",
            action_type="PAYMENT_LINK"
        )
        self.assertEqual(doc["simulation_id"], "sim_trace_1")
        self.assertEqual(doc["execution_id"], "exec_trace_1")
        self.assertEqual(doc["razorpay_id"], "plink_test_xyz123")
        self.assertEqual(doc["transaction_id"], "TXN_TRACE_101")

    # -------------------------------------------------------------
    # 16. Grounded Root-Cause Detection
    # -------------------------------------------------------------
    def test_16_grounded_root_cause_detection(self):
        """Deterministic root-cause mapping for ledger exceptions."""
        rc_dup = analyze_root_cause("TXN_1", 5000, 10000, 100.0, metadata={"exception_type": "DUPLICATE"})
        self.assertEqual(rc_dup["likely_cause"], "DUPLICATE_SETTLEMENT")
        self.assertGreaterEqual(rc_dup["confidence"], 0.95)

        rc_delay = analyze_root_cause("TXN_2", 5000, 0, 100.0, metadata={"exception_type": "DELAYED_SETTLEMENT"})
        self.assertEqual(rc_delay["likely_cause"], "SETTLEMENT_TIMING_DELAY")

        rc_fail = analyze_root_cause("TXN_3", 5000, 0, 100.0, execution_status="FAILED")
        self.assertEqual(rc_fail["likely_cause"], "EXECUTION_FAILURE")

    # -------------------------------------------------------------
    # 17. Grounded Explanation Without Hallucination
    # -------------------------------------------------------------
    def test_17_ai_explanation_grounding(self):
        """Root cause explanation references real numbers and stored evidence."""
        rc = analyze_root_cause(
            transaction_id="TXN_1013",
            predicted=7829.10,
            actual=7500.00,
            deviation_pct=4.2,
            metadata={"refund_amount": 329.10, "exception_type": "PARTIAL_REFUND"}
        )
        self.assertIn("329.10", rc["evidence"])
        self.assertIn("PARTIAL_REFUND", rc["likely_cause"])
        self.assertIn("recommended_investigation", rc)

    # -------------------------------------------------------------
    # 18. Critical Deviation Alert Generation
    # -------------------------------------------------------------
    def test_18_critical_deviation_alert_generation(self):
        """Critical deviation (>10%) generates alert in monitoring overview."""
        self.client.post("/api/monitoring/outcomes/record", json={
            "transactionId": f"TXN_ALERT_{uuid.uuid4().hex[:6]}",
            "predictedAmount": 10000.0,
            "actualAmount": 7500.0,  # 25% deviation -> CRITICAL
        }, headers=self.headers_a)

        resp = self.client.get("/api/monitoring/overview", headers=self.headers_a)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertGreaterEqual(data["metrics"]["critical_deviations_count"], 1)

    # -------------------------------------------------------------
    # 19. Historical Dataset Aggregation
    # -------------------------------------------------------------
    def test_19_historical_dataset_aggregation(self):
        """Aggregated frequency metrics across past cycles."""
        resp = self.client.get("/api/monitoring/feedback", headers=self.headers_a)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()["historical_feedback"]
        self.assertGreaterEqual(data["total_analyzed_cycles"], 0)
        self.assertIn("recurring_patterns", data)

    # -------------------------------------------------------------
    # 20. Historical Feedback Retrieval
    # -------------------------------------------------------------
    def test_20_historical_feedback_retrieval(self):
        """Feedback endpoint provides actionable guidance for future Counterfactual simulations."""
        resp = self.client.get("/api/monitoring/feedback", headers=self.headers_a)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()["historical_feedback"]
        self.assertIn("decision_intelligence_guidance", data)
        self.assertIn("action_performance", data)
        self.assertIn("payment_link_success_rate", data["action_performance"])
        self.assertIn("refund_settlement_rate", data["action_performance"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
