from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.dependencies import get_current_user
from app.models import AgentRun, Budget, Goal, Transaction, User
from app.schemas import AssistantRequest, AssistantResponse
from app.services.assistant import run_assistant

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/query", response_model=AssistantResponse)
def ask_assistant(
    payload: AssistantRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AssistantResponse:
    transactions = list(db.scalars(select(Transaction).where(Transaction.user_id == user.id)))
    budgets = list(db.scalars(select(Budget).where(Budget.user_id == user.id)))
    goals = list(db.scalars(select(Goal).where(Goal.user_id == user.id)))
    tx_data = [{"amount": str(row.amount), "type": row.type, "category": row.category} for row in transactions]
    budget_data = [{"amount": str(row.amount), "category": row.category} for row in budgets]
    goal_data = [
        {"name": row.name, "target_amount": str(row.target_amount), "saved_amount": str(row.saved_amount)}
        for row in goals
    ]
    answer, intent, facts = run_assistant(payload.question, tx_data, budget_data, goal_data)

    # Persist the execution classification and deterministic evidence, but not raw chat text.
    db.add(AgentRun(
        user_id=user.id,
        request_type=intent,
        status="completed",
        trace={"evidence": facts},
    ))
    db.commit()

    engine = "LangGraph + OpenAI explanation" if get_settings().openai_api_key else "LangGraph + deterministic finance tools"
    return AssistantResponse(answer=answer, intent=intent, evidence=facts, engine=engine)
