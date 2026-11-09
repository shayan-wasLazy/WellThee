# WealthOS

**Your money. In motion.**

WealthOS is a personal-finance workspace for understanding cash flow, recording transactions, tracking category budgets and planning savings goals. Its analytics borrow the time-series feel of a market terminal, but it does not analyse stocks, recommend investments or execute trades.

## What's implemented

### Frontend
- Next.js App Router, React and TypeScript.
- Responsive Overview, Transactions, Budgets, Goals, Trends and AI Assistant screens.
- Manual transaction creation, CSV import and CSV export.
- Apache ECharts spending series for illustrative data and account-backed expenses/refunds.
- Account registration and login with HttpOnly, SameSite session cookies.
- Connected-account views load the user's saved transactions, budgets and goals.
- PayPal Developer Sandbox checkout UI in the Goals screen.

### Backend
- FastAPI with Pydantic request/response validation.
- PostgreSQL via SQLAlchemy 2.x and Alembic.
- Argon2 password hashing, HttpOnly session cookies and bearer-token support for API clients.
- Per-user ownership checks for transactions, budgets, goals, payments and assistant requests.
- Transaction CRUD and CSV import with row validation and idempotent duplicate fingerprints.
- Monthly category budget upsert and savings-goal CRUD.
- Python Decimal financial summaries; transfers are excluded and refunds offset expenses.
- LangGraph orchestrator with specialist expense, budget, goal and cash-flow nodes.
- Optional OpenAI explanation layer. Numeric answers come from deterministic services; any LLM-generated numeric content is discarded.
- PayPal Orders v2 Sandbox order creation, approval/capture and server-side webhook signature verification with duplicate-event protection.
- GitHub Actions CI for frontend typecheck/build and backend tests.

## Important boundaries

- The anonymous browser preview uses illustrative sample data and in-memory state.
- Signing in switches to the authenticated API-backed dataset. The sample opening balance is not mixed into an authenticated user's net cash flow.
- Backend money values use Decimal and PostgreSQL NUMERIC. Browser numbers are display values, not the financial source of truth.
- LangGraph's deterministic financial tools work without an LLM key. Add OPENAI_API_KEY for optional qualitative explanations.
- PayPal defaults to Sandbox and uses USD. It requires Developer Sandbox credentials and a buyer test account. No live merchant credentials are included. INR is not accepted by the PayPal order route; live PayPal availability depends on country, account and merchant eligibility.
- A PayPal Sandbox checkout is stored separately from personal transactions. It does not fund or reserve money in a savings goal.
- There is no bank-account aggregation, live bank sync, receipt OCR or production transaction forecast yet.
- Authentication uses HttpOnly, SameSite cookies (Secure in production). Cookie-authenticated writes validate Origin. Bearer tokens are supported for non-browser API clients.

## Run locally

Requirements: Node.js 22, Python 3.12 and Docker Desktop (recommended).

### Option A — Full stack with Docker Compose

From the repository root:

~~~bash
docker compose up --build
~~~

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs
- API health: http://localhost:8000/health
- Local PostgreSQL: localhost:5432 (database, user and password are all wealthos; development only)

Compose starts PostgreSQL, runs Alembic migrations from the backend container, then launches FastAPI and Next.js.

### Option B — Run services separately

Start PostgreSQL first. Copy the example environment file:

~~~powershell
Copy-Item .env.example .env
~~~

~~~bash
cp .env.example .env
~~~

Set DATABASE_URL and replace JWT_SECRET with a long random value. Then run FastAPI:

~~~bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
~~~

In a second terminal at the repository root:

~~~bash
npm install
npm run dev
~~~

The Next.js app proxies /api/*, /health and /ready to BACKEND_URL (default http://localhost:8000).

### Verification

~~~bash
# Frontend
npm run typecheck
npm run build

# Backend (from backend/)
pytest -q
~~~

GitHub Actions runs these checks on pushes and pull requests to main.

## Environment variables

Copy .env.example to .env for local development. Never commit secrets.

| Variable | Purpose |
|---|---|
| DATABASE_URL | PostgreSQL connection string |
| JWT_SECRET | Signing key for access tokens |
| ENVIRONMENT | development or production; controls Secure cookie flag |
| FRONTEND_ORIGINS | Comma-separated trusted web origins for CORS and Origin checks |
| OPENAI_API_KEY / OPENAI_MODEL | Optional qualitative explanation layer |
| PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET | PayPal Developer app credentials |
| PAYPAL_WEBHOOK_ID | Sandbox webhook ID for signature verification |
| PAYPAL_ENVIRONMENT | sandbox by default |
| BACKEND_URL | Backend URL used by Next.js rewrites |

## PayPal Sandbox setup

1. Create a PayPal Developer app and use Sandbox credentials.
2. Set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and PAYPAL_WEBHOOK_ID in the backend environment.
3. Configure the webhook URL as https://YOUR_API_HOST/api/v1/payments/paypal/webhook.
4. Subscribe to capture events, including PAYMENT.CAPTURE.COMPLETED and PAYMENT.CAPTURE.DENIED.
5. Use a PayPal Sandbox buyer test account to approve checkout in the browser.

Do not describe this as a live payment integration until merchant-country eligibility, account type, currencies, webhook verification and production credentials have been checked.

## Deployment

A Render Blueprint is included in render.yaml. It declares a Next.js web service, FastAPI web service and PostgreSQL database in Singapore.

The Blueprint currently uses Free plans for a preview deployment. Render Free web services can sleep. Free Postgres is limited to 1 GB, has no backups and expires 30 days after creation. Do not store real financial records in that database. Upgrade Postgres before using WealthOS for durable personal data.

The Blueprint requires a manual FRONTEND_ORIGINS value for the actual frontend URL. Review the planned resources before approving the Blueprint sync. Secrets are generated or configured through Render, never committed to Git.

## Project documentation

See docs/PROJECT_BLUEPRINT.md for the product requirements, personas, user journeys, prioritisation, architecture, data model, API specification, financial methodology, agent workflow, PayPal strategy, security, responsive design, testing and roadmap.
