from app.services.assistant import run_assistant


def test_langgraph_expense_agent_returns_evidence_backed_result():
    answer, intent, facts = run_assistant(
        "How much did I spend on food?",
        [
            {"amount": "100.00", "type": "expense", "category": "Food"},
            {"amount": "25.00", "type": "refund", "category": "Food"},
        ],
        [],
        [],
    )
    assert intent == "expense"
    assert facts["total_expenses"] == "75.00"
    assert "₹75.00" in answer
