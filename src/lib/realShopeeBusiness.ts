import { buildProfitRisk, buildCostStructure } from "@/lib/profit";
import { getShopeeInventory, getShopeeOrders, getShopeeProducts } from "@/lib/connectors/shopeeAdapter";
import type {
  AiRecommendationItem,
  AnalysisApiResponse,
  CrawlLog,
  DailyOpsApiResponse,
  DashboardSummary,
  DashboardSummaryApiResponse,
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
  Product,
  ProductProfitItem,
  ProfitApiResponse,
  ProfitSnapshot,
  ReorderRecommendationItem,
  RiskAnalysisItem,
  RiskLevel,
  ShopeeDataSource,
  TasksApiResponse,
  TodayTaskItem,
  TopTaskItem,
} from "@/types";

type RealOrder = {
  order_id: string;
  product_id: string;
  sku: string;
  quantity: number;
  price: number;
  status: string;
  order_status: string;
  created_at: string;
};

type RealProduct = {
  product_id: string;
  title: string;
  price: number;
  stock: number;
  sales: number;
  sales_count: number;
};

type RealInventoryItem = {
  product_id: string;
  available_stock: number;
  reserved_stock: number;
};

type ProductAgg = {
  productId: string;
  productUid: string;
  title: string;
  price: number;
  stock: number;
  quantity: number;
  revenue: number;
  orderCount: number;
  lastOrderAt: string;
};

type RealShopeeBusinessBundle = {
  source: ShopeeDataSource;
  generatedAt: string;
  syncedAt: string;
  orders: RealOrder[];
  productsRaw: RealProduct[];
  inventoryRaw: RealInventoryItem[];
  productAgg: ProductAgg[];
  products: Product[];
  profit: ProfitApiResponse;
  inventory: InventoryApiResponse;
  opportunities: OpportunitiesApiResponse;
  analysis: AnalysisApiResponse;
  tasks: TasksApiResponse;
  dashboard: DashboardSummaryApiResponse;
  dailyOps: DailyOpsApiResponse;
};

const CACHE_TTL_MS = 30_000;
const SHOPEE_PLATFORM = "Shopee" as const;
const MARKET_CODE = "br";

let cachedBundle: { expiresAt: number; value: RealShopeeBusinessBundle | null } | null = null;

function nowIso() {
  return new Date().toISOString();
}

function today() {
  return nowIso().slice(0, 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toProductUid(productId: string) {
  return `product_shopee_br_${productId}`;
}

function latest(values: string[]) {
  return values
    .filter(Boolean)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
}

function riskRank(level: RiskLevel) {
  return { high: 3, medium: 2, low: 1 }[level];
}

function productTitle(productId: string, productMap: Map<string, RealProduct>) {
  return productMap.get(productId)?.title || `${SHOPEE_PLATFORM} 商品 ${productId}`;
}

function normalizeOrder(order: RealOrder): RealOrder {
  return {
    order_id: String(order.order_id || ""),
    product_id: String(order.product_id || ""),
    sku: String(order.sku || ""),
    quantity: Math.max(1, safeNumber(order.quantity || 1)),
    price: safeNumber(order.price),
    status: String(order.status || order.order_status || "unknown"),
    order_status: String(order.order_status || order.status || "unknown"),
    created_at: String(order.created_at || nowIso()),
  };
}

function aggregateProducts(
  orders: RealOrder[],
  productsRaw: RealProduct[],
  inventoryRaw: RealInventoryItem[],
): ProductAgg[] {
  const productMap = new Map(productsRaw.map((item) => [String(item.product_id), item]));
  const inventoryMap = new Map(inventoryRaw.map((item) => [String(item.product_id), item]));
  const aggMap = new Map<string, ProductAgg>();

  for (const product of productsRaw) {
    const productId = String(product.product_id || "");
    if (!productId) continue;
    const inventory = inventoryMap.get(productId);
    aggMap.set(productId, {
      productId,
      productUid: toProductUid(productId),
      title: product.title || productTitle(productId, productMap),
      price: safeNumber(product.price),
      stock: Math.max(safeNumber(product.stock), safeNumber(inventory?.available_stock)),
      quantity: 0,
      revenue: 0,
      orderCount: 0,
      lastOrderAt: "",
    });
  }

  for (const order of orders) {
    const productId = String(order.product_id || "");
    if (!productId) continue;
    const existing =
      aggMap.get(productId) ??
      ({
        productId,
        productUid: toProductUid(productId),
        title: productTitle(productId, productMap),
        price: 0,
        stock: safeNumber(inventoryMap.get(productId)?.available_stock),
        quantity: 0,
        revenue: 0,
        orderCount: 0,
        lastOrderAt: "",
      } satisfies ProductAgg);
    const quantity = Math.max(1, safeNumber(order.quantity || 1));
    existing.quantity += quantity;
    existing.orderCount += 1;
    existing.revenue += safeNumber(order.price) * quantity;
    existing.price = existing.price || safeNumber(order.price);
    existing.lastOrderAt = latest([existing.lastOrderAt, order.created_at]) ?? existing.lastOrderAt;
    aggMap.set(productId, existing);
  }

  return [...aggMap.values()].sort((left, right) => {
    const revenueDelta = right.revenue - left.revenue;
    if (revenueDelta !== 0) return revenueDelta;
    return right.quantity - left.quantity;
  });
}

function totalOrderRevenue(orders: RealOrder[]) {
  return orders.reduce((sum, order) => {
    const quantity = Math.max(1, safeNumber(order.quantity || 1));
    return sum + safeNumber(order.price) * quantity;
  }, 0);
}

function buildProducts(agg: ProductAgg[], generatedAt: string): Product[] {
  return agg.map((item) => ({
    product_uid: item.productUid,
    seller_uid: "seller_shopee_bound_shop",
    keyword_uid: `kw_br_${item.productId}`,
    platform: SHOPEE_PLATFORM,
    market_code: MARKET_CODE,
    platform_product_id: item.productId,
    platform_shop_id: "bound_shop",
    title: item.title,
    title_current: item.title,
    price_amount: item.price,
    market_currency: "BRL",
    rating: 0,
    review_count: 0,
    sold_count_text: `${item.quantity} 件真实订单销量`,
    snapshot_date: generatedAt.slice(0, 10),
    availability_status: item.stock > 0 ? "in_stock" : "stock_detail_pending",
  }));
}

function buildProfit(
  agg: ProductAgg[],
  inventorySnapshot: InventorySnapshot,
  generatedAt: string,
  source: ShopeeDataSource,
  fallbackRevenue = 0,
): ProfitApiResponse {
  const productRevenue = agg.reduce((sum, item) => sum + item.revenue, 0);
  const totalRevenue = productRevenue > 0 ? productRevenue : fallbackRevenue;
  const productProfit: ProductProfitItem[] = agg.slice(0, 50).map((item) => ({
    profit_item_id: `profit_real_${item.productId}`,
    product_uid: item.productUid,
    platform: SHOPEE_PLATFORM,
    product_name: item.title,
    revenue: item.revenue,
    cost: 0,
    gross_profit: 0,
    net_profit: 0,
    net_margin: 0,
    inventory_days: inventorySnapshot.inventory_turnover_days,
    risk_level: item.revenue > 0 ? "medium" : "low",
  }));

  const snapshot: ProfitSnapshot = {
    profit_snapshot_id: `profit_real_shopee_${generatedAt.slice(0, 10)}`,
    reporting_date: generatedAt.slice(0, 10),
    market_code: "br",
    yesterday_net_profit: 0,
    month_net_profit: 0,
    net_margin: 0,
    cash_flow: totalRevenue,
    inventory_turnover_days: inventorySnapshot.inventory_turnover_days,
    procurement_cost: 0,
    advertising_cost: 0,
    logistics_cost: 0,
    platform_commission: 0,
    tax_cost: 0,
  };

  return {
    source,
    snapshot,
    cost_structure: buildCostStructure(snapshot),
    profit_risk: buildProfitRisk(productProfit),
    product_profit: productProfit,
  };
}

function buildInventory(agg: ProductAgg[], generatedAt: string, source: ShopeeDataSource): InventoryApiResponse {
  const hasStockSignal = agg.some((item) => item.stock > 0);
  const inventoryStock: InventoryStockItem[] = agg.slice(0, 100).map((item) => {
    const dailySalesAvg = item.quantity / 14;
    const daysOfStock = item.stock > 0 && dailySalesAvg > 0 ? item.stock / dailySalesAvg : 0;
    const stockStatus =
      hasStockSignal && item.stock <= 0 && item.quantity > 0
        ? "stockout_risk"
        : hasStockSignal && item.stock > 0 && daysOfStock < 5
          ? "reorder_soon"
          : !hasStockSignal
            ? "healthy"
            : "healthy";
    return {
      inventory_item_id: `inventory_real_${item.productId}`,
      product_uid: item.productUid,
      product_name: item.title,
      platform: SHOPEE_PLATFORM,
      stock_qty: item.stock,
      daily_sales_avg: Number(dailySalesAvg.toFixed(2)),
      days_of_stock: Number(daysOfStock.toFixed(1)),
      reorder_point: Number((dailySalesAvg * 7).toFixed(0)),
      suggested_reorder_qty:
        stockStatus === "stockout_risk" || stockStatus === "reorder_soon"
          ? Math.max(10, Math.ceil(dailySalesAvg * 14 - item.stock))
          : 0,
      stock_status: stockStatus,
    };
  });

  const inventoryRisks: InventoryRiskItem[] = inventoryStock
    .filter((item) => item.stock_status === "stockout_risk" || item.stock_status === "reorder_soon")
    .slice(0, 20)
    .map((item) => ({
      risk_id: `inventory_risk_${item.inventory_item_id}`,
      product_uid: item.product_uid,
      platform: SHOPEE_PLATFORM,
      risk_type: item.stock_status,
      risk_level: item.stock_status === "stockout_risk" ? "high" : "medium",
      risk_reason:
        item.stock_status === "stockout_risk"
          ? "该商品已有真实订单记录，但当前库存读取为 0，需要人工确认是否断货。"
          : "该商品可售天数偏低，需要人工确认补货节奏。",
      suggested_action: "先核对 Shopee 后台库存与在途补货，再决定是否发起补货审批。",
    }));

  if (!hasStockSignal && agg.length > 0) {
    inventoryRisks.unshift({
      risk_id: "inventory_stock_detail_pending",
      product_uid: agg[0]?.productUid ?? "shopee_inventory",
      platform: SHOPEE_PLATFORM,
      risk_type: "stock_detail_pending",
      risk_level: "medium",
      risk_reason: "已读取到真实商品和订单，但库存明细字段仍未完整返回。",
      suggested_action: "继续补齐 Shopee 商品详情和库存明细读取权限，再用于断货判断。",
    });
  }

  const reorderRecommendations: ReorderRecommendationItem[] = inventoryStock
    .filter((item) => item.suggested_reorder_qty > 0)
    .slice(0, 20)
    .map((item) => ({
      recommendation_id: `reorder_real_${item.product_uid}`,
      product_uid: item.product_uid,
      product_name: item.product_name,
      platform: SHOPEE_PLATFORM,
      current_stock: item.stock_qty,
      daily_sales_avg: item.daily_sales_avg,
      lead_time_days: 14,
      recommended_reorder_qty: item.suggested_reorder_qty,
      reorder_priority: item.stock_status === "stockout_risk" ? "P1" : "P2",
      decision_notes: "仅生成补货建议，不会自动补货。",
    }));

  const totalInventoryValue = agg.reduce((sum, item) => sum + item.stock * item.price, 0);
  const averageTurnover =
    inventoryStock.length > 0
      ? inventoryStock.reduce((sum, item) => sum + item.days_of_stock, 0) / inventoryStock.length
      : 0;
  const stockoutCount = inventoryStock.filter((item) => item.stock_status === "stockout_risk").length;
  const overstockCount = inventoryStock.filter((item) => item.stock_status === "overstock_risk").length;
  const slowMovingCount = inventoryStock.filter((item) => item.stock_status === "slow_moving").length;
  const healthScore = !hasStockSignal && agg.length > 0 ? 40 : clamp(100 - stockoutCount * 8 - overstockCount * 4, 0, 100);

  return {
    source,
    snapshot: {
      inventory_snapshot_id: `inventory_real_shopee_${generatedAt.slice(0, 10)}`,
      reporting_date: generatedAt.slice(0, 10),
      market_code: "br",
      total_inventory_value: totalInventoryValue,
      inventory_turnover_days: Number(averageTurnover.toFixed(1)),
      stock_health_score: healthScore,
      stockout_risk_count: stockoutCount,
      overstock_risk_count: overstockCount,
      slow_moving_sku_count: slowMovingCount,
    },
    inventory_stock: inventoryStock,
    inventory_risks: inventoryRisks,
    reorder_recommendations: reorderRecommendations,
  };
}

function buildOpportunities(
  products: Product[],
  agg: ProductAgg[],
  inventory: InventoryApiResponse,
  source: ShopeeDataSource,
): OpportunitiesApiResponse {
  const keywords: Keyword[] = [
    {
      keyword_uid: "kw_br_shopee_real_orders",
      platform: SHOPEE_PLATFORM,
      market_code: MARKET_CODE,
      keyword: "Shopee 真实订单商品",
      normalized_keyword: "shopee_real_orders",
      category_hint: "Shopee BR",
      search_volume_index: agg.reduce((sum, item) => sum + item.quantity, 0),
      trend_direction: "flat",
    },
  ];

  const marketScore: MarketScore[] = [
    {
      market_score_id: "market_real_shopee_orders",
      keyword_uid: keywords[0].keyword_uid,
      platform: SHOPEE_PLATFORM,
      market_code: MARKET_CODE,
      keyword: keywords[0].keyword ?? "Shopee 真实订单商品",
      market_demand_score: clamp(50 + agg.length, 0, 100),
      competition_score: 50,
      trend_score: 55,
      total_score: clamp(55 + agg.length, 0, 100),
    },
  ];

  const opportunityScore: OpportunityScore[] = agg.slice(0, 50).map((item) => {
    const score = clamp(55 + item.quantity * 4 + item.orderCount * 2 + item.revenue / 100, 35, 95);
    const risk = inventory.inventory_risks.find((riskItem) => riskItem.product_uid === item.productUid);
    const riskLevel: RiskLevel = risk?.risk_level ?? "low";
    return {
      opportunity_id: `opportunity_real_${item.productId}`,
      product_uid: item.productUid,
      keyword_uid: keywords[0].keyword_uid,
      category_hint: "Shopee BR",
      market_demand_score: marketScore[0].market_demand_score,
      competition_score: marketScore[0].competition_score,
      market_score: marketScore[0].total_score,
      opportunity_score: Math.round(score),
      recommendation_level: score >= 80 ? "A" : score >= 65 ? "B" : "C",
      suggestion_level: score >= 80 ? "A" : score >= 65 ? "B" : "C",
      decision_notes: "基于已授权店铺的真实订单和商品数据生成，建议人工复核标题、价格、库存和广告承接。",
      risk_level: riskLevel,
      risk_score: riskLevel === "high" ? 80 : riskLevel === "medium" ? 55 : 25,
      reason: "该商品已出现在真实订单或真实商品清单中，可作为今天人工判断的候选项。",
    };
  });

  const productMap = new Map(products.map((item) => [item.product_uid, item]));
  const todayOpportunities: OpportunityProductItem[] = opportunityScore
    .map((score) => {
      const product = productMap.get(score.product_uid);
      return {
        product_uid: score.product_uid,
        platform: SHOPEE_PLATFORM,
        title_current: product?.title_current ?? score.product_uid,
        price_amount: product?.price_amount ?? 0,
        rating: product?.rating ?? 0,
        sold_count_text: product?.sold_count_text ?? "-",
        market_score: score.market_score,
        opportunity_score: score.opportunity_score,
        recommendation_level: score.recommendation_level ?? score.suggestion_level,
        decision_notes: score.decision_notes ?? score.reason,
        risk_level: score.risk_level,
        risk_score: score.risk_score ?? 0,
      };
    })
    .sort((left, right) => right.opportunity_score - left.opportunity_score);

  const keywordOpportunities: KeywordOpportunityItem[] = marketScore.map((item) => ({
    keyword_uid: item.keyword_uid,
    keyword: item.keyword,
    category_hint: "Shopee BR",
    market_demand_score: item.market_demand_score,
    competition_score: item.competition_score,
    trend_score: item.trend_score,
    total_score: item.total_score,
    platform: SHOPEE_PLATFORM,
  }));

  const riskAlerts: OpportunityRiskAlert[] = inventory.inventory_risks.map((risk) => ({
    risk_id: `opportunity_${risk.risk_id}`,
    risk_type: risk.risk_type,
    risk_level: risk.risk_level,
    affected_product: productMap.get(risk.product_uid)?.title_current ?? risk.product_uid,
    platform: SHOPEE_PLATFORM,
    product_uid: risk.product_uid,
    reason: risk.risk_reason,
    suggested_action: risk.suggested_action,
  }));

  return {
    source,
    products,
    keywords,
    market_score: marketScore,
    opportunity_score: opportunityScore,
    today_opportunities: todayOpportunities,
    keyword_opportunities: keywordOpportunities,
    risk_alerts: riskAlerts,
  };
}

function buildAnalysis(
  opportunities: OpportunitiesApiResponse,
  inventory: InventoryApiResponse,
  source: ShopeeDataSource,
): AnalysisApiResponse {
  const opportunityAnalysis: OpportunityAnalysisItem[] = opportunities.today_opportunities.slice(0, 20).map((item) => ({
    analysis_id: `analysis_real_${item.product_uid}`,
    product_uid: item.product_uid,
    platform: "Shopee",
    opportunity_score: item.opportunity_score,
    risk_level: item.risk_level,
    analysis_summary: "真实订单/商品数据已进入分析范围。",
    analysis_reason: "系统根据授权店铺读取到的订单、商品和库存字段生成初步经营判断。",
    recommendation: "先由运营人工复核链接质量、库存承接和广告承接，再进入审批或执行队列。",
  }));

  const riskAnalysis: RiskAnalysisItem[] = inventory.inventory_risks.slice(0, 20).map((item) => ({
    risk_id: `analysis_${item.risk_id}`,
    risk_type: item.risk_type,
    risk_level: item.risk_level,
    product_uid: item.product_uid,
    platform: "Shopee",
    risk_reason: item.risk_reason,
    mitigation_action: item.suggested_action,
  }));

  const aiRecommendations: AiRecommendationItem[] = opportunities.today_opportunities.slice(0, 10).map((item) => ({
    recommendation_id: `recommendation_real_${item.product_uid}`,
    recommendation_type: "real_data_review",
    priority: item.risk_level === "high" ? "P1" : item.recommendation_level === "A" ? "P2" : "P3",
    platform: "Shopee",
    product_uid: item.product_uid,
    action_suggestion: "人工复核该商品的标题、价格、库存和广告承接。",
    expected_impact: "减少人工翻表时间，优先处理已产生真实订单的商品。",
  }));

  return {
    source,
    opportunity_analysis: opportunityAnalysis,
    risk_analysis: riskAnalysis,
    market_analysis: [
      {
        market_score_id: "market_analysis_shopee_real_orders",
        platform: "Shopee",
        category: "Shopee BR 已授权店铺",
        demand_score: opportunities.market_score[0]?.market_demand_score ?? 0,
        competition_score: opportunities.market_score[0]?.competition_score ?? 0,
        trend_direction: "flat",
      },
    ],
    ai_recommendations: aiRecommendations,
  };
}

function taskPriority(riskLevel: RiskLevel, score = 0) {
  if (riskLevel === "high" || score >= 85) return "high" as const;
  if (riskLevel === "medium" || score >= 65) return "medium" as const;
  return "low" as const;
}

function buildTasks(
  agg: ProductAgg[],
  inventory: InventoryApiResponse,
  opportunities: OpportunitiesApiResponse,
  analysis: AnalysisApiResponse,
  source: ShopeeDataSource,
): TasksApiResponse {
  const tasks: TodayTaskItem[] = [];

  for (const risk of inventory.inventory_risks.slice(0, 10)) {
    const product = agg.find((item) => item.productUid === risk.product_uid);
    tasks.push({
      task_id: `task_${risk.risk_id}`,
      task_title: risk.risk_type === "stock_detail_pending" ? "补全 Shopee 库存明细读取" : "核对库存风险商品",
      task_type: "inventory_alert",
      source_module: "inventory",
      impact_type: "inventory",
      title: risk.risk_type === "stock_detail_pending" ? "补全 Shopee 库存明细读取" : "核对库存风险商品",
      summary: risk.risk_reason,
      product_uid: risk.product_uid,
      platform: "Shopee",
      estimated_profit_impact: product?.revenue ?? 0,
      estimated_gmv_impact: product?.revenue ?? 0,
      estimated_inventory_impact: product?.quantity ?? 0,
      priority: taskPriority(risk.risk_level),
      risk_level: risk.risk_level,
      expected_impact: "避免库存字段不完整导致运营误判。",
      suggested_action: risk.suggested_action,
      created_at: nowIso(),
      href: "/inventory",
    });
  }

  for (const opportunity of opportunities.today_opportunities.slice(0, 10)) {
    const product = agg.find((item) => item.productUid === opportunity.product_uid);
    tasks.push({
      task_id: `task_opportunity_${opportunity.product_uid}`,
      task_title: "复核真实订单商品机会",
      task_type: "opportunity_follow_up",
      source_module: "opportunity",
      impact_type: "gmv",
      title: "复核真实订单商品机会",
      summary: opportunity.decision_notes,
      product_uid: opportunity.product_uid,
      platform: "Shopee",
      estimated_profit_impact: 0,
      estimated_gmv_impact: product?.revenue ?? opportunity.price_amount,
      estimated_inventory_impact: product?.quantity ?? 0,
      priority: taskPriority(opportunity.risk_level, opportunity.opportunity_score),
      risk_level: opportunity.risk_level,
      expected_impact: "优先处理已经产生真实订单或高机会分的商品。",
      suggested_action: "检查链接标题、价格、主图、库存和广告承接，确认是否进入审批。",
      created_at: nowIso(),
      href: "/opportunities",
    });
  }

  for (const recommendation of analysis.ai_recommendations.slice(0, 5)) {
    tasks.push({
      task_id: `task_analysis_${recommendation.recommendation_id}`,
      task_title: "处理数据分析建议",
      task_type: "analysis_review",
      source_module: "analysis",
      impact_type: "risk",
      title: "处理数据分析建议",
      summary: recommendation.action_suggestion,
      product_uid: recommendation.product_uid,
      platform: recommendation.platform,
      estimated_profit_impact: 0,
      estimated_gmv_impact: 0,
      estimated_inventory_impact: 0,
      priority: recommendation.priority === "P1" ? "high" : recommendation.priority === "P2" ? "medium" : "low",
      risk_level: recommendation.priority === "P1" ? "high" : recommendation.priority === "P2" ? "medium" : "low",
      expected_impact: recommendation.expected_impact,
      suggested_action: recommendation.action_suggestion,
      created_at: nowIso(),
      href: "/analysis",
    });
  }

  const uniqueTasks = [...new Map(tasks.map((item) => [item.task_id, item])).values()].sort((left, right) => {
    const priorityDelta = riskRank(right.risk_level) - riskRank(left.risk_level);
    if (priorityDelta !== 0) return priorityDelta;
    return right.estimated_gmv_impact - left.estimated_gmv_impact;
  });

  const topTasks: TopTaskItem[] = uniqueTasks.slice(0, 5).map((task, index) => ({ ...task, rank: index + 1 }));
  const highTasks = uniqueTasks.filter((task) => task.priority === "high");
  const mediumTasks = uniqueTasks.filter((task) => task.priority === "medium");
  const lowTasks = uniqueTasks.filter((task) => task.priority === "low");
  const estimatedProfitImpact = uniqueTasks.reduce((sum, task) => sum + task.estimated_profit_impact, 0);
  const estimatedGmvImpact = uniqueTasks.reduce((sum, task) => sum + task.estimated_gmv_impact, 0);
  const estimatedInventoryImpact = uniqueTasks.reduce((sum, task) => sum + task.estimated_inventory_impact, 0);

  return {
    source,
    overview: {
      total_tasks: uniqueTasks.length,
      high_priority_tasks: highTasks.length,
      medium_priority_tasks: mediumTasks.length,
      low_priority_tasks: lowTasks.length,
      estimated_profit_impact: estimatedProfitImpact,
      estimated_gmv_impact: estimatedGmvImpact,
      estimated_inventory_impact: estimatedInventoryImpact,
    },
    top_tasks: topTasks,
    high_priority_tasks: highTasks,
    medium_priority_tasks: mediumTasks,
    low_priority_tasks: lowTasks,
    all_tasks: uniqueTasks,
    ai_recommendations: analysis.ai_recommendations.map((item) => ({
      recommendation_id: item.recommendation_id,
      recommendation_type: item.recommendation_type,
      recommendation_summary: item.action_suggestion,
      recommendation_reason: "来自真实 Shopee 店铺数据的规则分析。",
      expected_benefit: item.expected_impact,
      approval_required: true,
      priority: item.priority,
      href: "/analysis",
    })),
    source_stats: {
      inventory_tasks: uniqueTasks.filter((item) => item.source_module === "inventory").length,
      profit_tasks: uniqueTasks.filter((item) => item.source_module === "profit").length,
      approval_tasks: uniqueTasks.filter((item) => item.source_module === "approval").length,
      analysis_tasks: uniqueTasks.filter((item) => item.source_module === "analysis").length,
      opportunity_tasks: uniqueTasks.filter((item) => item.source_module === "opportunity").length,
    },
    impact_stats: {
      total_profit_impact: estimatedProfitImpact,
      total_gmv_impact: estimatedGmvImpact,
      total_inventory_impact: estimatedInventoryImpact,
    },
  };
}

function buildDashboard(
  products: Product[],
  agg: ProductAgg[],
  profit: ProfitApiResponse,
  inventory: InventoryApiResponse,
  opportunities: OpportunitiesApiResponse,
  analysis: AnalysisApiResponse,
  tasks: TasksApiResponse,
  generatedAt: string,
  source: ShopeeDataSource,
  fallbackGmv = 0,
): DashboardSummaryApiResponse {
  const productGmv = agg.reduce((sum, item) => sum + item.revenue, 0);
  const totalGmv = productGmv > 0 ? productGmv : fallbackGmv;
  const highRiskCount =
    inventory.inventory_risks.filter((item) => item.risk_level === "high").length +
    opportunities.risk_alerts.filter((item) => item.risk_level === "high").length;

  const dashboardSummary: DashboardSummary = {
    reporting_date: generatedAt.slice(0, 10),
    market_code: "br",
    core_metrics: {
      yesterday_net_profit: 0,
      month_net_profit: 0,
      net_margin: 0,
      cash_flow: totalGmv,
      inventory_turnover_days: inventory.snapshot.inventory_turnover_days,
      pending_approval_count: 0,
    },
    operating_status: {
      today_opportunity_count: opportunities.today_opportunities.length,
      high_priority_recommendation_count: analysis.ai_recommendations.filter((item) => item.priority === "P1").length,
      stockout_risk_count: inventory.snapshot.stockout_risk_count,
      low_profit_product_count: profit.product_profit.filter((item) => item.net_margin < 0.12 && item.revenue > 0).length,
      high_risk_alert_count: highRiskCount,
    },
    profit_and_cash: {
      yesterday_net_profit: 0,
      month_net_profit: 0,
      net_margin: 0,
      cash_flow: totalGmv,
      profit_risk_summary: profit.profit_risk,
    },
    inventory_risk: {
      inventory_turnover_days: inventory.snapshot.inventory_turnover_days,
      stock_health_score: inventory.snapshot.stock_health_score,
      stockout_risk_count: inventory.snapshot.stockout_risk_count,
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
      best_strategy: "等待决策复盘数据",
      worst_strategy: "等待决策复盘数据",
    },
    self_optimization: {
      rule_hit_rate: 0,
      rule_bias_rate: 0,
      recommendation_count: 0,
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
      top_opportunities: opportunities.today_opportunities.slice(0, 4).map((item) => ({
        product_uid: item.product_uid,
        platform: item.platform,
        title_current: item.title_current,
        price_amount: item.price_amount,
        opportunity_score: item.opportunity_score,
        market_score: item.market_score,
        recommendation_level: item.recommendation_level,
        decision_notes: item.decision_notes,
      })),
      top_risks: [
        ...inventory.inventory_risks.map((item) => ({
          risk_id: item.risk_id,
          source: "inventory" as const,
          risk_type: item.risk_type,
          risk_level: item.risk_level,
          product_uid: item.product_uid,
          product_name: products.find((product) => product.product_uid === item.product_uid)?.title_current ?? item.product_uid,
          platform: item.platform,
          summary: item.risk_reason,
          suggested_action: item.suggested_action,
        })),
        ...opportunities.risk_alerts.map((item) => ({
          risk_id: item.risk_id,
          source: "opportunity" as const,
          risk_type: item.risk_type,
          risk_level: item.risk_level,
          product_uid: item.product_uid,
          product_name: item.affected_product,
          platform: item.platform,
          summary: item.reason,
          suggested_action: item.suggested_action,
        })),
      ]
        .sort((left, right) => riskRank(right.risk_level) - riskRank(left.risk_level))
        .slice(0, 4),
      recommended_actions: analysis.ai_recommendations.slice(0, 4).map((item) => ({
        action_id: item.recommendation_id,
        recommendation_type: item.recommendation_type,
        priority: item.priority,
        platform: item.platform,
        product_uid: item.product_uid,
        product_name: products.find((product) => product.product_uid === item.product_uid)?.title_current ?? item.product_uid,
        action_suggestion: item.action_suggestion,
        expected_impact: item.expected_impact,
      })),
    },
    system_status: {
      data_source: source,
      last_updated_at: generatedAt,
      api_status: "healthy",
      database_status: "connected",
    },
  };

  const crawlLogs: CrawlLog[] = [
    {
      crawl_run_id: `shopee_real_read_${generatedAt}`,
      platform: "Shopee",
      market_code: "br",
      started_at: generatedAt,
      finished_at: generatedAt,
      status: "success",
      records_seen: products.length,
      records_inserted: products.length,
      message: "Shopee 只读接口已读取真实订单、商品和库存数据。",
    },
  ];

  const reports: DataQualityReport[] = [
    {
      report_id: "shopee_real_data_quality",
      report_date: generatedAt,
      source_table: "shopee_readonly",
      check_name: "real_store_data",
      severity: source === "shopee_api" ? "low" : "medium",
      quality_status: source === "shopee_api" ? "pass" : "warning",
      details: source === "shopee_api" ? "已读取授权店铺真实数据。" : "当前未直接返回 Shopee API 数据。",
    },
  ];

  return {
    source,
    products,
    action_queue: [],
    crawl_logs: crawlLogs,
    data_quality_report: reports,
    dashboard_summary: dashboardSummary,
  };
}

function buildDailyOps(
  tasks: TasksApiResponse,
  inventory: InventoryApiResponse,
  opportunities: OpportunitiesApiResponse,
  generatedAt: string,
  source: ShopeeDataSource,
  fallbackGmv = 0,
): DailyOpsApiResponse {
  const coreGoals = tasks.top_tasks.slice(0, 3).map((task) => ({
    goal_id: `daily_${task.task_id}`,
    rank: task.rank,
    title: task.task_title,
    source: task.source_module === "opportunity" ? ("decision_engine" as const) : ("tasks" as const),
    profit_impact: task.estimated_profit_impact,
    risk_level: task.risk_level,
    priority: task.priority,
    reason: task.summary,
    href: task.href,
  }));

  return {
    source,
    generated_at: generatedAt,
    core_goals: coreGoals,
    risk_overview: {
      stockout_risk_count: inventory.snapshot.stockout_risk_count,
      profit_decline_risk_count: 0,
      high_risk_product_count: inventory.inventory_risks.filter((item) => item.risk_level === "high").length,
      approval_backlog_count: 0,
      top_risks: inventory.inventory_risks.slice(0, 5).map((item) => ({
        risk_id: item.risk_id,
        risk_type: item.risk_type,
        risk_level: item.risk_level,
        title: item.risk_reason,
        source: "库存中心",
        suggested_action: item.suggested_action,
        href: "/inventory",
      })),
    },
    opportunities: opportunities.today_opportunities.slice(0, 5).map((item) => ({
      opportunity_id: `daily_opportunity_${item.product_uid}`,
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
      expected_gmv: Math.max(tasks.impact_stats.total_gmv_impact, fallbackGmv),
      expected_profit: tasks.impact_stats.total_profit_impact,
      stock_health_score: inventory.snapshot.stock_health_score,
      decision_success_rate: 0,
    },
    guardrails: ["仅使用 Shopee 授权店铺真实只读数据生成运营视图，不自动改价、不上架、不补货。"],
  };
}

async function createBundle(): Promise<RealShopeeBusinessBundle | null> {
  const [ordersResponse, productsResponse, inventoryResponse] = await Promise.all([
    getShopeeOrders(),
    getShopeeProducts(),
    getShopeeInventory(),
  ]);

  const orders = (ordersResponse.data as RealOrder[]).map(normalizeOrder);
  const productsRaw = productsResponse.data as RealProduct[];
  const inventoryRaw = inventoryResponse.data as RealInventoryItem[];

  if (orders.length === 0 && productsRaw.length === 0 && inventoryRaw.length === 0) {
    return null;
  }

  const generatedAt = nowIso();
  const syncedAt = latest([
    ordersResponse.synced_at ?? "",
    productsResponse.synced_at ?? "",
    inventoryResponse.synced_at ?? "",
    ordersResponse.timestamp,
    productsResponse.timestamp,
    inventoryResponse.timestamp,
  ]) ?? generatedAt;
  const source =
    ordersResponse.source === "shopee_api" ||
    productsResponse.source === "shopee_api" ||
    inventoryResponse.source === "shopee_api"
      ? "shopee_api"
      : ordersResponse.source;

  const productAgg = aggregateProducts(orders, productsRaw, inventoryRaw);
  const orderRevenue = totalOrderRevenue(orders);
  const products = buildProducts(productAgg, generatedAt);
  const inventory = buildInventory(productAgg, generatedAt, source);
  const profit = buildProfit(productAgg, inventory.snapshot, generatedAt, source, orderRevenue);
  const opportunities = buildOpportunities(products, productAgg, inventory, source);
  const analysis = buildAnalysis(opportunities, inventory, source);
  const tasks = buildTasks(productAgg, inventory, opportunities, analysis, source);
  const dashboard = buildDashboard(products, productAgg, profit, inventory, opportunities, analysis, tasks, generatedAt, source, orderRevenue);
  const dailyOps = buildDailyOps(tasks, inventory, opportunities, generatedAt, source, orderRevenue);

  return {
    source,
    generatedAt,
    syncedAt,
    orders,
    productsRaw,
    inventoryRaw,
    productAgg,
    products,
    profit,
    inventory,
    opportunities,
    analysis,
    tasks,
    dashboard,
    dailyOps,
  };
}

export async function getRealShopeeBusinessBundle() {
  const now = Date.now();
  if (cachedBundle && cachedBundle.expiresAt > now) return cachedBundle.value;
  try {
    const value = await createBundle();
    cachedBundle = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  } catch {
    cachedBundle = { value: null, expiresAt: now + 5_000 };
    return null;
  }
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
