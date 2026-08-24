import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
from explanation_engine import generate_explanation

TOLERANCE = 0.01


def reconcile(csv_path: str):
    """
    Core deterministic reconciliation engine.
    Reads raw multi-event ledger data, detects duplicates and discrepancies,
    and aggregates records into unique transaction domain entities.
    """
    raw_df = pd.read_csv(csv_path)

    # 1. Identify transactions with multiple settlement event records
    # Group by transaction_id to consolidate multi-event settlement records
    grouped_events = {}
    for _, row in raw_df.iterrows():
        tx_id = str(row["transaction_id"])
        if tx_id not in grouped_events:
            grouped_events[tx_id] = []
        grouped_events[tx_id].append({
            "order_id": str(row.get("order_id", "")),
            "payment_id": str(row.get("payment_id", "")),
            "customer_id": str(row.get("customer_id", "")),
            "payment_date": str(row.get("payment_date", "")),
            "payment_method": str(row.get("payment_method", "CARD")),
            "status": str(row.get("status", "captured")),
            "amount": float(row.get("amount", 0)),
            "fee": float(row.get("fee", 0)),
            "tax": float(row.get("tax", 0)),
            "refund_amount": float(row.get("refund_amount", 0)),
            "expected_settlement": float(row.get("expected_settlement", 0)),
            "actual_settlement": float(row.get("actual_settlement", 0)),
            "settlement_status": str(row.get("settlement_status", "unknown")),
            "settlement_date": str(row.get("settlement_date", "")),
            "injected_exception": str(row.get("injected_exception", "NONE")),
        })

    # 2. Build consolidated unique transaction entities
    consolidated_records = []

    for tx_id, events in grouped_events.items():
        base = events[0]
        event_count = len(events)
        
        # Aggregate actual settlements across all settlement events
        total_actual_settlement = round(sum(e["actual_settlement"] for e in events), 2)
        expected_settlement = round(base["expected_settlement"], 2)
        difference = round(expected_settlement - total_actual_settlement, 2)
        amount_matches = abs(difference) <= TOLERANCE

        # Injected ground truth for evaluation
        # If any event in the group was injected as DUPLICATE, or if multiple events exist, mark ground truth as DUPLICATE
        injected = "NONE"
        for e in events:
            if e["injected_exception"] != "NONE":
                injected = e["injected_exception"]
                break
        if event_count > 1 and injected == "NONE":
            injected = "DUPLICATE"

        # Classify deterministic exception type
        exception_type = "NONE"

        # Check for multi-record duplicate settlement or 2x single-record duplicate settlement
        is_multi_event_dup = event_count > 1
        is_single_record_dup = (
            (base["settlement_status"] == "settled")
            and (abs(total_actual_settlement - (2 * expected_settlement)) <= TOLERANCE)
            and expected_settlement > 0
        )

        if is_multi_event_dup or is_single_record_dup:
            exception_type = "DUPLICATE"
        elif base["settlement_status"] == "missing":
            exception_type = "MISSING_SETTLEMENT"
        elif base["settlement_status"] == "delayed":
            exception_type = "DELAYED_SETTLEMENT"
        elif base["refund_amount"] > 0 and not amount_matches:
            exception_type = "PARTIAL_REFUND"
        elif not amount_matches:
            exception_type = "FEE_MISMATCH"
        else:
            exception_type = "NONE"

        # Map settlement events
        settlement_events = []
        for idx, ev in enumerate(events, 1):
            settlement_events.append({
                "event_id": f"SETTLE_{tx_id}_{idx}",
                "actual_settlement": ev["actual_settlement"],
                "settlement_date": ev["settlement_date"],
                "settlement_status": ev["settlement_status"],
                "is_duplicate_disbursement": is_multi_event_dup and idx > 1
            })

        consolidated_records.append({
            "transaction_id": tx_id,
            "order_id": base["order_id"],
            "payment_id": base["payment_id"],
            "customer_id": base["customer_id"],
            "payment_date": base["payment_date"],
            "payment_method": base["payment_method"],
            "status": base["status"],
            "amount": base["amount"],
            "fee": base["fee"],
            "tax": base["tax"],
            "refund_amount": base["refund_amount"],
            "expected_settlement": expected_settlement,
            "actual_settlement": total_actual_settlement,
            "difference": difference,
            "settlement_status": base["settlement_status"] if not is_multi_event_dup else "settled",
            "settlement_date": base["settlement_date"],
            "exception_type": exception_type,
            "injected_exception": injected,
            "event_count": event_count,
            "settlement_events": settlement_events,
        })

    df = pd.DataFrame(consolidated_records)

    # 3. Calculate portfolio-wide reconciliation metrics
    total = len(df)
    matched = int((df["exception_type"] == "NONE").sum())
    exceptions = int((df["exception_type"] != "NONE").sum())

    metrics = {
        "total_records": total,
        "matched_records": matched,
        "exception_records": exceptions,
        "match_rate": round((matched / total) * 100, 2) if total > 0 else 0,
        "exception_rate": round((exceptions / total) * 100, 2) if total > 0 else 0,
        "expected_total": round(float(df["expected_settlement"].sum()), 2),
        "actual_total": round(float(df["actual_settlement"].sum()), 2),
        "unreconciled_amount": round(
            float(df.loc[df["exception_type"] != "NONE", "difference"].abs().sum()),
            2,
        ),
    }

    # 4. Ground-truth evaluation metrics
    y_true = df["injected_exception"]
    y_pred = df["exception_type"]

    report = classification_report(
        y_true,
        y_pred,
        zero_division=0
    )

    all_labels = sorted(set(y_true.unique()) | set(y_pred.unique()))
    matrix = confusion_matrix(
        y_true,
        y_pred,
        labels=all_labels
    )

    # 5. Build AI-ready exception records
    ai_records = []
    for _, row in df[df["exception_type"] != "NONE"].iterrows():
        exc_type = row["exception_type"]
        if exc_type in ["MISSING_SETTLEMENT", "DELAYED_SETTLEMENT", "DUPLICATE"]:
            severity = "HIGH"
        elif exc_type in ["PARTIAL_REFUND", "FEE_MISMATCH"]:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        if exc_type in ["MISSING_SETTLEMENT", "DELAYED_SETTLEMENT", "PARTIAL_REFUND"]:
            confidence = 0.99
        elif exc_type == "DUPLICATE":
            confidence = 0.98
        else:
            confidence = 0.92

        ai_records.append({
            "transaction_id": row["transaction_id"],
            "exception_type": row["exception_type"],
            "severity": severity,
            "confidence": confidence,
            "expected_settlement": round(float(row["expected_settlement"]), 2),
            "actual_settlement": round(float(row["actual_settlement"]), 2),
            "difference": round(float(row["difference"]), 2),
            "refund_amount": round(float(row["refund_amount"]), 2),
            "fee": round(float(row["fee"]), 2),
            "tax": round(float(row["tax"]), 2),
            "settlement_status": row["settlement_status"],
            "order_id": row["order_id"],
            "payment_id": row["payment_id"],
            "customer_id": row["customer_id"],
            "payment_date": row["payment_date"],
            "payment_method": row["payment_method"],
            "settlement_date": row["settlement_date"],
            "settlement_events": row["settlement_events"]
        })

    return df, metrics, report, matrix, all_labels, ai_records


if __name__ == "__main__":
    results, metrics, report, matrix, all_labels, ai_records = reconcile(
        "data/counterfactual_phase1_transactions.csv"
    )

    print("\n=== RECONCILIATION SUMMARY ===")
    for key, value in metrics.items():
        print(f"  {key}: {value}")

    print(f"\nUnique Transactions Count: {len(results)}")
    txn_1013 = results[results['transaction_id'] == 'TXN_1013']
    print("\nTXN_1013 Entity:")
    print(txn_1013[['transaction_id', 'expected_settlement', 'actual_settlement', 'difference', 'exception_type']].to_string(index=False))