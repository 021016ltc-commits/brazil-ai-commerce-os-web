"use client";

import { useEffect, useState } from "react";
import { BarChartCard, DonutChartCard, LineChartCard } from "@/components/Charts";
import {
  emptyActionQueueResponse,
  emptyBusinessImpactResponse,
  emptyDecisionHistoryResponse,
  emptyDecisionMetricsResponse,
  emptySelfOptimizationResponse,
  emptyShopeeInventoryResponse,
  emptyShopeeOrdersResponse,
  emptyShopeeProductsResponse,
} from "@/data/emptyResponses";
import { actionTypeLabelZh, decisionUserActionLabel, shopeeOrderStatusLabel, statusLabel } from "@/locales/zh-CN";
import type {
  ActionExecutionQueueApiResponse,
  BusinessImpactApiResponse,
  DecisionHistoryApiResponse,
  DecisionMetricsApiResponse,
  SelfOptimizationApiResponse,
  ShopeeInventoryItem,
  ShopeeOrder,
  ShopeeProduct,
  ShopeeReadOnlyApiResponse,
} from "@/types";

const actionFallback: ActionExecutionQueueApiResponse = emptyActionQueueResponse;
const decisionHistoryFallback: DecisionHistoryApiResponse = emptyDecisionHistoryResponse;
const decisionMetricsFallback: DecisionMetricsApiResponse = emptyDecisionMetricsResponse;
const shopeeOrdersFallback: ShopeeReadOnlyApiResponse<ShopeeOrder> = emptyShopeeOrdersResponse;
const shopeeProductsFallback: ShopeeReadOnlyApiResponse<ShopeeProduct> = emptyShopeeProductsResponse;
const shopeeInventoryFallback: ShopeeReadOnlyApiResponse<ShopeeInventoryItem> = emptyShopeeInventoryResponse;

function countBy(items: string[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
}

export function ActionsExperienceCharts() {
  const [data, setData] = useState<ActionExecutionQueueApiResponse>(actionFallback);

  useEffect(() => {
    let active = true;
    fetch("/api/actions/queue", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: ActionExecutionQueueApiResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(actionFallback);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <DonutChartCard
        title="执行状态分布"
        description="所有动作只进入本地审批，不触发真实平台写操作。"
        data={[
          { label: "待处理", value: data.stats.pending_count, color: "#D97706" },
          { label: "已批准", value: data.stats.approved_count, color: "#16A34A" },
          { label: "已驳回", value: data.stats.rejected_count, color: "#DC2626" },
          { label: "已完成", value: data.stats.executed_count, color: "#0F766E" },
        ]}
      />
      <BarChartCard
        title="模拟收益排行"
        description="按本地模拟收益排序，帮助人工优先审批。"
        data={data.queue.slice(0, 6).map((item) => ({
          label: `${actionTypeLabelZh(item.action_type)} / ${item.product_id}`,
          value: item.expected_profit_change,
        }))}
      />
    </section>
  );
}

export function ShopeeExperienceCharts() {
  const [orders, setOrders] = useState(shopeeOrdersFallback);
  const [products, setProducts] = useState(shopeeProductsFallback);
  const [inventory, setInventory] = useState(shopeeInventoryFallback);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/shopee/orders", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
      fetch("/api/shopee/products", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
      fetch("/api/shopee/inventory", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
    ])
      .then(([orderPayload, productPayload, inventoryPayload]) => {
        if (!active) return;
        setOrders(orderPayload as ShopeeReadOnlyApiResponse<ShopeeOrder>);
        setProducts(productPayload as ShopeeReadOnlyApiResponse<ShopeeProduct>);
        setInventory(inventoryPayload as ShopeeReadOnlyApiResponse<ShopeeInventoryItem>);
      })
      .catch(() => {
        if (!active) return;
        setOrders(shopeeOrdersFallback);
        setProducts(shopeeProductsFallback);
        setInventory(shopeeInventoryFallback);
      });

    return () => {
      active = false;
    };
  }, []);

  const orderStatus = countBy(orders.data.map((item) => item.order_status));
  const available = inventory.data.reduce((sum, item) => sum + item.available_stock, 0);
  const reserved = inventory.data.reduce((sum, item) => sum + item.reserved_stock, 0);

  return (
    <section className="grid gap-5 xl:grid-cols-3">
      <BarChartCard
        title="店铺商品销量排行"
        description="只读展示 Shopee 缓存商品销量。"
        data={products.data.map((item) => ({ label: item.title, value: item.sales_count })).slice(0, 6)}
        valueLabel={(value) => `${value}件`}
      />
      <DonutChartCard
        title="Shopee库存结构"
        description="可售库存与预留库存只用于观察，不做写入。"
        data={[
          { label: "可售库存", value: available, color: "#0F766E" },
          { label: "预留库存", value: reserved, color: "#D97706" },
        ]}
      />
      <BarChartCard
        title="订单状态分布"
        description="按只读订单缓存统计履约状态。"
        data={Object.entries(orderStatus).map(([status, value]) => ({
          label: shopeeOrderStatusLabel(status),
          value,
        }))}
        valueLabel={(value) => `${value}单`}
      />
    </section>
  );
}

export function DecisionFeedbackExperienceCharts() {
  const [history, setHistory] = useState<DecisionHistoryApiResponse>(decisionHistoryFallback);
  const [metrics, setMetrics] = useState<DecisionMetricsApiResponse>(decisionMetricsFallback);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/decision/history", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
      fetch("/api/decision/metrics", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
    ])
      .then(([historyPayload, metricsPayload]) => {
        if (!active) return;
        setHistory(historyPayload as DecisionHistoryApiResponse);
        setMetrics(metricsPayload as DecisionMetricsApiResponse);
      })
      .catch(() => {
        if (!active) return;
        setHistory(decisionHistoryFallback);
        setMetrics(decisionMetricsFallback);
      });

    return () => {
      active = false;
    };
  }, []);

  const actionMix = countBy(history.history.map((item) => decisionUserActionLabel(item.user_action)));

  return (
    <section className="grid gap-5 xl:grid-cols-3">
      <BarChartCard
        title="决策指标"
        description="用真实业务结果复盘历史判断质量。"
        data={[
          { label: "命中率", value: metrics.metrics.decision_accuracy_score * 100 },
          { label: "推荐成功率", value: metrics.metrics.recommendation_success_rate * 100 },
          { label: "拦截准确率", value: metrics.metrics.blocked_correct_rate * 100 },
        ]}
        valueLabel={(value) => `${value.toFixed(0)}%`}
      />
      <LineChartCard
        title="实际利润复盘"
        description="按历史反馈记录观察真实利润走势。"
        data={history.history.slice(0, 6).map((item, index) => ({
          label: `样本${index + 1}`,
          value: item.outcome?.actual_profit ?? 0,
        }))}
      />
      <DonutChartCard
        title="人工动作占比"
        description="看团队最终选择采购、观察、忽略或驳回的比例。"
        data={Object.entries(actionMix).map(([label, value], index) => ({
          label,
          value,
          color: ["#0F766E", "#14B8A6", "#D97706", "#DC2626"][index] ?? "#64748B",
        }))}
      />
    </section>
  );
}

export function BusinessImpactExperienceCharts() {
  const [data, setData] = useState<BusinessImpactApiResponse>(emptyBusinessImpactResponse);

  useEffect(() => {
    let active = true;
    fetch("/api/business-impact", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: BusinessImpactApiResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(emptyBusinessImpactResponse);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="grid gap-5 xl:grid-cols-3">
      <LineChartCard
        title="利润影响趋势"
        description="按归因动作观察利润变化。"
        data={data.action_impacts.slice(0, 6).map((item, index) => ({
          label: `动作${index + 1}`,
          value: item.profit_delta,
        }))}
      />
      <BarChartCard
        title="最佳策略排行"
        description="看哪些策略给利润和GMV带来正向贡献。"
        data={data.best_strategies.map((item) => ({
          label: actionTypeLabelZh(item.action_type),
          value: item.total_profit_delta,
        }))}
      />
      <DonutChartCard
        title="动作成功占比"
        description="基于本地经营结果归因计算。"
        data={[
          { label: "成功动作", value: data.summary.successful_action_count, color: "#16A34A" },
          {
            label: "待复盘动作",
            value: Math.max(0, data.summary.analyzed_action_count - data.summary.successful_action_count),
            color: "#D97706",
          },
        ]}
      />
    </section>
  );
}

export function SelfOptimizationExperienceCharts() {
  const [data, setData] = useState<SelfOptimizationApiResponse>(emptySelfOptimizationResponse);

  useEffect(() => {
    let active = true;
    fetch("/api/self-optimization", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: SelfOptimizationApiResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(emptySelfOptimizationResponse);
      });

    return () => {
      active = false;
    };
  }, []);

  const statusMix = countBy(data.rule_performance.map((item) => statusLabel(item.status)));

  return (
    <section className="grid gap-5 xl:grid-cols-3">
      <LineChartCard
        title="系统学习趋势图"
        description="跟踪规则命中率是否持续改善。"
        data={data.summary.learning_trend.map((item) => ({
          label: item.period,
          value: item.rule_hit_rate * 100,
        }))}
        valueLabel={(value) => `${value.toFixed(0)}%`}
      />
      <BarChartCard
        title="规则命中率排行"
        description="找出表现最好和需要复盘的规则。"
        data={data.rule_performance.slice(0, 6).map((item) => ({
          label: item.rule_name,
          value: item.hit_rate * 100,
        }))}
        valueLabel={(value) => `${value.toFixed(0)}%`}
      />
      <DonutChartCard
        title="规则健康状态"
        description="所有建议只进入人工审核，不自动改规则。"
        data={Object.entries(statusMix).map(([label, value], index) => ({
          label,
          value,
          color: ["#16A34A", "#D97706", "#DC2626"][index] ?? "#64748B",
        }))}
      />
    </section>
  );
}
