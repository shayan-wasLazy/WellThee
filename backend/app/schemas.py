from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class TransactionInput(BaseModel):
    amount: Decimal = Field(gt=0)
    type: Literal["income", "expense", "transfer", "refund"]
    category: str = Field(min_length=1, max_length=80)


class SummaryRequest(BaseModel):
    currency: str = Field(default="INR", min_length=3, max_length=3)
    transactions: list[TransactionInput]


class SummaryResponse(BaseModel):
    currency: str
    income: Decimal
    expenses: Decimal
    net_cash_flow: Decimal
    savings_rate: Decimal
    expenses_by_category: dict[str, Decimal]
