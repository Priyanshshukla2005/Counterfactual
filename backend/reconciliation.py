import pandas as pd
import json
from sklearn.metrics import classification_report, confusion_matrix
from explanation_engine import generate_explanation

TOLERANCE = 0.01


def reconcile(csv_path: str):
    df = pd.read_csv(csv_path)

    # 1. Duplicate transaction detection
    duplicate_mask = df.duplicated("transaction_id", keep=False)
    #2
    duplicate_settlement_mask = (
        (df["settlement_status"] == "settled") &
        (
            (df["actual_settlement"] - (2 * df["expected_settlement"])).abs()
            <= TOLERANCE
        )
    )

    # 2. Settlement difference
    df["difference"] = (
        df["expected_settlement"] - df["actual_settlement"]
    ).round(2)

    # 3. Basic amount matching
    df["amount_matches"] = df["difference"].abs() <= TOLERANCE

    # 4. Exception classification
    def classify(row):
        # Highest-priority structural exceptions
        if (
            duplicate_mask.loc[row.name]
            or duplicate_settlement_mask.loc[row.name]
        ):
            return "DUPLICATE"

        if row["settlement_status"] == "missing":
            return "MISSING_SETTLEMENT"

        if row["settlement_status"] == "delayed":
            return "DELAYED_SETTLEMENT"

        # Refund-related exception
        if row["refund_amount"] > 0:
            if not row["amount_matches"]:
                return "PARTIAL_REFUND"

        # Settlement amount mismatch with no refund
        if not row["amount_matches"]:
            return "FEE_MISMATCH"

        return "NONE"

    df["exception_type"] = df.apply(classify, axis=1)

    # 5. Metrics
    total = len(df)

    matched = int(
        (df["exception_type"] == "NONE").sum()
    )

    exceptions = int(
        (df["exception_type"] != "NONE").sum()
    )

    metrics = {
        "total_records": total,
        "matched_records": matched,
        "exception_records": exceptions,
        "match_rate": round((matched / total) * 100, 2),
        "exception_rate": round((exceptions / total) * 100, 2),
        "expected_total": round(
            df["expected_settlement"].sum(), 2
        ),
        "actual_total": round(
            df["actual_settlement"].sum(), 2
        ),
        "unreconciled_amount": round(
            df.loc[
                df["exception_type"] != "NONE",
                "difference"
            ].abs().sum(),
            2,
        ),
    }
    # 6. Ground-truth evaluation
    y_true = df["injected_exception"]
    y_pred = df["exception_type"]

    report = classification_report(
        y_true,
        y_pred,
        zero_division=0
    )

    all_labels = sorted(
    set(y_true.unique()) | set(y_pred.unique())
    )

    matrix = confusion_matrix(
    y_true,
    y_pred,
    labels=all_labels
    )
    print_labels = all_labels
        # 7. Build AI-ready exception records
    ai_records = []

    for _, row in df[df["exception_type"] != "NONE"].iterrows():

        if row["exception_type"] in [
            "MISSING_SETTLEMENT",
            "DELAYED_SETTLEMENT",
            "DUPLICATE"
        ]:
            severity = "HIGH"
        elif row["exception_type"] in [
            "PARTIAL_REFUND",
            "FEE_MISMATCH"
        ]:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        # Rule-based confidence
        if row["exception_type"] in [
            "MISSING_SETTLEMENT",
            "DELAYED_SETTLEMENT",
            "PARTIAL_REFUND"
        ]:
            confidence = 0.99
        elif row["exception_type"] == "DUPLICATE":
            confidence = 0.95
        else:
            confidence = 0.90

        ai_records.append({
            "transaction_id": row["transaction_id"],
            "exception_type": row["exception_type"],
            "severity": severity,
            "confidence": confidence,
            "expected_settlement": round(
                float(row["expected_settlement"]), 2
            ),
            "actual_settlement": round(
                float(row["actual_settlement"]), 2
            ),
            "difference": round(
                float(row["difference"]), 2
            ),
            "refund_amount": round(
                float(row["refund_amount"]), 2
            ),
            "fee": round(
                float(row["fee"]), 2
            ),
            "tax": round(
                float(row["tax"]), 2
            ),
            "settlement_status": row["settlement_status"]
        })
    return df, metrics, report, matrix, all_labels,ai_records


if __name__ == "__main__":

    results, metrics, report, matrix,all_labels,ai_records = reconcile(
    "data/counterfactual_phase1_transactions.csv"
    )

    print("\n=== COUNTERFACTUAL RECONCILIATION ===")

    for key, value in metrics.items():
        print(f"{key}: {value}")

    print("\n=== EXCEPTIONS ===")

    print(
        results[results["exception_type"] != "NONE"][
            [
                "transaction_id",
                "difference",
                "exception_type",
            ]
        ].to_string(index=False)
    )

    print("\n=== GENERATING COUNTERFACTUAL EXPLANATIONS ===")

    exceptions = results[
        results["exception_type"] != "NONE"
    ]

    explanations = []

    for _, row in exceptions.iterrows():

        exception = {
            "transaction_id": row["transaction_id"],
            "exception_type": row["exception_type"],
            "severity": "HIGH",
            "confidence": 0.99,
            "expected_settlement": row["expected_settlement"],
            "actual_settlement": row["actual_settlement"],
            "difference": row["difference"],
            "refund_amount": row["refund_amount"],
            "fee": row["fee"],
            "tax": row["tax"],
            "settlement_status": row["settlement_status"],
        }

        explanation = generate_explanation(exception)

        explanations.append(explanation)

    print(f"Generated explanations: {len(explanations)}")

    if explanations:

        print("\n=== SAMPLE COUNTERFACTUAL ===")

        for key, value in explanations[0].items():
            print(f"{key}: {value}")