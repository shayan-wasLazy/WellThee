export type TransactionType = "income" | "expense" | "transfer" | "refund";
export type FinancialTransaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  type: TransactionType;
  amount: number;
  account: string;
};
export type FinanceSummary = {
  income: number;
  expenses: number;
  netCashFlow: number;
  savingsRate: number;
  expensesByCategory: Record<string, number>;
};
