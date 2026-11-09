"use client";

import { useMemo, useState, type FormEvent, type ChangeEvent } from "react";
import { Activity, ArrowDownLeft, ArrowUpRight, Bell, CalendarDays, Car, Check, CircleHelp, CreditCard, Download, FileUp, Home, LayoutDashboard, Menu, Plus, Search, Settings, ShoppingBag, Sparkles, Target, TrendingDown, TrendingUp, Utensils, Wallet, X, Zap } from "lucide-react";
import { SpendingChart } from "@/components/spending-chart";
import { DEMO_BUDGETS, DEMO_GOALS, DEMO_STARTING_BALANCE, DEMO_TRANSACTIONS } from "@/lib/demo-data";
import { calculateSummary, escapeCsv, formatINR, formatShortDate } from "@/lib/finance";
import type { FinancialTransaction } from "@/lib/types";

type Section = "Overview" | "Transactions" | "Budgets" | "Goals" | "Trends" | "AI assistant";
const NAV_ITEMS = [
  { label: "Overview" as Section, icon: LayoutDashboard }, { label: "Transactions" as Section, icon: CreditCard },
  { label: "Budgets" as Section, icon: Wallet }, { label: "Goals" as Section, icon: Target },
  { label: "Trends" as Section, icon: Activity }, { label: "AI assistant" as Section, icon: Sparkles }
];
const CATEGORY_ICONS: Record<string, typeof Utensils> = {
  "Food & dining": Utensils, Groceries: ShoppingBag, Transport: Car, Housing: Home, Shopping: ShoppingBag, Bills: Zap, Subscriptions: CreditCard
};
const PAGE_COPY: Record<Section, string> = {
  Overview: "A clear picture of where your money is going.",
  Transactions: "Every movement, organised and searchable.",
  Budgets: "Give every rupee a purpose, then track how it is used.",
  Goals: "Turn the things you want into a plan you can follow.",
  Trends: "Understand the pace and direction of your spending.",
  "AI assistant": "Ask better questions about the numbers behind your money."
};
const INITIAL_MESSAGES = [{ role: "assistant", text: "I can help you understand your spending, compare categories and think through savings goals. This preview uses the sample workspace data shown in the dashboard." }];

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += char;
  }
  values.push(value.trim());
  return values;
}

function TransactionRows({ rows }: { rows: FinancialTransaction[] }) {
  return <div className="transaction-list">{rows.map((tx) => {
    const Icon = CATEGORY_ICONS[tx.category] ?? CreditCard;
    return <div className="transaction-row" key={tx.id}>
      <div className="transaction-identity"><span className="transaction-icon"><Icon size={16} /></span><div><strong>{tx.description}</strong><span>{tx.category} · {formatShortDate(tx.date)}</span></div></div>
      <div className={"transaction-amount " + (tx.type === "income" ? "positive" : "")}>{tx.type === "income" ? "+" : "−"}{formatINR(tx.amount)}</div>
    </div>;
  })}</div>;
}

export default function HomePage() {
  const [section, setSection] = useState<Section>("Overview");
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(DEMO_TRANSACTIONS);
  const [period, setPeriod] = useState("1M");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food & dining");
  const [toast, setToast] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [mobileNav, setMobileNav] = useState(false);
  const summary = useMemo(() => calculateSummary(transactions), [transactions]);
  const balance = DEMO_STARTING_BALANCE + summary.netCashFlow;
  const budgetTotal = DEMO_BUDGETS.reduce((sum, item) => sum + item.allocated, 0);
  const remaining = budgetTotal - summary.expenses;
  const matching = transactions.filter((tx) => (tx.description + " " + tx.category + " " + tx.account).toLowerCase().includes(search.toLowerCase()));
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  function notice(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }
  function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount);
    if (!description.trim() || !Number.isFinite(value) || value <= 0) { notice("Enter a description and a valid amount."); return; }
    const record: FinancialTransaction = {
      id: "local-" + Date.now(), date: new Date().toISOString().slice(0, 10),
      description: description.trim(), category, type: kind, amount: value, account: "Manual entry"
    };
    setTransactions((current) => [record, ...current]);
    setDescription(""); setAmount(""); setModal(false);
    notice("Transaction added to this demo session.");
  }
  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const lines = (await file.text()).split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) throw new Error("The CSV has no transaction rows.");
      const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
      if (!["date", "description", "amount"].every((field) => headers.includes(field))) throw new Error("CSV needs date, description and amount columns.");
      const imported = lines.slice(1).map((line, index) => {
        const columns = parseCsvLine(line);
        const read = (key: string) => columns[headers.indexOf(key)] ?? "";
        const value = Number(read("amount").replace(/[^0-9.-]/g, ""));
        if (!read("date") || !read("description") || !Number.isFinite(value) || value <= 0) throw new Error("Invalid data on CSV row " + (index + 2) + ".");
        return {
          id: "csv-" + Date.now() + "-" + index, date: read("date"), description: read("description"),
          category: read("category") || "Other", type: read("type").toLowerCase() === "income" ? "income" as const : "expense" as const,
          amount: value, account: read("account") || "CSV import"
        };
      });
      setTransactions((current) => [...imported, ...current]);
      notice(imported.length + " transactions imported into this demo session.");
    } catch (error) {
      notice(error instanceof Error ? error.message : "Could not read this CSV.");
    } finally { event.target.value = ""; }
  }
  function exportCsv() {
    const columns = ["date", "description", "amount", "type", "category", "account"];
    const csv = [columns.join(","), ...transactions.map((tx) => [tx.date, tx.description, String(tx.amount), tx.type, tx.category, tx.account].map((item) => escapeCsv(String(item))).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "wealthos-transactions.csv"; anchor.click(); URL.revokeObjectURL(url);
    notice("CSV export prepared.");
  }
  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim(); if (!prompt) return;
    const text = prompt.toLowerCase();
    let answer = "Your sample workspace shows " + formatINR(summary.expenses) + " in expenses and " + formatINR(remaining) + " remaining against planned category allocations.";
    if (text.includes("food") || text.includes("dining") || text.includes("restaurant")) {
      answer = "Food and groceries total " + formatINR((summary.expensesByCategory["Food & dining"] ?? 0) + (summary.expensesByCategory.Groceries ?? 0)) + " in the current sample data.";
    } else if (text.includes("save")) {
      answer = "Your sample savings rate is " + summary.savingsRate.toFixed(1) + "%. This is calculated as (income minus expenses) divided by income.";
    } else if (text.includes("balance") || text.includes("afford")) {
      answer = "The sample available balance is " + formatINR(balance) + ", based on a demo opening balance plus recorded income and expenses. It is not connected to a bank.";
    }
    setMessages((current) => [...current, { role: "user", text: prompt }, { role: "assistant", text: answer }]);
    setQuestion("");
  }

  return <div className="app-shell">
    <aside className={"sidebar " + (mobileNav ? "sidebar-open" : "")}>
      <div className="brand-lockup"><div className="brand-mark"><Activity size={19} /></div><div><div className="brand-name">wealth<span>os</span></div><div className="brand-caption">PERSONAL FINANCE</div></div><button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="primary-nav" aria-label="Main navigation">{NAV_ITEMS.map(({ label, icon: Icon }) => <button key={label} className={"nav-link " + (section === label ? "active" : "")} onClick={() => { setSection(label); setMobileNav(false); }}><Icon size={17} /><span>{label}</span>{label === "AI assistant" && <span className="nav-new">BETA</span>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="sidebar-help"><CircleHelp size={16} /><span>Help centre</span><ArrowUpRight size={13} /></div>
        <div className="profile-block"><div className="avatar">W</div><div className="profile-copy"><strong>Demo workspace</strong><span>Personal account</span></div><button className="icon-button" aria-label="Workspace settings" onClick={() => notice("Settings are part of the next implementation phase.")}><Settings size={16} /></button></div>
        <div className="demo-note"><span className="demo-dot" /> Sample data · local session only</div>
      </div>
    </aside>

    <div className="main-area">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={19} /></button><div className="breadcrumb">Workspace <span>/</span> <strong>{section}</strong></div><div className="topbar-actions"><div className="demo-chip"><span className="demo-dot" /> DEMO MODE</div><button className="icon-button notification-button" aria-label="Notifications" onClick={() => notice("You are all caught up.")}><Bell size={17} /></button><div className="top-avatar">W</div></div></header>
      <main className="content">
        <div className="page-heading"><div><div className="eyebrow">TUESDAY, 10 NOVEMBER 2026 <span className="heading-separator">/</span> PERSONAL FINANCE</div><h1>{section === "Overview" ? "Your money, in motion." : section}</h1><p>{PAGE_COPY[section]}</p></div><div className="heading-actions"><button className="button button-secondary" onClick={exportCsv}><Download size={15} /> Export</button><button className="button button-primary" onClick={() => setModal(true)}><Plus size={16} /> Add transaction</button></div></div>

        {section === "Overview" && <>
          <div className="metric-grid">
            <div className="metric-card balance-card"><div className="metric-top"><span>AVAILABLE BALANCE</span><Wallet size={16} /></div><div className="metric-value">{formatINR(balance)}</div><div className="metric-foot"><span className="metric-positive"><TrendingUp size={13} /> {summary.savingsRate.toFixed(1)}%</span><span>net cash flow this month</span></div></div>
            <div className="metric-card"><div className="metric-top"><span>INCOME THIS MONTH</span><ArrowDownLeft size={16} /></div><div className="metric-value">{formatINR(summary.income)}</div><div className="metric-foot"><span className="metric-neutral">2 sources</span><span>recorded income</span></div></div>
            <div className="metric-card"><div className="metric-top"><span>SPENDING THIS MONTH</span><ArrowUpRight size={16} /></div><div className="metric-value">{formatINR(summary.expenses)}</div><div className="metric-foot"><span className="metric-warning">{(summary.expenses / budgetTotal * 100).toFixed(0)}% used</span><span>of planned budgets</span></div></div>
            <div className="metric-card"><div className="metric-top"><span>BUDGET REMAINING</span><Target size={16} /></div><div className="metric-value">{formatINR(remaining)}</div><div className="metric-foot"><span className="metric-positive">On track</span><span>across 5 categories</span></div></div>
          </div>
          <div className="overview-grid">
            <section className="panel chart-panel"><div className="panel-heading"><div><div className="panel-kicker">SPENDING PERFORMANCE</div><h2>Outflow over time</h2><p>Actual cumulative spend against your planned pace.</p></div><div className="period-switch">{["1W", "1M", "3M", "6M", "1Y"].map((item) => <button key={item} className={period === item ? "selected" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div></div><div className="chart-summary"><strong>{formatINR(summary.expenses)}</strong><span>recorded outflow</span><span className="chart-divider" /><span>sample series</span></div><SpendingChart period={period} /></section>
            <section className="panel insight-panel"><div className="panel-heading"><div><div className="panel-kicker">A QUICK READ</div><h2>Worth noticing</h2></div><span className="insight-spark"><Sparkles size={17} /></span></div><div className="insight-feature"><div className="insight-icon"><TrendingDown size={18} /></div><div className="insight-label">SPENDING PACE</div><h3>You are under your planned pace.</h3><p>Your sample outflow is below the total category allocation currently set for this workspace.</p></div><div className="insight-divider" /><div className="insight-small"><span>Largest category</span><strong>{Object.entries(summary.expensesByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"}</strong></div><div className="insight-small"><span>Current savings rate</span><strong>{summary.savingsRate.toFixed(1)}%</strong></div><button className="text-link" onClick={() => setSection("AI assistant")}>Explore with assistant <ArrowUpRight size={14} /></button></section>
          </div>
          <div className="lower-grid">
            <section className="panel transactions-panel"><div className="panel-heading panel-heading-inline"><div><div className="panel-kicker">THE LEDGER</div><h2>Recent transactions</h2></div><button className="text-link" onClick={() => setSection("Transactions")}>View all <ArrowUpRight size={14} /></button></div><TransactionRows rows={recent} /></section>
            <section className="panel budget-panel"><div className="panel-heading panel-heading-inline"><div><div className="panel-kicker">ALLOCATION</div><h2>Budget overview</h2></div><button className="text-link" onClick={() => setSection("Budgets")}>Details <ArrowUpRight size={14} /></button></div><div className="budget-list">{DEMO_BUDGETS.slice(0, 4).map((budget) => { const spent = summary.expensesByCategory[budget.category] ?? budget.spent; return <div className="budget-item" key={budget.category}><div className="budget-meta"><span>{budget.category}</span><strong>{formatINR(spent)} <small>/ {formatINR(budget.allocated)}</small></strong></div><div className="progress-track"><div className="progress-fill" style={{ width: Math.min(100, spent / budget.allocated * 100) + "%", background: budget.color }} /></div></div>; })}</div></section>
          </div>
        </>}

        {section === "Transactions" && <section className="panel full-panel"><div className="table-toolbar"><div><div className="panel-kicker">YOUR LEDGER</div><h2>All transactions <span className="count-badge">{transactions.length}</span></h2><p>Manual entries and imported rows in this browser session.</p></div><div className="table-actions"><label className="button button-secondary upload-button"><FileUp size={15} /> Import CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} /></label><button className="button button-primary" onClick={() => setModal(true)}><Plus size={15} /> Add new</button></div></div><div className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search description, category or account..." /></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>DESCRIPTION</th><th>DATE</th><th>CATEGORY</th><th>ACCOUNT</th><th className="align-right">AMOUNT</th></tr></thead><tbody>{matching.sort((a, b) => b.date.localeCompare(a.date)).map((tx) => <tr key={tx.id}><td><strong>{tx.description}</strong></td><td>{formatShortDate(tx.date)}</td><td><span className="category-pill">{tx.category}</span></td><td>{tx.account}</td><td className={"align-right amount-cell " + (tx.type === "income" ? "positive" : "")}>{tx.type === "income" ? "+" : "−"}{formatINR(tx.amount)}</td></tr>)}{matching.length === 0 && <tr><td colSpan={5} className="empty-cell">No transactions match this search.</td></tr>}</tbody></table></div><div className="table-footnote">Amounts are shown in INR. CSV imports remain in this session only.</div></section>}

        {section === "Budgets" && <><div className="budget-hero panel"><div><div className="panel-kicker">NOVEMBER ALLOCATION</div><h2>{formatINR(remaining)} <span>left to allocate</span></h2><p>{formatINR(summary.expenses)} of {formatINR(budgetTotal)} used across your sample categories.</p></div><div className="budget-hero-ring"><div><strong>{Math.round(summary.expenses / budgetTotal * 100)}%</strong><span>UTILISED</span></div></div></div><div className="budget-detail-grid">{DEMO_BUDGETS.map((budget) => { const spent = summary.expensesByCategory[budget.category] ?? 0; const percentage = Math.min(100, spent / budget.allocated * 100); return <section className="panel budget-detail" key={budget.category}><div className="budget-detail-top"><span className="budget-color-dot" style={{ background: budget.color }} /><h3>{budget.category}</h3><span className="budget-state">{percentage >= 100 ? "Limit reached" : "On track"}</span></div><div className="budget-big-number">{formatINR(spent)} <span>spent</span></div><div className="progress-track thick"><div className="progress-fill" style={{ width: percentage + "%", background: budget.color }} /></div><div className="budget-detail-foot"><span>{percentage.toFixed(0)}% used</span><strong>{formatINR(Math.max(0, budget.allocated - spent))} remaining</strong></div><div className="budget-limit">Monthly limit <strong>{formatINR(budget.allocated)}</strong></div></section>; })}</div></>}

        {section === "Goals" && <><div className="goals-intro"><div><div className="panel-kicker">PLAN FOR WHAT MATTERS</div><h2>Small steps, meaningful progress.</h2><p>Progress shown below is sample data and does not represent a real savings account.</p></div><div className="goal-total"><span>TOTAL TARGETS</span><strong>{formatINR(DEMO_GOALS.reduce((sum, goal) => sum + goal.target, 0))}</strong></div></div><div className="goal-grid">{DEMO_GOALS.map((goal, index) => { const progress = Math.min(100, goal.saved / goal.target * 100); return <section className="panel goal-card" key={goal.id}><div className="goal-card-top"><span className={"goal-symbol goal-symbol-" + index}><Target size={18} /></span><span className="goal-due"><CalendarDays size={13} /> {new Date(goal.due + "T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span></div><h3>{goal.name}</h3><p>{goal.note}</p><div className="goal-progress-number"><strong>{formatINR(goal.saved)}</strong><span>of {formatINR(goal.target)}</span></div><div className="progress-track thick"><div className="progress-fill" style={{ width: progress + "%" }} /></div><div className="goal-bottom"><strong>{progress.toFixed(0)}% funded</strong><span>{formatINR(goal.target - goal.saved)} to go</span></div></section>; })}</div><div className="goal-disclaimer"><CircleHelp size={16} /> Goal contributions are planning figures only. No funds are moved or reserved by this demo.</div></>}

        {section === "Trends" && <><section className="panel chart-panel trends-chart-panel"><div className="panel-heading"><div><div className="panel-kicker">SPENDING ANALYTICS</div><h2>How your outflow is moving</h2><p>Actual spend compared with a planned cumulative pace. The chart is illustrative sample data.</p></div><div className="period-switch">{["1W", "1M", "3M", "6M", "1Y"].map((item) => <button key={item} className={period === item ? "selected" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div></div><SpendingChart period={period} /></section><section className="panel category-breakdown"><div className="panel-heading"><div><div className="panel-kicker">CATEGORY MIX</div><h2>Where spending is concentrated</h2></div></div>{Object.entries(summary.expensesByCategory).sort((a, b) => b[1] - a[1]).map(([name, value], index) => <div className="category-trend" key={name}><div className="category-trend-head"><span>{name}</span><strong>{formatINR(value)}</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: value / Math.max(summary.expenses, 1) * 100 + "%", background: ["#477b68", "#c59b72", "#8c9fbd", "#b68eaa", "#9aa0a6"][index % 5] }} /></div></div>)}</section></>}

        {section === "AI assistant" && <section className="assistant-layout"><div className="assistant-intro"><div className="assistant-orb"><Sparkles size={22} /></div><div className="panel-kicker">WEALTHOS INTELLIGENCE</div><h2>Make sense of your money.</h2><p>Ask a question about your current sample data. This is a deterministic product preview, not a connected LLM agent.</p></div><div className="assistant-panel panel"><div className="assistant-thread">{messages.map((message, index) => <div className={"chat-message " + message.role} key={index}><div className="chat-avatar">{message.role === "assistant" ? <Sparkles size={15} /> : "You"}</div><div className="chat-bubble">{message.text}</div></div>)}</div><div className="prompt-suggestions"><button onClick={() => setQuestion("How much did I spend on food?")}>Food spending</button><button onClick={() => setQuestion("What is my current savings rate?")}>Savings rate</button><button onClick={() => setQuestion("What is my available balance?")}>Available balance</button></div><form className="assistant-form" onSubmit={ask}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about your spending..." aria-label="Ask the finance assistant" /><button className="button button-primary" type="submit"><ArrowUpRight size={16} /> Send</button></form></div></section>}

        <footer className="page-footer"><span>WEALTHOS <span className="footer-dot">·</span> YOUR MONEY, IN MOTION.</span><span>Demo workspace · figures are illustrative</span></footer>
      </main>
    </div>

    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title"><div className="modal-heading"><div><div className="panel-kicker">THE LEDGER</div><h2 id="transaction-modal-title">Add a transaction</h2><p>This entry stays in the current browser session.</p></div><button className="icon-button" onClick={() => setModal(false)} aria-label="Close dialog"><X size={18} /></button></div><form onSubmit={addTransaction}><div className="type-switch"><button type="button" className={kind === "expense" ? "selected" : ""} onClick={() => setKind("expense")}>Expense</button><button type="button" className={kind === "income" ? "selected" : ""} onClick={() => setKind("income")}>Income</button></div><label className="form-label">Description<input required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Groceries" autoFocus /></label><label className="form-label">Amount (INR)<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label><label className="form-label">Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{["Food & dining", "Groceries", "Transport", "Housing", "Shopping", "Bills", "Subscriptions", "Freelance", "Allowance", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(false)}>Cancel</button><button type="submit" className="button button-primary"><Check size={15} /> Save transaction</button></div></form></section></div>}
    {toast && <div className="toast"><Check size={15} /> {toast}</div>}
  </div>;
}
