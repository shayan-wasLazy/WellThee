import type { FinanceSummary, FinancialTransaction } from "@/lib/types";

export function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

export function calculateSummary(transactions: FinancialTransaction[]): FinanceSummary {
  const income = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const expenses = transactions.reduce((total, transaction) => {
    if (transaction.type === "expense") return total + transaction.amount;
    if (transaction.type === "refund") return total - transaction.amount;
    return total;
  }, 0);

  const expensesByCategory: Record<string, number> = {};
  for (const transaction of transactions) {
    if (transaction.type !== "expense" && transaction.type !== "refund") continue;
    const direction = transaction.type === "expense" ? 1 : -1;
    expensesByCategory[transaction.category] =
      (expensesByCategory[transaction.category] ?? 0) + direction * transaction.amount;
  }

  return {
    income,
    expenses,
    netCashFlow: income - expenses,
    savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
    expensesByCategory
  };
}

export function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short"
  }).format(new Date(date + "T00:00:00"));
}

export function escapeCsv(value: string): string {
  return '"' + value.replaceAll('"', '""') + '"';
}
