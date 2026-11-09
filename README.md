# WealthOS

**Your money. In motion.**

A calm, user-first personal finance workspace. WealthOS applies the analytical feel of a market terminal to personal spending: track transactions, understand cash flow, manage budgets and move toward savings goals.

> **Product boundary:** WealthOS is a personal finance and budgeting product. It does not analyse stocks, recommend investments or execute trades.

## Current status

The repository now contains the first demo-first implementation:
- Next.js App Router, React and TypeScript.
- Responsive screens for overview, transactions, budgets, goals, trends and an assistant preview.
- Manual transaction entry and CSV import/export.
- Apache ECharts spending chart.
- FastAPI calculation endpoint using Python Decimal, with unit tests.

The browser workspace uses illustrative sample data and in-memory state. It is not connected to a bank, does not persist changes after refresh, and does not execute real AI or PayPal actions. The assistant screen is a deterministic preview, not an LLM agent.

## Run the frontend

Requirements: Node.js 20.9 or later and npm.

~~~bash
npm install
npm run dev
~~~

Open http://localhost:3000.

Useful commands:

~~~bash
npm run build
npm run typecheck
~~~

## Run the backend calculation API

From the repository root:

~~~bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
~~~

Health check: http://localhost:8000/health  
API docs: http://localhost:8000/docs

Run tests from the backend directory:

~~~bash
pytest
~~~

Example request:

~~~bash
curl -X POST http://localhost:8000/api/v1/analytics/summary \
  -H "Content-Type: application/json" \
  -d '{"currency":"INR","transactions":[{"amount":"42000.00","type":"income","category":"Allowance"},{"amount":"1200.00","type":"expense","category":"Groceries"}]}'
~~~

## Project documentation

See docs/PROJECT_BLUEPRINT.md for the product blueprint, architecture, data model, API plan, financial methodology, AI workflow, PayPal strategy, security, design system, testing and implementation roadmap.

## Planned stack

- **Frontend:** Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui/Radix, Lucide, Apache ECharts.
- **Backend:** Python, FastAPI, Pydantic, SQLAlchemy 2.x, Alembic.
- **Database:** PostgreSQL.
- **AI:** LangGraph with scoped tools and deterministic finance services.
- **Payments:** PayPal REST APIs and Sandbox, subject to capability and regional verification.
- **Deployment:** Vercel + Render (or equivalent).

## Safety and accuracy

Financial records must be treated as sensitive. Production money calculations must use PostgreSQL NUMERIC and Python Decimal; the browser demo's JavaScript number calculations are illustrative only. AI may explain tool results but must not invent financial facts or execute consequential actions without explicit user approval.
