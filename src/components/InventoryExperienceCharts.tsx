"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChartCard, DonutChartCard, LineChartCard } from "@/components/Charts";
import {
  inventoryRiskMock,
  inventorySnapshotMock,
  inventoryStockMock,
  reorderRecommendationMock,
} from "@/data/inventoryMock";
import type { InventoryApiResponse } from "@/types";

const fallbackInventory: InventoryApiResponse = {
  source: "mock",
  snapshot: inventorySnapshotMock,
  inventory_stock: inventoryStockMock,
  inventory_risks: inventoryRiskMock,
  reorder_recommendations: reorderRecommendationMock,
};

const statusLabels: Record<string, string> = {
  healthy: "健康库存",
  reorder_soon: "即将补货",
  stockout_risk: "断货风险",
  overstock_risk: "积压风险",
  slow_moving: "滞销风险",
};

export function InventoryExperienceCharts() {
  const [data, setData] = useState<InventoryApiResponse>(fallbackInventory);

  useEffect(() => {
    let active = true;
    fetch("/api/inventory", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: InventoryApiResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(fallbackInventory);
      });

    return () => {
      active = false;
    };
  }, []);

  const charts = useMemo(() => {
    const statusCount = data.inventory_stock.reduce<Record<string, number>>((acc, item) => {
      acc[item.stock_status] = (acc[item.stock_status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      structure: Object.entries(statusCount).map(([status, value], index) => ({
        label: statusLabels[status] ?? status,
        value,
        color: ["#16A34A", "#D97706", "#DC2626", "#14B8A6", "#64748B"][index] ?? "#64748B",
      })),
      riskRanking: [...data.inventory_stock]
        .sort((left, right) => left.days_of_stock - right.days_of_stock)
        .slice(0, 5)
        .map((item) => ({
          label: item.product_name,
          value: item.days_of_stock,
        })),
      turnoverTrend: ["周一", "周二", "周三", "周四", "周五", "今日"].map((label, index) => ({
        label,
        value: Math.round(data.snapshot.inventory_turnover_days + [6, 4, 2, 1, -1, 0][index]),
      })),
    };
  }, [data]);

  return (
    <section className="grid gap-5 xl:grid-cols-3">
      <DonutChartCard title="库存结构图" description="按库存状态查看健康、断货、积压和滞销占比。" data={charts.structure} />
      <BarChartCard
        title="风险SKU排行"
        description="库存天数越低越容易断货，越高越容易占压现金流。"
        data={charts.riskRanking}
        valueLabel={(value) => `${value.toFixed(1)}天`}
      />
      <LineChartCard
        title="库存周转趋势"
        description="周转天数下降通常代表库存效率改善。"
        data={charts.turnoverTrend}
        valueLabel={(value) => `${value}天`}
      />
    </section>
  );
}
