import os
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)


SYSTEM_PROMPT = """
You are Counterfactual, an AI financial operations
copilot for online merchants.

You receive VERIFIED reconciliation data generated
by a deterministic financial engine.

Your job is to:
1. Explain what happened.
2. Explain why it matters.
3. Explain the counterfactual outcome.
4. Recommend the next action.

Rules:
- Never invent financial numbers.
- Never modify the verified numbers.
- Use only the supplied data.
- Do not claim fraud unless the data explicitly proves it.
- Keep explanations concise and merchant-friendly.
- Financial values must be expressed in INR.
"""


def ask_counterfactual(question, context):

    response = client.responses.create(
        model="gpt-5-mini",
        instructions=SYSTEM_PROMPT,
        input=f"""
Merchant question:

{question}

Verified reconciliation data:

{context}
"""
    )

    return response.output_text


if __name__ == "__main__":

    context = """
Transaction ID: TXN_1003
Exception Type: MISSING_SETTLEMENT
Severity: HIGH
Confidence: 0.99
Expected Settlement: ₹782.03
Actual Settlement: ₹0.00
Difference: ₹782.03
Refund Amount: ₹0.00
Fee: ₹14.38
Tax: ₹2.59
Settlement Status: missing
"""

    question = "Why is this transaction a problem?"

    print("\n=== COUNTERFACTUAL AI ===\n")

    answer = ask_counterfactual(
        question,
        context
    )

    print(answer)