"use client";

import dynamic from "next/dynamic";
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });
import type { EChartsOption } from "echarts";
import { SPENDING_SERIES } from "@/lib/demo-data";
import type { FinancialTransaction } from "@/lib/types";

type Props = {
  period: string;
  transactions: FinancialTransaction[];
  demo: boolean;
  budgets: number;
};

function emptyState(message: string) {
  return <div style={{
    minHeight: 260, display: "grid", placeItems: "center", padding: 24,
    textAlign: "center", color: "#929b94", fontSize: 11, lineHeight: 1.6,
    background: "#fafbf8", borderRadius: 6
  }}>{message}</div>;
}

export function SpendingChart({ period, transactions, demo, budgets }: Props) {
  if (demo && period !== "1W" && period !== "1M") {
    return emptyState("The demo workspace contains only a short sample series. Import historical records or connect an account to explore longer periods.");
  }

  const points: Array<{ date: string; actual: number; planned: number }> = [];

  if (demo) {
    const values = period === "1W" ? SPENDING_SERIES.slice(-7) : SPENDING_SERIES;
    points.push(...values);
  } else {
    if (transactions.length === 0) {
      return emptyState("No transactions yet. Add an expense or import a statement to see your spending trend.");
    }
    if (period !== "1W" && period !== "1M") {
      return emptyState("Your account currently has no historical budget snapshots for this period. Use 1W or 1M while more history is collected.");
    }

    const days = period === "1W" ? 7 : 30;
    const latestDate = transactions.reduce((latest, tx) => tx.date > latest ? tx.date : latest, transactions[0].date);
    const end = new Date(latestDate + "T12:00:00");
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    const byDate = new Map<string, number>();

    for (const transaction of transactions) {
      if (transaction.type !== "expense" && transaction.type !== "refund") continue;
      const delta = transaction.type === "expense" ? transaction.amount : -transaction.amount;
      byDate.set(transaction.date, (byDate.get(transaction.date) ?? 0) + delta);
    }

    let cumulative = 0;
    const dailyPlan = budgets > 0 ? budgets / 30 : 0;
    for (let index = 0; index < days; index += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      const iso = [
        day.getFullYear(),
        String(day.getMonth() + 1).padStart(2, "0"),
        String(day.getDate()).padStart(2, "0")
      ].join("-");
      cumulative += byDate.get(iso) ?? 0;
      points.push({
        date: day.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        actual: Math.max(0, cumulative),
        planned: dailyPlan * (index + 1)
      });
    }
  }

  const maxValue = Math.max(0, ...points.map((point) => Math.max(point.actual, point.planned)));
  const axisMax = Math.max(1000, Math.ceil(maxValue / 1000) * 1000);
  const interval = axisMax <= 4_000 ? 1_000 : Math.ceil(axisMax / 4 / 1_000) * 1_000;

  const option: EChartsOption = {
    animationDuration: 450,
    grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#172c27",
      borderColor: "#172c27",
      textStyle: { color: "#f7f6f0", fontFamily: "inherit", fontSize: 12 },
      formatter: (params) => {
        const rows = Array.isArray(params) ? params : [params];
        const label = String(rows[0]?.name ?? "");
        const actual = Number(rows.find((point) => point.seriesName === "Actual")?.value ?? 0);
        const planned = Number(rows.find((point) => point.seriesName === "Planned")?.value ?? 0);
        return label + "<br/>Actual: ₹" + actual.toLocaleString("en-IN") + "<br/>Planned pace: ₹" + planned.toLocaleString("en-IN");
      }
    },
    legend: {
      top: 0, right: 0, itemWidth: 14, itemHeight: 6,
      textStyle: { color: "#8a928d", fontSize: 11 }
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: points.map((point) => point.date),
      axisLine: { lineStyle: { color: "#e7e8e2" } },
      axisTick: { show: false },
      axisLabel: { color: "#969d97", fontSize: 10, margin: 14 }
    },
    yAxis: {
      type: "value",
      min: 0,
      max: axisMax,
      interval,
      axisLabel: {
        color: "#969d97",
        fontSize: 10,
        formatter: (value: number) => value === 0 ? "0" : "₹" + (value / 1000) + "k"
      },
      splitLine: { lineStyle: { color: "#eff0eb", type: "dashed" } }
    },
    series: [
      {
        name: "Actual", type: "line", smooth: 0.32, showSymbol: false,
        lineStyle: { width: 2.5, color: "#477b68" },
        itemStyle: { color: "#477b68" },
        areaStyle: { color: "rgba(71,123,104,0.10)" },
        data: points.map((point) => point.actual)
      },
      {
        name: "Planned", type: "line", smooth: 0.32, showSymbol: false,
        lineStyle: { width: 1.5, type: "dashed", color: "#c5a27d" },
        itemStyle: { color: "#c5a27d" },
        data: points.map((point) => point.planned)
      }
    ]
  };

  return <ReactECharts option={option} notMerge style={{ height: 260, width: "100%" }} opts={{ renderer: "svg" }} />;
}
