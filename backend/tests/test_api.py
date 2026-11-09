def register(client, email: str):
    response = client.post("/api/v1/auth/register", json={"email": email, "password": "correct-horse-battery"})
    assert response.status_code == 201, response.text
    assert "httponly" in response.headers.get("set-cookie", "").lower()
    token = client.cookies.get("wealthos_session")
    assert token
    return token


def test_user_can_register_add_transaction_and_get_summary(client):
    token = register(client, "one@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/api/v1/transactions",
        headers=headers,
        json={
            "occurred_on": "2026-11-10",
            "description": "Lunch",
            "category": "Food",
            "type": "expense",
            "amount": "125.50",
            "currency": "INR",
            "account": "UPI",
        },
    )
    assert created.status_code == 201, created.text
    summary = client.get("/api/v1/analytics/summary?currency=INR", headers=headers)
    assert summary.status_code == 200
    assert summary.json()["expenses"] == "125.50"
    assert summary.json()["net_cash_flow"] == "-125.50"


def test_http_only_cookie_authenticates_browser_request(client):
    client.post("/api/v1/auth/register", json={"email": "cookie@example.com", "password": "correct-horse-battery"})
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == "cookie@example.com"


def test_users_cannot_read_each_others_transactions(client):
    token_one = register(client, "one@example.com")
    token_two = register(client, "two@example.com")
    client.post(
        "/api/v1/transactions",
        headers={"Authorization": f"Bearer {token_one}"},
        json={
            "occurred_on": "2026-11-10",
            "description": "Private purchase",
            "category": "Shopping",
            "type": "expense",
            "amount": "75.00",
            "currency": "INR",
        },
    )
    response = client.get("/api/v1/transactions", headers={"Authorization": f"Bearer {token_two}"})
    assert response.status_code == 200
    assert response.json() == []


def test_csv_import_is_idempotent(client):
    token = register(client, "csv@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    csv_content = "date,description,amount,type,category,account\n2026-11-09,Metro,35.00,expense,Transport,UPI\n"
    first = client.post("/api/v1/transactions/import", headers=headers, files={"file": ("bank.csv", csv_content, "text/csv")})
    second = client.post("/api/v1/transactions/import", headers=headers, files={"file": ("bank.csv", csv_content, "text/csv")})
    assert first.status_code == 200, first.text
    assert first.json() == {"inserted": 1, "duplicates": 0}
    assert second.status_code == 200, second.text
    assert second.json() == {"inserted": 0, "duplicates": 1}


def test_goal_owner_is_enforced(client):
    token_one = register(client, "goal-one@example.com")
    token_two = register(client, "goal-two@example.com")
    created = client.post(
        "/api/v1/goals",
        headers={"Authorization": f"Bearer {token_one}"},
        json={"name": "Laptop", "target_amount": "60000", "saved_amount": "10000", "currency": "INR"},
    )
    goal_id = created.json()["id"]
    update = client.patch(
        f"/api/v1/goals/{goal_id}",
        headers={"Authorization": f"Bearer {token_two}"},
        json={"saved_amount": "20000"},
    )
    assert update.status_code == 404


def test_logout_clears_session_cookie(client):
    client.post("/api/v1/auth/register", json={"email": "logout@example.com", "password": "correct-horse-battery"})
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401
