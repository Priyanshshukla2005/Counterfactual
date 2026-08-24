"""
Counterfactual Financial Simulation Engine
Deterministic commercial and pricing scenario modeling for payment & settlement operations.
"""

from typing import Dict, Any, List


def calculate_counterfactual(
    gross_amount: float,
    current_discount_pct: float = 5.0,
    new_discount_pct: float = 3.0,
    fee_pct: float = 1.8,
    tax_pct: float = 18.0,
    refund_amount: float = 0.0,
    settlement_recovery_pct: float = 100.0,
    settlement_timing_days: int = 1,
    transaction_id: str = "TXN_SIMULATION"
) -> Dict[str, Any]:
    """
    Simulates the exact financial outcome of modifying commercial pricing variables.
    
    Formula:
    Merchant Payout = Gross - Commercial Discount - (Fee + Tax) - Refund
    Platform Revenue = Commercial Discount + Gateway Fee Margin
    """
    gross = float(max(0, gross_amount))
    c_disc_pct = float(max(0, current_discount_pct))
    n_disc_pct = float(max(0, new_discount_pct))
    f_pct = float(max(0, fee_pct))
    t_pct = float(max(0, tax_pct))
    r_amt = float(max(0, refund_amount))
    recovery_mult = float(settlement_recovery_pct) / 100.0

    # Intermediate deductions
    cur_discount_amt = round(gross * (c_disc_pct / 100.0), 2)
    new_discount_amt = round(gross * (n_disc_pct / 100.0), 2)
    
    fee_amt = round(gross * (f_pct / 100.0), 2)
    tax_amt = round(fee_amt * (t_pct / 100.0), 2)
    total_charges = round(fee_amt + tax_amt, 2)

    # Merchant payouts
    cur_merchant_settlement = round(max(0, (gross - cur_discount_amt - total_charges - r_amt)), 2)
    new_merchant_settlement = round(max(0, (gross - new_discount_amt - total_charges - r_amt) * recovery_mult), 2)
    merchant_delta = round(new_merchant_settlement - cur_merchant_settlement, 2)

    # Platform revenue
    cur_platform_revenue = round(cur_discount_amt + fee_amt, 2)
    new_platform_revenue = round(new_discount_amt + fee_amt, 2)
    platform_delta = round(new_platform_revenue - cur_platform_revenue, 2)

    # Relative decision guidance
    if merchant_delta > 0 and abs(merchant_delta) >= (gross * 0.04):
        decision_guidance = "Merchant Favorable — High Incentive"
        guidance_type = "merchant_favorable"
    elif merchant_delta > 0:
        decision_guidance = "Merchant Favorable"
        guidance_type = "merchant_favorable"
    elif platform_delta > 0:
        decision_guidance = "Platform Favorable"
        guidance_type = "platform_favorable"
    else:
        decision_guidance = "Balanced Neutral"
        guidance_type = "neutral"

    timing_label = f"T+{settlement_timing_days}"

    # Dynamic natural language explanation with exact calculated numbers
    if c_disc_pct > n_disc_pct:
        explanation = (
            f"Reducing commercial discount from {c_disc_pct:.1f}% to {n_disc_pct:.1f}% on "
            f"₹{gross:,.2f} gross transaction increases merchant settlement by ₹{merchant_delta:,.2f} "
            f"(from ₹{cur_merchant_settlement:,.2f} to ₹{new_merchant_settlement:,.2f}). "
            f"The platform retains ₹{abs(platform_delta):,.2f} less discount revenue. "
            f"Scenario assessment: {decision_guidance}."
        )
    elif c_disc_pct < n_disc_pct:
        explanation = (
            f"Increasing commercial discount from {c_disc_pct:.1f}% to {n_disc_pct:.1f}% on "
            f"₹{gross:,.2f} gross transaction reduces merchant settlement by ₹{abs(merchant_delta):,.2f} "
            f"(from ₹{cur_merchant_settlement:,.2f} to ₹{new_merchant_settlement:,.2f}) while "
            f"increasing platform revenue by ₹{platform_delta:,.2f}. "
            f"Scenario assessment: {decision_guidance}."
        )
    else:
        explanation = (
            f"Preserving the existing {c_disc_pct:.1f}% discount yields identical merchant payout of "
            f"₹{cur_merchant_settlement:,.2f} and platform revenue of ₹{cur_platform_revenue:,.2f}. "
            f"Scenario assessment: Baseline parity."
        )

    # Standard baseline and counterfactual blocks
    baseline_block = {
        "gross_amount": gross,
        "discount": cur_discount_amt,
        "discount_pct": c_disc_pct,
        "gateway_fee": fee_amt,
        "fee_pct": f_pct,
        "tax": tax_amt,
        "tax_pct": t_pct,
        "refund_amount": r_amt,
        "merchant_payout": cur_merchant_settlement,
        "platform_revenue": cur_platform_revenue,
    }

    counterfactual_block = {
        "gross_amount": gross,
        "discount": new_discount_amt,
        "discount_pct": n_disc_pct,
        "gateway_fee": fee_amt,
        "fee_pct": f_pct,
        "tax": tax_amt,
        "tax_pct": t_pct,
        "refund_amount": r_amt,
        "merchant_payout": new_merchant_settlement,
        "platform_revenue": new_platform_revenue,
        "settlement_timing": timing_label,
        "settlement_timing_days": settlement_timing_days,
        "recovery_percentage": settlement_recovery_pct,
    }

    return {
        "transaction_id": transaction_id,
        "gross_amount": gross,
        "current_state": {
            "discount_pct": c_disc_pct,
            "discount_amount": cur_discount_amt,
            "fee_amount": fee_amt,
            "tax_amount": tax_amt,
            "refund_amount": r_amt,
            "merchant_settlement": cur_merchant_settlement,
            "platform_revenue": cur_platform_revenue,
        },
        "counterfactual_state": {
            "discount_pct": n_disc_pct,
            "discount_amount": new_discount_amt,
            "fee_amount": fee_amt,
            "tax_amount": tax_amt,
            "refund_amount": r_amt,
            "merchant_settlement": new_merchant_settlement,
            "platform_revenue": new_platform_revenue,
            "settlement_timing_days": settlement_timing_days,
            "settlement_recovery_pct": settlement_recovery_pct,
        },
        "baseline": baseline_block,
        "counterfactual": counterfactual_block,
        "deltas": {
            "merchant_delta": merchant_delta,
            "platform_delta": platform_delta,
            "is_merchant_gain": merchant_delta > 0,
            "is_platform_gain": platform_delta > 0,
        },
        "decision_guidance": decision_guidance,
        "guidance_type": guidance_type,
        "explanation": explanation,
    }


def generate_multi_scenario_comparison(
    gross_amount: float,
    custom_discount_pct: float = 3.0,
    fee_pct: float = 1.8,
    tax_pct: float = 18.0,
    refund_amount: float = 0.0
) -> List[Dict[str, Any]]:
    """
    Generates side-by-side comparison across 4 standard commercial scenarios:
    - Scenario A: Current Baseline (5.0% Discount)
    - Scenario B: Growth Incentive (3.0% Discount)
    - Scenario C: Zero Discount (0.0% Discount / Max Margin)
    - Scenario D: Custom Scenario (User selected discount)
    """
    scenarios_config = [
        {"id": "scenario_a", "name": "Scenario A: Baseline Pricing", "discount_pct": 5.0, "badge": "Current"},
        {"id": "scenario_b", "name": "Scenario B: Growth Incentive", "discount_pct": 3.0, "badge": "Merchant Favorable"},
        {"id": "scenario_c", "name": "Scenario C: Zero Discount", "discount_pct": 0.0, "badge": "Platform Margin"},
        {"id": "scenario_d", "name": "Scenario D: Custom Variable", "discount_pct": float(custom_discount_pct), "badge": "Custom Simulation"},
    ]

    results = []
    for sc in scenarios_config:
        sim = calculate_counterfactual(
            gross_amount=gross_amount,
            current_discount_pct=5.0,
            new_discount_pct=sc["discount_pct"],
            fee_pct=fee_pct,
            tax_pct=tax_pct,
            refund_amount=refund_amount,
        )
        results.append({
            "scenario_id": sc["id"],
            "name": sc["name"],
            "badge": sc["badge"],
            "discount_pct": sc["discount_pct"],
            "merchant_settlement": sim["counterfactual"]["merchant_payout"],
            "platform_revenue": sim["counterfactual"]["platform_revenue"],
            "merchant_delta": sim["deltas"]["merchant_delta"],
            "platform_delta": sim["deltas"]["platform_delta"],
            "decision_guidance": sim["decision_guidance"],
            "guidance_type": sim["guidance_type"],
        })

    return results
