from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models import Budget, User
from app.schemas import BudgetRead, BudgetWrite

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("", response_model=list[BudgetRead])
def list_budgets(
    year: int,
    month: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Budget]:
    if not 2000 <= year <= 2100 or not 1 <= month <= 12:
        raise HTTPException(status_code=422, detail="Invalid budget period.")
    query = select(Budget).where(Budget.user_id == user.id, Budget.year == year, Budget.month == month).order_by(Budget.category)
    return list(db.scalars(query))


@router.put("", response_model=BudgetRead)
def upsert_budget(
    payload: BudgetWrite,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Budget:
    budget = db.scalar(select(Budget).where(
        Budget.user_id == user.id,
        Budget.year == payload.year,
        Budget.month == payload.month,
        Budget.category == payload.category,
    ))
    if budget:
        budget.amount = payload.amount
        budget.currency = payload.currency.upper()
    else:
        budget = Budget(user_id=user.id, **payload.model_dump())
        budget.currency = payload.currency.upper()
        db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget
