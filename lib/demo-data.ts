import type { FinancialTransaction } from "@/lib/types";

export const DEMO_TRANSACTIONS: FinancialTransaction[] = [
  { id: "tx-001", date: "2026-11-09", description: "Monthly allowance", category: "Allowance", type: "income", amount: 42000, account: "Primary account" },
  { id: "tx-002", date: "2026-11-08", description: "Freelance design project", category: "Freelance", type: "income", amount: 8000, account: "Primary account" },
  { id: "tx-003", date: "2026-11-09", description: "Weekly groceries", category: "Groceries", type: "expense", amount: 1200, account: "UPI" },
  { id: "tx-004", date: "2026-11-08", description: "Metro and auto", category: "Transport", type: "expense", amount: 350, account: "UPI" },
  { id: "tx-005", date: "2026-11-07", description: "Cafe afternoon", category: "Food & dining", type: "expense", amount: 850, account: "UPI" },
  { id: "tx-006", date: "2026-11-06", description: "Music subscription", category: "Subscriptions", type: "expense", amount: 600, account: "Card" },
  { id: "tx-007", date: "2026-11-05", description: "Running shoes", category: "Shopping", type: "expense", amount: 2300, account: "Card" },
  { id: "tx-008", date: "2026-11-04", description: "Cab home", category: "Transport", type: "expense", amount: 450, account: "UPI" },
  { id: "tx-009", date: "2026-11-03", description: "Lunch", category: "Food & dining", type: "expense", amount: 900, account: "UPI" },
  { id: "tx-010", date: "2026-11-02", description: "Internet bill", category: "Bills", type: "expense", amount: 1600, account: "Card" },
  { id: "tx-011", date: "2026-11-01", description: "Household contribution", category: "Housing", type: "expense", amount: 3200, account: "Bank transfer" },
  { id: "tx-012", date: "2026-11-01", description: "Coffee", category: "Food & dining", type: "expense", amount: 550, account: "UPI" }
];
export const DEMO_STARTING_BALANCE = 25000;
export const DEMO_BUDGETS = [
  { category: "Housing", allocated: 8000, spent: 3200, color: "#78958a" },
  { category: "Food & dining", allocated: 5000, spent: 2300, color: "#c59b72" },
  { category: "Groceries", allocated: 2500, spent: 1200, color: "#8c9fbd" },
  { category: "Transport", allocated: 3000, spent: 800, color: "#8c9fbd" },
  { category: "Shopping", allocated: 4000, spent: 2300, color: "#b68eaa" },
  { category: "Bills", allocated: 2000, spent: 1600, color: "#9aa0a6" },
  { category: "Subscriptions", allocated: 1000, spent: 600, color: "#9aa0a6" }
];
export const DEMO_GOALS = [
  { id: "goal-1", name: "New laptop", target: 85000, saved: 32000, due: "2027-05-01", note: "Long-term purchase" },
  { id: "goal-2", name: "Emergency fund", target: 50000, saved: 18500, due: "2027-03-01", note: "Financial safety net" },
  { id: "goal-3", name: "Weekend getaway", target: 15000, saved: 9200, due: "2026-12-20", note: "Short-term goal" }
];
export const SPENDING_SERIES = [
  { date: "Nov 01", actual: 3750, planned: 4300 },
  { date: "Nov 02", actual: 5350, planned: 6000 },
  { date: "Nov 03", actual: 6250, planned: 7200 },
  { date: "Nov 04", actual: 6700, planned: 8400 },
  { date: "Nov 05", actual: 9000, planned: 9600 },
  { date: "Nov 06", actual: 9600, planned: 10800 },
  { date: "Nov 07", actual: 10450, planned: 12000 },
  { date: "Nov 08", actual: 10800, planned: 13200 },
  { date: "Nov 09", actual: 12000, planned: 14400 },
  { date: "Nov 10", actual: 12000, planned: 15600 }
];
