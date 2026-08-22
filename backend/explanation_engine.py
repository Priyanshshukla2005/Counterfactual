def generate_explanation(exception):
    exception_type = exception["exception_type"]

    transaction_id = exception["transaction_id"]
    expected = exception["expected_settlement"]
    actual = exception["actual_settlement"]
    difference = exception["difference"]
    confidence = exception["confidence"]

    if exception_type == "MISSING_SETTLEMENT":

        return {
            "transaction_id": transaction_id,
            "title": "Missing Settlement",
            "summary": (
                f"The transaction has an expected settlement of "
                f"₹{expected:.2f}, but the actual settlement is "
                f"₹{actual:.2f}."
            ),
            "counterfactual": (
                f"If this transaction had settled normally, "
                f"the merchant balance would be ₹{expected:.2f} higher."
            ),
            "recommended_action": (
                "Verify the settlement batch and payment gateway "
                "settlement status before initiating recovery."
            ),
            "financial_impact": round(abs(difference), 2),
            "confidence": confidence
        }

    elif exception_type == "DELAYED_SETTLEMENT":

        return {
            "transaction_id": transaction_id,
            "title": "Delayed Settlement",
            "summary": (
                f"The transaction is marked as delayed even though "
                f"the expected settlement is ₹{expected:.2f}."
            ),
            "counterfactual": (
                f"If the settlement had completed on schedule, "
                f"₹{expected:.2f} would already be available to the merchant."
            ),
            "recommended_action": (
                "Monitor the settlement batch and verify whether "
                "the transaction is still within the expected settlement window."
            ),
            "financial_impact": round(abs(difference), 2),
            "confidence": confidence
        }

    elif exception_type == "DUPLICATE":

        excess = abs(actual - expected)

        return {
            "transaction_id": transaction_id,
            "title": "Potential Duplicate Settlement",
            "summary": (
                f"The actual settlement of ₹{actual:.2f} is higher "
                f"than the expected settlement of ₹{expected:.2f}, "
                f"indicating a potential duplicate settlement."
            ),
            "counterfactual": (
                f"If the duplicate settlement had not occurred, "
                f"the merchant would have received ₹{expected:.2f} "
                f"instead of ₹{actual:.2f}."
            ),
            "recommended_action": (
                f"Review the settlement batch and investigate "
                f"the potential excess settlement of ₹{excess:.2f}."
            ),
            "financial_impact": round(excess, 2),
            "confidence": confidence
        }

    elif exception_type == "PARTIAL_REFUND":

        return {
            "transaction_id": transaction_id,
            "title": "Partial Refund Mismatch",
            "summary": (
                f"The transaction contains a refund of "
                f"₹{exception['refund_amount']:.2f} that does not "
                f"align with the observed settlement."
            ),
            "counterfactual": (
                f"If the refund had been reflected correctly, "
                f"the expected settlement would have been ₹{expected:.2f}."
            ),
            "recommended_action": (
                "Verify the refund record and reconcile it against "
                "the corresponding payment and settlement entries."
            ),
            "financial_impact": round(abs(difference), 2),
            "confidence": confidence
        }

    elif exception_type == "FEE_MISMATCH":

        return {
            "transaction_id": transaction_id,
            "title": "Fee Mismatch",
            "summary": (
                f"The actual settlement differs from the expected "
                f"settlement by ₹{abs(difference):.2f}."
            ),
            "counterfactual": (
                f"If the expected fee structure had been applied, "
                f"the merchant settlement would have been ₹{expected:.2f}."
            ),
            "recommended_action": (
                "Verify the applicable fee, tax and settlement rules "
                "for this transaction."
            ),
            "financial_impact": round(abs(difference), 2),
            "confidence": confidence
        }

    return {
        "transaction_id": transaction_id,
        "title": "Unknown Exception",
        "summary": "The transaction requires manual investigation.",
        "counterfactual": "Unable to determine a reliable counterfactual.",
        "recommended_action": "Review the transaction manually.",
        "financial_impact": round(abs(difference), 2),
        "confidence": 0.50
    }

    
if __name__ == "__main__":
    test_exception = {
        "transaction_id": "TXN_1003",
        "exception_type": "MISSING_SETTLEMENT",
        "severity": "HIGH",
        "confidence": 0.99,
        "expected_settlement": 782.03,
        "actual_settlement": 0.0,
        "difference": 782.03,
        "refund_amount": 0.0,
        "fee": 14.38,
        "tax": 2.59,
        "settlement_status": "missing"
    }

    result = generate_explanation(test_exception)

    print("\n=== COUNTERFACTUAL EXPLANATION ===")

    for key, value in result.items():
        print(f"{key}: {value}")