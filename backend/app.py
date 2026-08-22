from flask import Flask, jsonify
from flask_cors import CORS

from reconciliation import reconcile
from explanation_engine import generate_explanation


app = Flask(__name__)
CORS(app)


CSV_PATH = "data/counterfactual_phase1_transactions.csv"


@app.route("/")
def home():
    return jsonify({
        "name": "Counterfactual API",
        "status": "running"
    })


@app.route("/api/dashboard")
def dashboard():

    results, metrics, report, matrix, all_labels, ai_records = reconcile(CSV_PATH)

    exceptions = results[
        results["exception_type"] != "NONE"
    ].copy()

    exception_data = []

    for _, row in exceptions.iterrows():

        exception_data.append({
            "transaction_id": row["transaction_id"],
            "exception_type": row["exception_type"],
            "difference": float(row["difference"]),
            "expected_settlement": float(
                row["expected_settlement"]
            ),
            "actual_settlement": float(
                row["actual_settlement"]
            ),
            "refund_amount": float(
                row["refund_amount"]
            ),
            "settlement_status": row[
                "settlement_status"
            ]
        })

    return jsonify({
        "metrics": metrics,
        "exceptions": exception_data
    })
@app.route("/api/transactions")
def transactions():
    results, metrics, report, matrix, all_labels, ai_records = reconcile(CSV_PATH)

    transaction_data = []

    for _, row in results.iterrows():
        transaction_data.append({
            "transaction_id": str(row["transaction_id"]),
            "expected_settlement": float(row["expected_settlement"]),
            "actual_settlement": float(row["actual_settlement"]),
            "difference": float(row["difference"]),
            "refund_amount": float(row["refund_amount"]),
            "fee": float(row["fee"]),
            "tax": float(row["tax"]),
            "settlement_status": str(row["settlement_status"]),
            "exception_type": str(row["exception_type"]),
        })

    return jsonify(transaction_data)

    @app.route("/api/counterfactual/<transaction_id>")
def counterfactual(transaction_id):
    results, metrics, report, matrix, all_labels, ai_records = reconcile(CSV_PATH)

    transaction = results[
        results["transaction_id"].astype(str) == str(transaction_id)
    ]

    if transaction.empty:
        return jsonify({
            "error": "Transaction not found"
        }), 404

    row = transaction.iloc[0]

    if str(row["exception_type"]) == "NONE":
        return jsonify({
            "error": "This transaction has no exception"
        }), 400

    exception = {
        "transaction_id": str(row["transaction_id"]),
        "exception_type": str(row["exception_type"]),
        "expected_settlement": float(row["expected_settlement"]),
        "actual_settlement": float(row["actual_settlement"]),
        "difference": float(row["difference"]),
        "refund_amount": float(row["refund_amount"]),
        "fee": float(row["fee"]),
        "tax": float(row["tax"]),
        "settlement_status": str(row["settlement_status"]),
        "confidence": float(row.get("confidence", 0.95)),
    }

    explanation = generate_explanation(exception)

    return jsonify(explanation)


@app.route("/api/health")
def health():
    return jsonify({
        "status": "healthy"
    })


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )