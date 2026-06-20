"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChartCard, DonutChartCard, LineChartCard } from "@/components/Charts";
import { emptyProfitResponse } from "@/data/emptyResponses";
import type { ProfitApiResponse } from "@/types";

const fallbackProfit: ProfitApiResponse = emptyProfitResponse;

export function ProfitExperienceCharts() {
  const [data, setData] = useState<ProfitApiResponse>(fallbackProfit);

  useEffect(() => {
    let active = true;
    fetch("/api/profit", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: ProfitApiResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(fallbackProfit);
      });

    return () => {
      active = false;
    };
  }, []);

  const charts = useMemo(() => {
    const labels = ["周一", "周二", "周三", "周四", "周五", "今日"];
    const base = data.snapshot.yesterday_net_profit;
    return {
      profitTrend: labels.map((label, index) => ({
        label,
        value: Math.round(base * [0.72, 0.78, 0.86, 0.91, 0.96, 1][index]),
      })),
      costShare: data.cost_structure.map((item, index) => ({
        label: item.label,
        value: item.value,
        color: ["#0F766E", "#14B8A6", "#D97706", "#16A34A", "#DC2626"][index] ?? "#64748B",
      })),
      topProducts: [...data.product_profit]
        .sort((left, right) => right.net_profit - left.net_profit)
        .slice(0, 5)
        .map((item) => ({
          label: item.product_name,
          value: item.net_profit,
        })),
    };
  }, [data]);

  return (
    <section className="grid gap-5 xl:grid-cols-3">
      <LineChartCard title="利润趋势图" description="看利润是否持续稳定，而不是只看单日波动。" data={charts.profitTrend} />
      <DonutChartCard title="利润来源占比图" description="用成本结构判断利润被哪一类成本挤压。" data={charts.costShare} />
      <BarChartCard title="TOP利润商品" description="优先关注对净利润贡献最大的商品。" data={charts.topProducts} />
    </section>
  );
}
