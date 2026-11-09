from fastapi import FastAPI

from app.schemas import SummaryRequest, SummaryResponse
from app.services.finance import calculate_summary

app = FastAPI(
    title="WealthOS API",
    version="0.1.0",
    description="Deterministic personal-finance calculation API.",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "wealthos-api"}


@app.post("/api/v1/analytics/summary", response_model=SummaryResponse)
def financial_summary(payload: SummaryRequest) -> SummaryResponse:
    return calculate_summary(payload)
