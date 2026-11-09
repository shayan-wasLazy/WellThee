from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from urllib.parse import urlsplit

from app.config import get_settings


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: EmailStr
    created_at: datetime


class AuthResponse(BaseModel):
    user: UserRead


class TransactionCreate(BaseModel):
    occurred_on: date
    description: str = Field(min_length=1, max_length=240)
    category: str = Field(min_length=1, max_length=80)
    type: Literal["income", "expense", "transfer", "refund"]
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    account: str = Field(default="Primary account", min_length=1, max_length=100)


class TransactionUpdate(BaseModel):
    occurred_on: date | None = None
    description: str | None = Field(default=None, min_length=1, max_length=240)
    category: str | None = Field(default=None, min_length=1, max_length=80)
    type: Literal["income", "expense", "transfer", "refund"] | None = None
    amount: Decimal | None = Field(default=None, gt=0, max_digits=18, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    account: str | None = Field(default=None, min_length=1, max_length=100)


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    occurred_on: date
    description: str
    category: str
    type: str
    amount: Decimal
    currency: str
    account: str
    created_at: datetime


class BudgetWrite(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    category: str = Field(min_length=1, max_length=80)
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    currency: str = Field(default="INR", min_length=3, max_length=3)


class BudgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    year: int
    month: int
    category: str
    amount: Decimal
    currency: str


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    target_amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    saved_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=18, decimal_places=2)
    target_date: date | None = None
    currency: str = Field(default="INR", min_length=3, max_length=3)


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    target_amount: Decimal | None = Field(default=None, gt=0, max_digits=18, decimal_places=2)
    saved_amount: Decimal | None = Field(default=None, ge=0, max_digits=18, decimal_places=2)
    target_date: date | None = None


class GoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    target_amount: Decimal
    saved_amount: Decimal
    target_date: date | None
    currency: str


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


class AssistantRequest(BaseModel):
    question: str = Field(min_length=2, max_length=1000)


class AssistantResponse(BaseModel):
    answer: str
    intent: str
    evidence: dict[str, str]
    engine: str


class PayPalOrderRequest(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    description: str = Field(min_length=1, max_length=240)
    return_url: str = Field(min_length=8, max_length=500)
    cancel_url: str = Field(min_length=8, max_length=500)

    @field_validator("return_url", "cancel_url")
    @classmethod
    def validate_return_url(cls, value: str) -> str:
        parsed = urlsplit(value)
        local_http = parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}
        if not parsed.netloc or (parsed.scheme != "https" and not local_http):
            raise ValueError("PayPal return and cancel URLs must use HTTPS (localhost is allowed for development).")
        allowed_origins = get_settings().cors_origins
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if "*" not in allowed_origins and origin not in allowed_origins:
            raise ValueError("PayPal return and cancel URLs must belong to a configured frontend origin.")
        return value


class PayPalOrderResponse(BaseModel):
    order_id: str
    status: str
    approval_url: str


class PayPalCaptureResponse(BaseModel):
    order_id: str
    status: str
    capture_id: str | None = None
