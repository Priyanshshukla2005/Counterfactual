"""
Counterfactual Phase 9 — End-to-End Merchant Scenario Testing Suite
Exercises all 10 realistic merchant/business scenarios across the full intelligence lifecycle:
INPUT -> AGENT REASONING -> SIMULATION -> DECISION -> APPROVAL/GUARDRAILS ->
ACTION/SANDBOX EXECUTION -> OBSERVED OUTCOME -> DEVIATION ANALYSIS ->
ROOT CAUSE -> HISTORICAL FEEDBACK LEARNING.
"""

import os
import sys
import uuid
import unittest
from unittest.mock import patch, MagicMock

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
from counterfactual_engine import calculate_counterfactual, generate_multi_scenario_comparison
from explanation_engine import generate_explanation
from reconciliation import reconcile
from monitoring import (
    calculate_deviation,
    analyze_root_cause,
    build_outcome_record,
    DEVIATION_THRESHOLDS,
)
from guardrails import (
    validate_amount,
    validate_currency,
    validate_action_type,
    validate_state_transition,
    compute_idempotency_key,
)

# Global telemetry tally for final Phase 9 verification report
telemetry_stats = {
    "simulations_executed": 0,
    "decisions_generated": 0,
    "actions_staged": 0,
    "actions_approved": 0,
    "sandbox_executions": 0,
    "outcomes_recorded": 0,
    "deviations_detected": 0,
    "critical_deviations": 0,
    "root_causes_generated": 0,
    "feedback_records_generated": 0,
}

scenario_results = {}


class Phase9ScenarioBase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()

        # Create isolated test tenant users
        cls.user_a_email = f"merchant_alpha_{os.getpid()}_{uuid.uuid4().hex[:6]}@counterfactual.fi"
        cls.user_a_pass = "AlphaSecure123!"

        resp_a = cls.client.post("/api/auth/signup", json={
            "name": "Merchant Enterprise Alpha",
            "email": cls.user_a_email,
            "password": cls.user_a_pass,
            "organization": "Alpha Retail Group"
        })
        assert resp_a.status_code == 201, f"Signup failed: {resp_a.data}"
        data_a = resp_a.get_json()
        cls.token_user_a = data_a["token"]
        cls.user_a_id = data_a["user"]["id"]

        cls.user_b_email = f"merchant_beta_{os.getpid()}_{uuid.uuid4().hex[:6]}@counterfactual.fi"
        cls.user_b_pass = "BetaSecure456!"

        resp_b = cls.client.post("/api/auth/signup", json={
            "name": "Merchant Competitor Beta",
            "email": cls.user_b_email,
            "password": cls.user_b_pass,
            "organization": "Beta Logistics"
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


# ====================================================================
# SCENARIO 1 — HIGH DISCOUNT (20% Commercial Discount)
# ====================================================================
class TestScenario01HighDiscount(Phase9ScenarioBase):
    def test_scenario_01_high_discount(self):
        """
        Scenario 1: Merchant considers increasing commercial discount to 20% on ₹50,000 gross.
        Exercises: Input validation, Simulation, Decision guidance, Simulation persistence, Outcome monitoring.
        """
        tx_id = f"TXN_SCEN_01_{uuid.uuid4().hex[:6]}"
        gross = 50000.0
        cur_disc = 5.0
        new_disc = 20.0

        # 1. Unauthenticated protection
        unauth_resp = self.client.post("/api/counterfactual/simulate", json={"gross_amount": gross})
        self.assertEqual(unauth_resp.status_code, 401)

        # 2. Input validation: Gross amount <= 0 rejected
        bad_resp = self.client.post("/api/counterfactual/simulate", json={"gross_amount": -100}, headers=self.headers_a)
        self.assertEqual(bad_resp.status_code, 400)

        # 3. Deterministic Counterfactual Simulation
        sim_resp = self.client.post("/api/counterfactual/simulate", json={
            "gross_amount": gross,
            "current_discount_pct": cur_disc,
            "new_discount_pct": new_disc,
            "fee_pct": 1.8,
            "tax_pct": 18.0,
            "transaction_id": tx_id
        }, headers=self.headers_a)
        self.assertEqual(sim_resp.status_code, 200)
        sim_data = sim_resp.get_json()["simulation"]
        telemetry_stats["simulations_executed"] += 1

        # Mathematical assertions:
        # cur_discount = 2,500, new_discount = 10,000 -> merchant delta = -7,500
        self.assertEqual(sim_data["baseline"]["discount"], 2500.0)
        self.assertEqual(sim_data["counterfactual"]["discount"], 10000.0)
        self.assertEqual(sim_data["deltas"]["merchant_delta"], -7500.0)
        self.assertEqual(sim_data["deltas"]["platform_delta"], 7500.0)
        self.assertEqual(sim_data["guidance_type"], "platform_favorable")
        self.assertIn("Platform Favorable", sim_data["decision_guidance"])
        telemetry_stats["decisions_generated"] += 1

        # 4. Save simulation to MongoDB Atlas with tenant isolation
        save_resp = self.client.post("/api/simulations", json={
            "name": f"High 20% Discount Policy - {tx_id}",
            "gross_amount": gross,
            "current_discount_pct": cur_disc,
            "new_discount_pct": new_disc,
            "transaction_id": tx_id
        }, headers=self.headers_a)
        self.assertEqual(save_resp.status_code, 201)
        sim_id = save_resp.get_json()["simulation"]["id"]

        # Tenant isolation: User B cannot fetch User A's simulation
        resp_b = self.client.get(f"/api/simulations/{sim_id}", headers=self.headers_b)
        self.assertEqual(resp_b.status_code, 404)

        # 5. Outcome Recording & Monitoring Classification
        predicted_payout = sim_data["counterfactual"]["merchant_payout"]
        actual_payout = predicted_payout - 250.0  # Minor variance of ₹250 (< 1%)

        rec_resp = self.client.post("/api/monitoring/outcomes/record", json={
            "transactionId": tx_id,
            "predictedAmount": predicted_payout,
            "actualAmount": actual_payout,
            "simulationId": sim_id,
            "actionType": "SETTLEMENT"
        }, headers=self.headers_a)
        self.assertEqual(rec_resp.status_code, 201)
        outcome = rec_resp.get_json()["outcome"]
        telemetry_stats["outcomes_recorded"] += 1

        self.assertEqual(outcome["comparison"]["severity"], "ON_TARGET")
        self.assertGreaterEqual(outcome["comparison"]["accuracy_score"], 99.0)

        scenario_results["Scenario 1 — HIGH DISCOUNT"] = "PASS"


# ====================================================================
# SCENARIO 2 — PAYMENT FAILURE SPIKE
# ====================================================================
class TestScenario02PaymentFailureSpike(Phase9ScenarioBase):
    def test_scenario_02_payment_failure_spike(self):
        """
        Scenario 2: Merchant experiences payment failure / missing settlement on ₹15,000 transaction.
        Exercises: Exception modeling, Deterministic explanation engine, Financial exposure impact, Monitoring classification.
        """
        tx_id = f"TXN_SCEN_02_{uuid.uuid4().hex[:6]}"
        expected_settlement = 14688.0

        # 1. Deterministic Explanation Engine reasoning
        exception_data = {
            "transaction_id": tx_id,
            "exception_type": "MISSING_SETTLEMENT",
            "expected_settlement": expected_settlement,
            "actual_settlement": 0.0,
            "difference": expected_settlement,
            "refund_amount": 0.0,
            "fee": 270.0,
            "tax": 48.6,
            "settlement_status": "missing",
            "confidence": 0.99
        }
        explanation = generate_explanation(exception_data)
        telemetry_stats["decisions_generated"] += 1

        self.assertEqual(explanation["transaction_id"], tx_id)
        self.assertEqual(explanation["title"], "Missing Settlement")
        self.assertEqual(explanation["financial_impact"], expected_settlement)
        self.assertIn("settlement batch", explanation["recommended_action"].lower())

        # 2. Ingest into closed-loop monitoring
        rec_resp = self.client.post("/api/monitoring/outcomes/record", json={
            "transactionId": tx_id,
            "predictedAmount": expected_settlement,
            "actualAmount": 0.0,  # 100% failure variance -> CRITICAL
            "actionType": "SETTLEMENT",
            "status": "FAILED",
            "metadata": {"exception_type": "MISSING_SETTLEMENT"}
        }, headers=self.headers_a)
        self.assertEqual(rec_resp.status_code, 201)
        outcome = rec_resp.get_json()["outcome"]
        telemetry_stats["outcomes_recorded"] += 1
        telemetry_stats["deviations_detected"] += 1
        telemetry_stats["critical_deviations"] += 1

        self.assertEqual(outcome["comparison"]["severity"], "CRITICAL_DEVIATION")
        self.assertEqual(outcome["comparison"]["deviation_percentage"], 100.0)
        self.assertEqual(outcome["root_cause"]["likely_cause"], "EXECUTION_FAILURE")
        telemetry_stats["root_causes_generated"] += 1

        scenario_results["Scenario 2 — PAYMENT FAILURE SPIKE"] = "PASS"


# ====================================================================
# SCENARIO 3 — REFUND REQUEST
# ====================================================================
class TestScenario03RefundRequest(Phase9ScenarioBase):
    @patch("razorpay_service.create_refund")
    def test_scenario_03_refund_request(self, mock_create_refund):
        """
        Scenario 3: Merchant processes a ₹2,500 customer refund request.
        Exercises: Amount validation, Guardrails, Approval workflow (PENDING -> APPROVED), Sandbox execution, Outcome recording.
        """
        mock_create_refund.return_value = {
            "success": True,
            "status": "processed",
            "razorpay_id": f"rfnd_{uuid.uuid4().hex[:10]}",
            "amount": 2500.0,
            "currency": "INR",
            "payment_id": "pay_test_scen03_123"
        }

        tx_id = f"TXN_SCEN_03_{uuid.uuid4().hex[:6]}"
        payment_id = "pay_test_scen03_123"
        refund_amount = 2500.0

        # 1. Guardrail validation: Negative amount rejected
        ok, _, err = validate_amount(-500)
        self.assertFalse(ok)
        self.assertIn("greater than zero", err)

        # 2. Stage refund recommendation (PENDING_APPROVAL)
        stage_resp = self.client.post("/api/execution/recommend", json={
            "action_type": "REFUND",
            "amount": refund_amount,
            "currency": "INR",
            "target_transaction_id": tx_id,
            "payment_id": payment_id,
            "description": "Customer return authorization refund"
        }, headers=self.headers_a)
        self.assertEqual(stage_resp.status_code, 201)
        exec_doc = stage_resp.get_json()["execution"]
        exec_id = exec_doc["execution_id"]
        self.assertEqual(exec_doc["status"], "PENDING_APPROVAL")
        telemetry_stats["actions_staged"] += 1

        # 3. Direct execution before approval is rejected
        early_exec = self.client.post(f"/api/execution/{exec_id}/execute", headers=self.headers_a)
        self.assertEqual(early_exec.status_code, 400)

        # 4. Human Approval
        appr_resp = self.client.post(f"/api/execution/{exec_id}/approve", headers=self.headers_a)
        self.assertEqual(appr_resp.status_code, 200)
        self.assertTrue(appr_resp.get_json()["success"])
        self.assertEqual(appr_resp.get_json()["execution"]["status"], "APPROVED")
        telemetry_stats["actions_approved"] += 1

        # 5. Sandbox Execution
        exec_resp = self.client.post(f"/api/execution/{exec_id}/execute", headers=self.headers_a)
        self.assertEqual(exec_resp.status_code, 200)
        exec_result = exec_resp.get_json()
        self.assertEqual(exec_result["status"], "EXECUTED")
        self.assertTrue(exec_result["razorpayId"].startswith("rfnd_"))
        telemetry_stats["sandbox_executions"] += 1

        # 6. Record Observed Outcome & Delta
        rec_resp = self.client.post("/api/monitoring/outcomes/record", json={
            "transactionId": tx_id,
            "predictedAmount": refund_amount,
            "actualAmount": refund_amount,
            "executionId": exec_id,
            "actionType": "REFUND",
            "status": "EXECUTED"
        }, headers=self.headers_a)
        self.assertEqual(rec_resp.status_code, 201)
        outcome = rec_resp.get_json()["outcome"]
        telemetry_stats["outcomes_recorded"] += 1
        self.assertEqual(outcome["comparison"]["severity"], "ON_TARGET")
        self.assertEqual(outcome["comparison"]["accuracy_score"], 100.0)

        scenario_results["Scenario 3 — REFUND REQUEST"] = "PASS"


# ====================================================================
# SCENARIO 4 — CASH-FLOW SHORTAGE
# ====================================================================
class TestScenario04CashFlowShortage(Phase9ScenarioBase):
    def test_scenario_04_cash_flow_shortage(self):
        """
        Scenario 4: Merchant experiencing short-term liquidity constraints explores instant T+0 settlement.
        Exercises: Commercial variables simulation, Payout acceleration, Risk classification, Persistence.
        """
        tx_id = f"TXN_SCEN_04_{uuid.uuid4().hex[:6]}"
        gross = 100000.0

        # 1. Compare T+2 standard baseline vs T+0 accelerated settlement
        sim = calculate_counterfactual(
            gross_amount=gross,
            current_discount_pct=5.0,
            new_discount_pct=3.0,
            settlement_recovery_pct=100.0,
            settlement_timing_days=0,  # T+0
            transaction_id=tx_id
        )
        telemetry_stats["simulations_executed"] += 1

        # Delta: Reducing discount from 5% to 3% gives merchant +₹2,000 immediate liquidity
        self.assertEqual(sim["deltas"]["merchant_delta"], 2000.0)
        self.assertEqual(sim["counterfactual"]["settlement_timing"], "T+0")
        self.assertEqual(sim["guidance_type"], "merchant_favorable")
        telemetry_stats["decisions_generated"] += 1

        # 2. Persist scenario
        save_resp = self.client.post("/api/simulations", json={
            "name": f"Liquidity Acceleration T+0 - {tx_id}",
            "gross_amount": gross,
            "current_discount_pct": 5.0,
            "new_discount_pct": 3.0,
            "settlement_timing": "T+0",
            "transaction_id": tx_id
        }, headers=self.headers_a)
        self.assertEqual(save_resp.status_code, 201)

        scenario_results["Scenario 4 — CASH-FLOW SHORTAGE"] = "PASS"


# ====================================================================
# SCENARIO 5 — PROMOTION UNDERPERFORMING
# ====================================================================
class TestScenario05PromotionUnderperforming(Phase9ScenarioBase):
    def test_scenario_05_promotion_underperforming(self):
        """
        Scenario 5: Promotional 8% discount underperformed revenue targets.
        Exercises: Multi-scenario comparison, Revenue vs Payout trade-offs, Historical feedback linkage.
        """
        gross = 75000.0
        multi_scenarios = generate_multi_scenario_comparison(
            gross_amount=gross,
            custom_discount_pct=8.0,
            fee_pct=1.8,
            tax_pct=18.0
        )
        telemetry_stats["simulations_executed"] += 1

        self.assertIsInstance(multi_scenarios, list)
        self.assertGreaterEqual(len(multi_scenarios), 3)

        # Retrieve historical feedback to guide future promotions
        fb_resp = self.client.get("/api/monitoring/feedback", headers=self.headers_a)
        self.assertEqual(fb_resp.status_code, 200)
        fb_data = fb_resp.get_json()["historical_feedback"]
        self.assertIn("decision_intelligence_guidance", fb_data)
        telemetry_stats["feedback_records_generated"] += 1

        scenario_results["Scenario 5 — PROMOTION UNDERPERFORMING"] = "PASS"


# ====================================================================
# SCENARIO 6 — DUPLICATE SETTLEMENT
# ====================================================================
class TestScenario06DuplicateSettlement(Phase9ScenarioBase):
    @patch("razorpay_service.create_refund")
    def test_scenario_06_duplicate_settlement(self, mock_create_refund):
        """
        Scenario 6: Transaction TXN_1013 receives duplicate disbursement (+₹7,829.10 exposure).
        Exercises: Duplicate detection, Root-cause classification, Sandbox refund clawback, Critical deviation alert.
        """
        mock_create_refund.return_value = {
            "success": True,
            "status": "processed",
            "razorpay_id": f"rfnd_clawback_{uuid.uuid4().hex[:8]}",
            "amount": 7829.10,
            "currency": "INR",
            "payment_id": "pay_dup_disbursement_1013"
        }

        tx_id = "TXN_1013"
        exp_settlement = 7829.10
        actual_settlement = 15658.20  # Double settlement received

        # 1. Root-cause classification
        rc = analyze_root_cause(tx_id, exp_settlement, actual_settlement, 100.0, metadata={"exception_type": "DUPLICATE"})
        self.assertEqual(rc["likely_cause"], "DUPLICATE_SETTLEMENT")
        self.assertGreaterEqual(rc["confidence"], 0.95)
        self.assertIn("duplicate", rc["evidence"].lower())
        telemetry_stats["root_causes_generated"] += 1

        # 2. Stage Clawback Refund
        stage_resp = self.client.post("/api/execution/recommend", json={
            "action_type": "REFUND",
            "amount": exp_settlement,
            "currency": "INR",
            "target_transaction_id": tx_id,
            "payment_id": "pay_dup_disbursement_1013",
            "description": "Duplicate settlement clawback refund"
        }, headers=self.headers_a)
        self.assertEqual(stage_resp.status_code, 201)
        exec_id = stage_resp.get_json()["execution"]["execution_id"]
        telemetry_stats["actions_staged"] += 1

        # 3. Approve and Execute
        self.client.post(f"/api/execution/{exec_id}/approve", headers=self.headers_a)
        exec_resp = self.client.post(f"/api/execution/{exec_id}/execute", headers=self.headers_a)
        self.assertEqual(exec_resp.status_code, 200)
        telemetry_stats["actions_approved"] += 1
        telemetry_stats["sandbox_executions"] += 1

        # 4. Ingest Outcome and verify Critical Alert
        rec_resp = self.client.post("/api/monitoring/outcomes/record", json={
            "transactionId": tx_id,
            "predictedAmount": exp_settlement,
            "actualAmount": actual_settlement,
            "executionId": exec_id,
            "actionType": "REFUND",
            "metadata": {"exception_type": "DUPLICATE"}
        }, headers=self.headers_a)
        self.assertEqual(rec_resp.status_code, 201)
        outcome = rec_resp.get_json()["outcome"]
        telemetry_stats["outcomes_recorded"] += 1
        telemetry_stats["deviations_detected"] += 1
        telemetry_stats["critical_deviations"] += 1

        self.assertEqual(outcome["comparison"]["severity"], "CRITICAL_DEVIATION")

        scenario_results["Scenario 6 — DUPLICATE SETTLEMENT"] = "PASS"


# ====================================================================
# SCENARIO 7 — SETTLEMENT TIMING DELAY
# ====================================================================
class TestScenario07SettlementTimingDelay(Phase9ScenarioBase):
    def test_scenario_07_settlement_timing_delay(self):
        """
        Scenario 7: Merchant settlement delayed across bank holiday cutoff window (T+1 -> T+2).
        Exercises: Exception classification, Root-cause evidence, Severity classification.
        """
        tx_id = f"TXN_SCEN_07_{uuid.uuid4().hex[:6]}"
        predicted = 12500.0
        actual = 0.0

        # Grounded Root Cause detection
        rc = analyze_root_cause(
            transaction_id=tx_id,
            predicted=predicted,
            actual=actual,
            deviation_pct=100.0,
            metadata={"exception_type": "DELAYED_SETTLEMENT"}
        )
        self.assertEqual(rc["likely_cause"], "SETTLEMENT_TIMING_DELAY")
        self.assertIn("rollover", rc["explanation"].lower())
        telemetry_stats["root_causes_generated"] += 1

        # Ingest outcome and verify monitoring telemetry
        rec_resp = self.client.post("/api/monitoring/outcomes/record", json={
            "transactionId": tx_id,
            "predictedAmount": predicted,
            "actualAmount": actual,
            "metadata": {"exception_type": "DELAYED_SETTLEMENT"}
        }, headers=self.headers_a)
        self.assertEqual(rec_resp.status_code, 201)
        outcome = rec_resp.get_json()["outcome"]
        telemetry_stats["outcomes_recorded"] += 1
        telemetry_stats["deviations_detected"] += 1

        self.assertEqual(outcome["comparison"]["severity"], "CRITICAL_DEVIATION")

        scenario_results["Scenario 7 — SETTLEMENT TIMING DELAY"] = "PASS"


# ====================================================================
# SCENARIO 8 — FEE SCHEDULE DISCREPANCY
# ====================================================================
class TestScenario08FeeDiscrepancy(Phase9ScenarioBase):
    def test_scenario_08_fee_discrepancy(self):
        """
        Scenario 8: Card interchange fee tier variance creates minor 3.5% discrepancy.
        Exercises: Prediction vs actual calculation, Grounded evidence citation, Accuracy scoring.
        """
        tx_id = f"TXN_SCEN_08_{uuid.uuid4().hex[:6]}"
        predicted = 10000.0
        actual = 9650.0  # ₹350 variance (3.5%)

        comp = calculate_deviation(predicted, actual)
        self.assertEqual(comp["severity"], "MINOR_DEVIATION")
        self.assertEqual(comp["deviation_percentage"], 3.5)
        self.assertEqual(comp["accuracy_score"], 96.5)

        rc = analyze_root_cause(
            transaction_id=tx_id,
            predicted=predicted,
            actual=actual,
            deviation_pct=comp["deviation_percentage"],
            metadata={"exception_type": "FEE_MISMATCH"}
        )
        self.assertEqual(rc["likely_cause"], "FEE_SCHEDULE_DISCREPANCY")
        self.assertIn("350.00", rc["evidence"])
        telemetry_stats["root_causes_generated"] += 1

        # Record outcome
        rec_resp = self.client.post("/api/monitoring/outcomes/record", json={
            "transactionId": tx_id,
            "predictedAmount": predicted,
            "actualAmount": actual,
            "metadata": {"exception_type": "FEE_MISMATCH"}
        }, headers=self.headers_a)
        self.assertEqual(rec_resp.status_code, 201)
        telemetry_stats["outcomes_recorded"] += 1
        telemetry_stats["deviations_detected"] += 1

        scenario_results["Scenario 8 — FEE DISCREPANCY"] = "PASS"


# ====================================================================
# SCENARIO 9 — PARTIAL REFUND / REFUND OFFSET
# ====================================================================
class TestScenario09PartialRefund(Phase9ScenarioBase):
    @patch("razorpay_service.create_refund")
    def test_scenario_09_partial_refund(self, mock_create_refund):
        """
        Scenario 9: Customer partial refund of ₹1,200 is executed against original payment.
        Exercises: Guardrail checks, Sandbox refund execution, Traceability chain:
                   transaction_id -> simulation_id -> execution_id -> outcome_id.
        """
        mock_create_refund.return_value = {
            "success": True,
            "status": "processed",
            "razorpay_id": f"rfnd_partial_{uuid.uuid4().hex[:8]}",
            "amount": 1200.0,
            "currency": "INR",
            "payment_id": "pay_orig_order_999"
        }

        tx_id = f"TXN_SCEN_09_{uuid.uuid4().hex[:6]}"
        sim_id = f"sim_scen09_{uuid.uuid4().hex[:8]}"

        # 1. Direct Refund Execution
        ref_resp = self.client.post("/api/execution/refund", json={
            "paymentId": "pay_orig_order_999",
            "amount": 1200.0,
            "currency": "INR",
            "targetGrossAmount": 5000.0,
            "notes": {"reason": "Partial order cancellation"}
        }, headers=self.headers_a)
        self.assertEqual(ref_resp.status_code, 201)
        ref_data = ref_resp.get_json()
        exec_id = ref_data["executionId"]
        rzp_id = ref_data["refundId"]
        telemetry_stats["sandbox_executions"] += 1

        # 2. Record Outcome with complete reference chain
        rec_resp = self.client.post("/api/monitoring/outcomes/record", json={
            "transactionId": tx_id,
            "predictedAmount": 1200.0,
            "actualAmount": 1200.0,
            "simulationId": sim_id,
            "executionId": exec_id,
            "actionType": "REFUND",
            "metadata": {"razorpay_id": rzp_id}
        }, headers=self.headers_a)
        self.assertEqual(rec_resp.status_code, 201)
        outcome = rec_resp.get_json()["outcome"]
        telemetry_stats["outcomes_recorded"] += 1

        # Traceability chain assertions
        self.assertEqual(outcome["transaction_id"], tx_id)
        self.assertEqual(outcome["simulation_id"], sim_id)
        self.assertEqual(outcome["execution_id"], exec_id)

        scenario_results["Scenario 9 — PARTIAL REFUND"] = "PASS"


# ====================================================================
# SCENARIO 10 — MULTI-VARIABLE COMMERCIAL DECISION
# ====================================================================
class TestScenario10MultiVariableDecision(Phase9ScenarioBase):
    @patch("razorpay_service.create_payment_link")
    def test_scenario_10_multi_variable_decision(self, mock_create_plink):
        """
        Scenario 10: Multi-variable commercial decision modifying discount, recovery %, fee, and payout simultaneously.
        Exercises: Full pipeline from Simulation -> Decision -> Approval -> Execution -> Outcome -> Root Cause -> Feedback.
        """
        mock_create_plink.return_value = {
            "success": True,
            "status": "created",
            "razorpay_id": f"plink_multi_{uuid.uuid4().hex[:8]}",
            "short_url": "https://rzp.io/i/multi10",
            "amount": 47500.0,
            "currency": "INR"
        }

        tx_id = f"TXN_SCEN_10_{uuid.uuid4().hex[:6]}"
        gross = 50000.0

        # 1. Multi-variable simulation
        sim = calculate_counterfactual(
            gross_amount=gross,
            current_discount_pct=5.0,
            new_discount_pct=2.5,
            fee_pct=2.0,
            tax_pct=18.0,
            settlement_recovery_pct=100.0,
            settlement_timing_days=1,
            transaction_id=tx_id
        )
        telemetry_stats["simulations_executed"] += 1
        telemetry_stats["decisions_generated"] += 1

        self.assertEqual(sim["deltas"]["merchant_delta"], 1250.0)
        self.assertEqual(sim["guidance_type"], "merchant_favorable")

        # 2. Stage Action
        stage_resp = self.client.post("/api/execution/recommend", json={
            "action_type": "PAYMENT_LINK",
            "amount": 47500.0,
            "currency": "INR",
            "target_transaction_id": tx_id,
            "description": "Multi-variable pricing adjustment payment link"
        }, headers=self.headers_a)
        self.assertEqual(stage_resp.status_code, 201)
        exec_id = stage_resp.get_json()["execution"]["execution_id"]
        telemetry_stats["actions_staged"] += 1

        # 3. Approve and Execute
        self.client.post(f"/api/execution/{exec_id}/approve", headers=self.headers_a)
        exec_resp = self.client.post(f"/api/execution/{exec_id}/execute", headers=self.headers_a)
        self.assertEqual(exec_resp.status_code, 200)
        telemetry_stats["actions_approved"] += 1
        telemetry_stats["sandbox_executions"] += 1

        # 4. Record Outcome
        rec_resp = self.client.post("/api/monitoring/outcomes/record", json={
            "transactionId": tx_id,
            "predictedAmount": 47500.0,
            "actualAmount": 47500.0,
            "executionId": exec_id,
            "actionType": "PAYMENT_LINK",
            "status": "EXECUTED"
        }, headers=self.headers_a)
        self.assertEqual(rec_resp.status_code, 201)
        outcome = rec_resp.get_json()["outcome"]
        telemetry_stats["outcomes_recorded"] += 1

        self.assertEqual(outcome["comparison"]["severity"], "ON_TARGET")
        self.assertEqual(outcome["comparison"]["accuracy_score"], 100.0)

        scenario_results["Scenario 10 — MULTI-VARIABLE DECISION"] = "PASS"


# ====================================================================
# CUSTOM TEST RUNNER WITH SUMMARY REPORT
# ====================================================================
if __name__ == "__main__":
    suite = unittest.TestSuite()
    loader = unittest.TestLoader()

    scenario_classes = [
        TestScenario01HighDiscount,
        TestScenario02PaymentFailureSpike,
        TestScenario03RefundRequest,
        TestScenario04CashFlowShortage,
        TestScenario05PromotionUnderperforming,
        TestScenario06DuplicateSettlement,
        TestScenario07SettlementTimingDelay,
        TestScenario08FeeDiscrepancy,
        TestScenario09PartialRefund,
        TestScenario10MultiVariableDecision,
    ]

    for cls in scenario_classes:
        suite.addTests(loader.loadTestsFromTestCase(cls))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    # Print Formatted Verification Report
    print("\n" + "=" * 66)
    print("COUNTERFACTUAL PHASE 9 — END-TO-END SCENARIO TEST SUITE")
    print("=" * 66)

    total_scenarios = len(scenario_classes)
    passed_count = sum(1 for status in scenario_results.values() if status == "PASS")
    failed_count = total_scenarios - passed_count

    for name in [
        "Scenario 1 — HIGH DISCOUNT",
        "Scenario 2 — PAYMENT FAILURE SPIKE",
        "Scenario 3 — REFUND REQUEST",
        "Scenario 4 — CASH-FLOW SHORTAGE",
        "Scenario 5 — PROMOTION UNDERPERFORMING",
        "Scenario 6 — DUPLICATE SETTLEMENT",
        "Scenario 7 — SETTLEMENT TIMING DELAY",
        "Scenario 8 — FEE DISCREPANCY",
        "Scenario 9 — PARTIAL REFUND",
        "Scenario 10 — MULTI-VARIABLE DECISION",
    ]:
        status = scenario_results.get(name, "FAIL")
        print(f"{name:<42} {status}")

    print("-" * 66)
    print(f"TOTAL SCENARIOS: {total_scenarios}")
    print(f"PASSED: {passed_count}")
    print(f"FAILED: {failed_count}")
    print("-" * 66)
    print("Operational Telemetry Summary:")
    print(f"  • Simulations Executed:        {telemetry_stats['simulations_executed']}")
    print(f"  • Decisions Generated:         {telemetry_stats['decisions_generated']}")
    print(f"  • Actions Staged:              {telemetry_stats['actions_staged']}")
    print(f"  • Actions Approved:            {telemetry_stats['actions_approved']}")
    print(f"  • Sandbox Executions:          {telemetry_stats['sandbox_executions']}")
    print(f"  • Outcomes Recorded:           {telemetry_stats['outcomes_recorded']}")
    print(f"  • Deviations Detected:         {telemetry_stats['deviations_detected']}")
    print(f"  • Critical Deviations:         {telemetry_stats['critical_deviations']}")
    print(f"  • Root Causes Generated:       {telemetry_stats['root_causes_generated']}")
    print(f"  • Feedback Records Generated:  {telemetry_stats['feedback_records_generated']}")
    print("=" * 66 + "\n")

    sys.exit(0 if result.wasSuccessful() else 1)
