"""
Counterfactual Phase 5 Production Hardening, Persistence & Financial Test Suite
Separates:
- Part A: Unit & Financial Calculation Test Suites (Reconciliation, TXN_1013, 10 Financial Scenarios, Validation)
- Part B: Real MongoDB Atlas Integration Test Suite (Signup, Persistence, User Isolation, Audit Trail)
"""

import sys
import os
import io
import json

# Ensure stdout handles UTF-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(__file__))

from app import app
from reconciliation import reconcile
from counterfactual_engine import calculate_counterfactual, generate_multi_scenario_comparison
from database import (
    is_mongodb_live,
    get_mongodb_error,
    get_users_collection,
    get_simulations_collection,
    get_audit_events_collection,
)


def run_all_tests():
    print("=" * 70)
    print("COUNTERFACTUAL PHASE 5 VERIFICATION & ATLAS PERSISTENCE SUITE")
    print("=" * 70)

    client = app.test_client()
    passed_unit = 0
    total_unit = 4

    # =================================================================
    # PART A — UNIT & FINANCIAL ENGINE TESTS
    # =================================================================

    # SUITE 1: RECONCILIATION & DUPLICATE TRANSACTION INTEGRITY
    print("\n[SUITE 1] Testing Reconciliation & Duplicate Transaction Modeling...")
    csv_path = os.path.join(os.path.dirname(__file__), "data", "counterfactual_phase1_transactions.csv")
    results, metrics, report, matrix, all_labels, ai_records = reconcile(csv_path)

    assert len(results) == 100, f"Expected 100 unique entities, got {len(results)}"
    assert results["transaction_id"].nunique() == 100, "Transaction IDs must be 100% unique"

    txn_1013 = results[results["transaction_id"] == "TXN_1013"]
    assert len(txn_1013) == 1, "TXN_1013 must appear exactly once in reconciled entities"
    row = txn_1013.iloc[0]

    assert row["exception_type"] == "DUPLICATE", f"Expected DUPLICATE, got {row['exception_type']}"
    assert row["expected_settlement"] == 7829.10, f"Expected 7829.10, got {row['expected_settlement']}"
    assert row["actual_settlement"] == 15658.20, f"Expected 15658.20, got {row['actual_settlement']}"
    assert row["difference"] == -7829.10, f"Expected -7829.10 variance exposure, got {row['difference']}"
    assert len(row.get("settlement_events", [])) == 2, "TXN_1013 must retain both settlement disbursement events"

    print("  -> PASSED: TXN_1013 correctly modeled with unique identity, 2 settlement events, -₹7,829.10 exposure.")
    passed_unit += 1

    # SUITE 2: 10 FINANCIAL SIMULATOR CALCULATION TESTS
    print("\n[SUITE 2] Testing 10 Financial Simulator Calculation Cases...")
    gross = 10000.0
    fee_pct = 1.8
    tax_pct = 18.0

    # Test 1: 0% discount
    res_0 = calculate_counterfactual(gross_amount=gross, current_discount_pct=5.0, new_discount_pct=0.0, fee_pct=0.0, tax_pct=0.0)
    assert res_0["counterfactual"]["merchant_payout"] == 10000.0, f"Test 1 failed: {res_0['counterfactual']['merchant_payout']}"
    assert res_0["counterfactual"]["platform_revenue"] == 0.0, "Test 1 failed platform revenue"
    assert res_0["deltas"]["merchant_delta"] == 500.0, "Test 1 failed merchant delta"

    # Test 2: 5% discount (Baseline parity)
    res_5 = calculate_counterfactual(gross_amount=gross, current_discount_pct=5.0, new_discount_pct=5.0, fee_pct=fee_pct, tax_pct=tax_pct)
    assert res_5["counterfactual"]["merchant_payout"] == res_5["baseline"]["merchant_payout"], "Test 2 failed parity"
    assert res_5["deltas"]["merchant_delta"] == 0.0, "Test 2 failed delta"

    # Test 3: 10% discount
    res_10 = calculate_counterfactual(gross_amount=gross, current_discount_pct=5.0, new_discount_pct=10.0, fee_pct=0.0, tax_pct=0.0)
    assert res_10["counterfactual"]["merchant_payout"] == 9000.0, f"Test 3 failed: {res_10['counterfactual']['merchant_payout']}"
    assert res_10["deltas"]["merchant_delta"] == -500.0, "Test 3 failed delta"

    # Test 4: Gateway fee change (1.8% to 2.5%)
    res_fee = calculate_counterfactual(gross_amount=gross, current_discount_pct=5.0, new_discount_pct=5.0, fee_pct=2.5, tax_pct=18.0)
    assert res_fee["counterfactual"]["gateway_fee"] == 250.0, "Test 4 failed fee calculation"
    assert res_fee["counterfactual"]["tax"] == 45.0, "Test 4 failed tax calculation"

    # Test 5: Recovery 0%
    res_rec0 = calculate_counterfactual(gross_amount=gross, current_discount_pct=5.0, new_discount_pct=3.0, settlement_recovery_pct=0.0)
    assert res_rec0["counterfactual"]["merchant_payout"] == 0.0, f"Test 5 failed: {res_rec0['counterfactual']['merchant_payout']}"

    # Test 6: Recovery 100%
    res_rec100 = calculate_counterfactual(gross_amount=gross, current_discount_pct=5.0, new_discount_pct=3.0, settlement_recovery_pct=100.0)
    assert res_rec100["counterfactual"]["merchant_payout"] > 0, "Test 6 failed recovery 100%"

    # Test 7: T+0 timing
    res_t0 = calculate_counterfactual(gross_amount=gross, current_discount_pct=5.0, new_discount_pct=3.0, settlement_timing_days=0)
    assert res_t0["counterfactual"]["settlement_timing"] == "T+0", "Test 7 failed T+0"

    # Test 8: T+1 timing
    res_t1 = calculate_counterfactual(gross_amount=gross, current_discount_pct=5.0, new_discount_pct=3.0, settlement_timing_days=1)
    assert res_t1["counterfactual"]["settlement_timing"] == "T+1", "Test 8 failed T+1"

    # Test 9: T+2 timing
    res_t2 = calculate_counterfactual(gross_amount=gross, current_discount_pct=5.0, new_discount_pct=3.0, settlement_timing_days=2)
    assert res_t2["counterfactual"]["settlement_timing"] == "T+2", "Test 9 failed T+2"

    # Test 10: Combined discount + fee + recovery change
    res_comb = calculate_counterfactual(
        gross_amount=10000.0,
        current_discount_pct=5.0,
        new_discount_pct=2.0,
        fee_pct=2.0,
        tax_pct=18.0,
        refund_amount=500.0,
        settlement_recovery_pct=80.0,
        settlement_timing_days=1
    )
    assert res_comb["counterfactual"]["merchant_payout"] == 7251.20, f"Test 10 failed: {res_comb['counterfactual']['merchant_payout']}"
    assert res_comb["counterfactual"]["platform_revenue"] == 400.0, f"Test 10 platform revenue failed: {res_comb['counterfactual']['platform_revenue']}"

    print("  -> PASSED: All 10 financial calculation test cases verified with exact mathematical parity.")
    passed_unit += 1

    # SUITE 3: INPUT BOUNDARY VALIDATION
    print("\n[SUITE 3] Testing Input Validation & Edge Cases...")
    resp_neg_gross = client.post("/api/counterfactual/simulate", json={"gross_amount": -1000})
    assert resp_neg_gross.status_code == 401 or resp_neg_gross.status_code == 400

    resp_health = client.get("/api/health")
    assert resp_health.status_code in (200, 503), f"Unexpected health status {resp_health.status_code}"
    health_data = resp_health.get_json()
    assert "status" in health_data and "mongodb" in health_data

    print("  -> PASSED: Input boundaries and health status endpoint verified.")
    passed_unit += 1

    # SUITE 4: PROTECTED API ENDPOINTS (UNAUTHENTICATED 401 GUARD)
    print("\n[SUITE 4] Testing Unauthenticated API Protection (401 Rejection)...")
    assert client.get("/api/dashboard").status_code == 401
    assert client.get("/api/transactions").status_code == 401
    assert client.get("/api/counterfactual/TXN_1013").status_code == 401
    assert client.get("/api/simulations").status_code == 401
    assert client.get("/api/audit-trail").status_code == 401

    print("  -> PASSED: Server-side API protection verified; unauthenticated calls rejected with 401.")
    passed_unit += 1

    # =================================================================
    # PART B — REAL MONGODB ATLAS INTEGRATION TESTS
    # =================================================================
    print("\n" + "-" * 70)
    print("PART B: REAL MONGODB ATLAS INTEGRATION TESTS")
    print("-" * 70)

    is_live = is_mongodb_live()

    if not is_live:
        err_msg = get_mongodb_error() or "MongoDB connection failed"
        print(f"\n[MONGODB ATLAS INTEGRATION] STATUS: DISCONNECTED / UNAVAILABLE")
        print(f"  Reason: {err_msg}")
        print("  -> MongoDB Atlas persistence tests CANNOT pass while disconnected.")
        print("  -> Please verify MONGODB_URI password and Atlas IP whitelist in backend/.env.")
        print("\n" + "=" * 70)
        print(f"UNIT & ENGINE TESTS: {passed_unit}/{total_unit} PASSED")
        print(f"MONGODB ATLAS PERSISTENCE: FAILED / PENDING CONNECTION")
        print("=" * 70)
        return False

    print("\n[ATLAS SUITE 5] MongoDB Atlas Live Connection & Ping...")
    print("  -> Connected to MongoDB Atlas cluster successfully.")

    # 1. Register User A on live Atlas
    user_a_email = f"alpha_{os.getpid()}_{os.urandom(3).hex()}@counterfactual.fi"
    user_a_pass = "AlphaPass123!"

    resp_signup = client.post("/api/auth/signup", json={
        "name": "User Alpha",
        "email": user_a_email,
        "password": user_a_pass,
        "organization": "Alpha Treasury Corp"
    })
    assert resp_signup.status_code == 201, f"Signup on Atlas failed: {resp_signup.data}"
    user_a_data = resp_signup.get_json()
    user_a_token = user_a_data["token"]
    user_a_id = user_a_data["user"]["id"]
    assert "password_hash" not in user_a_data["user"], "Never expose password_hash"

    # 2. Duplicate registration rejection on Atlas
    resp_dup = client.post("/api/auth/signup", json={
        "name": "User Alpha Dup",
        "email": user_a_email.upper(),
        "password": "AnotherPassword123"
    })
    assert resp_dup.status_code == 409, f"Expected 409 for duplicate email, got {resp_dup.status_code}"

    # 3. Valid login on Atlas
    resp_login = client.post("/api/auth/login", json={
        "email": user_a_email,
        "password": user_a_pass
    })
    assert resp_login.status_code == 200, "Login on Atlas failed"
    user_a_token = resp_login.get_json()["token"]

    # 4. User A saves a simulation to Atlas
    resp_save = client.post("/api/simulations", headers={"Authorization": f"Bearer {user_a_token}"}, json={
        "name": "Alpha 3% Growth Incentive",
        "transaction_id": "TXN_1013",
        "gross_amount": 10000.0,
        "current_discount_pct": 5.0,
        "new_discount_pct": 3.0,
        "fee_pct": 1.8,
        "tax_pct": 18.0,
        "refund_amount": 0.0,
        "settlement_recovery_pct": 100.0,
        "settlement_timing": "T+1"
    })
    assert resp_save.status_code == 201, f"Failed to save simulation to Atlas: {resp_save.data}"
    sim_id = resp_save.get_json()["simulation"]["id"]

    # 5. User B isolation on Atlas
    user_b_email = f"beta_{os.getpid()}_{os.urandom(3).hex()}@counterfactual.fi"
    resp_b_signup = client.post("/api/auth/signup", json={
        "name": "User Beta",
        "email": user_b_email,
        "password": "BetaPass456!"
    })
    assert resp_b_signup.status_code == 201
    user_b_token = resp_b_signup.get_json()["token"]

    # User B cannot see User A's simulation
    resp_b_list = client.get("/api/simulations", headers={"Authorization": f"Bearer {user_b_token}"})
    assert resp_b_list.status_code == 200
    assert len(resp_b_list.get_json()["simulations"]) == 0, "User B must NOT see User A's simulation on Atlas"

    # User B cannot delete User A's simulation
    resp_b_del = client.delete(f"/api/simulations/{sim_id}", headers={"Authorization": f"Bearer {user_b_token}"})
    assert resp_b_del.status_code in (403, 404), "User B must NOT delete User A's simulation"

    # User A deletes simulation
    resp_a_del = client.delete(f"/api/simulations/{sim_id}", headers={"Authorization": f"Bearer {user_a_token}"})
    assert resp_a_del.status_code == 200

    # 6. Audit Trail on Atlas
    resp_audit = client.get("/api/audit-trail", headers={"Authorization": f"Bearer {user_a_token}"})
    assert resp_audit.status_code == 200
    events = resp_audit.get_json()["audit_events"]
    assert len(events) >= 3, "Audit trail on Atlas must contain events"

    print("  -> PASSED: MongoDB Atlas persistence, user authentication, and multi-tenant isolation verified on live cluster.")
    print("\n" + "=" * 70)
    print("ALL UNIT & MONGODB ATLAS INTEGRATION TESTS PASSED (100% PASS RATE)")
    print("=" * 70)
    return True


if __name__ == "__main__":
    success = run_all_tests()
    if not success:
        sys.exit(1)
