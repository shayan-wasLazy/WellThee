# WealthOS — Project Blueprint

**Tagline:** Your money. In motion.  
**Product category:** Personal financial management  
**Demo currency:** INR  
**Scope boundary:** Spending, budgets, savings goals and cash-flow intelligence. WealthOS is not a stock-analysis, brokerage, investment-research or trading product.

## 1. Product vision and problem

WealthOS gives people one reliable place to understand their cash position, record transactions, plan category budgets, track savings goals and interpret spending patterns. It borrows the visual discipline of market terminals—time-series charts, movement, comparisons and alerts—but applies those ideas to personal finances.

The core problem is not a lack of transaction lists. People struggle to connect day-to-day spending with the budgets and goals they care about. WealthOS turns raw records into an understandable financial picture without presenting forecasts as facts.

Principles:
- Trust before novelty: every insight should expose its evidence and calculation.
- Deterministic money math: use Python Decimal and PostgreSQL NUMERIC, never floating-point arithmetic for persisted financial values.
- User control: AI may explain and propose; users approve consequential changes.
- Clear provenance: distinguish imported, manually entered, simulated and calculated values.
- Calm information design: use hierarchy and whitespace before colour or decorative cards.

## 2. Target users

| Persona | Financial pattern | Priority jobs |
|---|---|---|
| Student | Allowance, occasional freelance income, variable discretionary spend | Track small expenses, avoid overspending, save for purchases |
| Salaried professional | Predictable salary, recurring bills, commitments and goals | Monthly cash flow, allocations, emergency savings |
| Freelancer | Irregular client receipts and variable costs | Runway, income variability, tax reserve planning, goal pacing |

Onboarding should ask only what is needed to configure the product: currency, income pattern, pay cycle, budgeting preference and initial balance. All values remain editable.

## 3. Core user journeys

1. First session: choose profile and currency → set an opening balance → create or import transactions → review the overview.
2. Record a purchase: enter amount, date, description, category and account → validate → save → recompute aggregates.
3. Import a statement: upload CSV → map and validate columns → preview duplicates and malformed rows → confirm import → retain an import batch ID.
4. Plan a month: set a total budget → allocate category limits → inspect remaining allocations → revise.
5. Fund a goal: enter target and date → calculate periodic contribution → compare against cash flow → adjust or mark aspirational.
6. Ask a question: classify intent → call permitted read-only tools → calculate deterministically → explain with evidence and assumptions.

## 4. Feature prioritisation

| Priority | Scope | Acceptance condition |
|---|---|---|
| P0 | Transaction entry, CSV import/export, overview, budget tracking, goals, deterministic summaries | User can record/import data and reconcile all visible totals |
| P0 | Provenance and demo disclosure | Simulated data is never presented as a live bank balance |
| P1 | Authentication, PostgreSQL persistence, migrations, user isolation | Signed-in users can safely return to their own records |
| P1 | Trends, comparisons, interpretable month-end forecast | Charts match backend aggregates and label projections |
| P1 | LangGraph assistant with scoped tools | Every numeric answer is backed by deterministic tool output |
| P2 | Receipt extraction, recurring suggestions, anomaly signals | User reviews suggestions before committing them |
| P2 | PayPal Sandbox payment and verified webhook processing | User approves a payment and provider status is reconciled |

## 5. MVP definition

The first MVP is a single-user demo workspace with clearly labelled illustrative data. It demonstrates:
- Overview metrics derived from a transaction ledger.
- Manual income/expense entry.
- CSV import and export.
- Searchable transactions.
- Category budget utilisation.
- Savings goal progress.
- Actual-versus-planned spending chart.
- A deterministic assistant preview showing how questions map to finance calculations.

It is not a bank integration, production financial account, persistent store, LLM agent or real payment flow. Browser state resets on refresh. The FastAPI calculation service is separate and not yet wired to the frontend.

## 6. System architecture

Use a modular monolith. Independently deployed services for each financial domain would add unnecessary operational overhead at this stage.

~~~mermaid
flowchart LR
  U[Browser] --> N[Next.js App Router]
  N -->|HTTPS / JSON| F[FastAPI]
  F --> D[Financial domain services]
  D --> P[(PostgreSQL)]
  F --> L[LangGraph orchestrator]
  L --> T[Validated read-only tools]
  T --> D
  F --> PP[PayPal REST APIs]
  PP --> WH[Verified webhook endpoint]
  WH --> F
~~~

One backend owns validation, authorization and calculations; PostgreSQL owns financial truth; the LLM calls narrow domain tools. Trade-off: the backend remains one larger deployable unit, but development, debugging and deployment are simpler than a microservice fleet.

## 7. Frontend architecture

- Next.js App Router, React and strict TypeScript.
- Tailwind CSS for layout and tokens; Radix/shadcn primitives for accessible dialogs, menus and inputs as screens mature.
- Apache ECharts for time series, category and comparison views.
- TanStack Query for API server-state caching.
- React Hook Form and Zod for validated forms.
- Lucide icons and shared component contracts.

Suggested boundaries:
- app/: route composition and layouts.
- components/: reusable UI, charts and form controls.
- features/transactions, features/budgets, features/goals and features/assistant: domain screen modules as the app grows.
- lib/: API client, formatters, validators and shared types.
- styles/: design tokens and global rules.

The initial commit intentionally keeps the first dashboard compact. Extract feature folders before introducing more complex flows.

## 8. Backend architecture

FastAPI with Pydantic schemas, SQLAlchemy 2.x and Alembic. Organise modules around transactions, budgets, goals, analytics, profiles, AI and payments. Keep calculations in framework-independent service functions.

Service boundaries:
- API routers validate requests and authenticated identity.
- Domain services enforce rules and calculate values.
- Repositories perform persistence.
- External adapters isolate PayPal, LLM and receipt/CSV integrations.

The initial API exposes a health check and a deterministic summary endpoint only.

## 9. Database schema and relationships

Use UUID primary keys, UTC timestamps and explicit ISO currency codes. Store money as PostgreSQL NUMERIC(18, 2) and calculate with Python Decimal.

| Entity | Important fields and constraints |
|---|---|
| users | id, email unique, password_hash, created_at |
| financial_profiles | user_id unique FK, currency, income_pattern, pay_cycle, timezone |
| accounts | id, user_id FK, name, type, currency, opening_balance |
| categories | id, user_id nullable for system defaults, name, kind |
| transactions | id, user_id FK, account_id FK, category_id FK, amount, currency, type, status, occurred_at, description, import_fingerprint |
| budgets | id, user_id FK, period_start, period_end, currency, strategy |
| budget_allocations | id, budget_id FK, category_id FK, amount; unique budget/category |
| goals | id, user_id FK, name, target_amount, saved_amount, target_date, currency, status |
| recurring_rules | id, user_id FK, cadence, expected_amount, next_due_at, category_id FK |
| daily_snapshots | id, user_id FK, snapshot_date, available_balance, currency; unique user/date |
| category_aggregates | id, user_id FK, period_start, category_id FK, amount, currency |
| insights | id, user_id FK, type, evidence JSONB, text, created_at, status |
| agent_runs | id, user_id FK, request_type, status, trace JSONB, created_at |
| paypal_events | id, provider_event_id unique, resource_id, event_type, verified_at, payload JSONB |

A user owns their profile, accounts, transactions, budgets, goals, rules, snapshots, insights and agent runs. A budget owns allocations. Transactions reference account and category. A PayPal event is deduplicated by provider event ID.

Indexes: (user_id, occurred_at DESC) on transactions; (user_id, category_id, occurred_at) for category analytics; (user_id, period_start) on budgets; (user_id, target_date) on goals. Add constraints for positive transaction amounts, valid date ranges, unique import fingerprints per user/account and supported currencies. Enforce ownership in every query; PostgreSQL row-level security can add defence in depth.

## 10. API endpoint specification

All routes are versioned under /api/v1. Authenticated routes derive user_id from the verified session; never trust a user ID supplied in request JSON.

| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | /auth/session, /auth/register | Session and account lifecycle |
| GET/PATCH | /profile | Read/update financial profile |
| GET/POST | /accounts | List/create accounts |
| GET/POST | /transactions | Query/create ledger entries |
| PATCH/DELETE | /transactions/{id} | Correct/remove an entry with audit history |
| POST | /transactions/import/preview | Parse, validate and deduplicate CSV |
| POST | /transactions/import/commit | Confirm a reviewed import batch |
| GET/POST | /budgets | List/create monthly budgets |
| PUT | /budgets/{id}/allocations | Replace allocations atomically |
| GET/POST | /goals | List/create savings goals |
| PATCH | /goals/{id} | Update target or contribution record |
| GET | /analytics/summary | Income, expenses, net cash flow and savings rate |
| GET | /analytics/spending-series | Time-bucketed actual and planned spend |
| GET | /analytics/forecast | Month-end estimate and uncertainty interval |
| POST | /assistant/query | Run a scoped financial question workflow |
| POST | /payments/paypal/orders | Create sandbox order after approval intent |
| POST | /payments/paypal/capture | Capture approved order |
| POST | /payments/paypal/webhook | Verify and process provider events |

Use pagination for transaction lists, idempotency keys for writes/imports and explicit response schemas. Add OpenAPI contract tests before frontend integration.

## 11. Financial calculation methodology

- Income is positive inflow; expenses are outflow; transfers are movement between owned accounts, not income or spending; refunds offset expenses.
- For a selected period: income = sum(completed income); expenses = sum(completed expenses) − eligible refunds; net cash flow = income − expenses.
- Savings rate = net cash flow ÷ income × 100; return null/undefined when income is zero rather than implying zero performance.
- Budget utilisation = eligible category expenses ÷ category limit × 100. Preserve values above 100% to represent overspending.
- Goal completion = saved amount ÷ target amount × 100. Required contribution = remaining amount ÷ remaining contribution periods.
- Use Decimal end-to-end in backend and NUMERIC in PostgreSQL. Round only for display or at a defined currency boundary.
- Refund matching, transfer pairing and pending transaction treatment must be explicit; never infer a match solely from a similar amount.

The current demo UI uses illustrative JavaScript number arithmetic. Replace it with API-returned decimal strings before production financial use.

## 12. Analytics and forecasting methodology

Aggregate transactions into calendar-day, week and month buckets using the user's timezone. Return raw totals and bucket metadata. Compare actual cumulative expenses with budget-derived planned pace; do not label an upward expense line as positive.

Start with a baseline month-end estimate: current completed spending divided by elapsed days, multiplied by days in period, then adjust for known recurring obligations when available. Include an uncertainty band derived from historical daily-spend variability. Do not train a complex model before enough user history exists.

Required interactions: 1W/1M/3M/6M/1Y/custom range, hover crosshair, date/value details, actual-versus-planned distinction, responsive sizing and accessible text summary.

## 13. Multi-agent workflow and communication

Start with one LangGraph orchestrator and specialist nodes:
1. Orchestrator classifies intent and chooses a bounded workflow.
2. Expense node analyses categories, unusual movement and recurring patterns.
3. Budget node evaluates limits and allocation trade-offs.
4. Goal node calculates contributions and projected completion.
5. Insights node explains results and assembles evidence.
6. Validator checks every numeric claim against tool output and rejects unsupported claims.

Typed shared state carries user ID, intent, date range, tool results, evidence references, proposed actions and response. Tool access is read-only by default. Financial changes and payments require an explicit approval state outside the model. Set recursion limits, timeouts and structured-output validation. Persist trace metadata without storing unnecessary sensitive prompt content.

## 14. PayPal integration strategy

Use PayPal REST APIs and Sandbox first. Confirm capability and regional availability before committing to a user journey. A reasonable initial use case is an explicitly approved payment or contribution checkout—not bank aggregation and not brokerage. Keep client secrets on the server. Verify webhook signatures, deduplicate by provider event ID, use idempotency keys, reconcile order/capture status from provider responses and model state transitions (created → approved → captured/failed). Show recipient, amount, purpose and funding source before user confirmation.

No PayPal integration is implemented in this first slice.

## 15. Security and data privacy

- Hash passwords with a modern password-hashing function; use secure, HttpOnly, SameSite cookies.
- Authorise every resource by authenticated user ownership.
- Keep secrets in environment variables; commit only examples, never credentials.
- Validate and constrain input; rate-limit authentication, imports and assistant requests.
- Treat CSVs, receipts, imported descriptions and retrieved text as untrusted input.
- Never grant an agent raw SQL, unrestricted ORM or payment-capture access.
- Log security events and consequential changes; avoid logging credentials or full sensitive descriptions.
- Encrypt transport and managed database storage; define retention and deletion workflows.
- Keep demo data clearly labelled and separate from production API models.

## 16. UI/UX design system

**Direction:** quiet-luxury fintech; warm ivory canvas, deep forest navigation, muted emerald accent, soft grey borders and restrained amber for caution.

| Token | Value |
|---|---|
| Background | #F7F8F4 |
| Surface | #FFFFFF |
| Primary text | #1E2E28 |
| Accent | #477B68 |
| Navigation | #18362E |
| Secondary text | #87918B |
| Border | #E8EAE4 |
| Caution | #B48A5D |

Use legible sans-serif typography (Geist/Inter), tabular numerals for money, 4/8-point spacing increments, thin borders, restrained 6–10px radii and clear focus rings. Avoid gradients, glassmorphism, decorative blobs, excessive card nesting and loud colour. Use red for destructive/error states, not ordinary spending movement.

## 17. Screen-by-screen specifications

- **Overview:** available balance, income, outflow, budget remainder, spending trend, priority insight, recent ledger entries and goal progress.
- **Transactions:** searchable ledger, date/category/type filters, manual form, CSV preview/import, correction history and export.
- **Budgets:** total allocation, category limits, actual usage, remaining amount and historical comparison.
- **Goals:** target amount/date, contributions, remaining amount, required cadence and projection confidence.
- **Trends:** selectable range, cumulative spending, category distribution, income-versus-expense and month comparison.
- **AI assistant:** conversation, evidence cards, calculation source, assumptions and proposed-action approvals.
- **Settings:** profile, currency, timezone, data export/deletion and connected integrations.
- **Payment approval:** recipient, amount, purpose, source and explicit confirmation.

## 18. Responsive design strategy

Desktop: persistent compact sidebar and wide charts. Tablet: collapsible navigation and two-column metric layout. Mobile: drawer navigation, stacked metrics, reduced chart axis density, card-based transaction rows where needed and no horizontal page overflow. All actions need keyboard focus, accessible names, loading/error/empty/success states and touch-friendly targets.

## 19. Repository structure

~~~text
WellThee/
├── app/                    # Next.js App Router
├── components/             # Shared UI and charts
├── features/               # Domain screens as extracted
├── lib/                    # Types, formatters, API client
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── services/
│   └── tests/
├── docs/                   # Blueprint and engineering record
├── public/
├── .env.example
├── docker-compose.yml
└── README.md
~~~

## 20. Testing strategy

- Unit-test Decimal calculations, refund/transfer treatment, budget use and goal projections.
- Test transaction validation, CSV duplicate detection, malformed rows and import idempotency.
- Test ownership boundaries with two users; confirm no cross-user reads or mutations.
- Test API response schemas, pagination and error shapes.
- Test agent tool failures, unsupported claims, prompt injection and numeric evidence validation.
- Test PayPal signature failures, duplicate webhook delivery and state transitions.
- Add browser tests for navigation, forms, import/export, chart responsiveness and keyboard operation.

## 21. Deployment architecture

Local development: Next.js frontend, FastAPI backend and PostgreSQL via Docker Compose. Production: frontend on Vercel (or equivalent), FastAPI and managed PostgreSQL on Render (or equivalent), HTTPS between components, managed secrets and database backups. Add Redis only when asynchronous imports or background jobs justify it. Include health/readiness endpoints and structured logs.

## 22. Hackathon demonstration plan

A three-minute demo should show: opening the workspace; importing or adding a transaction; seeing the ledger and category budget update; asking a question that produces a grounded calculation; then reviewing a PayPal Sandbox payment/goal-funding flow and explicitly approving it. Clearly disclose sample data and Sandbox operations. Do not demonstrate a mocked payment as a completed PayPal integration.

## 23. Technical risks and mitigations

| Risk | Mitigation |
|---|---|
| Demo values mistaken for real balances | Persistent demo labels; separate demo and production paths |
| Duplicate/malformed CSV rows | Preview, row-level errors, fingerprints and idempotency |
| Money rounding drift | Decimal and NUMERIC; display-only rounding |
| AI fabricates numeric answers | Tool-derived evidence and output validator |
| Cross-user data exposure | Ownership checks, tests and optional RLS |
| PayPal capability unavailable regionally | Validate early; preserve manual/CSV workflows |
| Forecast presented as certainty | Explicit horizon, assumptions and uncertainty interval |

## 24. Prioritised implementation roadmap

1. Foundation: repository conventions, design tokens, transaction model, deterministic finance services and tests.
2. MVP workflow: transaction CRUD, CSV validation/import, categories and summary endpoints.
3. Planning: budgets, savings goals, recurring rules and goal contribution calculations.
4. Analytics: ECharts time series, comparisons, savings rate and interpretable forecast.
5. Production data: auth, PostgreSQL schema, Alembic migrations, isolation and audit trail.
6. AI: LangGraph orchestration, scoped tools, evidence validation and approval workflow.
7. PayPal: Sandbox order/capture, verified webhooks, idempotency and status reconciliation.
8. Hardening: end-to-end tests, accessibility, responsive review, deployment and demo rehearsal.

## Engineering record — implementation status (10 November 2026)

### Implemented in the repository

- Next.js App Router dashboard with overview, transaction ledger, budgets, goals, trends and assistant screens.
- Manual transaction creation; CSV import/export; category correction; transaction deletion.
- Budget creation/update and savings-goal creation/contribution tracking in the current period.
- Responsive ECharts spending chart for demo data and signed-in user transaction history.
- FastAPI APIs for authentication, transactions, CSV imports, budgets, goals, analytics, assistant queries and PayPal Sandbox orders/capture/webhooks.
- SQLAlchemy models for users, transactions, budgets, goals, payments, PayPal events and agent-run traces.
- Alembic initial schema migration and Docker Compose for local PostgreSQL, API and web app.
- Password hashing, HttpOnly SameSite session cookie (Secure in production), bearer auth for external clients, user ownership checks and Origin validation on unsafe requests.
- Python Decimal and SQL NUMERIC calculation path; refund/transfer treatment is explicit.
- LangGraph orchestrator and specialist deterministic finance nodes. An optional OpenAI explanation layer can add qualitative context; numeric answers remain deterministic and unsupported numeric LLM output is rejected.
- PayPal REST Orders v2 Sandbox order creation, approval/capture and PayPal webhook signature verification/idempotency.
- GitHub Actions workflow for frontend typecheck/build and backend tests.
- Render Blueprint for a preview deployment in Singapore.

### Not yet implemented or verified

- Account and financial-profile CRUD, currency/time-zone onboarding and a full audit log for user edits.
- Recurring transaction rules and automated recurring-expense detection.
- Receipt OCR and review workflow.
- Production-grade cash-flow forecasting with historical uncertainty bands.
- Full transaction edit UI beyond category correction; backend PATCH supports additional fields.
- Bank aggregation or live bank sync.
- Goal funding through PayPal. A PayPal Sandbox order is stored as a separate payment record; it does not move money into a savings goal or post to the transaction ledger.
- A production PayPal merchant integration. Sandbox credentials, webhook ID and a Sandbox buyer account must be configured and verified. Live capability is country/account dependent; the sample checkout is USD only.
- Production deployment, successful remote build/test status and a durable database plan. The Render Blueprint intentionally uses free preview resources; Render free Postgres expires after 30 days and has no backups.
- Production hardening including refresh-token rotation, account recovery, rate limiting, stronger import preview/review, CSP and a security review.

### Known limitations

- The unauthenticated workspace is illustrative demo data stored in browser state and resets on refresh.
- Authenticated browser data is persisted through the FastAPI/PostgreSQL path.
- The dashboard converts API decimal strings to JavaScript numbers for display and charting. All source-of-truth money calculations must remain in Python Decimal/PostgreSQL NUMERIC.
- The LangGraph path runs without a model key using deterministic specialist nodes. Add OPENAI_API_KEY to enable the qualitative explanation layer.
- The PayPal sandbox checkout is separate from personal cash-flow totals and does not represent a bank transfer or savings contribution.

### Next implementation order

1. Run GitHub Actions and resolve every typecheck, build and test failure.
2. Review and approve the Render Blueprint after selecting a workspace and acknowledging the 30-day free database limitation.
3. Configure the frontend origin and verify registration, cookie restore, CRUD, CSV import, and account isolation on the deployed URL.
4. Configure PayPal Sandbox credentials/webhook and complete an approval/capture/duplicate-webhook test.
5. Add account/profile and recurring rules; then implement a clearly qualified month-end forecast from sufficient transaction history.
