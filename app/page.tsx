"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bell, CalendarDays, Car, Check, CircleHelp,
  CreditCard, Download, FileUp, Home, LayoutDashboard, Menu, Plus, Search, Settings,
  ShoppingBag, Sparkles, Target, TrendingDown, TrendingUp, Trash2, Utensils, Wallet, X, Zap
} from "lucide-react";
import { AuthDialog } from "@/components/auth-dialog";
import { PayPalSandbox } from "@/components/paypal-sandbox";
import { SpendingChart } from "@/components/spending-chart";
import { DEMO_BUDGETS, DEMO_GOALS, DEMO_STARTING_BALANCE, DEMO_TRANSACTIONS } from "@/lib/demo-data";
import { calculateSummary, escapeCsv, formatINR, formatShortDate } from "@/lib/finance";
import type { FinancialTransaction } from "@/lib/types";

type Section = "Overview" | "Transactions" | "Budgets" | "Goals" | "Trends" | "AI assistant";
type AccountUser = { id: string; email: string };
type BudgetView = { id?: string; category: string; allocated: number; spent: number; color: string };
type GoalView = { id: string; name: string; target: number; saved: number; due: string; note: string };
type ApiTransaction = { id: string; occurred_on: string; description: string; category: string; type: FinancialTransaction["type"]; amount: string; account: string };
type ApiBudget = { id: string; category: string; amount: string; currency: string };
type ApiGoal = { id: string; name: string; target_amount: string; saved_amount: string; target_date: string | null };

const NAV_ITEMS = [
  { label: "Overview" as Section, icon: LayoutDashboard }, { label: "Transactions" as Section, icon: CreditCard },
  { label: "Budgets" as Section, icon: Wallet }, { label: "Goals" as Section, icon: Target },
  { label: "Trends" as Section, icon: Activity }, { label: "AI assistant" as Section, icon: Sparkles }
];
const CATEGORY_ICONS: Record<string, typeof Utensils> = {
  "Food & dining": Utensils, Groceries: ShoppingBag, Transport: Car, Housing: Home,
  Shopping: ShoppingBag, Bills: Zap, Subscriptions: CreditCard
};
const CATEGORY_COLORS = ["#78958a", "#c59b72", "#8c9fbd", "#b68eaa", "#9aa0a6"];
const PAGE_COPY: Record<Section, string> = {
  Overview: "A clear picture of where your money is going.",
  Transactions: "Every movement, organised and searchable.",
  Budgets: "Give every rupee a purpose, then track how it is used.",
  Goals: "Turn the things you want into a plan you can follow.",
  Trends: "Understand the pace and direction of your spending.",
  "AI assistant": "Ask better questions about the numbers behind your money."
};

function toApiTransaction(row: ApiTransaction): FinancialTransaction {
  return {
    id: row.id, date: row.occurred_on, description: row.description, category: row.category,
    type: row.type, amount: Number(row.amount), account: row.account
  };
}

async function loadAccountData() {
  const month = new Date();
  const [txResponse, budgetResponse, goalResponse] = await Promise.all([
    fetch("/api/v1/transactions?limit=500", { credentials: "same-origin" }),
    fetch("/api/v1/budgets?year=" + month.getFullYear() + "&month=" + (month.getMonth() + 1), { credentials: "same-origin" }),
    fetch("/api/v1/goals", { credentials: "same-origin" })
  ]);
  if (!txResponse.ok || !budgetResponse.ok || !goalResponse.ok) {
    throw new Error("Could not load your saved financial data.");
  }
  const txRows: ApiTransaction[] = await txResponse.json();
  const budgetRows: ApiBudget[] = await budgetResponse.json();
  const goalRows: ApiGoal[] = await goalResponse.json();
  return {
    transactions: txRows.map(toApiTransaction),
    budgets: budgetRows.map((row, index) => ({
      id: row.id, category: row.category, allocated: Number(row.amount), spent: 0,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
    })),
    goals: goalRows.map((row) => ({
      id: row.id, name: row.name, target: Number(row.target_amount),
      saved: Number(row.saved_amount), due: row.target_date ?? "2027-01-01",
      note: "Saved to your account"
    }))
  };
}

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
      <div className="transaction-identity">
        <span className="transaction-icon"><Icon size={16} /></span>
        <div><strong>{tx.description}</strong><span>{tx.category} · {formatShortDate(tx.date)}</span></div>
      </div>
      <div className={"transaction-amount " + (tx.type === "income" || tx.type === "refund" ? "positive" : tx.type === "transfer" ? "transfer" : "")}>
        {tx.type === "income" || tx.type === "refund" ? "+" : tx.type === "transfer" ? "↔ " : "−"}{formatINR(tx.amount)}
      </div>
    </div>;
  })}</div>;
}

export default function HomePage() {
  const [section, setSection] = useState<Section>("Overview");
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(DEMO_TRANSACTIONS);
  const [budgets, setBudgets] = useState<BudgetView[]>(DEMO_BUDGETS);
  const [goals, setGoals] = useState<GoalView[]>(DEMO_GOALS);
  const [period, setPeriod] = useState("1M");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food & dining");
  const [toast, setToast] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", text: "I can help you understand your spending, compare categories and plan savings goals. Sign in to ask questions against your saved financial records." }]);
  const [mobileNav, setMobileNav] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [monthPrefix, setMonthPrefix] = useState("");
  const [budgetCategory, setBudgetCategory] = useState("Food & dining");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalSaved, setGoalSaved] = useState("0");
  const [goalDate, setGoalDate] = useState("");
  const [contributionDrafts, setContributionDrafts] = useState<Record<string, string>>({});

  function notice(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  async function refreshAccount() {
    const data = await loadAccountData();
    setTransactions(data.transactions);
    setBudgets(data.budgets);
    setGoals(data.goals);
  }

  useEffect(() => {
    const current = new Date();
    setMonthPrefix(current.getFullYear() + "-" + String(current.getMonth() + 1).padStart(2, "0"));
    setAccountLoading(true);
    fetch("/api/v1/auth/me", { credentials: "same-origin" })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error("Could not restore your WealthOS session.");
        return response.json() as Promise<AccountUser>;
      })
      .then(async (account) => {
        if (!account) {
          setSessionActive(false);
          setUser(null);
          return;
        }
        setSessionActive(true);
        setUser(account);
        await refreshAccount();
      })
      .catch(() => {
        setSessionActive(false);
        setUser(null);
        notice("Could not restore your account session. Sign in again.");
      })
      .finally(() => setAccountLoading(false));
  }, []);

  function onAuthenticated(account: AccountUser) {
    setSessionActive(true);
    setUser(account);
    setAuthOpen(false);
    setAccountLoading(true);
    refreshAccount()
      .then(() => notice("Account connected. Your financial records are now saved."))
      .catch((error) => notice(error instanceof Error ? error.message : "Could not load account data."))
      .finally(() => setAccountLoading(false));
  }

  function signOut() {
    fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" })
      .catch(() => undefined)
      .finally(() => {
        setSessionActive(false);
        setUser(null);
        setTransactions(DEMO_TRANSACTIONS);
        setBudgets(DEMO_BUDGETS);
        setGoals(DEMO_GOALS);
        setMessages([{ role: "assistant", text: "I can help you understand your spending, compare categories and plan savings goals. Sign in to ask questions against your saved financial records." }]);
        notice("Signed out. You are back in demo mode.");
      });
  }

  const monthlyTransactions = useMemo(
    () => monthPrefix ? transactions.filter((tx) => tx.date.startsWith(monthPrefix)) : transactions,
    [transactions, monthPrefix]
  );
  const summary = useMemo(() => calculateSummary(monthlyTransactions), [monthlyTransactions]);
  const budgetTotal = budgets.reduce((sum, item) => sum + item.allocated, 0);
  const remaining = budgetTotal - summary.expenses;
  const balance = user ? summary.netCashFlow : DEMO_STARTING_BALANCE + summary.netCashFlow;
  const matching = transactions.filter((tx) => (tx.description + " " + tx.category + " " + tx.account).toLowerCase().includes(search.toLowerCase()));
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  async function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount);
    if (!description.trim() || !Number.isFinite(value) || value <= 0) {
      notice("Enter a description and a valid amount.");
      return;
    }
    const occurredOn = new Date().toISOString().slice(0, 10);
    if (sessionActive) {
      try {
        const response = await fetch("/api/v1/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" }, credentials: "same-origin",
          body: JSON.stringify({
            occurred_on: occurredOn, description: description.trim(), category, type: kind,
            amount: value.toFixed(2), currency: "INR", account: "Manual entry"
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "Could not save transaction.");
        await refreshAccount();
        setDescription(""); setAmount(""); setModal(false);
        notice("Transaction saved to your account.");
      } catch (error) {
        notice(error instanceof Error ? error.message : "Could not save transaction.");
      }
      return;
    }
    setTransactions((current) => [{
      id: "local-" + Date.now(), date: occurredOn, description: description.trim(),
      category, type: kind, amount: value, account: "Manual entry"
    }, ...current]);
    setDescription(""); setAmount(""); setModal(false);
    notice("Transaction added to this demo session.");
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (sessionActive) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/v1/transactions/import", {
          method: "POST", headers: {}, credentials: "same-origin", body: form
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "Could not import this CSV.");
        await refreshAccount();
        notice(result.inserted + " transactions imported; " + result.duplicates + " duplicates skipped.");
        return;
      }
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
          category: read("category") || "Other",
          type: (["income", "expense", "transfer", "refund"].includes(read("type").toLowerCase()) ? read("type").toLowerCase() : "expense") as FinancialTransaction["type"],
          amount: value, account: read("account") || "CSV import"
        };
      });
      setTransactions((current) => [...imported, ...current]);
      notice(imported.length + " transactions imported into this demo session.");
    } catch (error) {
      notice(error instanceof Error ? error.message : "Could not read this CSV.");
    } finally { event.target.value = ""; }
  }

  async function changeCategory(transactionId: string, nextCategory: string) {
    if (sessionActive) {
      try {
        const response = await fetch("/api/v1/transactions/" + encodeURIComponent(transactionId), {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: nextCategory })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "Could not update the category.");
        await refreshAccount();
      } catch (error) {
        notice(error instanceof Error ? error.message : "Could not update the category.");
        return;
      }
    } else {
      setTransactions((current) => current.map((item) => item.id === transactionId ? { ...item, category: nextCategory } : item));
    }
    notice("Transaction category updated.");
  }

  async function removeTransaction(transactionId: string) {
    if (!window.confirm("Delete this transaction? This action cannot be undone.")) return;
    if (sessionActive) {
      try {
        const response = await fetch("/api/v1/transactions/" + encodeURIComponent(transactionId), {
          method: "DELETE",
          credentials: "same-origin"
        });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.detail ?? "Could not delete this transaction.");
        }
        await refreshAccount();
      } catch (error) {
        notice(error instanceof Error ? error.message : "Could not delete this transaction.");
        return;
      }
    } else {
      setTransactions((current) => current.filter((item) => item.id !== transactionId));
    }
    notice("Transaction deleted.");
  }

  function exportCsv() {
    const columns = ["date", "description", "amount", "type", "category", "account"];
    const csv = [columns.join(","), ...transactions.map((tx) => [tx.date, tx.description, String(tx.amount), tx.type, tx.category, tx.account].map((item) => escapeCsv(String(item))).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "wealthos-transactions.csv"; anchor.click(); URL.revokeObjectURL(url);
    notice("CSV export prepared.");
  }

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(budgetAmount);
    if (!Number.isFinite(value) || value <= 0) { notice("Enter a valid monthly allocation."); return; }
    const currentMonth = new Date();
    if (sessionActive) {
      const response = await fetch("/api/v1/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ year: currentMonth.getFullYear(), month: currentMonth.getMonth() + 1, category: budgetCategory, amount: value.toFixed(2), currency: "INR" })
      });
      const result = await response.json();
      if (!response.ok) { notice(result.detail ?? "Could not save budget."); return; }
      await refreshAccount();
    } else {
      setBudgets((current) => {
        if (current.some((item) => item.category === budgetCategory)) {
          return current.map((item) => item.category === budgetCategory ? { ...item, allocated: value } : item);
        }
        return [...current, { category: budgetCategory, allocated: value, spent: 0, color: CATEGORY_COLORS[current.length % CATEGORY_COLORS.length] }];
      });
    }
    setBudgetAmount("");
    notice(sessionActive ? "Monthly budget saved." : "Budget updated in this demo session.");
  }

  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = Number(goalTarget);
    const saved = Number(goalSaved);
    if (!goalName.trim() || !Number.isFinite(target) || target <= 0 || !Number.isFinite(saved) || saved < 0 || saved > target) {
      notice("Check the goal name and amounts.");
      return;
    }
    const payload = {
      name: goalName.trim(), target_amount: target.toFixed(2), saved_amount: saved.toFixed(2),
      target_date: goalDate || null, currency: "INR"
    };
    if (sessionActive) {
      const response = await fetch("/api/v1/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) { notice(result.detail ?? "Could not create goal."); return; }
      await refreshAccount();
    } else {
      setGoals((current) => [...current, {
        id: "local-goal-" + Date.now(), name: payload.name, target, saved,
        due: goalDate || "2027-01-01", note: "Demo goal"
      }]);
    }
    setGoalName(""); setGoalTarget(""); setGoalSaved("0"); setGoalDate("");
    notice(sessionActive ? "Savings goal saved." : "Goal added to this demo session.");
  }

  async function contributeToGoal(goalId: string, currentSaved: number, target: number) {
    const contribution = Number(contributionDrafts[goalId] ?? "");
    if (!Number.isFinite(contribution) || contribution <= 0 || currentSaved + contribution > target) {
      notice("Enter a contribution greater than zero that does not exceed the remaining goal amount.");
      return;
    }
    const nextSaved = currentSaved + contribution;
    if (sessionActive) {
      const response = await fetch("/api/v1/goals/" + encodeURIComponent(goalId), {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved_amount: nextSaved.toFixed(2) })
      });
      const result = await response.json();
      if (!response.ok) {
        notice(result.detail ?? "Could not update this goal.");
        return;
      }
      await refreshAccount();
    } else {
      setGoals((current) => current.map((goal) => goal.id === goalId ? { ...goal, saved: nextSaved } : goal));
    }
    setContributionDrafts((current) => ({ ...current, [goalId]: "" }));
    notice("Goal progress updated. This records a plan, not a funds transfer.");
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt) return;
    if (sessionActive) {
      try {
        const response = await fetch("/api/v1/assistant/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" }, credentials: "same-origin",
          body: JSON.stringify({ question: prompt })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail ?? "The finance assistant could not answer.");
        setMessages((current) => [...current, { role: "user", text: prompt }, { role: "assistant", text: result.answer }]);
        setQuestion("");
      } catch (error) {
        notice(error instanceof Error ? error.message : "The finance assistant is unavailable.");
      }
      return;
    }
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

  const pageDescription: Record<Section, string> = {
    Overview: "A clear picture of where your money is going.",
    Transactions: "Every movement, organised and searchable.",
    Budgets: "Give every rupee a purpose, then track how it is used.",
    Goals: "Turn the things you want into a plan you can follow.",
    Trends: "Understand the pace and direction of your spending.",
    "AI assistant": "Ask better questions about the numbers behind your money."
  };

  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobileNav ? "sidebar-open" : "")}>
        <div className="brand-lockup"><div className="brand-mark"><Activity size={19} /></div><div><div className="brand-name">wealth<span>os</span></div><div className="brand-caption">PERSONAL FINANCE</div></div><button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={18} /></button></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">{NAV_ITEMS.map(({ label, icon: Icon }) => <button key={label} className={"nav-link " + (section === label ? "active" : "")} onClick={() => { setSection(label); setMobileNav(false); }}><Icon size={17} /><span>{label}</span>{label === "AI assistant" && <span className="nav-new">BETA</span>}</button>)}</nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><CircleHelp size={16} /><span>Help centre</span><ArrowUpRight size={13} /></div>
          <div className="profile-block"><div className="avatar">W</div><div className="profile-copy"><strong>{user?.email ?? "Demo workspace"}</strong><span>{user ? "Connected account" : "Personal account"}</span></div><button className="icon-button" aria-label="Workspace settings" onClick={() => notice("Settings are part of the next implementation phase.")}><Settings size={16} /></button></div>
          <div className="demo-note"><span className="demo-dot" /> {user ? "Saved to your account" : "Sample data · local session only"}</div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={19} /></button><div className="breadcrumb">Workspace <span>/</span> <strong>{section}</strong></div><div className="topbar-actions"><div className="demo-chip"><span className="demo-dot" /> {user ? "CONNECTED" : "DEMO MODE"}</div><button className="button button-secondary account-button" onClick={() => user ? signOut() : setAuthOpen(true)}>{user ? "Sign out" : "Sign in"}</button><button className="icon-button notification-button" aria-label="Notifications" onClick={() => notice("You are all caught up.")}><Bell size={17} /></button><div className="top-avatar">W</div></div></header>
      <main className="content">
        <div className="page-heading"><div><div className="eyebrow">PERSONAL FINANCE <span className="heading-separator">/</span> {user ? "CONNECTED ACCOUNT" : "DEMO WORKSPACE"}</div><h1>{section === "Overview" ? "Your money, in motion." : section}</h1><p>{PAGE_COPY[section]}</p></div><div className="heading-actions"><button className="button button-secondary" onClick={exportCsv}><Download size={15} /> Export</button><button className="button button-primary" onClick={() => setModal(true)}><Plus size={16} /> Add transaction</button></div></div>

        {section === "Overview" && <>
          <div className="metric-grid">
            <div className="metric-card balance-card"><div className="metric-top"><span>{user ? "NET CASH FLOW" : "AVAILABLE BALANCE"}</span><Wallet size={16} /></div><div className="metric-value">{formatINR(balance)}</div><div className="metric-foot"><span className="metric-positive"><TrendingUp size={13} /> {summary.savingsRate.toFixed(1)}%</span><span>net cash flow this month</span></div></div>
            <div className="metric-card"><div className="metric-top"><span>INCOME THIS MONTH</span><ArrowDownLeft size={16} /></div><div className="metric-value">{formatINR(summary.income)}</div><div className="metric-foot"><span className="metric-neutral">{monthlyTransactions.filter((tx) => tx.type === "income").length} entries</span><span>recorded income</span></div></div>
            <div className="metric-card"><div className="metric-top"><span>SPENDING THIS MONTH</span><ArrowUpRight size={16} /></div><div className="metric-value">{formatINR(summary.expenses)}</div><div className="metric-foot"><span className="metric-warning">{budgetTotal > 0 ? (summary.expenses / budgetTotal * 100).toFixed(0) + "% used" : "Not set"}</span><span>of planned budgets</span></div></div>
            <div className="metric-card"><div className="metric-top"><span>BUDGET REMAINING</span><Target size={16} /></div><div className="metric-value">{formatINR(remaining)}</div><div className="metric-foot"><span className="metric-positive">{budgets.length ? "Tracking" : "Not set"}</span><span>across {budgets.length} categories</span></div></div>
          </div>
          <div className="overview-grid">
            <section className="panel chart-panel"><div className="panel-heading"><div><div className="panel-kicker">SPENDING PERFORMANCE</div><h2>Outflow over time</h2><p>{user ? "Cumulative expense records from your account." : "Illustrative demo series. Connect an account to chart your records."}</p></div><div className="period-switch">{["1W", "1M", "3M", "6M", "1Y"].map((item) => <button key={item} className={period === item ? "selected" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div></div><div className="chart-summary"><strong>{formatINR(summary.expenses)}</strong><span>recorded outflow</span><span className="chart-divider" /><span>{user ? "connected data" : "sample data"}</span></div><SpendingChart period={period} transactions={transactions} demo={!user} budgets={budgetTotal} /></section>
            <section className="panel insight-panel"><div className="panel-heading"><div><div className="panel-kicker">A QUICK READ</div><h2>Worth noticing</h2></div><span className="insight-spark"><Sparkles size={17} /></span></div><div className="insight-feature"><div className="insight-icon"><TrendingDown size={18} /></div><div className="insight-label">SPENDING PACE</div><h3>{budgetTotal === 0 ? "Start with a category budget." : summary.expenses <= budgetTotal ? "You are within your planned allocation." : "Your recorded spending is over budget."}</h3><p>{budgetTotal === 0 ? "Set monthly category limits to compare real spending against a plan." : "Your recorded outflow is compared with the total category allocation for this month."}</p></div><div className="insight-divider" /><div className="insight-small"><span>Largest category</span><strong>{Object.entries(summary.expensesByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"}</strong></div><div className="insight-small"><span>Current savings rate</span><strong>{summary.savingsRate.toFixed(1)}%</strong></div><button className="text-link" onClick={() => setSection("AI assistant")}>Explore with assistant <ArrowUpRight size={14} /></button></section>
          </div>
          <div className="lower-grid">
            <section className="panel transactions-panel"><div className="panel-heading panel-heading-inline"><div><div className="panel-kicker">THE LEDGER</div><h2>Recent transactions</h2></div><button className="text-link" onClick={() => setSection("Transactions")}>View all <ArrowUpRight size={14} /></button></div>{recent.length ? <TransactionRows rows={recent} /> : <p className="empty-note">No transactions yet. Add one manually or import a CSV.</p>}</section>
            <section className="panel budget-panel"><div className="panel-heading panel-heading-inline"><div><div className="panel-kicker">ALLOCATION</div><h2>Budget overview</h2></div><button className="text-link" onClick={() => setSection("Budgets")}>Details <ArrowUpRight size={14} /></button></div><div className="budget-list">{budgets.slice(0, 4).map((budget) => { const spent = summary.expensesByCategory[budget.category] ?? 0; return <div className="budget-item" key={budget.category}><div className="budget-meta"><span>{budget.category}</span><strong>{formatINR(spent)} <small>/ {formatINR(budget.allocated)}</small></strong></div><div className="progress-track"><div className="progress-fill" style={{ width: Math.min(100, spent / budget.allocated * 100) + "%", background: budget.color }} /></div></div>; })}</div>{budgets.length === 0 && <p className="empty-note">No category budgets yet. Add your first allocation in Budgets.</p>}</section>
          </div>
        </>}

        {section === "Transactions" && <section className="panel full-panel">
          <div className="table-toolbar">
            <div><div className="panel-kicker">YOUR LEDGER</div><h2>All transactions <span className="count-badge">{transactions.length}</span></h2><p>{user ? "Your saved transactions, synced with the WealthOS API." : "Manual entries and imported rows in this browser session."}</p></div>
            <div className="table-actions">
              <label className="button button-secondary upload-button"><FileUp size={15} /> Import CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} /></label>
              <button className="button button-primary" onClick={() => setModal(true)}><Plus size={15} /> Add new</button>
            </div>
          </div>
          <div className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search description, category or account..." /></div>
          <div className="data-table-wrap"><table className="data-table">
            <thead><tr><th>DESCRIPTION</th><th>DATE</th><th>CATEGORY</th><th>ACCOUNT</th><th className="align-right">AMOUNT</th><th className="align-right">ACTIONS</th></tr></thead>
            <tbody>
              {matching.sort((a, b) => b.date.localeCompare(a.date)).map((tx) => <tr key={tx.id}>
                <td><strong>{tx.description}</strong></td>
                <td>{formatShortDate(tx.date)}</td>
                <td><select className="table-category-select" aria-label={"Category for " + tx.description} value={tx.category} onChange={(event) => changeCategory(tx.id, event.target.value)}>{["Food & dining", "Groceries", "Transport", "Housing", "Shopping", "Bills", "Subscriptions", "Education", "Health", "Freelance", "Allowance", "Other"].map((name) => <option key={name}>{name}</option>)}</select></td>
                <td>{tx.account}</td>
                <td className={"align-right amount-cell " + (tx.type === "income" || tx.type === "refund" ? "positive" : tx.type === "transfer" ? "transfer" : "")}>{tx.type === "income" || tx.type === "refund" ? "+" : tx.type === "transfer" ? "↔ " : "−"}{formatINR(tx.amount)}</td>
                <td className="align-right"><button className="icon-button delete-row-button" onClick={() => removeTransaction(tx.id)} aria-label={"Delete " + tx.description}><Trash2 size={14} /></button></td>
              </tr>)}
              {matching.length === 0 && <tr><td colSpan={6} className="empty-cell">No transactions match this search.</td></tr>}
            </tbody>
          </table></div>
          <div className="table-footnote">Amounts are shown in INR. {user ? "Changes are saved to your account." : "CSV imports remain in this session only."}</div>
        </section>}

        {section === "Budgets" && <>
          <form className="budget-create-form panel" onSubmit={saveBudget}><div><div className="panel-kicker">MONTHLY ALLOCATION</div><strong>Set a category limit</strong></div><select value={budgetCategory} onChange={(event) => setBudgetCategory(event.target.value)}>{["Housing", "Food & dining", "Groceries", "Transport", "Shopping", "Bills", "Subscriptions", "Education", "Health", "Other"].map((name) => <option key={name}>{name}</option>)}</select><input aria-label="Monthly budget amount" type="number" min="0.01" step="0.01" required value={budgetAmount} onChange={(event) => setBudgetAmount(event.target.value)} placeholder="Monthly limit in INR" /><button className="button button-primary" type="submit"><Plus size={14} /> Save limit</button></form>
          <div className="budget-hero panel"><div><div className="panel-kicker">MONTHLY ALLOCATION</div><h2>{formatINR(remaining)} <span>left to allocate</span></h2><p>{formatINR(summary.expenses)} of {formatINR(budgetTotal)} used across {budgets.length} categories.</p></div><div className="budget-hero-ring" style={{ background: budgetTotal > 0 ? "conic-gradient(#638a70 0 " + Math.min(100, summary.expenses / budgetTotal * 100) + "%, #dfe9df " + Math.min(100, summary.expenses / budgetTotal * 100) + "% 100%)" : "#dfe9df" }}><div><strong>{budgetTotal > 0 ? Math.round(summary.expenses / budgetTotal * 100) : 0}%</strong><span>UTILISED</span></div></div></div>
          <div className="budget-detail-grid">{budgets.map((budget) => { const spent = summary.expensesByCategory[budget.category] ?? 0; const rawPercentage = spent / budget.allocated * 100; const percentage = Math.max(0, Math.min(100, rawPercentage)); return <section className="panel budget-detail" key={budget.category}><div className="budget-detail-top"><span className="budget-color-dot" style={{ background: budget.color }} /><h3>{budget.category}</h3><span className="budget-state">{rawPercentage >= 100 ? "Limit reached" : "On track"}</span></div><div className="budget-big-number">{formatINR(spent)} <span>spent</span></div><div className="progress-track thick"><div className="progress-fill" style={{ width: percentage + "%", background: budget.color }} /></div><div className="budget-detail-foot"><span>{percentage.toFixed(0)}% used</span><strong>{spent > budget.allocated ? formatINR(spent - budget.allocated) + " over" : formatINR(budget.allocated - spent) + " remaining"}</strong></div><div className="budget-limit">Monthly limit <strong>{formatINR(budget.allocated)}</strong></div></section>; })}</div>
          {budgets.length === 0 && <div className="panel empty-panel">No budgets yet. Add a category allocation above to start tracking your spending.</div>}
        </>}

        {section === "Goals" && <>
          <form className="goal-create-form panel" onSubmit={saveGoal}><div><div className="panel-kicker">NEW SAVINGS GOAL</div><strong>Give something a target.</strong></div><input required value={goalName} onChange={(event) => setGoalName(event.target.value)} placeholder="Goal name" aria-label="Goal name" /><input required type="number" min="0.01" step="0.01" value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)} placeholder="Target amount (INR)" aria-label="Goal target amount" /><input type="number" min="0" step="0.01" value={goalSaved} onChange={(event) => setGoalSaved(event.target.value)} placeholder="Already saved" aria-label="Already saved amount" /><input type="date" value={goalDate} onChange={(event) => setGoalDate(event.target.value)} aria-label="Goal target date" /><button className="button button-primary" type="submit"><Plus size={14} /> Create goal</button></form>
          <div className="goals-intro"><div><div className="panel-kicker">PLAN FOR WHAT MATTERS</div><h2>Small steps, meaningful progress.</h2><p>{user ? "Your saved goals and contributions." : "Progress shown below is sample data and does not represent a real savings account."}</p></div><div className="goal-total"><span>TOTAL TARGETS</span><strong>{formatINR(goals.reduce((sum, goal) => sum + goal.target, 0))}</strong></div></div>
          <div className="goal-grid">{goals.map((goal, index) => { const progress = Math.min(100, goal.saved / goal.target * 100); return <section className="panel goal-card" key={goal.id}><div className="goal-card-top"><span className={"goal-symbol goal-symbol-" + (index % 3)}><Target size={18} /></span><span className="goal-due"><CalendarDays size={13} /> {new Date(goal.due + "T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span></div><h3>{goal.name}</h3><p>{goal.note}</p><div className="goal-progress-number"><strong>{formatINR(goal.saved)}</strong><span>of {formatINR(goal.target)}</span></div><div className="progress-track thick"><div className="progress-fill" style={{ width: progress + "%" }} /></div><div className="goal-bottom"><strong>{progress.toFixed(0)}% funded</strong><span>{formatINR(goal.target - goal.saved)} to go</span></div><div className="goal-contribution"><input type="number" min="0.01" step="0.01" max={goal.target - goal.saved} aria-label={"Contribution for " + goal.name} placeholder="Add contribution (INR)" value={contributionDrafts[goal.id] ?? ""} onChange={(event) => setContributionDrafts((current) => ({ ...current, [goal.id]: event.target.value }))} /><button type="button" className="button button-secondary" disabled={goal.saved >= goal.target} onClick={() => contributeToGoal(goal.id, goal.saved, goal.target)}>Add</button></div></section>; })}</div>
          {goals.length === 0 && <div className="panel empty-panel">No savings goals yet. Create your first target above.</div>}
          <div className="goal-disclaimer"><CircleHelp size={16} /> Goal progress is planning information. WealthOS does not move, reserve or custody funds.</div>
          <div className="paypal-section"><PayPalSandbox authenticated={sessionActive} /></div>
        </>}

        {section === "Trends" && <><section className="panel chart-panel trends-chart-panel"><div className="panel-heading"><div><div className="panel-kicker">SPENDING ANALYTICS</div><h2>How your outflow is moving</h2><p>{user ? "Actual records from your account." : "The current demo series is illustrative."}</p></div><div className="period-switch">{["1W", "1M", "3M", "6M", "1Y"].map((item) => <button key={item} className={period === item ? "selected" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div></div><SpendingChart period={period} transactions={transactions} demo={!user} budgets={budgetTotal} /></section><section className="panel category-breakdown"><div className="panel-heading"><div><div className="panel-kicker">CATEGORY MIX</div><h2>Where spending is concentrated</h2></div></div>{Object.entries(summary.expensesByCategory).sort((a, b) => b[1] - a[1]).map(([name, value], index) => <div className="category-trend" key={name}><div className="category-trend-head"><span>{name}</span><strong>{formatINR(value)}</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: value / Math.max(summary.expenses, 1) * 100 + "%", background: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} /></div></div>)}</section></>}

        {section === "AI assistant" && <section className="assistant-layout"><div className="assistant-intro"><div className="assistant-orb"><Sparkles size={22} /></div><div className="panel-kicker">WEALTHOS INTELLIGENCE</div><h2>Make sense of your money.</h2><p>{user ? "LangGraph coordinates specialist financial analysis using your saved transactions, budgets and goals." : "Ask a question about the sample workspace. Sign in to use LangGraph against your saved financial data."}</p></div><div className="assistant-panel panel"><div className="assistant-thread">{messages.map((message, index) => <div className={"chat-message " + message.role} key={index}><div className="chat-avatar">{message.role === "assistant" ? <Sparkles size={15} /> : "You"}</div><div className="chat-bubble">{message.text}</div></div>)}</div><div className="prompt-suggestions"><button onClick={() => setQuestion("How much did I spend on food?")}>Food spending</button><button onClick={() => setQuestion("What is my current savings rate?")}>Savings rate</button><button onClick={() => setQuestion("What is my available balance?")}>Available balance</button></div><form className="assistant-form" onSubmit={ask}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about your spending..." aria-label="Ask the finance assistant" /><button className="button button-primary" type="submit"><ArrowUpRight size={16} /> Send</button></form></div></section>}

        <footer className="page-footer"><span>WEALTHOS <span className="footer-dot">·</span> YOUR MONEY, IN MOTION.</span><span>{user ? "Connected account · calculated from saved records" : "Demo workspace · figures are illustrative"}</span></footer>
      </main>
    </div>

    <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onAuthenticated={onAuthenticated} />
    {accountLoading && <div className="account-loading" role="status">Syncing your financial records…</div>}
    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title"><div className="modal-heading"><div><div className="panel-kicker">THE LEDGER</div><h2 id="transaction-modal-title">Add a transaction</h2><p>{user ? "This entry will be saved to your account." : "This entry stays in the current browser session."}</p></div><button className="icon-button" onClick={() => setModal(false)} aria-label="Close dialog"><X size={18} /></button></div><form onSubmit={addTransaction}><div className="type-switch"><button type="button" className={kind === "expense" ? "selected" : ""} onClick={() => setKind("expense")}>Expense</button><button type="button" className={kind === "income" ? "selected" : ""} onClick={() => setKind("income")}>Income</button></div><label className="form-label">Description<input required value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. Groceries" autoFocus /></label><label className="form-label">Amount (INR)<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></label><label className="form-label">Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{["Food & dining", "Groceries", "Transport", "Housing", "Shopping", "Bills", "Subscriptions", "Freelance", "Allowance", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setModal(false)}>Cancel</button><button type="submit" className="button button-primary"><Check size={15} /> Save transaction</button></div></form></section></div>}
    {toast && <div className="toast"><Check size={15} /> {toast}</div>}
  </div>);
}
