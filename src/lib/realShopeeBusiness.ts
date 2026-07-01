import { getLatestShopeeSnapshot } from "@/lib/connectors/shopeeSyncEngine";
import type {
  AiRecommendationItem,
  AnalysisApiResponse,
  AnalysisPriority,
  CrawlLog,
  DashboardMetric,
  DashboardRisk,
  DashboardSummary,
  DashboardSummaryApiResponse,
  DailyOpsApiResponse,
  DataQualityReport,
  InventoryApiResponse,
  InventoryRiskItem,
  InventorySnapshot,
  InventoryStockItem,
  Keyword,
  KeywordOpportunityItem,
  MarketScore,
  OpportunityAnalysisItem,
  OpportunityProductItem,
  OpportunitiesApiResponse,
  OpportunityRiskAlert,
  OpportunityScore,
  Platform,
  Product,
  ProductProfitItem,
  ProfitApiResponse,
  ProfitCostStructureItem,
  ProfitRiskSummary,
  ProfitSnapshot,
  ReorderRecommendationItem,
  RiskAnalysisItem,
  RiskLevel,
  ShopeeDataSource,
  StockStatus,
  TaskImpactType,
  TaskPriority,
  TaskSourceModule,
  TasksApiResponse,
  TaskType,
  TodayTaskItem,
} from "@/types";

const PLATFORM: Platform = "Shopee";
const MARKET_CODE = "br";
const CURRENCY = "BRL" as const;
const SHOP_ID_FALLBACK = "authorized_shop";
const REVIEW_STATUS_PENDING = "pending_review" as const;
const CACHE_TTL_MS = 60_000;

type RealOrder = {
  order_id: string;
  product_id: string;
  sku?: string;
  quantity: number;
  price: number;
  status: string;
  created_at: string;
};

type RealProduct = {
  product_id: string;
  title: string;
  price: number;
  stock: number;
  sales_count: number;
};

type RealInventoryItem = {
  product_id: string;
  available_stock: number;
  reserved_stock: number;
};

type ProductAgg = {
  productId: string;
  title: string;
  price: number;
  stock: number;
  reservedStock: number;
  orderQty: number;
  orderCount: number;
  revenue: number;
  latestOrderAt: string | null;
  hasProductRecord: boolean;
  hasInventoryRecord: boolean;
};

type RealShopeeBusinessBundle = {
  source: ShopeeDataSource;
  generatedAt: string;
  shopId: string;
  orders: RealOrder[];
  rawProducts: RealProduct[];
  rawInventory: RealInventoryItem[];
  aggregations: ProductAgg[];
  products: Product[];
  opportunities: OpportunitiesApiResponse;
  analysis: AnalysisApiResponse;
  tasks: TasksApiResponse;
  profit: ProfitApiResponse;
  inventory: InventoryApiResponse;
  dashboard: DashboardSummaryApiResponse;
  dailyOps: DailyOpsApiResponse;
};

let cachedBundle: { value: RealShopeeBusinessBundle | null; expiresAt: number } | null = null;

function nowIso() {
  return new Date().toISOString();
}

function todayDate() {
  return nowIso().slice(0, 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function uid(prefix: string, value: string) {
  return `${prefix}_${String(value || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function productUid(productId: string) {
  return `Shopee_${productId}`;
}

function sellerUid(shopId: string) {
  return `seller_Shopee_${shopId || SHOP_ID_FALLBACK}`;
}

function keywordUid(keyword: string) {
  let hash = 0;
  for (let i = 0; i < keyword.length; i += 1) {
    hash = (hash * 31 + keyword.charCodeAt(i)) >>> 0;
  }
  return `kw_br_${hash.toString(16)}`;
}

function normalizeOrder(value: unknown): RealOrder {
  const record = value as Partial<RealOrder>;
  return {
    order_id: String(record.order_id ?? ""),
    product_id: String(record.product_id ?? ""),
    sku: record.sku ? String(record.sku) : undefined,
    quantity: Number(record.quantity ?? 0) || 0,
    price: Number(record.price ?? 0) || 0,
    status: String(record.status ?? "unknown"),
    created_at: String(record.created_at ?? nowIso()),
  };
}

function normalizeProduct(value: unknown): RealProduct {
  const record = value as Partial<RealProduct>;
  return {
    product_id: String(record.product_id ?? ""),
    title: String(record.title ?? ""),
    price: Number(record.price ?? 0) || 0,
    stock: Number(record.stock ?? 0) || 0,
    sales_count: Number(record.sales_count ?? 0) || 0,
  };
}

function normalizeInventory(value: unknown): RealInventoryItem {
  const record = value as Partial<RealInventoryItem>;
  return {
    product_id: String(record.product_id ?? ""),
    available_stock: Number(record.available_stock ?? 0) || 0,
    reserved_stock: Number(record.reserved_stock ?? 0) || 0,
  };
}

function inferShopIdFromData(orders: RealOrder[], products: RealProduct[], inventory: RealInventoryItem[]) {
  const firstProduct = products.find((item) => item.product_id)?.product_id;
  const firstInventory = inventory.find((item) => item.product_id)?.product_id;
  const firstOrder = orders.find((item) => item.product_id)?.product_id;
  return firstProduct || firstInventory || firstOrder || SHOP_ID_FALLBACK;
}

function productTitle(agg: ProductAgg) {
  if (agg.title.trim()) return agg.title.trim();
  return `${PLATFORM} item ${agg.productId}`;
}

function buildAggregations(orders: RealOrder[], products: RealProduct[], inventory: RealInventoryItem[]) {
  const map = new Map<string, ProductAgg>();

  function ensure(productId: string) {
    const id = String(productId || "unknown");
    if (!map.has(id)) {
      map.set(id, {
        productId: id,
        title: "",
        price: 0,
        stock: 0,
        reservedStock: 0,
        orderQty: 0,
        orderCount: 0,
        revenue: 0,
        latestOrderAt: null,
        hasProductRecord: false,
        hasInventoryRecord: false,
      });
    }
    return map.get(id)!;
  }

  for (const product of products) {
    if (!product.product_id) continue;
    const agg = ensure(product.product_id);
    agg.title = product.title || agg.title;
    agg.price = product.price || agg.price;
    agg.stock = product.stock || agg.stock;
    agg.orderQty = Math.max(agg.orderQty, product.sales_count || 0);
    agg.hasProductRecord = true;
  }

  for (const stock of inventory) {
    if (!stock.product_id) continue;
    const agg = ensure(stock.product_id);
    agg.stock = stock.available_stock;
    agg.reservedStock = stock.reserved_stock;
    agg.hasInventoryRecord = true;
  }

  for (const order of orders) {
    if (!order.product_id) continue;
    const agg = ensure(order.product_id);
    const qty = Math.max(1, order.quantity || 1);
    agg.orderQty += qty;
    agg.orderCount += 1;
    agg.revenue += (order.price || agg.price || 0) * qty;
    agg.price = agg.price || order.price || 0;
    if (!agg.latestOrderAt || new Date(order.created_at).getTime() > new Date(agg.latestOrderAt).getTime()) {
      agg.latestOrderAt = order.created_at;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue || b.orderQty - a.orderQty);
}

function hasMeaningfulStockData(inventory: RealInventoryItem[], products: RealProduct[]) {
  return inventory.some((item) => item.available_stock > 0 || item.reserved_stock > 0) || products.some((item) => item.stock > 0);
}

function totalRevenue(aggs: ProductAgg[]) {
  return round(aggs.reduce((sum, item) => sum + item.revenue, 0));
}

function buildProducts(aggs: ProductAgg[], shopId: string): Product[] {
  return aggs.map((item) => ({
    product_uid: productUid(item.productId),
    seller_uid: sellerUid(shopId),
    keyword_uid: keywordUid(productTitle(item)),
    platform: PLATFORM,
    market_code: MARKET_CODE,
    platform_product_id: item.productId,
    platform_shop_id: shopId,
    title: productTitle(item),
    title_current: productTitle(item),
    price_amount: round(item.price),
    market_currency: CURRENCY,
    rating: 0,
    review_count: 0,
    sold_count_text: item.orderQty > 0 ? `${item.orderQty} 件真实订单销量` : "暂无订单销量",
    snapshot_date: todayDate(),
    availability_status: item.hasInventoryRecord ? "数据正常" : "库存详情待确认",
  }));
}

function opportunityLevel(score: number): "A" | "B" | "C" {
  if (score >= 82) return "A";
  if (score >= 68) return "B";
  return "C";
}

function opportunityScore(item: ProductAgg) {
  if (item.orderQty > 0 || item.revenue > 0) {
    return clamp(Math.round(52 + item.orderQty * 4 + item.orderCount * 2 + item.revenue / 100), 45, 96);
  }

  return clamp(Math.round(56 + (item.hasProductRecord ? 10 : 0) + (item.hasInventoryRecord ? 8 : 0) + (item.price > 0 ? 6 : 0)), 52, 76);
}

function marketScore(item: ProductAgg) {
  if (item.orderQty > 0 || item.revenue > 0) {
    return clamp(Math.round(50 + item.orderQty * 3 + item.revenue / 160), 45, 92);
  }

  return clamp(Math.round(54 + (item.hasProductRecord ? 9 : 0) + (item.hasInventoryRecord ? 7 : 0)), 50, 74);
}

function riskLevelFromOpportunity(score: number): RiskLevel {
  if (score >= 82) return "low";
  if (score >= 65) return "medium";
  return "high";
}

function buildOpportunities(aggs: ProductAgg[], products: Product[], inventoryRisks: InventoryRiskItem[]): OpportunitiesApiResponse {
  const opportunityProducts = aggs
    .filter((item) => item.orderQty > 0 || item.revenue > 0 || item.hasProductRecord || item.hasInventoryRecord)
    .slice(0, 24)
    .map<OpportunityProductItem>((item) => {
      const score = opportunityScore(item);
      return {
        product_uid: productUid(item.productId),
        platform: PLATFORM,
        title_current: productTitle(item),
        price_amount: round(item.price),
        rating: 0,
        sold_count_text: item.orderQty > 0 ? `${item.orderQty} 件真实订单销量` : "已读取真实商品，等待订单匹配",
        market_score: marketScore(item),
        opportunity_score: score,
        recommendation_level: opportunityLevel(score),
        decision_notes:
          item.orderQty > 0 || item.revenue > 0
            ? "基于已授权店铺真实订单生成，建议先核对库存、成本和广告承接。"
            : "已读取真实商品数据，建议先补齐价格、库存和广告数据后再判断是否放量。",
        risk_level: riskLevelFromOpportunity(score),
        risk_score: clamp(100 - score, 5, 70),
      };
    });

  const keywords: Keyword[] = [
    {
      keyword_uid: keywordUid("Shopee 真实店铺商品"),
      platform: PLATFORM,
      market_code: MARKET_CODE,
      keyword: "Shopee 真实店铺商品",
      normalized_keyword: "shopee_real_store_products",
      category_hint: "真实店铺商品",
      search_volume_index: opportunityProducts.length,
      trend_direction: opportunityProducts.length > 0 ? "up" : "flat",
    },
  ];

  const market_score: MarketScore[] = keywords.map((keyword, index) => ({
    market_score_id: uid("market_score", `${keyword.keyword_uid}_${index}`),
    keyword_uid: keyword.keyword_uid,
    platform: PLATFORM,
    market_code: MARKET_CODE,
    keyword: keyword.keyword || keyword.normalized_keyword,
    market_demand_score: clamp(60 + opportunityProducts.length * 2, 40, 90),
    competition_score: 50,
    trend_score: opportunityProducts.length > 0 ? 72 : 50,
    total_score: opportunityProducts.length > 0 ? 72 : 50,
  }));

  const opportunity_score: OpportunityScore[] = opportunityProducts.map((item) => ({
    opportunity_id: uid("opp", item.product_uid),
    product_uid: item.product_uid,
    keyword_uid: keywords[0].keyword_uid,
    category_hint: "真实店铺商品",
    market_demand_score: item.market_score,
    competition_score: 50,
    market_score: item.market_score,
    opportunity_score: item.opportunity_score,
    recommendation_level: item.recommendation_level,
    suggestion_level: item.recommendation_level,
    decision_notes: item.decision_notes,
    risk_level: item.risk_level,
    risk_score: item.risk_score,
    reason: "来自已授权店铺商品、订单和库存数据。",
  }));

  const keyword_opportunities: KeywordOpportunityItem[] = market_score.map((score) => ({
    keyword_uid: score.keyword_uid,
    keyword: score.keyword,
    category_hint: "真实店铺商品",
    market_demand_score: score.market_demand_score,
    competition_score: score.competition_score,
    trend_score: score.trend_score,
    total_score: score.total_score,
    platform: PLATFORM,
  }));

  const risk_alerts: OpportunityRiskAlert[] = inventoryRisks.slice(0, 10).map((risk) => ({
    risk_id: risk.risk_id,
    risk_type: risk.risk_type,
    risk_level: risk.risk_level,
    affected_product: products.find((product) => product.product_uid === risk.product_uid)?.title_current || risk.product_uid,
    platform: PLATFORM,
    product_uid: risk.product_uid,
    reason: risk.risk_reason,
    suggested_action: risk.suggested_action,
  }));

  return {
    source: "shopee_api",
    products,
    keywords,
    market_score,
    opportunity_score,
    today_opportunities: opportunityProducts,
    keyword_opportunities,
    risk_alerts,
  };
}

function stockStatus(item: ProductAgg, meaningfulStock: boolean): StockStatus {
  if (!item.hasInventoryRecord && !item.hasProductRecord) return "healthy";
  if (!meaningfulStock) {
    if (item.stock <= 0 && item.orderQty > 0) return "stockout_risk";
    if (item.stock <= 0) return "reorder_soon";
    return "healthy";
  }
  if (!item.hasInventoryRecord) return "reorder_soon";
  if (item.stock <= 0 && item.orderQty > 0) return "stockout_risk";
  const dailySales = Math.max(0.1, item.orderQty / 14);
  const days = item.stock / dailySales;
  if (days < 5) return "stockout_risk";
  if (days < 12) return "reorder_soon";
  if (days > 90 && item.orderQty <= 1) return "slow_moving";
  if (days > 120) return "overstock_risk";
  return "healthy";
}

function statusRiskLevel(status: StockStatus): RiskLevel {
  if (status === "stockout_risk") return "high";
  if (status === "reorder_soon" || status === "overstock_risk" || status === "slow_moving") return "medium";
  return "low";
}

function statusReason(status: StockStatus, item: ProductAgg, meaningfulStock: boolean) {
  if (!meaningfulStock || !item.hasInventoryRecord) return "已读取真实商品，但库存字段仍需复核；当前先按库存待确认处理。";
  if (status === "stockout_risk") return "近期有真实订单，但可用库存偏低，需要人工确认是否断货。";
  if (status === "reorder_soon") return "按近 14 天订单估算，可售天数偏低。";
  if (status === "slow_moving") return "库存可售天数偏高，且近期订单较少。";
  if (status === "overstock_risk") return "库存量高于当前销售速度。";
  return "库存与订单暂未显示明显异常。";
}

function statusAction(status: StockStatus, meaningfulStock: boolean) {
  if (!meaningfulStock) return "先核对 Seller Center 库存字段，再决定是否补货或暂停投放。";
  if (status === "stockout_risk") return "人工核对仓库库存，必要时创建补货审批。";
  if (status === "reorder_soon") return "准备补货计划，但不要自动下单。";
  if (status === "slow_moving" || status === "overstock_risk") return "检查价格、广告和活动承接，避免继续压货。";
  return "继续观察。";
}

function buildInventory(aggs: ProductAgg[], meaningfulStock: boolean): InventoryApiResponse {
  const inventory_stock: InventoryStockItem[] = aggs.map((item) => {
    const dailySales = round(item.orderQty / 14, 2);
    const status = stockStatus(item, meaningfulStock);
    const daysOfStock = meaningfulStock && dailySales > 0 ? round(item.stock / dailySales, 1) : 0;
    const reorderPoint = Math.ceil(Math.max(1, dailySales * 7));
    return {
      inventory_item_id: uid("inventory", item.productId),
      product_uid: productUid(item.productId),
      product_name: productTitle(item),
      platform: PLATFORM,
      stock_qty: item.stock,
      daily_sales_avg: dailySales,
      days_of_stock: daysOfStock,
      reorder_point: reorderPoint,
      suggested_reorder_qty: status === "stockout_risk" || status === "reorder_soon" ? Math.ceil(Math.max(0, dailySales * 21 - item.stock)) : 0,
      stock_status: status,
    };
  });

  const inventory_risks: InventoryRiskItem[] = inventory_stock
    .filter((item) => item.stock_status !== "healthy")
    .map((item) => ({
      risk_id: uid("inventory_risk", item.product_uid),
      product_uid: item.product_uid,
      platform: PLATFORM,
      risk_type: item.stock_status === "stockout_risk" ? "缺货风险" : "库存待确认",
      risk_level: statusRiskLevel(item.stock_status),
      risk_reason: statusReason(item.stock_status, aggs.find((agg) => productUid(agg.productId) === item.product_uid)!, meaningfulStock),
      suggested_action: statusAction(item.stock_status, meaningfulStock),
    }));

  const reorder_recommendations: ReorderRecommendationItem[] = inventory_stock
    .filter((item) => item.stock_status === "stockout_risk" || item.stock_status === "reorder_soon")
    .map((item) => ({
      recommendation_id: uid("reorder", item.product_uid),
      product_uid: item.product_uid,
      product_name: item.product_name,
      platform: PLATFORM,
      current_stock: item.stock_qty,
      daily_sales_avg: item.daily_sales_avg,
      lead_time_days: 14,
      recommended_reorder_qty: item.suggested_reorder_qty,
      reorder_priority: item.stock_status === "stockout_risk" ? "P1" : "P2",
      decision_notes: "仅生成补货建议，不会自动采购或修改平台库存。",
    }));

  const stockout = inventory_stock.filter((item) => item.stock_status === "stockout_risk").length;
  const reorderSoon = inventory_stock.filter((item) => item.stock_status === "reorder_soon").length;
  const overstock = inventory_stock.filter((item) => item.stock_status === "overstock_risk").length;
  const slowMoving = inventory_stock.filter((item) => item.stock_status === "slow_moving").length;
  const riskPenalty = stockout * 14 + reorderSoon * 4 + overstock * 8 + slowMoving * 6;
  const stockHealth = inventory_stock.length > 0 ? clamp(100 - riskPenalty, 0, 100) : 70;
  const totalInventoryValue = round(inventory_stock.reduce((sum, item) => {
    const agg = aggs.find((entry) => productUid(entry.productId) === item.product_uid);
    return sum + item.stock_qty * (agg?.price || 0);
  }, 0));
  const inventoryTurnover = meaningfulStock
    ? round(inventory_stock.reduce((sum, item) => sum + item.days_of_stock, 0) / Math.max(1, inventory_stock.length), 1)
    : 0;

  const snapshot: InventorySnapshot = {
    inventory_snapshot_id: uid("inventory_snapshot", todayDate()),
    reporting_date: todayDate(),
    market_code: MARKET_CODE,
    total_inventory_value: totalInventoryValue,
    inventory_turnover_days: inventoryTurnover,
    stock_health_score: stockHealth,
    stockout_risk_count: stockout,
    overstock_risk_count: overstock,
    slow_moving_sku_count: slowMoving,
  };

  return {
    source: "shopee_api",
    snapshot,
    inventory_stock,
    inventory_risks,
    reorder_recommendations,
  };
}

function buildProfit(aggs: ProductAgg[], inventory: InventoryApiResponse): ProfitApiResponse {
  const gmv = totalRevenue(aggs);
  const product_profit: ProductProfitItem[] = aggs
    .filter((item) => item.revenue > 0 || item.orderQty > 0 || item.hasProductRecord)
    .slice(0, 100)
    .map((item) => ({
      profit_item_id: uid("profit", item.productId),
      product_uid: productUid(item.productId),
      platform: PLATFORM,
      product_name: productTitle(item),
      revenue: round(item.revenue),
      cost: 0,
      gross_profit: 0,
      net_profit: 0,
      net_margin: 0,
      inventory_days: inventory.inventory_stock.find((stock) => stock.product_uid === productUid(item.productId))?.days_of_stock || 0,
      risk_level: item.revenue > 0 ? "medium" : "medium",
    }));

  const profit_risk: ProfitRiskSummary = {
    loss_products: 0,
    low_profit_products: product_profit.filter((item) => item.revenue > 0 && item.net_margin < 10).length,
    high_risk_products: product_profit.filter((item) => item.risk_level === "high").length,
  };

  const snapshot: ProfitSnapshot = {
    profit_snapshot_id: uid("profit_snapshot", todayDate()),
    reporting_date: todayDate(),
    market_code: MARKET_CODE,
    yesterday_net_profit: 0,
    month_net_profit: 0,
    net_margin: 0,
    cash_flow: gmv,
    inventory_turnover_days: inventory.snapshot.inventory_turnover_days,
    procurement_cost: 0,
    advertising_cost: 0,
    logistics_cost: 0,
    platform_commission: 0,
    tax_cost: 0,
  };

  const cost_structure: ProfitCostStructureItem[] = [
    { cost_key: "procurement_cost", label: "采购成本", value: 0, share: 0 },
    { cost_key: "advertising_cost", label: "广告成本", value: 0, share: 0 },
    { cost_key: "logistics_cost", label: "物流成本", value: 0, share: 0 },
    { cost_key: "platform_commission", label: "平台佣金", value: 0, share: 0 },
    { cost_key: "tax_cost", label: "税费", value: 0, share: 0 },
  ];

  return {
    source: "shopee_api",
    snapshot,
    cost_structure,
    profit_risk,
    product_profit,
  };
}

function buildAnalysis(opportunities: OpportunitiesApiResponse, inventory: InventoryApiResponse): AnalysisApiResponse {
  const opportunity_analysis: OpportunityAnalysisItem[] = opportunities.today_opportunities.slice(0, 10).map((item) => ({
    analysis_id: uid("analysis", item.product_uid),
    product_uid: item.product_uid,
    platform: PLATFORM,
    opportunity_score: item.opportunity_score,
    risk_level: item.risk_level,
    analysis_summary: "该商品已出现在真实订单中，具备继续观察或优化的价值。",
    analysis_reason: "基于已授权店铺订单量、订单金额和商品信息生成。",
    recommendation: "优先核对库存、成本和广告承接，再决定是否加大运营动作。",
  }));

  const risk_analysis: RiskAnalysisItem[] = inventory.inventory_risks.slice(0, 10).map((risk) => ({
    risk_id: risk.risk_id,
    risk_type: risk.risk_type,
    risk_level: risk.risk_level,
    product_uid: risk.product_uid,
    platform: PLATFORM,
    risk_reason: risk.risk_reason,
    mitigation_action: risk.suggested_action,
  }));

  const market_analysis = opportunities.market_score.map((score) => ({
    market_score_id: score.market_score_id,
    platform: PLATFORM,
    category: score.keyword,
    demand_score: score.market_demand_score,
    competition_score: score.competition_score,
    trend_direction: "up" as const,
  }));

  const ai_recommendations: AiRecommendationItem[] = opportunity_analysis.slice(0, 5).map((item, index) => ({
    recommendation_id: uid("ai_rec", `${item.product_uid}_${index}`),
    recommendation_type: "运营建议",
    priority: item.opportunity_score >= 82 ? "P1" : "P2",
    platform: PLATFORM,
    product_uid: item.product_uid,
    action_suggestion: item.recommendation,
    expected_impact: "提升人工排查效率，避免没有库存或没有成本数据时盲目放量。",
  }));

  return {
    source: "shopee_api",
    opportunity_analysis,
    risk_analysis,
    market_analysis,
    ai_recommendations,
  };
}

function taskPriority(level: RiskLevel, score = 0): TaskPriority {
  if (level === "high" || score >= 82) return "high";
  if (level === "medium" || score >= 68) return "medium";
  return "low";
}

function analysisPriority(priority: TaskPriority): AnalysisPriority {
  if (priority === "high") return "P1";
  if (priority === "medium") return "P2";
  return "P3";
}

function taskRankValue(task: TodayTaskItem) {
  const riskScore = task.risk_level === "high" ? 300 : task.risk_level === "medium" ? 150 : 50;
  const priorityScore = task.priority === "high" ? 500 : task.priority === "medium" ? 250 : 100;
  return priorityScore + riskScore + task.estimated_profit_impact + task.estimated_gmv_impact / 3 + task.estimated_inventory_impact * 20;
}

function buildTasks(
  aggs: ProductAgg[],
  opportunities: OpportunitiesApiResponse,
  inventory: InventoryApiResponse,
  profit: ProfitApiResponse,
): TasksApiResponse {
  const tasks: TodayTaskItem[] = [];

  for (const risk of inventory.inventory_risks.slice(0, 5)) {
    const stock = inventory.inventory_stock.find((item) => item.product_uid === risk.product_uid);
    const priority = taskPriority(risk.risk_level);
    tasks.push({
      task_id: uid("task_inventory", risk.product_uid),
      task_title: `${risk.risk_type}: ${stock?.product_name || risk.product_uid}`,
      task_type: "inventory_alert",
      source_module: "inventory",
      impact_type: "inventory",
      title: `${risk.risk_type}: ${stock?.product_name || risk.product_uid}`,
      summary: risk.risk_reason,
      product_uid: risk.product_uid,
      platform: PLATFORM,
      estimated_profit_impact: 0,
      estimated_gmv_impact: 0,
      estimated_inventory_impact: stock?.stock_qty || 0,
      priority,
      risk_level: risk.risk_level,
      expected_impact: "减少断货或压货导致的运营损失。",
      suggested_action: risk.suggested_action,
      created_at: nowIso(),
      href: "/inventory",
    });
  }

  for (const item of opportunities.today_opportunities.slice(0, 5)) {
    const priority = taskPriority(item.risk_level, item.opportunity_score);
    const agg = aggs.find((entry) => productUid(entry.productId) === item.product_uid);
    tasks.push({
      task_id: uid("task_opportunity", item.product_uid),
      task_title: `跟进真实成交商品: ${item.title_current}`,
      task_type: "opportunity_follow_up",
      source_module: "opportunity",
      impact_type: "gmv",
      title: `跟进真实成交商品: ${item.title_current}`,
      summary: item.decision_notes,
      product_uid: item.product_uid,
      platform: PLATFORM,
      estimated_profit_impact: 0,
      estimated_gmv_impact: round(agg?.revenue || 0),
      estimated_inventory_impact: 0,
      priority,
      risk_level: item.risk_level,
      expected_impact: "优先处理已经产生真实订单的商品。",
      suggested_action: "核对商品链接、库存、成本和广告承接，不自动执行平台操作。",
      created_at: nowIso(),
      href: "/opportunities",
    });
  }

  if (profit.product_profit.length > 0) {
    tasks.push({
      task_id: "task_profit_cost_confirmation",
      task_title: "补齐已成交商品的成本和广告数据",
      task_type: "profit_alert",
      source_module: "profit",
      impact_type: "profit",
      title: "补齐已成交商品的成本和广告数据",
      summary: "系统已经读取到真实订单，但采购、物流、佣金、广告成本仍未接入，利润暂不能作为最终判断。",
      platform: PLATFORM,
      estimated_profit_impact: 0,
      estimated_gmv_impact: profit.snapshot.cash_flow,
      estimated_inventory_impact: 0,
      priority: "high",
      risk_level: "medium",
      expected_impact: "补齐成本后才能判断哪些商品真正赚钱。",
      suggested_action: "先导入或接入成本、广告和佣金数据，再生成利润动作。",
      created_at: nowIso(),
      href: "/profit",
    });
  }

  const allTasks = tasks.sort((a, b) => taskRankValue(b) - taskRankValue(a));
  const top_tasks = allTasks.slice(0, 5).map((task, index) => ({ ...task, rank: index + 1 }));
  const high = allTasks.filter((task) => task.priority === "high");
  const medium = allTasks.filter((task) => task.priority === "medium");
  const low = allTasks.filter((task) => task.priority === "low");

  return {
    source: "shopee_api",
    overview: {
      total_tasks: allTasks.length,
      high_priority_tasks: high.length,
      medium_priority_tasks: medium.length,
      low_priority_tasks: low.length,
      estimated_profit_impact: round(allTasks.reduce((sum, task) => sum + task.estimated_profit_impact, 0)),
      estimated_gmv_impact: round(allTasks.reduce((sum, task) => sum + task.estimated_gmv_impact, 0)),
      estimated_inventory_impact: round(allTasks.reduce((sum, task) => sum + task.estimated_inventory_impact, 0)),
    },
    top_tasks,
    high_priority_tasks: high,
    medium_priority_tasks: medium,
    low_priority_tasks: low,
    all_tasks: allTasks,
    ai_recommendations: allTasks.slice(0, 5).map((task) => ({
      recommendation_id: uid("task_ai", task.task_id),
      recommendation_type: task.task_type,
      recommendation_summary: task.title,
      recommendation_reason: task.summary,
      expected_benefit: task.expected_impact,
      approval_required: true,
      priority: analysisPriority(task.priority),
      href: task.href,
    })),
    source_stats: {
      inventory_tasks: allTasks.filter((task) => task.source_module === "inventory").length,
      profit_tasks: allTasks.filter((task) => task.source_module === "profit").length,
      approval_tasks: 0,
      analysis_tasks: allTasks.filter((task) => task.source_module === "analysis").length,
      opportunity_tasks: allTasks.filter((task) => task.source_module === "opportunity").length,
    },
    impact_stats: {
      total_profit_impact: round(allTasks.reduce((sum, task) => sum + task.estimated_profit_impact, 0)),
      total_gmv_impact: round(allTasks.reduce((sum, task) => sum + task.estimated_gmv_impact, 0)),
      total_inventory_impact: round(allTasks.reduce((sum, task) => sum + task.estimated_inventory_impact, 0)),
    },
  };
}

function metric(metric_id: string, label: string, value: number, unit: DashboardMetric["unit"], note: string, tone: DashboardMetric["tone"]): DashboardMetric {
  return { metric_id, label, value, unit, note, tone };
}

function buildDashboard(
  aggs: ProductAgg[],
  products: Product[],
  opportunities: OpportunitiesApiResponse,
  inventory: InventoryApiResponse,
  profit: ProfitApiResponse,
  tasks: TasksApiResponse,
  analysis: AnalysisApiResponse,
): DashboardSummaryApiResponse {
  const gmv = totalRevenue(aggs);
  const inventoryRiskTotal = inventory.inventory_risks.length;
  const highRisk = inventory.inventory_risks.filter((risk) => risk.risk_level === "high").length;
  const lowProfit = profit.profit_risk.low_profit_products;
  const generatedAt = nowIso();

  const profitRiskSummary = profit.profit_risk;
  const dashboard_summary: DashboardSummary = {
    reporting_date: todayDate(),
    market_code: MARKET_CODE,
    core_metrics: {
      yesterday_net_profit: 0,
      month_net_profit: 0,
      net_margin: 0,
      cash_flow: gmv,
      inventory_turnover_days: inventory.snapshot.inventory_turnover_days,
      pending_approval_count: 0,
    },
    operating_status: {
      today_opportunity_count: opportunities.today_opportunities.length,
      high_priority_recommendation_count: tasks.overview.high_priority_tasks,
      stockout_risk_count: inventoryRiskTotal,
      low_profit_product_count: lowProfit,
      high_risk_alert_count: highRisk,
    },
    profit_and_cash: {
      yesterday_net_profit: 0,
      month_net_profit: 0,
      net_margin: 0,
      cash_flow: gmv,
      profit_risk_summary: profitRiskSummary,
    },
    inventory_risk: {
      inventory_turnover_days: inventory.snapshot.inventory_turnover_days,
      stock_health_score: inventory.snapshot.stock_health_score,
      stockout_risk_count: inventoryRiskTotal,
      overstock_risk_count: inventory.snapshot.overstock_risk_count,
      slow_moving_sku_count: inventory.snapshot.slow_moving_sku_count,
    },
    decision_feedback: {
      decision_accuracy_score: 0,
      recommendation_hit_rate: 0,
      recommendation_success_rate: 0,
      blocked_correct_rate: 0,
      roi_deviation_rate: 0,
    },
    execution_guard: {
      pending_count: 0,
      approved_count: 0,
      rejected_count: 0,
      simulated_profit_total: 0,
    },
    business_impact: {
      total_profit_impact: 0,
      decision_success_rate: 0,
      roi_prediction_error: 0,
      best_strategy: "真实订单已接入，下一步需要补齐成本、广告和库存详情。",
      worst_strategy: "不要在缺少成本和库存详情时自动放量。",
    },
    self_optimization: {
      rule_hit_rate: 0,
      rule_bias_rate: 0,
      recommendation_count: analysis.ai_recommendations.length,
      top_recommendations: [],
      learning_trend: [],
    },
    ai_pending_approval: {
      pending_count: 0,
      high_priority_count: 0,
      deferred_count: 0,
      latest_recommendations: [],
    },
    opportunity_and_risk: {
      top_opportunities: opportunities.today_opportunities.slice(0, 5).map((item) => ({
        product_uid: item.product_uid,
        platform: PLATFORM,
        title_current: item.title_current,
        price_amount: item.price_amount,
        opportunity_score: item.opportunity_score,
        market_score: item.market_score,
        recommendation_level: item.recommendation_level,
        decision_notes: item.decision_notes,
      })),
      top_risks: inventory.inventory_risks.slice(0, 5).map((risk) => ({
        risk_id: risk.risk_id,
        source: "inventory",
        risk_type: risk.risk_type,
        risk_level: risk.risk_level,
        product_uid: risk.product_uid,
        product_name: products.find((product) => product.product_uid === risk.product_uid)?.title_current || risk.product_uid,
        platform: PLATFORM,
        summary: risk.risk_reason,
        suggested_action: risk.suggested_action,
      })),
      recommended_actions: analysis.ai_recommendations.slice(0, 5).map((item) => ({
        action_id: uid("dashboard_action", item.recommendation_id),
        recommendation_type: item.recommendation_type,
        priority: item.priority,
        platform: PLATFORM,
        product_uid: item.product_uid,
        product_name: products.find((product) => product.product_uid === item.product_uid)?.title_current || item.product_uid,
        action_suggestion: item.action_suggestion,
        expected_impact: item.expected_impact,
      })),
    },
    system_status: {
      data_source: "shopee_api",
      last_updated_at: generatedAt,
      api_status: "healthy",
      database_status: "connected",
    },
  };

  const crawl_logs: CrawlLog[] = [
    {
      crawl_run_id: uid("shopee_sync", generatedAt),
      platform: PLATFORM,
      market_code: MARKET_CODE,
      started_at: generatedAt,
      finished_at: generatedAt,
      status: "success",
      records_seen: aggs.length,
      records_inserted: aggs.length,
      message: "已读取授权店铺订单、商品和库存只读数据。",
    },
  ];

  const data_quality_report: DataQualityReport[] = [
    {
      report_id: uid("quality", "shopee_real_data"),
      report_date: todayDate(),
      source_table: "shopee_readonly",
      check_name: "真实店铺数据接入",
      severity: aggs.length > 0 ? "low" : "medium",
      quality_status: aggs.length > 0 ? "pass" : "warning",
      details: aggs.length > 0 ? "已读取真实店铺数据。" : "尚未读取到真实店铺数据。",
    },
  ];

  return {
    source: "shopee_api",
    products,
    action_queue: [],
    crawl_logs,
    data_quality_report,
    dashboard_summary,
    dashboard_snapshot: {
      reporting_date: todayDate(),
      market_code: MARKET_CODE,
      bossMetrics: [
        metric("gmv", "今日销售", gmv, "currency", "来自真实订单金额", "good"),
        metric("profit", "今日利润", 0, "currency", "成本和广告未接入，暂不估算净利润", "warn"),
        metric("inventory", "库存健康度", inventory.snapshot.stock_health_score, "count", "来自库存只读数据", "neutral"),
        metric("tasks", "待处理事项", tasks.overview.total_tasks, "count", "来自真实数据生成的运营事项", "warn"),
      ],
      riskCenter: inventory.inventory_risks.slice(0, 5).map<DashboardRisk>((risk) => ({
        risk_id: risk.risk_id,
        title: risk.risk_type,
        level: risk.risk_level,
        signal: risk.product_uid,
        note: risk.risk_reason,
      })),
      operationSafety: [metric("orders", "订单数量", aggs.reduce((sum, item) => sum + item.orderCount, 0), "count", "来自授权店铺订单", "good")],
      trafficFunnel: [],
      adsCenter: [metric("ads", "广告数据", 0, "count", "广告权限尚未接入", "warn")],
      inventoryCenter: [metric("stock_health", "库存健康度", inventory.snapshot.stock_health_score, "count", "来自库存只读数据", "neutral")],
      watchlist: opportunities.today_opportunities.slice(0, 5).map((item) => ({
        watch_id: uid("watch", item.product_uid),
        product_uid: item.product_uid,
        focus_metric: "真实订单",
        focus_value: item.sold_count_text,
        risk_level: item.risk_level,
        next_action: item.decision_notes,
      })),
    },
  };
}

function buildDailyOps(tasks: TasksApiResponse, inventory: InventoryApiResponse, opportunities: OpportunitiesApiResponse, profit: ProfitApiResponse): DailyOpsApiResponse {
  const inventoryRiskTotal = inventory.inventory_risks.length;
  const topRisks = inventory.inventory_risks.slice(0, 5).map((risk) => ({
    risk_id: risk.risk_id,
    risk_type: risk.risk_type,
    risk_level: risk.risk_level,
    title: risk.risk_type,
    source: "库存中心",
    suggested_action: risk.suggested_action,
    href: "/inventory",
  }));

  return {
    source: "shopee_api",
    generated_at: nowIso(),
    core_goals: tasks.top_tasks.slice(0, 3).map((task) => ({
      goal_id: uid("daily_goal", task.task_id),
      rank: task.rank,
      title: task.title,
      source: "tasks",
      profit_impact: task.estimated_profit_impact,
      risk_level: task.risk_level,
      priority: task.priority,
      reason: task.summary,
      href: task.href,
    })),
    risk_overview: {
      stockout_risk_count: inventoryRiskTotal,
      profit_decline_risk_count: profit.profit_risk.low_profit_products,
      high_risk_product_count: inventory.inventory_risks.filter((risk) => risk.risk_level === "high").length,
      approval_backlog_count: 0,
      top_risks: topRisks,
    },
    opportunities: opportunities.today_opportunities.slice(0, 5).map((item) => ({
      opportunity_id: uid("daily_opp", item.product_uid),
      opportunity_type: "test_product",
      title: item.title_current,
      source: "decision_engine",
      expected_roi: 0,
      expected_profit: 0,
      priority: item.recommendation_level,
      recommendation: item.decision_notes,
      href: "/opportunities",
    })),
    execution_queue: {
      pending_approval_count: 0,
      approved_unexecuted_count: 0,
      rejected_count: 0,
      total_queue_count: 0,
      queue_items: [],
    },
    metrics: {
      expected_gmv: profit.snapshot.cash_flow,
      expected_profit: 0,
      stock_health_score: inventory.snapshot.stock_health_score,
      decision_success_rate: 0,
    },
    guardrails: [
      "所有建议只展示，不自动改价、不自动上架、不自动发货。",
      "利润判断需要补齐采购、物流、佣金和广告成本。",
      "广告、联盟和活动建议需要对应 Shopee 权限后再生成。",
    ],
  };
}

async function createBundle(): Promise<RealShopeeBusinessBundle | null> {
  const snapshot = await getLatestShopeeSnapshot({ maxAgeMs: CACHE_TTL_MS });
  const ordersResponse = snapshot.orders;
  const productsResponse = snapshot.products;
  const inventoryResponse = snapshot.inventory;

  const hasRealData = [ordersResponse, productsResponse, inventoryResponse].some(
    (response) => response.source === "shopee_api" && response.data.length > 0,
  );
  if (!hasRealData) return null;

  const orders = ordersResponse.data.map(normalizeOrder).filter((item) => item.order_id || item.product_id);
  const rawProducts = productsResponse.data.map(normalizeProduct).filter((item) => item.product_id);
  const rawInventory = inventoryResponse.data.map(normalizeInventory).filter((item) => item.product_id);
  const shopId = inferShopIdFromData(orders, rawProducts, rawInventory);
  const aggregations = buildAggregations(orders, rawProducts, rawInventory);
  if (aggregations.length === 0) return null;

  const products = buildProducts(aggregations, shopId);
  const inventory = buildInventory(aggregations, hasMeaningfulStockData(rawInventory, rawProducts));
  const profit = buildProfit(aggregations, inventory);
  const opportunities = buildOpportunities(aggregations, products, inventory.inventory_risks);
  const analysis = buildAnalysis(opportunities, inventory);
  const tasks = buildTasks(aggregations, opportunities, inventory, profit);
  const dashboard = buildDashboard(aggregations, products, opportunities, inventory, profit, tasks, analysis);
  const dailyOps = buildDailyOps(tasks, inventory, opportunities, profit);

  return {
    source: snapshot.source,
    generatedAt: snapshot.created_at,
    shopId,
    orders,
    rawProducts,
    rawInventory,
    aggregations,
    products,
    opportunities,
    analysis,
    tasks,
    profit,
    inventory,
    dashboard,
    dailyOps,
  };
}

export async function getRealShopeeBusinessBundle() {
  const now = Date.now();
  if (cachedBundle && cachedBundle.expiresAt > now) return cachedBundle.value;
  const value = await createBundle();
  cachedBundle = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
}

export function clearRealShopeeBusinessCache() {
  cachedBundle = null;
}

export async function getRealShopeeProductsResponse() {
  const bundle = await getRealShopeeBusinessBundle();
  if (!bundle) return null;
  return {
    source: bundle.source,
    products: bundle.products,
  };
}

export async function getRealShopeeDashboardResponse() {
  return (await getRealShopeeBusinessBundle())?.dashboard ?? null;
}

export async function getRealShopeeProfitResponse() {
  return (await getRealShopeeBusinessBundle())?.profit ?? null;
}

export async function getRealShopeeInventoryResponse() {
  return (await getRealShopeeBusinessBundle())?.inventory ?? null;
}

export async function getRealShopeeOpportunitiesResponse() {
  return (await getRealShopeeBusinessBundle())?.opportunities ?? null;
}

export async function getRealShopeeAnalysisResponse() {
  return (await getRealShopeeBusinessBundle())?.analysis ?? null;
}

export async function getRealShopeeTasksResponse() {
  return (await getRealShopeeBusinessBundle())?.tasks ?? null;
}

export async function getRealShopeeDailyOpsResponse() {
  return (await getRealShopeeBusinessBundle())?.dailyOps ?? null;
}
