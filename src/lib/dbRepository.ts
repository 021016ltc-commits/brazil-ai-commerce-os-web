import {
  action_queue as mockActionQueue,
  crawl_logs as mockCrawlLogs,
  data_quality_report as mockDataQualityReport,
  products as mockProducts,
  upload_queue as mockUploadQueue,
} from "@/data/mock";
import { approvalHistoryMock, approvalQueueMock } from "@/data/approvalsMock";
import { analysisQueueMock } from "@/data/analysisMock";
import { dashboardSummaryMock } from "@/data/dashboardMock";
import {
  inventoryRiskMock,
  inventorySnapshotMock,
  inventoryStockMock,
  reorderRecommendationMock,
} from "@/data/inventoryMock";
import { productProfitMock, profitSnapshotMock } from "@/data/profitMock";
import { tasksMock } from "@/data/tasksMock";
import {
  opportunityKeywordsMock,
  opportunityMarketScoreMock,
  opportunityProductsMock,
  opportunityScoreMock,
} from "@/data/opportunitiesMock";
import {
  emptyAnalysisResponse,
  emptyApprovalsResponse,
  emptyDashboardResponse,
  emptyInventoryResponse,
  emptyOpportunitiesResponse,
  emptyProfitResponse,
  emptyTasksResponse,
} from "@/data/emptyResponses";
import { buildExecutionStats } from "@/action_execution_layer/guard";
import { buildApprovalHistoryItem, buildApprovalQueue, buildApprovalStats } from "@/lib/approvals";
import { calculateDecisionMetrics } from "@/decision_feedback_system/engine";
import {
  buildAiRecommendations,
  buildMarketAnalysis,
  buildOpportunityAnalysis,
  buildRiskAnalysis,
} from "@/lib/analysis";
import { buildDashboardSummary } from "@/lib/dashboard";
import { getBusinessImpactResponse } from "@/lib/businessImpactRepository";
import { getSelfOptimizationResponse } from "@/lib/selfOptimizationRepository";
import { readActionExecutionQueue } from "@/lib/actionExecutionRepository";
import { readDecisionHistory } from "@/lib/decisionFeedbackRepository";
import { isMockDataAllowed } from "@/lib/runtime/config";
import { buildCostStructure, buildProfitRisk } from "@/lib/profit";
import {
  buildKeywordOpportunities,
  buildRiskAlerts,
  buildTodayOpportunities,
} from "@/lib/opportunities";
import { buildTasksResponse } from "@/lib/tasks";
import { withDatabase } from "@/lib/sqlite";
import { currentTenantId, DEFAULT_TENANT_ID } from "@/lib/tenantContext";
import type {
  AnalysisApiResponse,
  AnalysisQueueRecord,
  ActionQueueItem,
  ApprovalHistoryItem,
  ApprovalsApiResponse,
  CrawlLog,
  DashboardSummaryApiResponse,
  DataQualityReport,
  InventoryApiResponse,
  InventoryRiskItem,
  InventorySnapshot,
  InventoryStockItem,
  Keyword,
  MarketScore,
  OpportunitiesApiResponse,
  OpportunityScore,
  ProductProfitItem,
  Product,
  ProfitApiResponse,
  ProfitSnapshot,
  ProductsApiResponse,
  ReorderRecommendationItem,
  ReviewStatus,
  RiskLevel,
  TasksApiResponse,
  UploadQueueItem,
} from "@/types";

type ProductRow = {
  product_uid: string;
  platform: Product["platform"];
  market_code: Product["market_code"];
  platform_product_id: string;
  platform_shop_id: string;
  title_current: string | null;
  price_amount: number | null;
  market_currency: "BRL" | null;
  rating: number | null;
  review_count: number | null;
  sold_count_text: string | null;
  seller_uid: string | null;
  last_seen_at: string | null;
  availability_status: string | null;
};

type KeywordRow = {
  keyword_uid: string;
  platform: Keyword["platform"] | null;
  market_code: Keyword["market_code"];
  normalized_keyword: string;
  category_hint: string | null;
  latest_result_count: number | null;
  seasonality_tag: string | null;
};

type MarketScoreRow = {
  market_score_id: string;
  keyword_uid: string;
  platform: Product["platform"];
  market_code: Product["market_code"];
  keyword: string | null;
  market_demand_score: number | null;
  competition_score: number | null;
  trend_score: number | null;
  total_score: number | null;
};

type OpportunityRow = {
  opportunity_score_id: string;
  platform: Product["platform"];
  market_code: Product["market_code"];
  keyword_uid: string;
  keyword: string | null;
  category_hint: string | null;
  market_demand_score: number | null;
  competition_score: number | null;
  total_score: number | null;
  recommendation_level: "A" | "B" | "C" | null;
  decision_notes: string | null;
  logistics_risk_score: number | null;
  policy_risk_score: number | null;
  market_total_score: number | null;
  product_uid: string | null;
};

type ActionRow = {
  action_id: string;
  created_at: string | null;
  platform: Product["platform"] | null;
  target_id: string | null;
  target_type: string | null;
  action_type: ActionQueueItem["action_type"] | string | null;
  recommendation_text: string | null;
  confidence_score: number | null;
  risk_level: RiskLevel | null;
  approval_status: ReviewStatus | string | null;
  status: ReviewStatus | string | null;
  approved_by: string | null;
  approved_at: string | null;
};

type UploadRow = {
  upload_id: string;
  created_at: string | null;
  target_id: string | null;
  upload_request_type: string | null;
  approval_status: ReviewStatus | string | null;
  status: ReviewStatus | string | null;
};

type CrawlLogRow = {
  crawl_run_id: string;
  platform: CrawlLog["platform"];
  market_code: CrawlLog["market_code"];
  started_at: string | null;
  ended_at: string | null;
  status: CrawlLog["status"];
  items_requested: number | null;
  items_captured: number | null;
  notes: string | null;
};

type DataQualityRow = {
  report_id: string;
  report_date: string | null;
  source_table: string | null;
  check_name: string | null;
  severity: RiskLevel | null;
  quality_status: DataQualityReport["quality_status"] | null;
  details: string | null;
};

type ApprovalHistoryRow = {
  history_id: string;
  approval_id: string;
  action: ReviewStatus | string | null;
  reviewer: string | null;
  reviewed_at: string | null;
  notes: string | null;
};

type AnalysisQueueRow = {
  analysis_id: string;
  analysis_type: string | null;
  priority: number | null;
  notes: string | null;
  status: string | null;
};

type ProfitSnapshotRow = {
  profit_snapshot_id: string;
  reporting_date: string | null;
  market_code: Product["market_code"];
  yesterday_net_profit: number | null;
  month_net_profit: number | null;
  net_margin: number | null;
  cash_flow: number | null;
  inventory_turnover_days: number | null;
  procurement_cost: number | null;
  advertising_cost: number | null;
  logistics_cost: number | null;
  platform_commission: number | null;
  tax_cost: number | null;
};

type ProductProfitRow = {
  profit_item_id: string;
  product_uid: string;
  platform: Product["platform"];
  product_name: string | null;
  revenue: number | null;
  cost: number | null;
  gross_profit: number | null;
  net_profit: number | null;
  net_margin: number | null;
  inventory_days: number | null;
  risk_level: RiskLevel | null;
};

type InventorySnapshotRow = {
  inventory_snapshot_id: string;
  reporting_date: string | null;
  market_code: Product["market_code"];
  total_inventory_value: number | null;
  inventory_turnover_days: number | null;
  stock_health_score: number | null;
  stockout_risk_count: number | null;
  overstock_risk_count: number | null;
  slow_moving_sku_count: number | null;
};

type InventoryStockRow = {
  inventory_item_id: string;
  product_uid: string;
  platform: Product["platform"];
  product_name: string | null;
  stock_qty: number | null;
  daily_sales_avg: number | null;
  days_of_stock: number | null;
  reorder_point: number | null;
  suggested_reorder_qty: number | null;
  stock_status: InventoryStockItem["stock_status"] | null;
};

type InventoryRiskRow = {
  risk_id: string;
  product_uid: string;
  platform: Product["platform"];
  risk_type: string | null;
  risk_level: RiskLevel | null;
  risk_reason: string | null;
  suggested_action: string | null;
};

type ReorderRecommendationRow = {
  recommendation_id: string;
  product_uid: string;
  product_name: string | null;
  platform: Product["platform"];
  current_stock: number | null;
  daily_sales_avg: number | null;
  lead_time_days: number | null;
  recommended_reorder_qty: number | null;
  reorder_priority: ReorderRecommendationItem["reorder_priority"] | null;
  decision_notes: string | null;
};

function asRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function shouldUseMockData() {
  return isMockDataAllowed() && process.env.DATA_SOURCE_MODE?.trim().toLowerCase() === "mock";
}

function shouldAllowMockFallback() {
  return isMockDataAllowed();
}

function tenantId() {
  return currentTenantId();
}

function isDefaultTenant() {
  return tenantId() === DEFAULT_TENANT_ID;
}

function emptyProfitSnapshot(): ProfitSnapshot {
  return {
    profit_snapshot_id: `profit_snapshot_${tenantId()}_empty`,
    reporting_date: new Date().toISOString().slice(0, 10),
    market_code: "br",
    yesterday_net_profit: 0,
    month_net_profit: 0,
    net_margin: 0,
    cash_flow: 0,
    inventory_turnover_days: 0,
    procurement_cost: 0,
    advertising_cost: 0,
    logistics_cost: 0,
    platform_commission: 0,
    tax_cost: 0,
  };
}

function emptyInventorySnapshot(): InventorySnapshot {
  return {
    inventory_snapshot_id: `inventory_snapshot_${tenantId()}_empty`,
    reporting_date: new Date().toISOString().slice(0, 10),
    market_code: "br",
    total_inventory_value: 0,
    inventory_turnover_days: 0,
    stock_health_score: 0,
    stockout_risk_count: 0,
    overstock_risk_count: 0,
    slow_moving_sku_count: 0,
  };
}

function mapProduct(row: ProductRow): Product {
  const fallback = isMockDataAllowed()
    ? opportunityProductsMock.find((item) => item.product_uid === row.product_uid)
    : undefined;
  return {
    product_uid: row.product_uid,
    seller_uid: row.seller_uid ?? fallback?.seller_uid ?? "",
    keyword_uid: fallback?.keyword_uid ?? "",
    platform: row.platform,
    market_code: row.market_code,
    platform_product_id: row.platform_product_id,
    platform_shop_id: row.platform_shop_id,
    title: row.title_current ?? fallback?.title ?? row.product_uid,
    title_current: row.title_current ?? fallback?.title_current ?? fallback?.title ?? row.product_uid,
    price_amount: row.price_amount ?? fallback?.price_amount ?? 0,
    market_currency: row.market_currency ?? "BRL",
    rating: row.rating ?? fallback?.rating ?? 0,
    review_count: row.review_count ?? fallback?.review_count ?? 0,
    sold_count_text: row.sold_count_text ?? fallback?.sold_count_text ?? "-",
    snapshot_date: (row.last_seen_at ?? fallback?.snapshot_date ?? "").slice(0, 10),
    availability_status: row.availability_status ?? fallback?.availability_status ?? "in_stock",
  };
}

function mapKeyword(row: KeywordRow): Keyword {
  const fallback = isMockDataAllowed()
    ? opportunityKeywordsMock.find((item) => item.keyword_uid === row.keyword_uid)
    : undefined;
  return {
    keyword_uid: row.keyword_uid,
    platform: row.platform ?? fallback?.platform ?? "Shopee",
    market_code: row.market_code,
    keyword: row.normalized_keyword,
    normalized_keyword: row.normalized_keyword,
    category_hint: row.category_hint ?? fallback?.category_hint ?? "General",
    search_volume_index: row.latest_result_count ?? fallback?.search_volume_index ?? 0,
    trend_direction: fallback?.trend_direction ?? (row.seasonality_tag === "uptrend" ? "up" : "flat"),
  };
}

function riskFromScores(row: OpportunityRow): RiskLevel {
  const maxRisk = Math.max(row.logistics_risk_score ?? 0, row.policy_risk_score ?? 0);
  if (maxRisk >= 40) return "high";
  if (maxRisk >= 25) return "medium";
  return "low";
}

function mapMarketScore(row: MarketScoreRow): MarketScore {
  const fallback = isMockDataAllowed()
    ? opportunityMarketScoreMock.find((item) => item.market_score_id === row.market_score_id)
    : undefined;
  return {
    market_score_id: row.market_score_id,
    keyword_uid: row.keyword_uid,
    platform: row.platform,
    market_code: row.market_code,
    keyword: row.keyword ?? fallback?.keyword ?? row.keyword_uid,
    market_demand_score: row.market_demand_score ?? fallback?.market_demand_score ?? 0,
    competition_score: row.competition_score ?? fallback?.competition_score ?? 0,
    trend_score: row.trend_score ?? fallback?.trend_score ?? 0,
    total_score: row.total_score ?? fallback?.total_score ?? 0,
  };
}

function mapOpportunity(row: OpportunityRow): OpportunityScore {
  const fallback = isMockDataAllowed()
    ? opportunityScoreMock.find((item) => item.opportunity_id === row.opportunity_score_id)
    : undefined;
  const riskLevel = riskFromScores(row);
    return {
      opportunity_id: row.opportunity_score_id,
      product_uid: row.product_uid ?? fallback?.product_uid ?? "",
      keyword_uid: row.keyword_uid,
      category_hint: row.category_hint ?? fallback?.category_hint ?? "General",
      market_demand_score: row.market_demand_score ?? fallback?.market_demand_score ?? 0,
      competition_score: row.competition_score ?? fallback?.competition_score ?? 0,
      market_score: row.market_total_score ?? fallback?.market_score ?? 0,
      opportunity_score: row.total_score ?? fallback?.opportunity_score ?? 0,
      recommendation_level: row.recommendation_level ?? fallback?.recommendation_level ?? "B",
      suggestion_level: row.recommendation_level ?? fallback?.suggestion_level ?? "B",
      decision_notes: row.decision_notes ?? fallback?.decision_notes ?? fallback?.reason ?? "",
      risk_level: riskLevel,
      risk_score: Math.max(row.logistics_risk_score ?? 0, row.policy_risk_score ?? 0, fallback?.risk_score ?? 0),
      reason: row.decision_notes ?? fallback?.reason ?? "",
    };
}

function mapAction(row: ActionRow): ActionQueueItem {
  return {
    action_id: row.action_id,
    product_uid: row.target_id ?? "",
    platform: row.platform ?? undefined,
    action_type: (row.action_type ?? "listing_review") as ActionQueueItem["action_type"],
    suggestion_text: row.recommendation_text ?? "",
    target_object: row.target_type ?? "product",
    risk_level: row.risk_level ?? "medium",
    confidence_score: row.confidence_score ?? 0,
    status: normalizeReviewStatus(row.approval_status ?? row.status),
    created_at: row.created_at ?? "",
    reviewer: row.approved_by ?? undefined,
    reviewed_at: row.approved_at ?? undefined,
  };
}

function mapUpload(row: UploadRow): UploadQueueItem {
  return {
    upload_id: row.upload_id,
    product_uid: row.target_id ?? "",
    request_type: row.upload_request_type === "listing_review" ? "listing_review" : "content_review",
    status: normalizeReviewStatus(row.approval_status ?? row.status),
    created_at: row.created_at ?? "",
  };
}

function mapCrawlLog(row: CrawlLogRow): CrawlLog {
  return {
    crawl_run_id: row.crawl_run_id,
    platform: row.platform,
    market_code: row.market_code,
    started_at: row.started_at ?? "",
    finished_at: row.ended_at ?? "",
    status: row.status,
    records_seen: row.items_requested ?? 0,
    records_inserted: row.items_captured ?? 0,
    message: row.notes ?? row.status,
  };
}

function mapDataQuality(row: DataQualityRow): DataQualityReport {
  return {
    report_id: row.report_id,
    report_date: row.report_date ?? "",
    source_table: row.source_table ?? "",
    check_name: row.check_name ?? "",
    severity: row.severity ?? "medium",
    quality_status: row.quality_status ?? "warning",
    details: row.details ?? "",
  };
}

function mapAnalysisQueue(row: AnalysisQueueRow): AnalysisQueueRecord {
  return {
    analysis_id: row.analysis_id,
    analysis_type: row.analysis_type ?? "analysis_review",
    priority: row.priority ?? 3,
    notes: row.notes ?? "",
    status: row.status ?? "pending_analysis",
  };
}

function mapProfitSnapshot(row: ProfitSnapshotRow): ProfitSnapshot {
  return {
    profit_snapshot_id: row.profit_snapshot_id,
    reporting_date:
      row.reporting_date ??
      (isMockDataAllowed() ? profitSnapshotMock.reporting_date : new Date().toISOString().slice(0, 10)),
    market_code: row.market_code,
    yesterday_net_profit: row.yesterday_net_profit ?? 0,
    month_net_profit: row.month_net_profit ?? 0,
    net_margin: row.net_margin ?? 0,
    cash_flow: row.cash_flow ?? 0,
    inventory_turnover_days: row.inventory_turnover_days ?? 0,
    procurement_cost: row.procurement_cost ?? 0,
    advertising_cost: row.advertising_cost ?? 0,
    logistics_cost: row.logistics_cost ?? 0,
    platform_commission: row.platform_commission ?? 0,
    tax_cost: row.tax_cost ?? 0,
  };
}

function mapProductProfit(row: ProductProfitRow): ProductProfitItem {
  const fallback = isMockDataAllowed()
    ? productProfitMock.find((item) => item.profit_item_id === row.profit_item_id)
    : undefined;
  return {
    profit_item_id: row.profit_item_id,
    product_uid: row.product_uid,
    platform: row.platform,
    product_name: row.product_name ?? fallback?.product_name ?? row.product_uid,
    revenue: row.revenue ?? fallback?.revenue ?? 0,
    cost: row.cost ?? fallback?.cost ?? 0,
    gross_profit: row.gross_profit ?? fallback?.gross_profit ?? 0,
    net_profit: row.net_profit ?? fallback?.net_profit ?? 0,
    net_margin: row.net_margin ?? fallback?.net_margin ?? 0,
    inventory_days: row.inventory_days ?? fallback?.inventory_days ?? 0,
    risk_level: row.risk_level ?? fallback?.risk_level ?? "medium",
  };
}

function mapInventorySnapshot(row: InventorySnapshotRow): InventorySnapshot {
  return {
    inventory_snapshot_id: row.inventory_snapshot_id,
    reporting_date:
      row.reporting_date ??
      (isMockDataAllowed() ? inventorySnapshotMock.reporting_date : new Date().toISOString().slice(0, 10)),
    market_code: row.market_code,
    total_inventory_value: row.total_inventory_value ?? 0,
    inventory_turnover_days: row.inventory_turnover_days ?? 0,
    stock_health_score: row.stock_health_score ?? 0,
    stockout_risk_count: row.stockout_risk_count ?? 0,
    overstock_risk_count: row.overstock_risk_count ?? 0,
    slow_moving_sku_count: row.slow_moving_sku_count ?? 0,
  };
}

function mapInventoryStock(row: InventoryStockRow): InventoryStockItem {
  const fallback = isMockDataAllowed()
    ? inventoryStockMock.find((item) => item.inventory_item_id === row.inventory_item_id)
    : undefined;
  return {
    inventory_item_id: row.inventory_item_id,
    product_uid: row.product_uid,
    product_name: row.product_name ?? fallback?.product_name ?? row.product_uid,
    platform: row.platform,
    stock_qty: row.stock_qty ?? fallback?.stock_qty ?? 0,
    daily_sales_avg: row.daily_sales_avg ?? fallback?.daily_sales_avg ?? 0,
    days_of_stock: row.days_of_stock ?? fallback?.days_of_stock ?? 0,
    reorder_point: row.reorder_point ?? fallback?.reorder_point ?? 0,
    suggested_reorder_qty: row.suggested_reorder_qty ?? fallback?.suggested_reorder_qty ?? 0,
    stock_status: row.stock_status ?? fallback?.stock_status ?? "healthy",
  };
}

function mapInventoryRisk(row: InventoryRiskRow): InventoryRiskItem {
  const fallback = isMockDataAllowed()
    ? inventoryRiskMock.find((item) => item.risk_id === row.risk_id)
    : undefined;
  return {
    risk_id: row.risk_id,
    product_uid: row.product_uid,
    platform: row.platform,
    risk_type: row.risk_type ?? fallback?.risk_type ?? "stockout_risk",
    risk_level: row.risk_level ?? fallback?.risk_level ?? "medium",
    risk_reason: row.risk_reason ?? fallback?.risk_reason ?? "",
    suggested_action: row.suggested_action ?? fallback?.suggested_action ?? "",
  };
}

function mapReorderRecommendation(row: ReorderRecommendationRow): ReorderRecommendationItem {
  const fallback = isMockDataAllowed()
    ? reorderRecommendationMock.find((item) => item.recommendation_id === row.recommendation_id)
    : undefined;
  return {
    recommendation_id: row.recommendation_id,
    product_uid: row.product_uid,
    product_name: row.product_name ?? fallback?.product_name ?? row.product_uid,
    platform: row.platform,
    current_stock: row.current_stock ?? fallback?.current_stock ?? 0,
    daily_sales_avg: row.daily_sales_avg ?? fallback?.daily_sales_avg ?? 0,
    lead_time_days: row.lead_time_days ?? fallback?.lead_time_days ?? 0,
    recommended_reorder_qty:
      row.recommended_reorder_qty ?? fallback?.recommended_reorder_qty ?? 0,
    reorder_priority: row.reorder_priority ?? fallback?.reorder_priority ?? "P3",
    decision_notes: row.decision_notes ?? fallback?.decision_notes ?? "",
  };
}

function mapApprovalHistory(row: ApprovalHistoryRow): ApprovalHistoryItem {
  return {
    history_id: row.history_id,
    approval_id: row.approval_id,
    action: normalizeReviewStatus(row.action),
    reviewer: row.reviewer ?? "local_operator",
    reviewed_at: row.reviewed_at ?? "",
    notes: row.notes ?? "无备注",
  };
}

function normalizeReviewStatus(status: unknown): ReviewStatus {
  if (
    status === "approved_local" ||
    status === "rejected_local" ||
    status === "pending_review" ||
    status === "deferred_local"
  ) {
    return status;
  }
  if (status === "approved") return "approved_local";
  if (status === "rejected") return "rejected_local";
  return "pending_review";
}

export async function readProducts(): Promise<Product[]> {
  return withDatabase((db) =>
    asRows<ProductRow>(
      db
        .prepare(
          `SELECT product_uid, platform, market_code, platform_product_id, platform_shop_id,
                  title_current, price_amount, market_currency, rating, review_count,
                  sold_count_text, seller_uid, last_seen_at, availability_status
             FROM products
            WHERE tenant_id = ?
             ORDER BY updated_at DESC, product_uid ASC`,
        )
        .all(tenantId()),
    ).map(mapProduct),
  );
}

export async function readKeywords(): Promise<Keyword[]> {
  return withDatabase((db) =>
    asRows<KeywordRow>(
      db
        .prepare(
          `SELECT keyword_uid, platform, market_code, normalized_keyword, category_hint,
                  latest_result_count, seasonality_tag
             FROM keywords
            WHERE tenant_id = ?
             ORDER BY last_seen_at DESC, keyword_uid ASC`,
        )
        .all(tenantId()),
    ).map(mapKeyword),
  );
}

export async function readMarketScores(): Promise<MarketScore[]> {
  return withDatabase((db) =>
    asRows<MarketScoreRow>(
      db
        .prepare(
          `SELECT market_score_id, keyword_uid, platform, market_code, keyword,
                  market_demand_score, competition_score, trend_score, total_score
             FROM market_score
            WHERE tenant_id = ?
             ORDER BY total_score DESC, market_score_id ASC`,
        )
        .all(tenantId()),
    ).map(mapMarketScore),
  );
}

export async function readOpportunities() {
  return withDatabase((db) =>
    asRows<OpportunityRow>(
      db
        .prepare(
          `SELECT os.opportunity_score_id, os.platform, os.market_code, os.keyword_uid,
                  os.keyword, os.category_hint, os.total_score, os.recommendation_level,
                  os.market_demand_score, os.competition_score, os.decision_notes,
                  os.logistics_risk_score, os.policy_risk_score,
                  ms.total_score AS market_total_score, p.product_uid
             FROM opportunity_score os
             LEFT JOIN market_score ms
               ON ms.keyword_uid = os.keyword_uid
              AND ms.platform = os.platform
              AND ms.market_code = os.market_code
              AND ms.tenant_id = os.tenant_id
             LEFT JOIN products p
               ON p.platform = os.platform
              AND p.market_code = os.market_code
              AND p.tenant_id = os.tenant_id
             WHERE os.tenant_id = ?
             ORDER BY os.total_score DESC, os.opportunity_score_id ASC`,
        )
        .all(tenantId()),
    ).map(mapOpportunity),
  );
}

export async function readActions(): Promise<ActionQueueItem[]> {
  return withDatabase((db) =>
    asRows<ActionRow>(
      db
        .prepare(
          `SELECT action_id, created_at, platform, target_id, target_type, action_type,
                  recommendation_text, confidence_score, risk_level, approval_status, status,
                  approved_by, approved_at
             FROM action_queue
            WHERE tenant_id = ?
              AND (target_type IS NULL
               OR target_type <> 'execution_action')
             ORDER BY created_at DESC, action_id ASC`,
        )
        .all(tenantId()),
    ).map(mapAction),
  );
}

export async function readApprovalHistory(): Promise<ApprovalHistoryItem[]> {
  return withDatabase((db) =>
    asRows<ApprovalHistoryRow>(
      db
        .prepare(
          `SELECT history_id, approval_id, action, reviewer, reviewed_at, notes
             FROM approval_history
            WHERE tenant_id = ?
             ORDER BY reviewed_at DESC, history_id DESC`,
        )
        .all(tenantId()),
    ).map(mapApprovalHistory),
  );
}

export async function readUploads(): Promise<UploadQueueItem[]> {
  return withDatabase((db) =>
    asRows<UploadRow>(
      db
        .prepare(
          `SELECT upload_id, created_at, target_id, upload_request_type, approval_status, status
             FROM upload_queue
            WHERE tenant_id = ?
             ORDER BY created_at DESC, upload_id ASC`,
        )
        .all(tenantId()),
    ).map(mapUpload),
  );
}

export async function readCrawlLogs(): Promise<CrawlLog[]> {
  return withDatabase((db) =>
    asRows<CrawlLogRow>(
      db
        .prepare(
          `SELECT crawl_run_id, platform, market_code, started_at, ended_at, status,
                  items_requested, items_captured, notes
             FROM crawl_logs
            WHERE tenant_id = ?
             ORDER BY started_at DESC, crawl_run_id ASC`,
        )
        .all(tenantId()),
    ).map(mapCrawlLog),
  );
}

export async function readDataQualityReports(): Promise<DataQualityReport[]> {
  return withDatabase((db) =>
    asRows<DataQualityRow>(
      db
        .prepare(
          `SELECT report_id, report_date, source_table, check_name, severity, quality_status, details
             FROM data_quality_report
            WHERE tenant_id = ?
             ORDER BY generated_at DESC, report_id ASC`,
        )
        .all(tenantId()),
    ).map(mapDataQuality),
  );
}

export async function readAnalysisQueue(): Promise<AnalysisQueueRecord[]> {
  return withDatabase((db) =>
    asRows<AnalysisQueueRow>(
      db
        .prepare(
          `SELECT analysis_id, analysis_type, priority, notes, status
             FROM analysis_queue
            WHERE tenant_id = ?
             ORDER BY priority ASC, created_at DESC, analysis_id ASC`,
        )
        .all(tenantId()),
    ).map(mapAnalysisQueue),
  );
}

export async function readProfitSnapshot(): Promise<ProfitSnapshot> {
  return withDatabase((db) => {
    const row = db
      .prepare(
        `SELECT profit_snapshot_id, reporting_date, market_code,
                yesterday_net_profit, month_net_profit, net_margin, cash_flow,
                inventory_turnover_days, procurement_cost, advertising_cost,
                logistics_cost, platform_commission, tax_cost
           FROM profit_snapshot
          WHERE tenant_id = ?
          ORDER BY reporting_date DESC, profit_snapshot_id DESC
          LIMIT 1`,
      )
      .get(tenantId()) as ProfitSnapshotRow | undefined;

    if (!row) {
      if (!isDefaultTenant()) return emptyProfitSnapshot();
      throw new Error("Profit snapshot not found.");
    }

    return mapProfitSnapshot(row);
  });
}

export async function readProductProfit(): Promise<ProductProfitItem[]> {
  return withDatabase((db) =>
    asRows<ProductProfitRow>(
      db
        .prepare(
          `SELECT profit_item_id, product_uid, platform, product_name,
                  revenue, cost, gross_profit, net_profit, net_margin,
                  inventory_days, risk_level
             FROM product_profit
            WHERE tenant_id = ?
             ORDER BY net_profit DESC, profit_item_id ASC`,
        )
        .all(tenantId()),
    ).map(mapProductProfit),
  );
}

export async function readInventorySnapshot(): Promise<InventorySnapshot> {
  return withDatabase((db) => {
    const row = db
      .prepare(
        `SELECT inventory_snapshot_id, reporting_date, market_code,
                total_inventory_value, inventory_turnover_days, stock_health_score,
                stockout_risk_count, overstock_risk_count, slow_moving_sku_count
           FROM inventory_snapshot
          WHERE tenant_id = ?
          ORDER BY reporting_date DESC, inventory_snapshot_id DESC
          LIMIT 1`,
      )
      .get(tenantId()) as InventorySnapshotRow | undefined;

    if (!row) {
      if (!isDefaultTenant()) return emptyInventorySnapshot();
      throw new Error("Inventory snapshot not found.");
    }

    return mapInventorySnapshot(row);
  });
}

export async function readInventoryStock(): Promise<InventoryStockItem[]> {
  return withDatabase((db) =>
    asRows<InventoryStockRow>(
      db
        .prepare(
          `SELECT inventory_item_id, product_uid, platform, product_name, stock_qty,
                  daily_sales_avg, days_of_stock, reorder_point, suggested_reorder_qty,
                  stock_status
             FROM inventory_stock
            WHERE tenant_id = ?
             ORDER BY days_of_stock ASC, inventory_item_id ASC`,
        )
        .all(tenantId()),
    ).map(mapInventoryStock),
  );
}

export async function readInventoryRisks(): Promise<InventoryRiskItem[]> {
  return withDatabase((db) =>
    asRows<InventoryRiskRow>(
      db
        .prepare(
          `SELECT risk_id, product_uid, platform, risk_type, risk_level, risk_reason, suggested_action
             FROM inventory_risk
            WHERE tenant_id = ?
             ORDER BY risk_level DESC, risk_id ASC`,
        )
        .all(tenantId()),
    ).map(mapInventoryRisk),
  );
}

export async function readReorderRecommendations(): Promise<ReorderRecommendationItem[]> {
  return withDatabase((db) =>
    asRows<ReorderRecommendationRow>(
      db
        .prepare(
          `SELECT recommendation_id, product_uid, product_name, platform, current_stock,
                  daily_sales_avg, lead_time_days, recommended_reorder_qty,
                  reorder_priority, decision_notes
             FROM reorder_recommendation
            WHERE tenant_id = ?
             ORDER BY reorder_priority ASC, recommendation_id ASC`,
        )
        .all(tenantId()),
    ).map(mapReorderRecommendation),
  );
}

export async function getProductsResponse(): Promise<ProductsApiResponse> {
  if (shouldUseMockData()) {
    return { source: "mock", products: mockProducts };
  }

  try {
    return { source: "sqlite", products: await readProducts() };
  } catch (error) {
    if (!shouldAllowMockFallback()) return { source: "sqlite", products: [] };
    return { source: "mock", products: mockProducts };
  }
}

export async function getOpportunitiesResponse(): Promise<OpportunitiesApiResponse> {
  if (shouldUseMockData()) {
    const todayOpportunities = buildTodayOpportunities(opportunityProductsMock, opportunityScoreMock);
    const keywordOpportunities = buildKeywordOpportunities(
      opportunityKeywordsMock,
      opportunityMarketScoreMock,
      opportunityScoreMock,
    );
    const riskAlerts = buildRiskAlerts(opportunityProductsMock, opportunityScoreMock);

    return {
      source: "mock",
      products: opportunityProductsMock,
      keywords: opportunityKeywordsMock,
      market_score: opportunityMarketScoreMock,
      opportunity_score: opportunityScoreMock,
      today_opportunities: todayOpportunities,
      keyword_opportunities: keywordOpportunities,
      risk_alerts: riskAlerts,
    };
  }

  try {
    const products = await readProducts();
    const keywords = await readKeywords();
    const marketScores = await readMarketScores();
    const opportunityScores = await readOpportunities();

    return {
      source: "sqlite",
      products,
      keywords,
      market_score: marketScores,
      opportunity_score: opportunityScores,
      today_opportunities: buildTodayOpportunities(products, opportunityScores),
      keyword_opportunities: buildKeywordOpportunities(keywords, marketScores, opportunityScores),
      risk_alerts: buildRiskAlerts(products, opportunityScores),
    };
  } catch (error) {
    if (!shouldAllowMockFallback()) return emptyOpportunitiesResponse;
    const todayOpportunities = buildTodayOpportunities(opportunityProductsMock, opportunityScoreMock);
    const keywordOpportunities = buildKeywordOpportunities(
      opportunityKeywordsMock,
      opportunityMarketScoreMock,
      opportunityScoreMock,
    );
    const riskAlerts = buildRiskAlerts(opportunityProductsMock, opportunityScoreMock);

    return {
      source: "mock",
      products: opportunityProductsMock,
      keywords: opportunityKeywordsMock,
      market_score: opportunityMarketScoreMock,
      opportunity_score: opportunityScoreMock,
      today_opportunities: todayOpportunities,
      keyword_opportunities: keywordOpportunities,
      risk_alerts: riskAlerts,
    };
  }
}

export async function getApprovalsResponse(): Promise<ApprovalsApiResponse> {
  if (shouldUseMockData()) {
    const approvalQueue = approvalQueueMock;
    const approvalHistory = approvalHistoryMock;
    return {
      source: "mock",
      products: opportunityProductsMock,
      approval_queue: approvalQueue,
      approval_history: approvalHistory,
      approval_stats: buildApprovalStats(approvalQueue),
      action_queue: mockActionQueue,
      upload_queue: mockUploadQueue,
    };
  }

  try {
    const products = await readProducts();
    const actions = await readActions();
    const history = await readApprovalHistory();
    const approvalQueue = buildApprovalQueue(products, actions, history);
    return {
      source: "sqlite",
      products,
      approval_queue: approvalQueue,
      approval_history: history,
      approval_stats: buildApprovalStats(approvalQueue),
      action_queue: actions,
      upload_queue: await readUploads(),
    };
  } catch (error) {
    if (!shouldAllowMockFallback()) return emptyApprovalsResponse;
    const approvalQueue = approvalQueueMock;
    const approvalHistory = approvalHistoryMock;
    return {
      source: "mock",
      products: opportunityProductsMock,
      approval_queue: approvalQueue,
      approval_history: approvalHistory,
      approval_stats: buildApprovalStats(approvalQueue),
      action_queue: mockActionQueue,
      upload_queue: mockUploadQueue,
    };
  }
}

export async function getAnalysisResponse(): Promise<AnalysisApiResponse> {
  if (shouldUseMockData()) {
    return {
      source: "mock",
      opportunity_analysis: buildOpportunityAnalysis(
        opportunityProductsMock,
        opportunityScoreMock,
        analysisQueueMock,
      ),
      risk_analysis: buildRiskAnalysis(opportunityProductsMock, opportunityScoreMock),
      market_analysis: buildMarketAnalysis(
        opportunityKeywordsMock,
        opportunityMarketScoreMock,
        opportunityScoreMock,
      ),
      ai_recommendations: buildAiRecommendations(
        opportunityProductsMock,
        opportunityScoreMock,
        mockActionQueue,
        analysisQueueMock,
      ),
    };
  }

  try {
    const products = await readProducts();
    const keywords = await readKeywords();
    const marketScores = await readMarketScores();
    const opportunityScores = await readOpportunities();
    const analysisQueue = await readAnalysisQueue();
    const actions = await readActions();

    return {
      source: "sqlite",
      opportunity_analysis: buildOpportunityAnalysis(products, opportunityScores, analysisQueue),
      risk_analysis: buildRiskAnalysis(products, opportunityScores),
      market_analysis: buildMarketAnalysis(keywords, marketScores, opportunityScores),
      ai_recommendations: buildAiRecommendations(products, opportunityScores, actions, analysisQueue),
    };
  } catch (error) {
    if (!shouldAllowMockFallback()) return emptyAnalysisResponse;
    return {
      source: "mock",
      opportunity_analysis: buildOpportunityAnalysis(
        opportunityProductsMock,
        opportunityScoreMock,
        analysisQueueMock,
      ),
      risk_analysis: buildRiskAnalysis(opportunityProductsMock, opportunityScoreMock),
      market_analysis: buildMarketAnalysis(
        opportunityKeywordsMock,
        opportunityMarketScoreMock,
        opportunityScoreMock,
      ),
      ai_recommendations: buildAiRecommendations(
        opportunityProductsMock,
        opportunityScoreMock,
        mockActionQueue,
        analysisQueueMock,
      ),
    };
  }
}

export async function getProfitResponse(): Promise<ProfitApiResponse> {
  if (shouldUseMockData()) {
    return {
      source: "mock",
      snapshot: profitSnapshotMock,
      cost_structure: buildCostStructure(profitSnapshotMock),
      profit_risk: buildProfitRisk(productProfitMock),
      product_profit: productProfitMock,
    };
  }

  try {
    const snapshot = await readProfitSnapshot();
    const productProfit = await readProductProfit();

    return {
      source: "sqlite",
      snapshot,
      cost_structure: buildCostStructure(snapshot),
      profit_risk: buildProfitRisk(productProfit),
      product_profit: productProfit,
    };
  } catch (error) {
    if (!shouldAllowMockFallback()) return emptyProfitResponse;
    return {
      source: "mock",
      snapshot: profitSnapshotMock,
      cost_structure: buildCostStructure(profitSnapshotMock),
      profit_risk: buildProfitRisk(productProfitMock),
      product_profit: productProfitMock,
    };
  }
}

export async function getInventoryResponse(): Promise<InventoryApiResponse> {
  if (shouldUseMockData()) {
    return {
      source: "mock",
      snapshot: inventorySnapshotMock,
      inventory_stock: inventoryStockMock,
      inventory_risks: inventoryRiskMock,
      reorder_recommendations: reorderRecommendationMock,
    };
  }

  try {
    const snapshot = await readInventorySnapshot();
    const inventoryStock = await readInventoryStock();
    const inventoryRisks = await readInventoryRisks();
    const reorderRecommendations = await readReorderRecommendations();

    return {
      source: "sqlite",
      snapshot,
      inventory_stock: inventoryStock,
      inventory_risks: inventoryRisks,
      reorder_recommendations: reorderRecommendations,
    };
  } catch (error) {
    if (!shouldAllowMockFallback()) return emptyInventoryResponse;
    return {
      source: "mock",
      snapshot: inventorySnapshotMock,
      inventory_stock: inventoryStockMock,
      inventory_risks: inventoryRiskMock,
      reorder_recommendations: reorderRecommendationMock,
    };
  }
}

export async function getDashboardSummaryResponse(): Promise<DashboardSummaryApiResponse> {
  if (shouldUseMockData()) {
    return {
      source: "mock",
      products: opportunityProductsMock,
      action_queue: mockActionQueue,
      crawl_logs: mockCrawlLogs,
      data_quality_report: mockDataQualityReport,
      dashboard_summary: dashboardSummaryMock,
    };
  }

  try {
    const products = await readProducts();
    const actionQueue = await readActions();
    const approvalHistory = await readApprovalHistory();
    const crawlLogs = await readCrawlLogs();
    const qualityReports = await readDataQualityReports();
    const opportunityScores = await readOpportunities();
    const analysisQueue = await readAnalysisQueue();
    const profitSnapshot = await readProfitSnapshot();
    const productProfit = await readProductProfit();
    const inventorySnapshot = await readInventorySnapshot();
    const inventoryRisks = await readInventoryRisks();
    const decisionHistory = await readDecisionHistory();
    const executionQueue = await readActionExecutionQueue();
    const businessImpact = await getBusinessImpactResponse();
    const selfOptimization = await getSelfOptimizationResponse();

    const approvalQueue = buildApprovalQueue(products, actionQueue, approvalHistory);
    const todayOpportunities = buildTodayOpportunities(products, opportunityScores);
    const opportunityRisks = buildRiskAlerts(products, opportunityScores);
    const aiRecommendations = buildAiRecommendations(
      products,
      opportunityScores,
      actionQueue,
      analysisQueue,
    );

    return {
      source: "sqlite",
      products,
      action_queue: actionQueue,
      crawl_logs: crawlLogs,
      data_quality_report: qualityReports,
      dashboard_summary: buildDashboardSummary({
        source: "sqlite",
        products,
        profitSnapshot,
        productProfit,
        inventorySnapshot,
        approvalQueue,
        todayOpportunities,
        opportunityRisks,
        inventoryRisks,
        aiRecommendations,
        crawlLogs,
        dataQualityReports: qualityReports,
        decisionMetrics: calculateDecisionMetrics(decisionHistory),
        executionStats: buildExecutionStats(executionQueue),
        businessImpactSummary: businessImpact.summary,
        selfOptimizationSummary: selfOptimization.summary,
        selfOptimizationRecommendations: selfOptimization.recommendations,
      }),
    };
  } catch (error) {
    if (!shouldAllowMockFallback()) return emptyDashboardResponse;
    return {
      source: "mock",
      products: opportunityProductsMock,
      action_queue: mockActionQueue,
      crawl_logs: mockCrawlLogs,
      data_quality_report: mockDataQualityReport,
      dashboard_summary: dashboardSummaryMock,
    };
  }
}

export async function getTasksResponse(): Promise<TasksApiResponse> {
  if (shouldUseMockData()) {
    return tasksMock;
  }

  try {
    const products = await readProducts();
    const actions = await readActions();
    const approvalHistory = await readApprovalHistory();
    const opportunityScores = await readOpportunities();
    const analysisQueue = await readAnalysisQueue();
    const inventoryStock = await readInventoryStock();
    const inventoryRisks = await readInventoryRisks();
    const productProfit = await readProductProfit();

    const approvalQueue = buildApprovalQueue(products, actions, approvalHistory);
    const todayOpportunities = buildTodayOpportunities(products, opportunityScores);
    const opportunityRisks = buildRiskAlerts(products, opportunityScores);
    const riskAnalysis = buildRiskAnalysis(products, opportunityScores);
    const aiRecommendations = buildAiRecommendations(
      products,
      opportunityScores,
      actions,
      analysisQueue,
    );

    return buildTasksResponse({
      source: "sqlite",
      products,
      inventoryStock,
      inventoryRisks,
      productProfit,
      approvalQueue,
      todayOpportunities,
      opportunityRisks,
      riskAnalysis,
      aiRecommendations,
    });
  } catch (error) {
    if (!shouldAllowMockFallback()) return emptyTasksResponse;
    return tasksMock;
  }
}

export async function updateLocalActionStatus(
  actionId: string,
  status: ReviewStatus,
  notes?: string,
  reviewer = "local_operator",
): Promise<{ action: ActionQueueItem | null; history: ApprovalHistoryItem }> {
  if (shouldUseMockData()) {
    throw new Error("SQLite writes are disabled because test data mode is unavailable.");
  }

  return withDatabase((db) => {
    const reviewedAt = new Date().toISOString();

    db
      .prepare(
        `UPDATE action_queue
            SET approval_status = ?,
                status = ?,
                approved_by = ?,
                approved_at = ?
          WHERE action_id = ?
            AND tenant_id = ?`,
      )
      .run(status, status, reviewer, reviewedAt, actionId, tenantId());

    const history = buildApprovalHistoryItem({
      approvalId: actionId,
      action: status,
      reviewer,
      reviewedAt,
      notes,
    });

    db
      .prepare(
        `INSERT INTO approval_history (history_id, approval_id, action, reviewer, reviewed_at, notes, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        history.history_id,
        history.approval_id,
        history.action,
        history.reviewer,
        history.reviewed_at,
        history.notes,
        tenantId(),
      );

    const row = db
      .prepare(
        `SELECT action_id, created_at, platform, target_id, target_type, action_type,
                recommendation_text, confidence_score, risk_level, approval_status, status,
                approved_by, approved_at
           FROM action_queue
          WHERE action_id = ?
            AND tenant_id = ?`,
      )
      .get(actionId, tenantId()) as ActionRow | undefined;

    return {
      action: row ? mapAction(row) : null,
      history,
    };
  }, false);
}
