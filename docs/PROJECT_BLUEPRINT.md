## Engineering record — implementation status (10 November 2026)

### Implemented

- Next.js App Router screens for Overview, Transactions, Budgets, Goals, Trends and AI Assistant.
- Manual transaction creation, CSV import/export, category correction and transaction deletion.
- Monthly category budget upsert; savings-goal creation and contribution tracking.
- ECharts trend chart for sample records and account-backed expense/refund history.
- FastAPI APIs for authentication, transactions, CSV import, budgets, goals, analytics, LangGraph assistant and PayPal Sandbox order/capture/webhooks.
- PostgreSQL SQLAlchemy models for users, transactions, budgets, goals, payments, PayPal events and assistant-run traces.
- Alembic initial migration and a local Docker Compose stack: Next.js, FastAPI and PostgreSQL.
- HttpOnly SameSite cookie sessions (Secure outside local development), bearer support for API clients, Origin validation and per-user record ownership.
- Decimal/NUMERIC calculation path; transfers are excluded and refunds offset expenses.
- LangGraph deterministic specialist finance nodes, with an optional qualitative OpenAI explanation layer.
- PayPal Orders v2 Sandbox checkout and capture, with webhook signature verification in the backend.
- GitHub Actions checks for frontend typecheck/build, backend tests, and a full local Docker Compose build/health/functional smoke test.

### Local deployment decision

WealthOS is to be run locally only. Do not provision Render or another hosted environment. The canonical deployment is:

1. `docker compose up --build -d`
2. Frontend: `http://localhost:3000`
3. API docs: `http://localhost:8000/docs`
4. PostgreSQL host port: `localhost:5433`
5. Validate: `python scripts/smoke_local.py`

The frontend Docker image must be built with `BACKEND_URL=http://backend:8000`, because Next.js rewrites are generated during the build and the frontend container must use the Compose service hostname, not its own localhost.

### Not yet implemented or verified

- Account profile CRUD, currency/time-zone onboarding and detailed user audit history.
- Recurring transaction rules and automated recurring-expense detection.
- Receipt OCR and a reviewed extraction workflow.
- A robust month-end cash-flow forecasting model with uncertainty bands.
- Full transaction-edit UI for all fields (backend PATCH supports the transaction schema; the UI currently edits category and deletes records).
- Bank aggregation or live bank sync.
- Goal funding through PayPal. Contributions update a planning record only; they do not move or reserve funds.
- Live PayPal merchant integration. The included checkout is Sandbox-only and uses USD. Webhook callbacks require a publicly reachable endpoint and are not exercised in the local-only setup.
- Local execution has been packaged for Compose. Hardware-specific verification on the developer's PC remains a user-side step.
- Production hardening such as password recovery, refresh-token rotation, rate limiting, import review/rollback, CSP and independent security review.

### Known boundaries

- The anonymous browser preview uses illustrative demo data held in browser state.
- Authenticated records persist in the local PostgreSQL Docker volume.
- The frontend converts API decimal strings into JavaScript numbers for display and charting; source-of-truth money calculations remain Python Decimal/PostgreSQL NUMERIC.
- LangGraph runs without an LLM API key through deterministic tools. Setting OPENAI_API_KEY causes optional external model calls.
- PayPal Sandbox checkout records are separate from personal cash flow and do not fund savings goals.

### Next local completion order

1. Run the Docker Compose integration smoke test on the target PC.
2. Resolve any Docker Desktop, port binding or local firewall issues.
3. Validate user registration/login, CSV import, CRUD, budget and goal persistence after a container restart.
4. Supply PayPal Sandbox credentials only if local checkout testing is required.
5. Complete profile settings, recurring rules and forecasting before describing those areas as finished.
