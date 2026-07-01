"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  Boxes,
  PackageOpen,
  RefreshCcw,
  Wallet,
} from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { InventoryExperienceCharts } from "@/components/InventoryExperienceCharts";
import { ColumnSettingsNote, dataStatusLabel } from "@/components/OperatorControls";
import { RealDataReadiness } from "@/components/RealDataReadiness";
import { emptyInventoryResponse } from "@/data/emptyResponses";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { formatBrl } from "@/lib/format";
import { riskTypeLabel } from "@/locales/zh-CN";
import type {
  AnalysisPriority,
  InventoryApiResponse,
  InventoryStockItem,
  Platform,
  RiskLevel,
  StockStatus,
} from "@/types";

type PlatformFilter = "all" | Platform;
type StockStatusFilter = "all" | StockStatus;
type RiskFilter = "all" | RiskLevel;
type SortKey = "days_of_stock" | "stock_qty" | "stockout_risk" | "reorder_priority";

const fallbackInventory: InventoryApiResponse = emptyInventoryResponse;

function sourceLabel(source: InventoryApiResponse["source"]) {
  return dataStatusLabel(source);
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function stockStatusLabel(status: StockStatus) {
  return {
    healthy: "健康",
    reorder_soon: "即将补货",
    stockout_risk: "断货风险",
    overstock_risk: "积压风险",
    slow_moving: "慢动销",
  }[status];
}

function stockStatusBadge(status: StockStatus) {
  return {
    healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
    reorder_soon: "bg-amber-50 text-amber-700 border-amber-200",
    stockout_risk: "bg-rose-50 text-rose-700 border-rose-200",
    overstock_risk: "bg-orange-50 text-orange-700 border-orange-200",
    slow_moving: "bg-slate-100 text-slate-700 border-slate-200",
  }[status];
}

function stockStatusRank(status: StockStatus) {
  return {
    stockout_risk: 5,
    reorder_soon: 4,
    slow_moving: 3,
    overstock_risk: 2,
    healthy: 1,
  }[status];
}

function reorderPriorityRank(priority: AnalysisPriority) {
  return { P1: 3, P2: 2, P3: 1 }[priority];
}

function reorderPriorityLabel(priority: AnalysisPriority) {
  return {
    P1: "P1 / 优先补货",
    P2: "P2 / 进入复核",
    P3: "P3 / 保持观察",
  }[priority];
}

function reorderPriorityBadge(priority: AnalysisPriority) {
  return {
    P1: "bg-rose-50 text-rose-700 border-rose-200",
    P2: "bg-amber-50 text-amber-700 border-amber-200",
    P3: "bg-slate-100 text-slate-700 border-slate-200",
  }[priority];
}

function sortLabel(sortBy: SortKey) {
  return {
    days_of_stock: "按库存天数",
    stock_qty: "按库存数量",
    stockout_risk: "按断货风险",
    reorder_priority: "按补货优先级",
  }[sortBy];
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">{eyebrow}</div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-ink sm:text-2xl">{title}</h2>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [data, setData] = useState<InventoryApiResponse>(fallbackInventory);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("days_of_stock");

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      const payload = (await response.json()) as InventoryApiResponse;
      setData(payload);
    } catch {
      setData(fallbackInventory);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useAutoRefresh(loadData);

  const platformOptions = Array.from(new Set(data.inventory_stock.map((item) => item.platform)));
  const stockMap = new Map(data.inventory_stock.map((item) => [item.product_uid, item]));
  const riskMap = new Map(data.inventory_risks.map((item) => [item.product_uid, item]));
  const reorderMap = new Map(data.reorder_recommendations.map((item) => [item.product_uid, item]));

  const filteredInventoryStock = useMemo(() => {
    return [...data.inventory_stock]
      .filter((item) => {
        if (platformFilter !== "all" && item.platform !== platformFilter) return false;
        if (stockStatusFilter !== "all" && item.stock_status !== stockStatusFilter) return false;
        if (riskFilter !== "all" && riskMap.get(item.product_uid)?.risk_level !== riskFilter) return false;
        return true;
      })
      .sort((left, right) => {
        if (sortBy === "stock_qty") return left.stock_qty - right.stock_qty;
        if (sortBy === "stockout_risk") {
          const riskDelta = stockStatusRank(right.stock_status) - stockStatusRank(left.stock_status);
          if (riskDelta !== 0) return riskDelta;
          return left.days_of_stock - right.days_of_stock;
        }
        if (sortBy === "reorder_priority") {
          const leftPriority = reorderMap.get(left.product_uid)?.reorder_priority ?? "P3";
          const rightPriority = reorderMap.get(right.product_uid)?.reorder_priority ?? "P3";
          const priorityDelta = reorderPriorityRank(rightPriority) - reorderPriorityRank(leftPriority);
          if (priorityDelta !== 0) return priorityDelta;
          return left.days_of_stock - right.days_of_stock;
        }
        return left.days_of_stock - right.days_of_stock;
      });
  }, [data.inventory_stock, platformFilter, riskFilter, riskMap, reorderMap, sortBy, stockStatusFilter]);

  const filteredInventoryRisks = useMemo(() => {
    return [...data.inventory_risks]
      .filter((item) => {
        if (platformFilter !== "all" && item.platform !== platformFilter) return false;
        if (riskFilter !== "all" && item.risk_level !== riskFilter) return false;
        if (stockStatusFilter !== "all" && stockMap.get(item.product_uid)?.stock_status !== stockStatusFilter) {
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        if (sortBy === "days_of_stock") {
          return (stockMap.get(left.product_uid)?.days_of_stock ?? 0) - (stockMap.get(right.product_uid)?.days_of_stock ?? 0);
        }
        if (sortBy === "stock_qty") {
          return (stockMap.get(left.product_uid)?.stock_qty ?? 0) - (stockMap.get(right.product_uid)?.stock_qty ?? 0);
        }
        if (sortBy === "reorder_priority") {
          const leftPriority = reorderMap.get(left.product_uid)?.reorder_priority ?? "P3";
          const rightPriority = reorderMap.get(right.product_uid)?.reorder_priority ?? "P3";
          return reorderPriorityRank(rightPriority) - reorderPriorityRank(leftPriority);
        }
        return stockStatusRank(stockMap.get(right.product_uid)?.stock_status ?? "healthy") -
          stockStatusRank(stockMap.get(left.product_uid)?.stock_status ?? "healthy");
      });
  }, [data.inventory_risks, platformFilter, reorderMap, riskFilter, sortBy, stockMap, stockStatusFilter]);

  const filteredReorderRecommendations = useMemo(() => {
    return [...data.reorder_recommendations]
      .filter((item) => {
        if (platformFilter !== "all" && item.platform !== platformFilter) return false;
        if (riskFilter !== "all" && riskMap.get(item.product_uid)?.risk_level !== riskFilter) return false;
        if (stockStatusFilter !== "all" && stockMap.get(item.product_uid)?.stock_status !== stockStatusFilter) {
          return false;
        }
        return true;
      })
      .sort((left, right) => {
        if (sortBy === "days_of_stock") {
          return (stockMap.get(left.product_uid)?.days_of_stock ?? 0) - (stockMap.get(right.product_uid)?.days_of_stock ?? 0);
        }
        if (sortBy === "stock_qty") {
          return left.current_stock - right.current_stock;
        }
        if (sortBy === "stockout_risk") {
          const leftStatus = stockMap.get(left.product_uid)?.stock_status ?? "healthy";
          const rightStatus = stockMap.get(right.product_uid)?.stock_status ?? "healthy";
          const riskDelta = stockStatusRank(rightStatus) - stockStatusRank(leftStatus);
          if (riskDelta !== 0) return riskDelta;
          return left.current_stock - right.current_stock;
        }
        return reorderPriorityRank(right.reorder_priority) - reorderPriorityRank(left.reorder_priority);
      });
  }, [data.reorder_recommendations, platformFilter, reorderMap, riskFilter, riskMap, sortBy, stockMap, stockStatusFilter]);

  const snapshot = data.snapshot;
  const hasInventoryData =
    data.inventory_stock.length > 0 ||
    data.inventory_risks.length > 0 ||
    data.reorder_recommendations.length > 0 ||
    snapshot.total_inventory_value > 0 ||
    snapshot.stock_health_score > 0;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-7 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                库存中心 V1
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {sourceLabel(data.source)}
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">库存中心</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                查看库存健康、缺货风险和补货建议。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs text-slate-500">库存健康度</div>
              <div className="mt-2 text-2xl font-semibold text-forest">{formatNumber(snapshot.stock_health_score)}</div>
              <div className="mt-1 text-xs text-slate-500">周转 {formatNumber(snapshot.inventory_turnover_days, 1)} 天</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs text-slate-500">缺货风险</div>
              <div className="mt-2 text-2xl font-semibold text-coral">{snapshot.stockout_risk_count}</div>
              <div className="mt-1 text-xs text-slate-500">需要优先确认</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs text-slate-500">滞销风险</div>
              <div className="mt-2 text-2xl font-semibold text-amber">{snapshot.slow_moving_sku_count}</div>
              <div className="mt-1 text-xs text-slate-500">积压风险 {snapshot.overstock_risk_count}</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs text-slate-500">补货建议</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{data.reorder_recommendations.length}</div>
              <div className="mt-1 text-xs text-slate-500">只建议，不自动补货</div>
            </div>
          </div>
        </div>
      </section>

      <RealDataReadiness context="inventory" isEmpty={!hasInventoryData} />

      <section className="space-y-5">
        <SectionHeader
          eyebrow="库存总览"
          title="先看库存体质，再决定今天盯哪一类 SKU"
          description="库存总览回答的是：库存规模是否健康、周转是否拖慢现金流、断货和积压是否已经开始成为经营风险。"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3 text-ink">
              <Wallet className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-sm font-semibold">库存总货值</h3>
            </div>
            <div className="mt-4 text-2xl font-semibold text-ink">{formatBrl(snapshot.total_inventory_value)}</div>
          </article>
          <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3 text-ink">
              <RefreshCcw className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-sm font-semibold">库存周转天数</h3>
            </div>
            <div className="mt-4 text-2xl font-semibold text-ink">{formatNumber(snapshot.inventory_turnover_days, 1)} 天</div>
          </article>
          <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3 text-ink">
              <Boxes className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-sm font-semibold">库存健康分</h3>
            </div>
            <div className="mt-4 text-2xl font-semibold text-forest">{formatNumber(snapshot.stock_health_score)}</div>
          </article>
          <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3 text-ink">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-sm font-semibold">断货风险</h3>
            </div>
            <div className="mt-4 text-2xl font-semibold text-coral">{snapshot.stockout_risk_count}</div>
          </article>
          <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3 text-ink">
              <PackageOpen className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-sm font-semibold">积压风险</h3>
            </div>
            <div className="mt-4 text-2xl font-semibold text-amber">{snapshot.overstock_risk_count}</div>
          </article>
          <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3 text-ink">
              <Boxes className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-sm font-semibold">慢动销 SKU</h3>
            </div>
            <div className="mt-4 text-2xl font-semibold text-slate-700">{snapshot.slow_moving_sku_count}</div>
          </article>
        </div>
      </section>

      <InventoryExperienceCharts />

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">筛选与排序</div>
            <h2 className="text-lg font-semibold text-ink">筛选与排序</h2>
          </div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-ink">
            <ArrowDownWideNarrow className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">平台筛选</span>
            <select
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value as PlatformFilter)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="all">全部平台</option>
              {platformOptions.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">库存状态筛选</span>
            <select
              value={stockStatusFilter}
              onChange={(event) => setStockStatusFilter(event.target.value as StockStatusFilter)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="all">全部状态</option>
              <option value="healthy">健康</option>
              <option value="reorder_soon">即将补货</option>
              <option value="stockout_risk">断货风险</option>
              <option value="overstock_risk">积压风险</option>
              <option value="slow_moving">慢动销</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">风险等级筛选</span>
            <select
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="all">全部风险</option>
              <option value="high">高风险</option>
              <option value="medium">中风险</option>
              <option value="low">低风险</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">排序方式</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortKey)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="days_of_stock">按库存天数</option>
              <option value="stock_qty">按库存数量</option>
              <option value="stockout_risk">按断货风险</option>
              <option value="reorder_priority">按补货优先级</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="SKU库存监控"
          title="把今天要先看的 SKU 库存排出来"
          description="SKU库存监控回答的是：哪些品马上没货、哪些货压得太深、哪些已经应该进入补货复核。"
        />

        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="text-sm text-slate-500">
              当前结果 {filteredInventoryStock.length} 条，{sortLabel(sortBy)}。
            </div>
          </div>

          <div className="operator-scroll hidden md:block">
            <table className="operator-table text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th>商品</th>
                  <th>当前库存</th>
                  <th>日均销量</th>
                  <th>可售天数</th>
                  <th>风险等级</th>
                  <th>建议动作</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventoryStock.map((item) => (
                  <tr key={item.inventory_item_id} className={item.stock_status === "stockout_risk" ? "operator-risk-row" : undefined}>
                    <td>
                      <div className="font-medium text-ink">{item.product_name}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.platform}</div>
                    </td>
                    <td>{formatNumber(item.stock_qty)}</td>
                    <td>{formatNumber(item.daily_sales_avg, 1)}</td>
                    <td>{formatNumber(item.days_of_stock, 1)} 天</td>
                    <td>
                      <span
                        className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${stockStatusBadge(item.stock_status)}`}
                      >
                        {stockStatusLabel(item.stock_status)}
                      </span>
                    </td>
                    <td className="text-forest">
                      {item.stock_status === "stockout_risk" || item.stock_status === "reorder_soon"
                        ? `建议补货 ${formatNumber(item.suggested_reorder_qty)}`
                        : "保持观察"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4">
            <ColumnSettingsNote hiddenFields={["商品编号", "补货点", "建议补货量明细", "库存记录编号", "平台原始库存状态"]} />
          </div>

          <div className="grid gap-3 p-4 md:hidden">
            {filteredInventoryStock.map((item) => (
              <article key={item.inventory_item_id} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">{item.product_name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.platform} / {item.product_uid}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${stockStatusBadge(item.stock_status)}`}
                  >
                    {stockStatusLabel(item.stock_status)}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600">
                  <div>库存 {formatNumber(item.stock_qty)}</div>
                  <div>日均销量 {formatNumber(item.daily_sales_avg, 1)}</div>
                  <div>库存天数 {formatNumber(item.days_of_stock, 1)}</div>
                  <div>补货点 {formatNumber(item.reorder_point)}</div>
                  <div>建议补货量 {formatNumber(item.suggested_reorder_qty)}</div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="库存风险"
          title="把拖利润和现金流的库存风险先提出来"
          description="库存风险回答的是：哪些品已经接近断货、哪些货压得太深、哪些慢动销已经开始影响资金效率。"
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {filteredInventoryRisks.map((item) => (
            <article key={item.risk_id} className="rounded-lg border border-line bg-white p-5 shadow-panel">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">{riskTypeLabel(item.risk_type)}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {item.platform} / {item.product_uid}
                  </div>
                </div>
                <StatusPill status={item.risk_level} />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">{item.risk_reason}</p>
              <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                建议动作：{item.suggested_action}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="补货建议"
          title="把该进入人工补货复核的品先排队"
          description="补货建议回答的是：哪些品应该优先补、哪些要先确认交期、哪些虽然有建议但今天不用立刻推进。"
        />

        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="text-sm text-slate-500">
              当前结果 {filteredReorderRecommendations.length} 条，{sortLabel(sortBy)}。
            </div>
          </div>

          <div className="grid gap-4 p-5 lg:grid-cols-2">
            {filteredReorderRecommendations.map((item) => (
              <article key={item.recommendation_id} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">{item.product_name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.platform} / {item.product_uid}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${reorderPriorityBadge(item.reorder_priority)}`}
                  >
                    {reorderPriorityLabel(item.reorder_priority)}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  <div>当前库存：{formatNumber(item.current_stock)}</div>
                  <div>日均销量：{formatNumber(item.daily_sales_avg, 1)}</div>
                  <div>交期天数：{formatNumber(item.lead_time_days)} 天</div>
                  <div>建议补货量：{formatNumber(item.recommended_reorder_qty)}</div>
                  <div>库存状态：{stockStatusLabel(stockMap.get(item.product_uid)?.stock_status ?? "healthy")}</div>
                </div>

                <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                  决策说明：{item.decision_notes}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
