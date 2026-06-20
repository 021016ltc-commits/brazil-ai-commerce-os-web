import {
  buildBusinessImpactSummary,
  buildStrategyRanks,
  enrichBusinessImpactItem,
} from "@/business_impact_engine/engine";
import { businessImpactMock } from "@/data/businessImpactMock";
import { isMockDataAllowed } from "@/lib/runtime/config";
import { withDatabase } from "@/lib/sqlite";
import { currentTenantId, DEFAULT_TENANT_ID } from "@/lib/tenantContext";
import type {
  ApiDataSource,
  BusinessImpactActionItem,
  BusinessImpactApiResponse,
  Platform,
} from "@/types";

type BusinessImpactRow = {
  impact_id: string;
  action_id: string;
  product_id: string;
  product_uid: string | null;
  platform: Platform | null;
  action_type: string | null;
  action_status: string | null;
  expected_impact: number | null;
  actual_impact: number | null;
  expected_profit_change: number | null;
  profit_before: number | null;
  profit_after: number | null;
  profit_delta: number | null;
  stock_before: number | null;
  stock_after: number | null;
  stock_turnover_change: number | null;
  gmv_before: number | null;
  gmv_after: number | null;
  gmv_delta: number | null;
  attribution_note: string | null;
  measured_at: string | null;
  source: BusinessImpactActionItem["source"] | null;
  queue_action_type: string | null;
  queue_status: string | null;
  queue_expected_profit_change: number | null;
  platform_order_gmv: number | null;
  platform_order_qty: number | null;
  platform_sales_count: number | null;
};

function shouldUseMockData() {
  return isMockDataAllowed() && process.env.DATA_SOURCE_MODE?.trim().toLowerCase() === "mock";
}

function asRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function tenantId() {
  return currentTenantId();
}

function defaultTenantFallback() {
  if (!isMockDataAllowed()) return buildResponse("sqlite", []);
  return tenantId() === DEFAULT_TENANT_ID ? businessImpactMock : buildResponse("sqlite", []);
}

function nowIso() {
  return new Date().toISOString();
}

function mapImpactRow(row: BusinessImpactRow): BusinessImpactActionItem {
  const expectedImpact = row.expected_impact ?? row.expected_profit_change ?? row.queue_expected_profit_change ?? 0;
  const profitDelta = row.profit_delta ?? (row.profit_after ?? 0) - (row.profit_before ?? 0);
  const gmvDelta = row.gmv_delta ?? (row.gmv_after ?? 0) - (row.gmv_before ?? 0);
  const actualImpact = row.actual_impact ?? profitDelta + gmvDelta * 0.08 - (row.stock_turnover_change ?? 0) * 40;

  return enrichBusinessImpactItem({
    impact_id: row.impact_id,
    action_id: row.action_id,
    product_id: row.product_id,
    product_uid: row.product_uid ?? undefined,
    platform: row.platform ?? undefined,
    action_type: row.action_type ?? row.queue_action_type ?? "business_review",
    action_status: row.action_status ?? row.queue_status ?? "evaluated",
    expected_impact: expectedImpact,
    actual_impact: actualImpact,
    expected_profit_change: row.expected_profit_change ?? row.queue_expected_profit_change ?? expectedImpact,
    profit_before: row.profit_before ?? 0,
    profit_after: row.profit_after ?? 0,
    profit_delta: profitDelta,
    stock_before: row.stock_before ?? 0,
    stock_after: row.stock_after ?? 0,
    stock_turnover_change: row.stock_turnover_change ?? 0,
    gmv_before: row.gmv_before ?? 0,
    gmv_after: row.gmv_after ?? row.platform_order_gmv ?? 0,
    gmv_delta: gmvDelta,
    attribution_note:
      row.attribution_note ??
      `本地归因使用执行审批池、决策复盘和 Shopee 只读缓存，不修改任何平台数据。`,
    measured_at: row.measured_at ?? "",
    source: row.source ?? "manual",
  });
}

async function readBusinessImpactActions(): Promise<BusinessImpactActionItem[]> {
  return withDatabase((db) =>
    asRows<BusinessImpactRow>(
      db
        .prepare(
          `SELECT bir.impact_id, bir.action_id, bir.product_id, bir.product_uid,
                  bir.platform, bir.action_type, bir.action_status,
                  bir.expected_impact, bir.actual_impact, bir.expected_profit_change,
                  bir.profit_before, bir.profit_after, bir.profit_delta,
                  bir.stock_before, bir.stock_after, bir.stock_turnover_change,
                  bir.gmv_before, bir.gmv_after, bir.gmv_delta,
                  bir.attribution_note, bir.measured_at, bir.source,
                  aq.action_type AS queue_action_type,
                  aq.status AS queue_status,
                  aq.expected_profit_change AS queue_expected_profit_change,
                  COALESCE(SUM(so.quantity * so.price), 0) AS platform_order_gmv,
                  COALESCE(SUM(so.quantity), 0) AS platform_order_qty,
                  sp.sales_count AS platform_sales_count
             FROM business_impact_results bir
             LEFT JOIN action_queue aq
               ON aq.action_id = bir.action_id
              AND aq.tenant_id = bir.tenant_id
             LEFT JOIN shopee_orders so
               ON so.product_id = bir.product_id
              AND so.tenant_id = bir.tenant_id
             LEFT JOIN shopee_products sp
               ON sp.product_id = bir.product_id
              AND sp.tenant_id = bir.tenant_id
             WHERE bir.tenant_id = ?
             GROUP BY bir.impact_id
             ORDER BY bir.measured_at DESC, bir.impact_id DESC`,
        )
        .all(tenantId()),
    ).map(mapImpactRow),
  );
}

function buildResponse(source: ApiDataSource, actionImpacts: BusinessImpactActionItem[]): BusinessImpactApiResponse {
  const summary = buildBusinessImpactSummary(actionImpacts);
  const ranks = buildStrategyRanks(actionImpacts);

  return {
    source,
    generated_at: nowIso(),
    summary,
    action_impacts: actionImpacts,
    best_strategies: ranks.slice(0, 5),
    worst_strategies: summary.worst_strategy_rank,
    data_sources: ["action_queue", "business_impact_results", "decision_feedback", "shopee_orders", "shopee_products"],
  };
}

export async function getBusinessImpactResponse(): Promise<BusinessImpactApiResponse> {
  if (shouldUseMockData()) return businessImpactMock;

  try {
    const actionImpacts = await readBusinessImpactActions();
    if (actionImpacts.length === 0) return defaultTenantFallback();
    return buildResponse("sqlite", actionImpacts);
  } catch (error) {
    if (!isMockDataAllowed()) throw error instanceof Error ? error : new Error("Business impact read failed.");
    return defaultTenantFallback();
  }
}

export async function getBusinessImpactActionsResponse() {
  const response = await getBusinessImpactResponse();
  return {
    source: response.source,
    generated_at: response.generated_at,
    action_impacts: response.action_impacts,
    data_sources: response.data_sources,
  };
}

export async function getBusinessImpactSummaryResponse() {
  const response = await getBusinessImpactResponse();
  return {
    source: response.source,
    generated_at: response.generated_at,
    summary: response.summary,
    best_strategies: response.best_strategies,
    worst_strategies: response.worst_strategies,
    data_sources: response.data_sources,
  };
}
