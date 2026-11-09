import type { FinanceSummary, FinancialTransaction } from "@/lib/types";

export function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}
export function calculateSummary(transactions: FinancialTransaction[]): FinanceSummary {
  const income = transactions.filter((item) => item.type === "income").reduce((total, item) => total + item.amount, 0);
  const expenses = transactions.filter((item) => item.type === "expense").reduce((total, item) => total + item.amount, 0);
  const expensesByCategory: Record<string, number> = {};
  for (const item of transactions) {
    if (item.type !== "expense") continue;
    expensesByCategory[item.category] = (expensesByCategory[item.category] ?? 0) + item.amount;
  }
  return { income, expenses, netCashFlow: income - expenses, savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0, expensesByCategory };
}
export function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(date + "T00:00:00"));
}
export function escapeCsv(value: string): string {
  return '"' + value.replaceAll('"', '""') + '"';
}
