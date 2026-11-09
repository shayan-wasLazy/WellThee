"""Smoke-test the complete local WealthOS stack through the Next.js origin.

Run after: docker compose up --build -d
The script uses only Python's standard library and creates a disposable test account.
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from http.cookiejar import CookieJar
from urllib.error import HTTPError, URLError
from urllib.request import HTTPCookieProcessor, Request, build_opener
from datetime import date
from decimal import Decimal

BASE_URL = os.environ.get("WEALTHOS_BASE_URL", "http://localhost:3000").rstrip("/")
ORIGIN = BASE_URL
opener = build_opener(HTTPCookieProcessor(CookieJar()))


def call(path: str, method: str = "GET", payload: dict | None = None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {"Accept": "application/json", "Origin": ORIGIN}
    if body is not None:
        headers["Content-Type"] = "application/json"
    request = Request(BASE_URL + path, data=body, headers=headers, method=method)
    try:
        with opener.open(request, timeout=15) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} returned HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not reach {BASE_URL}: {exc}") from exc


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> int:
    suffix = uuid.uuid4().hex[:12]
    email = f"local-smoke-{suffix}@example.com"
    password = "local-smoke-password-2026"

    print(f"Checking local WealthOS at {BASE_URL}")

    status, registered = call(
        "/api/v1/auth/register",
        "POST",
        {"email": email, "password": password},
    )
    expect(status == 201 and registered.get("user", {}).get("email") == email, "Registration did not return the test user.")
    print("PASS: frontend proxy reaches registration API; HttpOnly session created")

    status, user = call("/api/v1/auth/me")
    expect(status == 200 and user.get("email") == email, "Cookie session did not authenticate /auth/me.")
    print("PASS: browser-style cookie session restores the account")

    transaction_payload = {
        "occurred_on": date.today().isoformat(),
        "description": "Local smoke test purchase",
        "category": "Food & dining",
        "type": "expense",
        "amount": "125.50",
        "currency": "INR",
        "account": "Smoke test",
    }
    status, transaction = call("/api/v1/transactions", "POST", transaction_payload)
    expect(status == 201, "Transaction creation failed.")
    transaction_id = transaction["id"]
    print("PASS: transaction is stored in PostgreSQL")

    status, rows = call("/api/v1/transactions?limit=20")
    expect(status == 200 and any(row["id"] == transaction_id for row in rows), "Created transaction was not returned from the database.")
    print("PASS: transaction reads back from persistent storage")

    status, budget = call(
        "/api/v1/budgets",
        "PUT",
        {
            "year": date.today().year,
            "month": date.today().month,
            "category": "Food & dining",
            "amount": "5000.00",
            "currency": "INR",
        },
    )
    expect(status in (200, 201) and Decimal(str(budget["amount"])) == Decimal("5000.00"), "Budget upsert failed.")
    print("PASS: monthly budget can be saved")

    status, goal = call(
        "/api/v1/goals",
        "POST",
        {
            "name": "Local smoke goal",
            "target_amount": "10000.00",
            "saved_amount": "1500.00",
            "currency": "INR",
        },
    )
    expect(status == 201 and goal["name"] == "Local smoke goal", "Savings goal creation failed.")
    print("PASS: savings goal can be saved")

    status, summary = call("/api/v1/analytics/summary?currency=INR")
    expect(status == 200 and Decimal(str(summary["expenses"])) == Decimal("125.50"), "Analytics did not include the test transaction.")
    print("PASS: analytics reads the persisted ledger")

    status, assistant = call(
        "/api/v1/assistant/query",
        "POST",
        {"question": "How much did I spend on food?"},
    )
    expect(status == 200 and assistant.get("intent") == "expense", "LangGraph assistant did not answer the test query.")
    print("PASS: LangGraph assistant runs against account data")

    status, _ = call("/api/v1/transactions/" + transaction_id, "DELETE")
    expect(status == 204, "Transaction deletion failed.")
    print("PASS: transaction deletion works")

    print("LOCAL SMOKE TEST PASSED")
    print("The smoke-test account and goal remain in the local database. Delete them from the app or reset the local database volume when finished.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, KeyError, TypeError, ValueError) as exc:
        print(f"LOCAL SMOKE TEST FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1)
