from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.db import engine
from app.routers import analytics, assistant, auth, budgets, goals, payments, transactions

settings = get_settings()
app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    description="Personal finance APIs for WealthOS. Money calculations are deterministic and use Decimal.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def protect_cookie_authenticated_writes(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin and origin not in settings.cors_origins:
            return JSONResponse(
                status_code=403,
                content={"detail": "Request origin is not allowed for this session."},
            )
    return await call_next(request)


for router in (
    auth.router,
    transactions.router,
    budgets.router,
    goals.router,
    analytics.router,
    assistant.router,
    payments.router,
):
    app.include_router(router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "wealthos-api"}


@app.get("/ready")
def ready() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ready", "database": "reachable"}
