"use client";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { SPENDING_SERIES } from "@/lib/demo-data";

type Props = { period: string };
export function SpendingChart({ period }: Props) {
  if (period !== "1W" && period !== "1M") {
    return <div style={{minHeight:260,display:"grid",placeItems:"center",padding:24,textAlign:"center",color:"#929b94",fontSize:11,lineHeight:1.6,background:"#fafbf8",borderRadius:6}}>Not enough sample history for {period}. Import more historical transactions to unlock this range.</div>;
  }
  const values = period === "1W" ? SPENDING_SERIES.slice(-7) : SPENDING_SERIES;
  const option: EChartsOption = {
    animationDuration: 450,
    grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis", backgroundColor: "#172c27", borderColor: "#172c27",
      textStyle: { color: "#f7f6f0", fontFamily: "inherit", fontSize: 12 },
      formatter: (params) => {
        const points = Array.isArray(params) ? params : [params];
        const label = String(points[0]?.axisValueLabel ?? "");
        const actual = Number(points.find((point) => point.seriesName === "Actual")?.value ?? 0);
        const planned = Number(points.find((point) => point.seriesName === "Planned")?.value ?? 0);
        return label + "<br/>Actual: ₹" + actual.toLocaleString("en-IN") + "<br/>Planned: ₹" + planned.toLocaleString("en-IN");
      }
    },
    legend: { top: 0, right: 0, itemWidth: 14, itemHeight: 6, textStyle: { color: "#8a928d", fontSize: 11 } },
    xAxis: {
      type: "category", boundaryGap: false, data: values.map((point) => point.date),
      axisLine: { lineStyle: { color: "#e7e8e2" } }, axisTick: { show: false },
      axisLabel: { color: "#969d97", fontSize: 10, margin: 14 }
    },
    yAxis: {
      type: "value", min: 0, max: 18000, interval: 6000,
      axisLabel: { color: "#969d97", fontSize: 10, formatter: (value: number) => value === 0 ? "0" : "₹" + (value / 1000) + "k" },
      splitLine: { lineStyle: { color: "#eff0eb", type: "dashed" } }
    },
    series: [
      { name: "Actual", type: "line", smooth: 0.32, showSymbol: false, lineStyle: { width: 2.5, color: "#477b68" }, itemStyle: { color: "#477b68" }, areaStyle: { color: "rgba(71,123,104,0.10)" }, data: values.map((point) => point.actual) },
      { name: "Planned", type: "line", smooth: 0.32, showSymbol: false, lineStyle: { width: 1.5, type: "dashed", color: "#c5a27d" }, itemStyle: { color: "#c5a27d" }, data: values.map((point) => point.planned) }
    ]
  };
  return <ReactECharts option={option} notMerge style={{ height: 260, width: "100%" }} opts={{ renderer: "svg" }} />;
}
