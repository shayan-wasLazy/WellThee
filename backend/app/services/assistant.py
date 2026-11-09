from decimal import Decimal
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from app.config import get_settings

ZERO = Decimal("0")


class AssistantState(TypedDict, total=False):
    question: str
    intent: str
    transactions: list[dict]
    budgets: list[dict]
    goals: list[dict]
    facts: dict[str, str]
    answer: str


def orchestrator(state: AssistantState) -> dict:
    question = state["question"].casefold()
    if any(word in question for word in ("budget", "limit", "allocation", "overspend")):
        return {"intent": "budget"}
    if any(word in question for word in ("goal", "laptop", "save for", "target", "saved")):
        return {"intent": "goal"}
    if any(word in question for word in ("food", "dining", "shopping", "transport", "expense", "spend", "category")):
        return {"intent": "expense"}
    return {"intent": "cashflow"}


def expense_agent(state: AssistantState) -> dict:
    totals: dict[str, Decimal] = {}
    total = ZERO
    for transaction in state.get("transactions", []):
        amount = Decimal(transaction["amount"])
        if transaction["type"] == "expense":
            total += amount
            totals[transaction["category"]] = totals.get(transaction["category"], ZERO) + amount
        elif transaction["type"] == "refund":
            total -= amount
            totals[transaction["category"]] = totals.get(transaction["category"], ZERO) - amount
    largest = max(totals.items(), key=lambda item: item[1], default=("none", ZERO))
    return {"facts": {
        "total_expenses": str(total),
        "largest_category": largest[0],
        "largest_category_total": str(largest[1]),
        "category_count": str(len(totals)),
    }}


def budget_agent(state: AssistantState) -> dict:
    allocation = sum((Decimal(item["amount"]) for item in state.get("budgets", [])), ZERO)
    expenses = sum(
        (
            Decimal(item["amount"]) if item["type"] == "expense"
            else -Decimal(item["amount"]) if item["type"] == "refund"
            else ZERO
        )
        for item in state.get("transactions", [])
    )
    return {"facts": {
        "budget_allocation": str(allocation),
        "budget_actual_spend": str(expenses),
        "budget_remaining": str(allocation - expenses),
        "budget_utilisation_percent": str(
            (expenses / allocation * 100).quantize(Decimal("0.1")) if allocation > ZERO else ZERO
        ),
    }}


def goal_agent(state: AssistantState) -> dict:
    goals = state.get("goals", [])
    if not goals:
        return {"facts": {"goal_count": "0"}}
    goal = min(goals, key=lambda item: Decimal(item["target_amount"]) - Decimal(item["saved_amount"]))
    target = Decimal(goal["target_amount"])
    saved = Decimal(goal["saved_amount"])
    return {"facts": {
        "goal_count": str(len(goals)),
        "goal_name": goal["name"],
        "goal_target": str(target),
        "goal_saved": str(saved),
        "goal_remaining": str(max(ZERO, target - saved)),
        "goal_progress_percent": str((saved / target * 100).quantize(Decimal("0.1")) if target > ZERO else ZERO),
    }}


def cashflow_agent(state: AssistantState) -> dict:
    income = sum(
        (Decimal(item["amount"]) for item in state.get("transactions", []) if item["type"] == "income"),
        ZERO,
    )
    expenses = sum(
        (
            Decimal(item["amount"]) if item["type"] == "expense"
            else -Decimal(item["amount"]) if item["type"] == "refund"
            else ZERO
        )
        for item in state.get("transactions", [])
    )
    net = income - expenses
    return {"facts": {
        "income": str(income),
        "expenses": str(expenses),
        "net_cash_flow": str(net),
        "savings_rate_percent": str((net / income * 100).quantize(Decimal("0.1")) if income > ZERO else ZERO),
    }}


def answer_agent(state: AssistantState) -> dict:
    facts = state.get("facts", {})
    intent = state.get("intent", "cashflow")

    if intent == "expense":
        answer = (
            f"Your recorded expenses total ₹{facts.get('total_expenses', '0')}. "
            f"Your largest category is {facts.get('largest_category', 'not available')} "
            f"at ₹{facts.get('largest_category_total', '0')}. These figures come from your recorded ledger entries."
        )
    elif intent == "budget":
        answer = (
            f"You have ₹{facts.get('budget_allocation', '0')} allocated across your budgets. "
            f"Recorded spending is ₹{facts.get('budget_actual_spend', '0')}, leaving ₹{facts.get('budget_remaining', '0')} "
            f"of the allocation ({facts.get('budget_utilisation_percent', '0')}% used)."
        )
    elif intent == "goal":
        if facts.get("goal_count") == "0":
            answer = "You have not created a savings goal yet. Add a goal to see its remaining amount and progress."
        else:
            answer = (
                f"Your closest-to-completion goal is {facts['goal_name']}. "
                f"You have saved ₹{facts['goal_saved']} of ₹{facts['goal_target']} "
                f"({facts['goal_progress_percent']}%), with ₹{facts['goal_remaining']} remaining."
            )
    else:
        answer = (
            f"Your recorded income is ₹{facts.get('income', '0')} and your net cash flow is "
            f"₹{facts.get('net_cash_flow', '0')}. Your savings rate is {facts.get('savings_rate_percent', '0')}% "
            f"of recorded income for the transactions in this workspace."
        )

    # Optional LLM wording is restricted to one qualitative sentence. Deterministic tools own every figure.
    settings = get_settings()
    if settings.openai_api_key:
        try:
            import re
            from langchain_openai import ChatOpenAI

            model = ChatOpenAI(
                api_key=settings.openai_api_key,
                model=settings.openai_model,
                temperature=0,
                timeout=12,
                max_retries=1,
            )
            response = model.invoke([
                (
                    "system",
                    "You are the explanation layer of a personal-finance assistant. "
                    "Write at most one short qualitative sentence using only the supplied question, intent and evidence. "
                    "Do not calculate, introduce recommendations, claim facts that are not present, include digits, "
                    "currency symbols, percentages, dates, or change the supplied financial figures. "
                    "If the evidence is insufficient, say so."
                ),
                ("human", str({
                    "question": state.get("question", ""),
                    "intent": intent,
                    "evidence": facts,
                })),
            ])
            qualitative = str(response.content).strip()
            if qualitative and len(qualitative) <= 320 and not re.search(r"[0-9₹$€£%]", qualitative):
                answer += " " + qualitative
        except Exception:
            # Keep the deterministic answer available if the LLM provider is unavailable.
            pass

    return {"answer": answer}


def _build_graph():
    builder = StateGraph(AssistantState)
    builder.add_node("orchestrator", orchestrator)
    builder.add_node("expense_agent", expense_agent)
    builder.add_node("budget_agent", budget_agent)
    builder.add_node("goal_agent", goal_agent)
    builder.add_node("cashflow_agent", cashflow_agent)
    builder.add_node("answer_agent", answer_agent)
    builder.add_edge(START, "orchestrator")
    builder.add_conditional_edges(
        "orchestrator",
        lambda state: state["intent"],
        {
            "expense": "expense_agent",
            "budget": "budget_agent",
            "goal": "goal_agent",
            "cashflow": "cashflow_agent",
        },
    )
    for node in ("expense_agent", "budget_agent", "goal_agent", "cashflow_agent"):
        builder.add_edge(node, "answer_agent")
    builder.add_edge("answer_agent", END)
    return builder.compile()


assistant_graph = _build_graph()


def run_assistant(
    question: str,
    transactions: list[dict],
    budgets: list[dict],
    goals: list[dict],
) -> tuple[str, str, dict[str, str]]:
    result = assistant_graph.invoke({
        "question": question,
        "transactions": transactions,
        "budgets": budgets,
        "goals": goals,
    })
    return result["answer"], result["intent"], result.get("facts", {})
