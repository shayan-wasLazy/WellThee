from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models import Transaction, User
from app.schemas import SummaryRequest, SummaryResponse, TransactionInput
from app.services.finance import calculate_summary

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=SummaryResponse)
def get_summary(
    from_date: date | None = None,
    to_date: date | None = None,
    currency: str = "INR",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SummaryResponse:
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="from_date must be on or before to_date.")
    query = select(Transaction).where(Transaction.user_id == user.id, Transaction.currency == currency.upper())
    if from_date:
        query = query.where(Transaction.occurred_on >= from_date)
    if to_date:
        query = query.where(Transaction.occurred_on <= to_date)
    rows = list(db.scalars(query))
    payload = SummaryRequest(
        currency=currency.upper(),
        transactions=[
            TransactionInput(amount=row.amount, type=row.type, category=row.category)
            for row in rows
        ],
    )
    return calculate_summary(payload)
