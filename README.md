# WealthOS

**Your money. In motion.**

WealthOS is a local-first personal-finance workspace for understanding cash flow, recording transactions, tracking category budgets and planning savings goals. Its analytics borrow the time-series feel of a market terminal, but it does not analyse stocks, recommend investments or execute trades.

## Current product scope

### Frontend
- Next.js App Router, React and TypeScript.
- Overview, Transactions, Budgets, Goals, Trends and AI Assistant screens.
- Manual transaction creation, CSV import/export, category editing and transaction deletion.
- Actual expense/refund trends for an authenticated account.
- Account registration and login with HttpOnly, SameSite cookies.
- Budget creation/update, savings goal creation and goal contributions.
- Optional PayPal Developer Sandbox checkout UI.

### Backend
- FastAPI with Pydantic validation.
- PostgreSQL via SQLAlchemy 2.x and Alembic.
- Argon2 password hashing, HttpOnly session cookies and bearer-token support for API clients.
- Per-user ownership checks for transactions, budgets, goals, payments and assistant requests.
- Transaction CRUD and CSV import with row validation and idempotent duplicate fingerprints.
- Monthly category budget upsert and savings-goal CRUD.
- Python Decimal financial summaries; transfers are excluded and refunds offset expenses.
- LangGraph orchestrator with specialist expense, budget, goal and cash-flow nodes.
- Optional OpenAI explanation layer. Numeric answers come from deterministic services; generated numeric content is not used.
- PayPal Orders v2 Sandbox order creation, approval/capture and server-side webhook verification.

## Run WealthOS locally (recommended)

Requirements: Docker Desktop with Docker Compose. No cloud account, hosted database or public URL is required.

### 1. Get the project

~~~powershell
git clone https://github.com/shayan-wasLazy/WellThee.git
cd WellThee
~~~

### 2. Optional local environment configuration

The default setup works without a .env file. To customize local secrets or enable optional integrations:

~~~powershell
Copy-Item .env.example .env
~~~

Edit .env. Do not commit it. Keep PAYPAL_ENVIRONMENT in Sandbox; do not add live merchant credentials.

### 3. Build and start the complete stack

~~~powershell
docker compose up --build -d
~~~

The first build installs the frontend and backend dependencies and applies the Alembic database migration automatically.

Open:

| Service | Local address |
|---|---|
| WealthOS frontend | http://localhost:3000 |
| FastAPI documentation | http://localhost:8000/docs |
| Backend health | http://localhost:8000/health |
| Backend readiness | http://localhost:8000/ready |
| PostgreSQL from the host | localhost:5433 |

PostgreSQL is available inside Docker on db:5432. From the host (for example, DBeaver) use localhost:5433 with database wealthos, username wealthos and password wealthos. These are local development credentials only.

The frontend container builds Next.js with BACKEND_URL=http://backend:8000. This is important: the browser talks to localhost:3000, and Next.js proxies /api/* to the backend container over the private Compose network.

### 4. Check container health

~~~powershell
docker compose ps
~~~

All three services should show as running; db and backend should become healthy.

Run the full local integration smoke test:

~~~powershell
python scripts/smoke_local.py
~~~

It tests registration, HttpOnly cookie restoration, transaction persistence, budget creation, goal creation, analytics, LangGraph and transaction deletion through the same frontend origin used by the browser.

### 5. Logs and shutdown

Follow application logs:

~~~powershell
docker compose logs -f frontend backend db
~~~

Stop the services without deleting financial data:

~~~powershell
docker compose down
~~~

Start them again:

~~~powershell
docker compose up -d
~~~

Delete the containers and the local PostgreSQL data volume (this is destructive):

~~~powershell
docker compose down -v
~~~

Use `docker compose down -v` only when you intentionally want to erase the local WealthOS database.

## Run without Docker (development mode)

Requirements: Node.js 22, Python 3.12 and a local PostgreSQL server.

1. Create a database and set DATABASE_URL and JWT_SECRET in backend/.env or the process environment.
2. In PowerShell, from the repository root:

~~~powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
~~~

3. In a second terminal at the repository root:

~~~powershell
npm install
npm run dev
~~~

Next.js proxies /api/*, /health and /ready to BACKEND_URL. For this mode the default is http://localhost:8000.

## Verification commands

Frontend:

~~~powershell
npm install
npm run typecheck
npm run build
~~~

Backend:

~~~powershell
cd backend
python -m pytest -q
~~~

The GitHub Actions workflow runs frontend typechecking/build, backend tests, then builds and smoke-tests the complete Docker Compose stack. It verifies the local deployment configuration; it does not publish or host the application.

## Environment variables

Docker Compose provides safe local defaults. Optional values may be set in the root .env file.

| Variable | Purpose |
|---|---|
| JWT_SECRET | Local session-signing key |
| ACCESS_TOKEN_MINUTES | Session duration |
| OPENAI_API_KEY | Optional qualitative explanation layer |
| OPENAI_MODEL | Optional model name |
| PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET | Optional PayPal Developer Sandbox credentials |
| PAYPAL_WEBHOOK_ID | Optional Sandbox webhook verification ID |

## Optional integrations and boundaries

- The LangGraph financial workflow works locally without an LLM key using deterministic calculations. Setting OPENAI_API_KEY enables an optional qualitative explanation layer and makes external API calls.
- PayPal is Sandbox-only and uses USD in the included checkout flow. With Sandbox credentials, you can test order creation, approval and capture while the app itself remains at localhost. PayPal webhook callbacks require a publicly reachable endpoint; webhook delivery is not part of the local-only setup.
- No real bank aggregation or bank sync is included. Transactions are entered manually or imported from CSV.
- Savings goals are planning records. Adding a contribution updates the planned saved amount; it does not move, reserve or custody funds.
- Backend money calculations use Python Decimal and PostgreSQL NUMERIC. Frontend numbers are display/chart values, not the financial source of truth.
- The unauthenticated preview uses illustrative data in browser state. Signed-in records persist in the local PostgreSQL volume.

## Project documentation

See docs/PROJECT_BLUEPRINT.md for product requirements, personas, user journeys, architecture, data model, API specification, financial methodology, agent workflow, security, responsive design, testing and roadmap.
