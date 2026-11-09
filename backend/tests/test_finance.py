from decimal import Decimal

from app.schemas import SummaryRequest, TransactionInput
from app.services.finance import calculate_summary


def test_summary_uses_decimal_and_excludes_transfers() -> None:
    payload = SummaryRequest(
        currency="INR",
        transactions=[
            TransactionInput(amount=Decimal("1000.10"), type="income", category="Salary"),
            TransactionInput(amount=Decimal("250.05"), type="expense", category="Food"),
            TransactionInput(amount=Decimal("500"), type="transfer", category="Internal"),
        ],
    )
    result = calculate_summary(payload)
    assert result.income == Decimal("1000.10")
    assert result.expenses == Decimal("250.05")
    assert result.net_cash_flow == Decimal("750.05")
    assert result.expenses_by_category == {"Food": Decimal("250.05")}


def test_refund_offsets_expenses() -> None:
    payload = SummaryRequest(transactions=[
        TransactionInput(amount=Decimal("500"), type="expense", category="Shopping"),
        TransactionInput(amount=Decimal("100"), type="refund", category="Shopping"),
    ])
    result = calculate_summary(payload)
    assert result.expenses == Decimal("400")
    assert result.net_cash_flow == Decimal("-400")
