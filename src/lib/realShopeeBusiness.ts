import { Buffer } from "node:buffer";

import {
  getInventory as getShopeeInventoryRealtime,
  getOrders as getShopeeOrdersRealtime,
  getProducts as getShopeeProductsRealtime,
} from "@/lib/connectors/shopee";
import { getLatestShopeeSnapshot } from "@/lib/connectors/shopeeSyncEngine";
import type {
  AiRecommendationItem,
  AnalysisApiResponse,
  AnalysisPriority,
  ApiDataSource,
  CrawlLog,
  DailyOpsApiResponse,
  DashboardMetric,
  DashboardRisk,
  DashboardSummary,
  DashboardSummaryApiResponse,
  DashboardSnapshot,
  DataQualityReport,
  InventoryApiResponse,
  InventoryRiskItem,
  InventoryStockItem,
  Keyword,
  KeywordOpportunityItem,
  MarketAnalysisItem,
  MarketScore,
  OpportunitiesApiResponse,
  OpportunityAnalysisItem,
  OpportunityProductItem,
  OpportunityRiskAlert,
  OpportunityScore,
  Platform,
  Product,
  ProductProfitItem,
  ProductsApiResponse,
  ProfitApiResponse,
  ProfitCostStructureItem,
  ProfitRiskSummary,
  ReorderRecommendationItem,
  RiskAnalysisItem,
  RiskLevel,
  ShopeeDataSource,
  ShopeeInventoryItem,
  ShopeeOrder,
  ShopeeProduct,
  StockStatus,
  TaskImpactType,
  TaskPriority,
  TaskSourceModule,
  TasksApiResponse,
  TodayTaskItem,
} from "@/types";

type AnyRecord = Record<string, unknown>;

type SnapshotPart<T> = {
  source?: ShopeeDataSource;
  data?: T[];
  created_at?: string;
  synced_at?: string | null;
};

type ProductAgg = {
  productId: string;
  productUid: string;
  title: string;
  keyword: string;
  keywordUid: string;
  price: number;
  stockQty: number;
  reservedStock: number;
  salesCount: number;
  orderQty: number;
  revenue: number;
  dailySalesAvg: number;
  daysOfStock: number;
  stockStatus: StockStatus;
  riskLevel: RiskLevel;
  riskScore: number;
  marketScore: number;
  opportunityScore: number;
};

type RealShopeeBundle = {
  source: ApiDataSource;
  syncedAt: string;
  shopId: string;
  orders: ShopeeOrder[];
  productsRaw: ShopeeProduct[];
  inventoryRaw: ShopeeInventoryItem[];
  products: Product[];
  keywords: Keyword[];
  marketScore: MarketScore[];
  opportunityScore: OpportunityScore[];
  todayOpportunities: OpportunityProductItem[];
  keywordOpportunities: KeywordOpportunityItem[];
  riskAlerts: OpportunityRiskAlert[];
  inventoryStock: InventoryStockItem[];
  inventoryRisks: InventoryRiskItem[];
  reorderRecommendations: ReorderRecommendationItem[];
  productProfit: ProductProfitItem[];
  profitRisk: ProfitRiskSummary;
  costStructure: ProfitCostStructureItem[];
  tasks: TasksApiResponse;
  analysis: AnalysisApiResponse;
  opportunities: OpportunitiesApiResponse;
  inventory: InventoryApiResponse;
  profit: ProfitApiResponse;
  dashboard: DashboardSummaryApiResponse;
  dailyOps: DailyOpsApiResponse;
};

const PLATFORM: Platform = "Shopee";
const MARKET_CODE = "br";
const CURRENCY = "BRL";
const CACHE_TTL_MS = 60_000;
const DEFAULT_SHOP_ID = "authorized_shop";
const REORDER_LEAD_TIME_DAYS = 14;
const MAX_ITEMS = 10_000;

let cachedBundle: { expiresAt: number; value: RealShopeeBundle | null } | null = null;

function nowIso() {
  return new Date().toISOString();
}

function today() {
  return nowIso().slice(0, 10);
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

function asString(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function cleanText(value: unknown, fallback: string) {
  const raw = asString(value, "");
  if (!raw) return fallback;

  let text = raw;
  const looksMojibake = /Ã|Â|�/.test(text);
  if (looksMojibake) {
    try {
      const decoded = Buffer.from(text, "latin1").toString("utf8");
      if (decoded && !/Ã|Â|�/.test(decoded)) text = decoded;
    } catch {
      text = raw;
    }
  }

  return text.replace(/\s+/g, " ").trim() || fallback;
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").slice(0, 10);
}

function keywordFromTitle(title: string) {
  const words = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3);
  return words.slice(0, 3).join(" ") || "shopee item";
}

function keywordUid(keyword: string) {
  return `kw_${MARKET_CODE}_${hashText(keyword)}`;
}

function productUid(productId: string) {
  return `shopee_${productId}`;
}

function safeSource(values: Array<ShopeeDataSource | undefined>): ApiDataSource {
  if (values.includes("shopee_api")) return "shopee_api";
  if (values.includes("sqlite")) return "sqlite";
  return "mock";
}

function extractArray<T>(response: unknown, key: string): T[] {
  const record = asRecord(response);
  const direct = record[key];
  const data = record.data;
  if (Array.isArray(direct)) return direct as T[];
  if (Array.isArray(data)) return data as T[];
  return [];
}

function extractSource(response: unknown): ShopeeDataSource | undefined {
  const source = asRecord(response).source;
  return source === "shopee_api" || source === "sqlite" || source === "mock" ? source : undefined;
}

async function resolve<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

function readSnapshotPart<T>(snapshot: unknown, key: "orders" | "products" | "inventory"): SnapshotPart<T> {
  const part = asRecord(asRecord(snapshot)[key]);
  return {
    source: extractSource(part),
    data: Array.isArray(part.data) ? (part.data as T[]) : [],
    created_at: asString(part.created_at, ""),
    synced_at: asString(part.synced_at, ""),
  };
}

function normalizeOrder(value: unknown): ShopeeOrder {
  const item = asRecord(value);
  return {
    order_id: asString(item.order_id ?? item.order_sn ?? item.id, `order_${hashText(JSON.stringify(item))}`),
    product_id: asString(item.product_id ?? item.item_id ?? item.itemId, ""),
    sku: asString(item.sku ?? item.model_sku ?? item.item_sku, ""),
    quantity: Math.max(0, asNumber(item.quantity ?? item.qty ?? item.item_count, 0)),
    price: Math.max(0, asNumber(item.price ?? item.item_price ?? item.amount, 0)),
    order_status: asString(item.order_status ?? item.status, "unknown"),
    created_at: asString(item.created_at ?? item.create_time ?? item.order_time, nowIso()),
  };
}

function normalizeProduct(value: unknown): ShopeeProduct {
  const item = asRecord(value);
  const productId = asString(item.product_id ?? item.item_id ?? item.itemId ?? item.id, `item_${hashText(JSON.stringify(item))}`);
  return {
    product_id: productId,
    title: cleanText(item.title ?? item.item_name ?? item.name, `Shopee Product ${productId}`),
    price: Math.max(0, asNumber(item.price ?? item.current_price ?? item.price_amount, 0)),
    stock: Math.max(0, asNumber(item.stock ?? item.normal_stock ?? item.available_stock, 0)),
    sales_count: Math.max(0, asNumber(item.sales_count ?? item.sales ?? item.sold ?? item.historical_sold, 0)),
  };
}

function normalizeInventory(value: unknown): ShopeeInventoryItem {
  const item = asRecord(value);
  return {
    product_id: asString(item.product_id ?? item.item_id ?? item.itemId ?? item.id, ""),
    available_stock: Math.max(0, asNumber(item.available_stock ?? item.stock ?? item.normal_stock, 0)),
    reserved_stock: Math.max(0, asNumber(item.reserved_stock ?? item.reserved ?? item.allocated_stock, 0)),
  };
}

function deriveInventoryFromProducts(products: ShopeeProduct[]): ShopeeInventoryItem[] {
  return products.map((product) => ({
    product_id: product.product_id,
    available_stock: product.stock,
    reserved_stock: 0,
  }));
}

function inferShopId(...responses: unknown[]) {
  for (const response of responses) {
    const record = asRecord(response);
    const shopId = asString(record.shop_id ?? record.shopId, "");
    if (shopId) return shopId;

    for (const key of ["orders", "products", "inventory", "data"]) {
      const rows = extractArray<AnyRecord>(record, key);
      for (const row of rows) {
        const rowShopId = asString(asRecord(row).shop_id ?? asRecord(row).shopId, "");
        if (rowShopId) return rowShopId;
      }
    }
  }
  return asString(process.env.SHOPEE_SHOP_ID ?? process.env.SHOPEE_READONLY_SHOP_ID, DEFAULT_SHOP_ID);
}

function riskLevel(score: number): RiskLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function statusFromStock(stockQty: number, dailySalesAvg: number): { status: StockStatus; riskScore: number } {
  if (stockQty <= 0) return { status: "stockout_risk", riskScore: 95 };
  if (dailySalesAvg > 0) {
    const days = stockQty / dailySalesAvg;
    if (days < 5) return { status: "stockout_risk", riskScore: 90 };
    if (days < 14) return { status: "reorder_soon", riskScore: 65 };
    if (days > 120) return { status: "overstock_risk", riskScore: 72 };
  }
  if (stockQty > 80 && dailySalesAvg === 0) return { status: "slow_moving", riskScore: 70 };
  return { status: "healthy", riskScore: 18 };
}

function aggregateProducts(products: ShopeeProduct[], inventory: ShopeeInventoryItem[], orders: ShopeeOrder[], shopId: string): ProductAgg[] {
  const inventoryByProduct = new Map(inventory.map((item) => [item.product_id, item]));
  const orderByProduct = new Map<string, { qty: number; revenue: number }>();

  for (const order of orders) {
    if (!order.product_id) continue;
    const current = orderByProduct.get(order.product_id) ?? { qty: 0, revenue: 0 };
    const quantity = Math.max(1, order.quantity || 1);
    current.qty += quantity;
    current.revenue += order.price * quantity;
    orderByProduct.set(order.product_id, current);
  }

  return products.slice(0, MAX_ITEMS).map((product) => {
    const itemInventory = inventoryByProduct.get(product.product_id);
    const orderStats = orderByProduct.get(product.product_id) ?? { qty: 0, revenue: 0 };
    const stockQty = itemInventory ? itemInventory.available_stock : product.stock;
    const reservedStock = itemInventory ? itemInventory.reserved_stock : 0;
    const salesCount = Math.max(product.sales_count, orderStats.qty);
    const dailySalesAvg = Math.max(0, salesCount / 30);
    const daysOfStock = dailySalesAvg > 0 ? Math.round((stockQty / dailySalesAvg) * 10) / 10 : stockQty > 0 ? 999 : 0;
    const stock = statusFromStock(stockQty, dailySalesAvg);
    const keyword = keywordFromTitle(product.title);
    const marketScore = Math.max(35, Math.min(96, 45 + Math.min(35, salesCount * 2) + Math.max(0, 20 - stock.riskScore / 5)));
    const opportunityScore = Math.max(20, Math.min(98, marketScore + (stock.riskScore >= 70 ? 8 : 0) + (product.price > 0 ? 5 : 0)));

    return {
      productId: product.product_id,
      productUid: productUid(product.product_id),
      title: product.title,
      keyword,
      keywordUid: keywordUid(keyword),
      price: product.price,
      stockQty,
      reservedStock,
      salesCount,
      orderQty: orderStats.qty,
      revenue: orderStats.revenue,
      dailySalesAvg,
      daysOfStock,
      stockStatus: stock.status,
      riskLevel: riskLevel(stock.riskScore),
      riskScore: stock.riskScore,
      marketScore,
      opportunityScore,
    };
  });
}

function productRows(items: ProductAgg[], shopId: string, syncedAt: string): Product[] {
  return items.map((item) => ({
    product_uid: item.productUid,
    seller_uid: `shopee_${shopId}`,
    keyword_uid: item.keywordUid,
    platform: PLATFORM,
    market_code: MARKET_CODE,
    platform_product_id: item.productId,
    platform_shop_id: shopId,
    title: item.title,
    title_current: item.title,
    price_amount: item.price,
    market_currency: CURRENCY,
    rating: 0,
    review_count: 0,
    sold_count_text: String(item.salesCount || item.orderQty || 0),
    snapshot_date: syncedAt,
    availability_status: item.stockQty > 0 ? "available" : "stockout",
  }));
}

function keywordRows(items: ProductAgg[]): Keyword[] {
  const unique = new Map<string, ProductAgg>();
  for (const item of items) {
    if (!unique.has(item.keywordUid)) unique.set(item.keywordUid, item);
  }
  return Array.from(unique.values()).map((item) => ({
    keyword_uid: item.keywordUid,
    platform: PLATFORM,
    market_code: MARKET_CODE,
    keyword: item.keyword,
    normalized_keyword: item.keyword,
    category_hint: "Shopee",
    search_volume_index: Math.round(item.marketScore),
    trend_direction: item.salesCount > 0 ? "up" : "flat",
  }));
}

function marketScoreRows(items: ProductAgg[]): MarketScore[] {
  const byKeyword = new Map<string, ProductAgg[]>();
  for (const item of items) {
    byKeyword.set(item.keywordUid, [...(byKeyword.get(item.keywordUid) ?? []), item]);
  }

  return Array.from(byKeyword.entries()).map(([keywordId, rows]) => {
    const first = rows[0];
    const totalScore = Math.round(rows.reduce((sum, row) => sum + row.marketScore, 0) / rows.length);
    return {
      market_score_id: `market_${keywordId}`,
      keyword_uid: keywordId,
      platform: PLATFORM,
      market_code: MARKET_CODE,
      keyword: first.keyword,
      market_demand_score: Math.min(100, totalScore + 4),
      competition_score: Math.max(5, 100 - totalScore),
      trend_score: Math.min(100, totalScore + (first.salesCount > 0 ? 5 : 0)),
      total_score: totalScore,
    };
  });
}

function opportunityScoreRows(items: ProductAgg[]): OpportunityScore[] {
  return items.map((item) => {
    const level: "A" | "B" | "C" = item.opportunityScore >= 85 ? "A" : item.opportunityScore >= 65 ? "B" : "C";
    return {
      opportunity_id: `opp_${item.productId}`,
      product_uid: item.productUid,
      keyword_uid: item.keywordUid,
      category_hint: "Shopee",
      market_demand_score: Math.round(item.marketScore),
      competition_score: Math.max(5, 100 - Math.round(item.marketScore)),
      market_score: Math.round(item.marketScore),
      opportunity_score: Math.round(item.opportunityScore),
      recommendation_level: level,
      suggestion_level: level,
      decision_notes: item.riskScore >= 70 ? "优先确认库存和页面质量，再决定动作。" : "可进入人工复核队列。",
      risk_level: item.riskLevel,
      risk_score: item.riskScore,
      reason: "基于已授权 Shopee 店铺的商品、库存和订单数据生成。",
    };
  });
}

function buildOpportunities(items: ProductAgg[], products: Product[], keywords: Keyword[], marketScores: MarketScore[], opportunityScores: OpportunityScore[]): OpportunitiesApiResponse {
  const scoreByProduct = new Map(opportunityScores.map((score) => [score.product_uid, score]));
  const todayOpportunities: OpportunityProductItem[] = products
    .map((product) => {
      const score = scoreByProduct.get(product.product_uid);
      return {
        product_uid: product.product_uid,
        platform: PLATFORM,
        title_current: product.title_current ?? product.title,
        price_amount: product.price_amount,
        rating: product.rating,
        sold_count_text: product.sold_count_text,
        market_score: score?.market_score ?? 0,
        opportunity_score: score?.opportunity_score ?? 0,
        recommendation_level: score?.recommendation_level ?? "C",
        decision_notes: score?.decision_notes ?? "等待更多真实数据。",
        risk_level: score?.risk_level ?? "low",
        risk_score: score?.risk_score ?? 0,
      };
    })
    .sort((a, b) => b.opportunity_score - a.opportunity_score)
    .slice(0, 50);

  const keywordOpportunities: KeywordOpportunityItem[] = marketScores
    .map((score) => ({
      keyword_uid: score.keyword_uid,
      keyword: score.keyword,
      category_hint: "Shopee",
      market_demand_score: score.market_demand_score,
      competition_score: score.competition_score,
      trend_score: score.trend_score,
      total_score: score.total_score,
      platform: PLATFORM,
    }))
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, 50);

  const riskAlerts: OpportunityRiskAlert[] = items
    .filter((item) => item.riskLevel !== "low")
    .map((item) => ({
      risk_id: `risk_${item.productId}`,
      risk_type: item.stockStatus === "stockout_risk" ? "库存风险" : item.stockStatus === "slow_moving" ? "滞销风险" : "运营风险",
      risk_level: item.riskLevel,
      affected_product: item.title,
      platform: PLATFORM,
      product_uid: item.productUid,
      reason: item.stockQty <= 0 ? "当前可售库存为 0，需要确认是否断货。" : "库存与销量结构需要人工复核。",
      suggested_action: "先核对库存、价格和页面信息，再进入审批动作。",
    }))
    .slice(0, 50);

  return {
    source: "shopee_api",
    products,
    keywords,
    market_score: marketScores,
    opportunity_score: opportunityScores,
    today_opportunities: todayOpportunities,
    keyword_opportunities: keywordOpportunities,
    risk_alerts: riskAlerts,
  };
}

function buildInventory(items: ProductAgg[], syncedAt: string): InventoryApiResponse {
  const inventoryStock: InventoryStockItem[] = items.map((item) => ({
    inventory_item_id: `inv_${item.productId}`,
    product_uid: item.productUid,
    product_name: item.title,
    platform: PLATFORM,
    stock_qty: item.stockQty,
    daily_sales_avg: Number(item.dailySalesAvg.toFixed(2)),
    days_of_stock: item.daysOfStock,
    reorder_point: Math.ceil(item.dailySalesAvg * REORDER_LEAD_TIME_DAYS),
    suggested_reorder_qty: item.stockStatus === "stockout_risk" || item.stockStatus === "reorder_soon" ? Math.max(10, Math.ceil(item.dailySalesAvg * 30 - item.stockQty)) : 0,
    stock_status: item.stockStatus,
  }));

  const inventoryRisks: InventoryRiskItem[] = items
    .filter((item) => item.riskLevel !== "low")
    .map((item) => ({
      risk_id: `inventory_risk_${item.productId}`,
      product_uid: item.productUid,
      platform: PLATFORM,
      risk_type: item.stockStatus,
      risk_level: item.riskLevel,
      risk_reason: item.stockQty <= 0 ? "商品当前没有可售库存。" : "库存周转状态需要确认。",
      suggested_action: "人工确认实际仓库库存和补货计划。",
    }));

  const reorderRecommendations: ReorderRecommendationItem[] = items
    .filter((item) => item.stockStatus === "stockout_risk" || item.stockStatus === "reorder_soon")
    .map((item) => ({
      recommendation_id: `reorder_${item.productId}`,
      product_uid: item.productUid,
      product_name: item.title,
      platform: PLATFORM,
      current_stock: item.stockQty,
      daily_sales_avg: Number(item.dailySalesAvg.toFixed(2)),
      lead_time_days: REORDER_LEAD_TIME_DAYS,
      recommended_reorder_qty: Math.max(10, Math.ceil(item.dailySalesAvg * 30 - item.stockQty)),
      reorder_priority: item.riskLevel === "high" ? "P1" : "P2",
      decision_notes: "只生成补货建议，不自动采购。",
    }));

  const totalInventoryValue = items.reduce((sum, item) => sum + item.stockQty * item.price, 0);
  const stockoutCount = inventoryRisks.filter((risk) => risk.risk_type === "stockout_risk").length;
  const overstockCount = inventoryRisks.filter((risk) => risk.risk_type === "overstock_risk").length;
  const slowCount = inventoryRisks.filter((risk) => risk.risk_type === "slow_moving").length;
  const healthScore = Math.max(0, Math.round(100 - (inventoryRisks.length / Math.max(1, items.length)) * 100));
  const turnoverDays = average(items.map((item) => item.daysOfStock).filter((value) => Number.isFinite(value) && value < 999));

  return {
    source: "shopee_api",
    snapshot: {
      inventory_snapshot_id: `inventory_${Date.now()}`,
      reporting_date: syncedAt,
      market_code: MARKET_CODE,
      total_inventory_value: Number(totalInventoryValue.toFixed(2)),
      inventory_turnover_days: Number(turnoverDays.toFixed(1)),
      stock_health_score: healthScore,
      stockout_risk_count: stockoutCount,
      overstock_risk_count: overstockCount,
      slow_moving_sku_count: slowCount,
    },
    inventory_stock: inventoryStock,
    inventory_risks: inventoryRisks,
    reorder_recommendations: reorderRecommendations,
  };
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildProfit(items: ProductAgg[], syncedAt: string): ProfitApiResponse {
  const revenue = items.reduce((sum, item) => sum + item.revenue, 0);
  const procurement = revenue * 0.55;
  const logistics = revenue * 0.1;
  const commission = revenue * 0.12;
  const tax = revenue * 0.06;
  const ads = 0;
  const totalCost = procurement + logistics + commission + tax + ads;
  const netProfit = revenue - totalCost;
  const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  const productProfit: ProductProfitItem[] = items.map((item) => {
    const cost = item.revenue * 0.73;
    const profit = item.revenue - cost;
    const margin = item.revenue > 0 ? (profit / item.revenue) * 100 : 0;
    return {
      profit_item_id: `profit_${item.productId}`,
      product_uid: item.productUid,
      platform: PLATFORM,
      product_name: item.title,
      revenue: Number(item.revenue.toFixed(2)),
      cost: Number(cost.toFixed(2)),
      gross_profit: Number(profit.toFixed(2)),
      net_profit: Number(profit.toFixed(2)),
      net_margin: Number(margin.toFixed(2)),
      inventory_days: item.daysOfStock,
      risk_level: margin > 0 && margin < 10 ? "high" : item.riskLevel,
    };
  });

  const profitRisk: ProfitRiskSummary = {
    loss_products: productProfit.filter((item) => item.net_profit < 0).length,
    low_profit_products: productProfit.filter((item) => item.revenue > 0 && item.net_margin < 10).length,
    high_risk_products: productProfit.filter((item) => item.risk_level === "high").length,
  };

  const costRows: ProfitCostStructureItem[] = ([
    { cost_key: "procurement_cost", label: "采购成本", value: procurement, share: revenue > 0 ? (procurement / revenue) * 100 : 0 },
    { cost_key: "advertising_cost", label: "广告成本", value: ads, share: revenue > 0 ? (ads / revenue) * 100 : 0 },
    { cost_key: "logistics_cost", label: "物流成本", value: logistics, share: revenue > 0 ? (logistics / revenue) * 100 : 0 },
    { cost_key: "platform_commission", label: "平台佣金", value: commission, share: revenue > 0 ? (commission / revenue) * 100 : 0 },
    { cost_key: "tax_cost", label: "税费", value: tax, share: revenue > 0 ? (tax / revenue) * 100 : 0 },
  ] satisfies ProfitCostStructureItem[]).map((item) => ({ ...item, value: Number(item.value.toFixed(2)), share: Number(item.share.toFixed(2)) }));

  return {
    source: "shopee_api",
    snapshot: {
      profit_snapshot_id: `profit_${Date.now()}`,
      reporting_date: syncedAt,
      market_code: MARKET_CODE,
      yesterday_net_profit: Number(netProfit.toFixed(2)),
      month_net_profit: Number(netProfit.toFixed(2)),
      net_margin: Number(netMargin.toFixed(2)),
      cash_flow: Number(netProfit.toFixed(2)),
      inventory_turnover_days: 0,
      procurement_cost: Number(procurement.toFixed(2)),
      advertising_cost: Number(ads.toFixed(2)),
      logistics_cost: Number(logistics.toFixed(2)),
      platform_commission: Number(commission.toFixed(2)),
      tax_cost: Number(tax.toFixed(2)),
    },
    cost_structure: costRows,
    profit_risk: profitRisk,
    product_profit: productProfit,
  };
}

function priorityFromRisk(risk: RiskLevel): TaskPriority {
  if (risk === "high") return "high";
  if (risk === "medium") return "medium";
  return "low";
}

function priorityLabel(priority: TaskPriority): AnalysisPriority {
  if (priority === "high") return "P1";
  if (priority === "medium") return "P2";
  return "P3";
}

function buildTasks(items: ProductAgg[]): TodayTaskItem[] {
  const riskTasks = items
    .filter((item) => item.riskLevel !== "low")
    .map((item): TodayTaskItem => {
      const priority = priorityFromRisk(item.riskLevel);
      const impact = Math.max(item.revenue, item.price * Math.max(1, item.salesCount));
      return {
        task_id: `task_inventory_${item.productId}`,
        task_title: `${item.title} 库存风险确认`,
        task_type: "inventory_alert",
        source_module: "inventory",
        impact_type: "inventory",
        title: `${item.title} 库存风险确认`,
        summary: item.stockQty <= 0 ? "当前可售库存为 0，需要先确认是否断货。" : "库存周转异常，需要复核。",
        product_uid: item.productUid,
        platform: PLATFORM,
        estimated_profit_impact: Number((impact * 0.27).toFixed(2)),
        estimated_gmv_impact: Number(impact.toFixed(2)),
        estimated_inventory_impact: item.stockQty,
        priority,
        risk_level: item.riskLevel,
        expected_impact: "降低断货或积压风险。",
        suggested_action: "进入库存中心核对库存，再由人工决定是否补货。",
        created_at: nowIso(),
        href: "/inventory",
      };
    });

  const opportunityTasks = items
    .filter((item) => item.opportunityScore >= 85)
    .slice(0, 30)
    .map((item): TodayTaskItem => ({
      task_id: `task_opportunity_${item.productId}`,
      task_title: `${item.title} 机会跟进`,
      task_type: "opportunity_follow_up",
      source_module: "opportunity",
      impact_type: "gmv",
      title: `${item.title} 机会跟进`,
      summary: "机会评分较高，适合进入人工复核。",
      product_uid: item.productUid,
      platform: PLATFORM,
      estimated_profit_impact: Number((item.price * 3 * 0.27).toFixed(2)),
      estimated_gmv_impact: Number((item.price * 3).toFixed(2)),
      estimated_inventory_impact: item.stockQty,
      priority: "medium",
      risk_level: item.riskLevel,
      expected_impact: "提高高潜商品处理优先级。",
      suggested_action: "检查标题、主图、价格和库存后再决定动作。",
      created_at: nowIso(),
      href: "/opportunities",
    }));

  return [...riskTasks, ...opportunityTasks]
    .sort((a, b) => {
      const rank = { high: 3, medium: 2, low: 1 };
      return rank[b.priority] - rank[a.priority] || b.estimated_profit_impact - a.estimated_profit_impact;
    })
    .slice(0, 100);
}

function buildTasksResponse(tasks: TodayTaskItem[]): TasksApiResponse {
  const high = tasks.filter((task) => task.priority === "high");
  const medium = tasks.filter((task) => task.priority === "medium");
  const low = tasks.filter((task) => task.priority === "low");

  return {
    source: "shopee_api",
    overview: {
      total_tasks: tasks.length,
      high_priority_tasks: high.length,
      medium_priority_tasks: medium.length,
      low_priority_tasks: low.length,
      estimated_profit_impact: sum(tasks, "estimated_profit_impact"),
      estimated_gmv_impact: sum(tasks, "estimated_gmv_impact"),
      estimated_inventory_impact: sum(tasks, "estimated_inventory_impact"),
    },
    top_tasks: tasks.slice(0, 5).map((task, index) => ({ ...task, rank: index + 1 })),
    high_priority_tasks: high,
    medium_priority_tasks: medium,
    low_priority_tasks: low,
    all_tasks: tasks,
    ai_recommendations: tasks.slice(0, 8).map((task) => ({
      recommendation_id: `rec_${task.task_id}`,
      recommendation_type: task.task_type,
      recommendation_summary: task.summary,
      recommendation_reason: "来自已授权 Shopee 店铺真实商品、库存和订单数据。",
      expected_benefit: task.expected_impact,
      approval_required: true,
      priority: priorityLabel(task.priority),
      href: task.href,
    })),
    source_stats: {
      inventory_tasks: tasks.filter((task) => task.source_module === "inventory").length,
      profit_tasks: tasks.filter((task) => task.source_module === "profit").length,
      approval_tasks: tasks.filter((task) => task.source_module === "approval").length,
      analysis_tasks: tasks.filter((task) => task.source_module === "analysis").length,
      opportunity_tasks: tasks.filter((task) => task.source_module === "opportunity").length,
    },
    impact_stats: {
      total_profit_impact: sum(tasks, "estimated_profit_impact"),
      total_gmv_impact: sum(tasks, "estimated_gmv_impact"),
      total_inventory_impact: sum(tasks, "estimated_inventory_impact"),
    },
  };
}

function sum<T>(items: T[], key: keyof T) {
  return Number(items.reduce((total, item) => total + asNumber(item[key], 0), 0).toFixed(2));
}

function buildAnalysis(items: ProductAgg[], opportunities: OpportunityProductItem[], risks: OpportunityRiskAlert[]): AnalysisApiResponse {
  const opportunityAnalysis: OpportunityAnalysisItem[] = opportunities.slice(0, 50).map((item) => ({
    analysis_id: `analysis_${item.product_uid}`,
    product_uid: item.product_uid,
    platform: PLATFORM,
    opportunity_score: item.opportunity_score,
    risk_level: item.risk_level,
    analysis_summary: "该商品已进入真实数据分析队列。",
    analysis_reason: "基于 Shopee 商品、库存和订单读取结果。",
    recommendation: item.decision_notes,
  }));

  const riskAnalysis: RiskAnalysisItem[] = risks.map((risk) => ({
    risk_id: risk.risk_id,
    risk_type: risk.risk_type,
    risk_level: risk.risk_level,
    product_uid: risk.product_uid,
    platform: PLATFORM,
    risk_reason: risk.reason,
    mitigation_action: risk.suggested_action,
  }));

  const marketAnalysis: MarketAnalysisItem[] = items.slice(0, 20).map((item) => ({
    market_score_id: `market_analysis_${item.productId}`,
    platform: PLATFORM,
    category: item.keyword,
    demand_score: Math.round(item.marketScore),
    competition_score: Math.max(5, 100 - Math.round(item.marketScore)),
    trend_direction: item.salesCount > 0 ? "up" : "flat",
  }));

  const aiRecommendations: AiRecommendationItem[] = opportunityAnalysis.slice(0, 20).map((item) => ({
    recommendation_id: `ai_${item.analysis_id}`,
    recommendation_type: item.risk_level === "high" ? "risk_review" : "opportunity_review",
    priority: item.risk_level === "high" ? "P1" : item.opportunity_score >= 85 ? "P2" : "P3",
    platform: PLATFORM,
    product_uid: item.product_uid,
    action_suggestion: item.recommendation,
    expected_impact: "只生成建议，关键动作仍需人工审批。",
  }));

  return {
    source: "shopee_api",
    opportunity_analysis: opportunityAnalysis,
    risk_analysis: riskAnalysis,
    market_analysis: marketAnalysis,
    ai_recommendations: aiRecommendations,
  };
}

function metric(metric_id: string, label: string, value: number, unit: DashboardMetric["unit"], note: string, tone: DashboardMetric["tone"]): DashboardMetric {
  return { metric_id, label, value, unit, note, tone };
}

function buildDashboard(bundle: Pick<RealShopeeBundle, "products" | "inventory" | "profit" | "opportunities" | "tasks" | "analysis" | "syncedAt">): DashboardSummaryApiResponse {
  const profit = bundle.profit.snapshot;
  const inventory = bundle.inventory.snapshot;
  const pendingApprovals = bundle.analysis.ai_recommendations.length;
  const highPriority = bundle.tasks.all_tasks.filter((task) => task.priority === "high").length;
  const highRisks = bundle.opportunities.risk_alerts.filter((risk) => risk.risk_level === "high").length;

  const summary: DashboardSummary = {
    reporting_date: today(),
    market_code: MARKET_CODE,
    core_metrics: {
      yesterday_net_profit: profit.yesterday_net_profit,
      month_net_profit: profit.month_net_profit,
      net_margin: profit.net_margin,
      cash_flow: profit.cash_flow,
      inventory_turnover_days: inventory.inventory_turnover_days,
      pending_approval_count: pendingApprovals,
    },
    operating_status: {
      today_opportunity_count: bundle.opportunities.today_opportunities.length,
      high_priority_recommendation_count: highPriority,
      stockout_risk_count: inventory.stockout_risk_count,
      low_profit_product_count: bundle.profit.profit_risk.low_profit_products,
      high_risk_alert_count: highRisks,
    },
    profit_and_cash: {
      yesterday_net_profit: profit.yesterday_net_profit,
      month_net_profit: profit.month_net_profit,
      net_margin: profit.net_margin,
      cash_flow: profit.cash_flow,
      profit_risk_summary: bundle.profit.profit_risk,
    },
    inventory_risk: {
      inventory_turnover_days: inventory.inventory_turnover_days,
      stock_health_score: inventory.stock_health_score,
      stockout_risk_count: inventory.stockout_risk_count,
      overstock_risk_count: inventory.overstock_risk_count,
      slow_moving_sku_count: inventory.slow_moving_sku_count,
    },
    decision_feedback: {
      decision_accuracy_score: 0,
      recommendation_hit_rate: 0,
      recommendation_success_rate: 0,
      blocked_correct_rate: 0,
      roi_deviation_rate: 0,
    },
    execution_guard: {
      pending_count: pendingApprovals,
      approved_count: 0,
      rejected_count: 0,
      simulated_profit_total: 0,
    },
    business_impact: {
      total_profit_impact: bundle.tasks.impact_stats.total_profit_impact,
      decision_success_rate: 0,
      roi_prediction_error: 0,
      best_strategy: "等待更多经营结果",
      worst_strategy: "等待更多经营结果",
    },
    self_optimization: {
      rule_hit_rate: 0,
      rule_bias_rate: 0,
      recommendation_count: bundle.analysis.ai_recommendations.length,
      top_recommendations: [],
      learning_trend: [],
    },
    ai_pending_approval: {
      pending_count: pendingApprovals,
      high_priority_count: bundle.analysis.ai_recommendations.filter((item) => item.priority === "P1").length,
      deferred_count: 0,
      latest_recommendations: bundle.analysis.ai_recommendations.slice(0, 5).map((item) => ({
        approval_id: `approval_${item.recommendation_id}`,
        recommendation_type: "listing_review",
        product_uid: item.product_uid,
        product_name: bundle.products.find((product) => product.product_uid === item.product_uid)?.title ?? item.product_uid,
        platform: PLATFORM,
        priority: item.priority,
        recommendation_summary: item.action_suggestion,
        created_at: bundle.syncedAt,
        status: "pending_review",
      })),
    },
    opportunity_and_risk: {
      top_opportunities: bundle.opportunities.today_opportunities.slice(0, 5),
      top_risks: bundle.opportunities.risk_alerts.slice(0, 5).map((risk) => ({
        risk_id: risk.risk_id,
        source: "inventory",
        risk_type: risk.risk_type,
        risk_level: risk.risk_level,
        product_uid: risk.product_uid,
        product_name: risk.affected_product,
        platform: PLATFORM,
        summary: risk.reason,
        suggested_action: risk.suggested_action,
      })),
      recommended_actions: bundle.analysis.ai_recommendations.slice(0, 5).map((item) => ({
        action_id: `action_${item.recommendation_id}`,
        recommendation_type: item.recommendation_type,
        priority: item.priority,
        platform: PLATFORM,
        product_uid: item.product_uid,
        product_name: bundle.products.find((product) => product.product_uid === item.product_uid)?.title ?? item.product_uid,
        action_suggestion: item.action_suggestion,
        expected_impact: item.expected_impact,
      })),
    },
    system_status: {
      data_source: "shopee_api",
      last_updated_at: bundle.syncedAt,
      api_status: "healthy",
      database_status: "connected",
    },
  };

  const snapshot: DashboardSnapshot = {
    reporting_date: today(),
    market_code: MARKET_CODE,
    bossMetrics: [
      metric("today_sales", "今日销售", bundle.profit.product_profit.reduce((total, item) => total + item.revenue, 0), "currency", "来自已授权 Shopee 店铺", "neutral"),
      metric("today_profit", "今日利润", profit.yesterday_net_profit, "currency", "按当前可得订单估算", "good"),
      metric("inventory_risk", "库存风险", inventory.stockout_risk_count, "count", "缺货风险数量", inventory.stockout_risk_count > 0 ? "risk" : "good"),
      metric("pending_tasks", "待处理事项", bundle.tasks.overview.total_tasks, "count", "今日任务数量", bundle.tasks.overview.total_tasks > 0 ? "warn" : "good"),
    ],
    riskCenter: bundle.opportunities.risk_alerts.slice(0, 5).map((risk): DashboardRisk => ({
      risk_id: risk.risk_id,
      title: risk.affected_product,
      level: risk.risk_level,
      signal: risk.risk_type,
      note: risk.reason,
    })),
    operationSafety: [],
    trafficFunnel: [],
    adsCenter: [],
    inventoryCenter: [
      metric("stock_health", "库存健康度", inventory.stock_health_score, "percent", "来自库存读取", inventory.stock_health_score < 60 ? "risk" : "good"),
      metric("stockout_count", "断货SKU", inventory.stockout_risk_count, "count", "缺货风险", inventory.stockout_risk_count > 0 ? "risk" : "good"),
    ],
    watchlist: bundle.opportunities.risk_alerts.slice(0, 10).map((risk) => ({
      watch_id: `watch_${risk.risk_id}`,
      product_uid: risk.product_uid,
      focus_metric: risk.risk_type,
      focus_value: risk.risk_level,
      risk_level: risk.risk_level,
      next_action: risk.suggested_action,
    })),
  };

  const crawlLogs: CrawlLog[] = [
    {
      crawl_run_id: `shopee_read_${Date.now()}`,
      platform: PLATFORM,
      market_code: MARKET_CODE,
      started_at: bundle.syncedAt,
      finished_at: bundle.syncedAt,
      status: "success",
      records_seen: bundle.products.length,
      records_inserted: bundle.products.length,
      message: "Shopee 只读数据已进入系统。",
    },
  ];

  const quality: DataQualityReport[] = [
    {
      report_id: `quality_${Date.now()}`,
      report_date: today(),
      source_table: "shopee_readonly",
      check_name: "real_data_presence",
      severity: bundle.products.length > 0 ? "low" : "high",
      quality_status: bundle.products.length > 0 ? "pass" : "failed",
      details: `已读取商品 ${bundle.products.length} 个，库存 ${bundle.inventory.inventory_stock.length} 条。`,
    },
  ];

  return {
    source: "shopee_api",
    products: bundle.products,
    action_queue: [],
    crawl_logs: crawlLogs,
    data_quality_report: quality,
    dashboard_summary: summary,
    dashboard_snapshot: snapshot,
  };
}

function buildDailyOps(tasks: TasksApiResponse, inventory: InventoryApiResponse, profit: ProfitApiResponse): DailyOpsApiResponse {
  return {
    source: "shopee_api",
    generated_at: nowIso(),
    core_goals: tasks.top_tasks.slice(0, 3).map((task) => ({
      goal_id: `goal_${task.task_id}`,
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
      stockout_risk_count: inventory.snapshot.stockout_risk_count,
      profit_decline_risk_count: profit.profit_risk.low_profit_products,
      high_risk_product_count: inventory.inventory_risks.filter((risk) => risk.risk_level === "high").length,
      approval_backlog_count: tasks.ai_recommendations.length,
      top_risks: inventory.inventory_risks.slice(0, 5).map((risk) => ({
        risk_id: risk.risk_id,
        risk_type: risk.risk_type,
        risk_level: risk.risk_level,
        title: risk.product_uid,
        source: "inventory",
        suggested_action: risk.suggested_action,
        href: "/inventory",
      })),
    },
    opportunities: tasks.all_tasks
      .filter((task) => task.source_module === "opportunity")
      .slice(0, 5)
      .map((task) => ({
        opportunity_id: `daily_${task.task_id}`,
        opportunity_type: "test_product",
        title: task.title,
        source: "decision_engine",
        expected_roi: 0,
        expected_profit: task.estimated_profit_impact,
        priority: task.priority,
        recommendation: task.suggested_action,
        href: task.href,
      })),
    execution_queue: {
      pending_approval_count: tasks.ai_recommendations.length,
      approved_unexecuted_count: 0,
      rejected_count: 0,
      total_queue_count: tasks.ai_recommendations.length,
      queue_items: [],
    },
    metrics: {
      expected_gmv: tasks.impact_stats.total_gmv_impact,
      expected_profit: tasks.impact_stats.total_profit_impact,
      stock_health_score: inventory.snapshot.stock_health_score,
      decision_success_rate: 0,
    },
    guardrails: ["只读读取平台数据", "不自动改价", "不自动上架", "关键动作必须人工审批"],
  };
}

async function createBundle(): Promise<RealShopeeBundle | null> {
  const [ordersResponse, productsResponse, inventoryResponse, snapshotResponse] = await Promise.all([
    resolve(getShopeeOrdersRealtime()),
    resolve(getShopeeProductsRealtime()),
    resolve(getShopeeInventoryRealtime()),
    resolve(getLatestShopeeSnapshot({ maxAgeMs: CACHE_TTL_MS })),
  ]);

  const snapshot = snapshotResponse;
  const orderSnapshot = readSnapshotPart<ShopeeOrder>(snapshot, "orders");
  const productSnapshot = readSnapshotPart<ShopeeProduct>(snapshot, "products");
  const inventorySnapshot = readSnapshotPart<ShopeeInventoryItem>(snapshot, "inventory");

  let orders = extractArray<ShopeeOrder>(ordersResponse, "orders").map(normalizeOrder);
  let products = extractArray<ShopeeProduct>(productsResponse, "products").map(normalizeProduct);
  let inventory = extractArray<ShopeeInventoryItem>(inventoryResponse, "inventory").map(normalizeInventory);

  if (!orders.length && orderSnapshot.data?.length) orders = orderSnapshot.data.map(normalizeOrder);
  if (!products.length && productSnapshot.data?.length) products = productSnapshot.data.map(normalizeProduct);
  if (!inventory.length && inventorySnapshot.data?.length) inventory = inventorySnapshot.data.map(normalizeInventory);
  if (!inventory.length && products.length) inventory = deriveInventoryFromProducts(products);

  products = products.filter((product) => product.product_id);
  inventory = inventory.filter((item) => item.product_id);
  orders = orders.filter((order) => order.order_id);

  if (!products.length) return null;

  const source = safeSource([
    extractSource(productsResponse),
    extractSource(inventoryResponse),
    extractSource(ordersResponse),
    productSnapshot.source,
    inventorySnapshot.source,
    orderSnapshot.source,
  ]);
  if (source !== "shopee_api" && !products.length) return null;

  const syncedAt = nowIso();
  const shopId = inferShopId(productsResponse, inventoryResponse, ordersResponse, snapshot);
  const aggregated = aggregateProducts(products, inventory, orders, shopId);
  const productList = productRows(aggregated, shopId, syncedAt);
  const keywords = keywordRows(aggregated);
  const marketScores = marketScoreRows(aggregated);
  const opportunityScores = opportunityScoreRows(aggregated);
  const opportunities = buildOpportunities(aggregated, productList, keywords, marketScores, opportunityScores);
  const inventoryApi = buildInventory(aggregated, syncedAt);
  const profitApi = buildProfit(aggregated, syncedAt);
  profitApi.snapshot.inventory_turnover_days = inventoryApi.snapshot.inventory_turnover_days;
  const tasks = buildTasksResponse(buildTasks(aggregated));
  const analysis = buildAnalysis(aggregated, opportunities.today_opportunities, opportunities.risk_alerts);

  const baseBundle = {
    source: "shopee_api" as ApiDataSource,
    syncedAt,
    shopId,
    orders,
    productsRaw: products,
    inventoryRaw: inventory,
    products: productList,
    keywords,
    marketScore: marketScores,
    opportunityScore: opportunityScores,
    todayOpportunities: opportunities.today_opportunities,
    keywordOpportunities: opportunities.keyword_opportunities,
    riskAlerts: opportunities.risk_alerts,
    inventoryStock: inventoryApi.inventory_stock,
    inventoryRisks: inventoryApi.inventory_risks,
    reorderRecommendations: inventoryApi.reorder_recommendations,
    productProfit: profitApi.product_profit,
    profitRisk: profitApi.profit_risk,
    costStructure: profitApi.cost_structure,
    tasks,
    analysis,
    opportunities,
    inventory: inventoryApi,
    profit: profitApi,
  };

  const dashboard = buildDashboard({ ...baseBundle, tasks, analysis });
  const dailyOps = buildDailyOps(tasks, inventoryApi, profitApi);

  return {
    ...baseBundle,
    tasks,
    dashboard,
    dailyOps,
  };
}

export async function getRealShopeeBusinessBundle() {
  if (cachedBundle && cachedBundle.expiresAt > Date.now()) return cachedBundle.value;
  const value = await createBundle();
  cachedBundle = { expiresAt: Date.now() + CACHE_TTL_MS, value };
  return value;
}

export function clearRealShopeeBusinessCache() {
  cachedBundle = null;
}

export async function getRealShopeeProductsResponse(): Promise<ProductsApiResponse | null> {
  const bundle = await getRealShopeeBusinessBundle();
  if (!bundle) return null;
  return {
    source: bundle.source,
    products: bundle.products,
  };
}

export async function getRealShopeeDashboardResponse(): Promise<DashboardSummaryApiResponse | null> {
  return (await getRealShopeeBusinessBundle())?.dashboard ?? null;
}

export async function getRealShopeeProfitResponse(): Promise<ProfitApiResponse | null> {
  return (await getRealShopeeBusinessBundle())?.profit ?? null;
}

export async function getRealShopeeInventoryResponse(): Promise<InventoryApiResponse | null> {
  return (await getRealShopeeBusinessBundle())?.inventory ?? null;
}

export async function getRealShopeeOpportunitiesResponse(): Promise<OpportunitiesApiResponse | null> {
  return (await getRealShopeeBusinessBundle())?.opportunities ?? null;
}

export async function getRealShopeeAnalysisResponse(): Promise<AnalysisApiResponse | null> {
  return (await getRealShopeeBusinessBundle())?.analysis ?? null;
}

export async function getRealShopeeTasksResponse(): Promise<TasksApiResponse | null> {
  const bundle = await getRealShopeeBusinessBundle();
  if (!bundle) return null;
  return bundle.tasks;
}

export async function getRealShopeeDailyOpsResponse(): Promise<DailyOpsApiResponse | null> {
  return (await getRealShopeeBusinessBundle())?.dailyOps ?? null;
}
