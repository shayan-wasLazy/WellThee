from collections import defaultdict
from decimal import Decimal

from app.schemas import SummaryRequest, SummaryResponse

ZERO = Decimal("0")


def calculate_summary(payload: SummaryRequest) -> SummaryResponse:
    income = ZERO
    expenses = ZERO
    category_totals: dict[str, Decimal] = defaultdict(lambda: ZERO)

    for transaction in payload.transactions:
        if transaction.type == "income":
            income += transaction.amount
        elif transaction.type == "expense":
            expenses += transaction.amount
            category_totals[transaction.category] += transaction.amount
        elif transaction.type == "refund":
            expenses -= transaction.amount

    net_cash_flow = income - expenses
    savings_rate = (net_cash_flow / income * Decimal("100")) if income > ZERO else ZERO
    return SummaryResponse(
        currency=payload.currency.upper(),
        income=income,
        expenses=expenses,
        net_cash_flow=net_cash_flow,
        savings_rate=savings_rate.quantize(Decimal("0.01")),
        expenses_by_category=dict(category_totals),
    )
