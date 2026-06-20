import { getLatestShopeeSnapshot, type ShopeeSnapshotBundle } from "@/lib/connectors/shopeeSyncEngine";
import { recordOperationLog } from "@/lib/users";
import type { NormalizedShopeeInventoryItem, NormalizedShopeeOrder, NormalizedShopeeProduct } from "@/lib/connectors/shopee";
import type { OperationLogAction, RiskLevel, ShopeeDataSource } from "@/types";

type ProductOrderStats = {
  current_units: number;
  previous_units: number;
  current_gmv: number;
  previous_gmv: number;
  total_units: number;
  total_gmv: number;
};

export type ShopeeSalesTrend = {
  current_7d_units: number;
  previous_7d_units: number;
  seven_day_change_rate: number;
  current_7d_gmv: number;
  previous_7d_gmv: number;
  gmv_change_rate: number;
  trend_direction: "up" | "flat" | "down";
};

export type ShopeeAnomalyFlag = {
  flag: "sales_drop" | "low_stock" | "revenue_volatility" | "dead_stock";
  product_id: string;
  severity: RiskLevel;
  reason: string;
};

export type ShopeeProductHealthItem = {
  product_id: string;
  title: string;
  health_score: number;
  risk_level: RiskLevel;
  revenue_impact_score: number;
  stock_pressure_score: number;
  inventory_risk_score: number;
  current_7d_units: number;
  previous_7d_units: number;
  seven_day_change_rate: number;
  current_7d_gmv: number;
  available_stock: number;
  anomaly_flags: ShopeeAnomalyFlag["flag"][];
};

export type ShopeeAnalyticsResponse = {
  source: ShopeeDataSource;
  generated_at: string;
  sales_trend: ShopeeSalesTrend;
  product_health_score: ShopeeProductHealthItem[];
  inventory_risk_score: Array<{
    product_id: string;
    title: string;
    inventory_risk_score: number;
    risk_level: RiskLevel;
    available_stock: number;
    stock_pressure_score: number;
  }>;
  revenue_prediction: Array<{
    product_id: string;
    title: string;
    revenue_impact_score: number;
    current_7d_gmv: number;
    projected_30d_gmv: number;
  }>;
  anomaly_flags: ShopeeAnomalyFlag[];
  readonly: true;
};

function nowIso() {
  return new Date().toISOString();
}

function bounded(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function rate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function riskLevel(score: number): RiskLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function trendDirection(changeRate: number): ShopeeSalesTrend["trend_direction"] {
  if (changeRate > 0.08) return "up";
  if (changeRate < -0.08) return "down";
  return "flat";
}

function parseTime(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function referenceTime(orders: NormalizedShopeeOrder[]) {
  const latest = orders
    .map((order) => parseTime(order.created_at))
    .filter((value): value is number => value !== null)
    .sort((left, right) => right - left)[0];

  return latest ?? Date.now();
}

function productOrderStats(productId: string, orders: NormalizedShopeeOrder[]): ProductOrderStats {
  const endTime = referenceTime(orders);
  const currentStart = endTime - 7 * 24 * 60 * 60 * 1000;
  const previousStart = endTime - 14 * 24 * 60 * 60 * 1000;

  return orders
    .filter((order) => order.product_id === productId)
    .reduce<ProductOrderStats>(
      (stats, order) => {
        const createdAt = parseTime(order.created_at);
        const gmv = order.quantity * order.price;
        stats.total_units += order.quantity;
        stats.total_gmv += gmv;

        if (createdAt !== null && createdAt >= currentStart && createdAt <= endTime) {
          stats.current_units += order.quantity;
          stats.current_gmv += gmv;
        } else if (createdAt !== null && createdAt >= previousStart && createdAt < currentStart) {
          stats.previous_units += order.quantity;
          stats.previous_gmv += gmv;
        }

        return stats;
      },
      {
        current_units: 0,
        previous_units: 0,
        current_gmv: 0,
        previous_gmv: 0,
        total_units: 0,
        total_gmv: 0,
      },
    );
}

function inventoryForProduct(productId: string, inventory: NormalizedShopeeInventoryItem[]) {
  return inventory.find((item) => item.product_id === productId);
}

function salesChangeRate(stats: ProductOrderStats) {
  if (stats.previous_units <= 0) return stats.current_units > 0 ? 1 : 0;
  return rate(stats.current_units - stats.previous_units, stats.previous_units);
}

function gmvChangeRate(stats: ProductOrderStats) {
  if (stats.previous_gmv <= 0) return stats.current_gmv > 0 ? 1 : 0;
  return rate(stats.current_gmv - stats.previous_gmv, stats.previous_gmv);
}

export function analyzeSalesTrend(snapshot: ShopeeSnapshotBundle): ShopeeSalesTrend {
  const totals = snapshot.products.data.reduce(
    (summary, product) => {
      const stats = productOrderStats(product.product_id, snapshot.orders.data);
      summary.current_units += stats.current_units;
      summary.previous_units += stats.previous_units;
      summary.current_gmv += stats.current_gmv;
      summary.previous_gmv += stats.previous_gmv;
      return summary;
    },
    {
      current_units: 0,
      previous_units: 0,
      current_gmv: 0,
      previous_gmv: 0,
    },
  );
  const sevenDayChangeRate =
    totals.previous_units <= 0 ? (totals.current_units > 0 ? 1 : 0) : rate(totals.current_units - totals.previous_units, totals.previous_units);
  const revenueChangeRate =
    totals.previous_gmv <= 0 ? (totals.current_gmv > 0 ? 1 : 0) : rate(totals.current_gmv - totals.previous_gmv, totals.previous_gmv);

  return {
    current_7d_units: totals.current_units,
    previous_7d_units: totals.previous_units,
    seven_day_change_rate: sevenDayChangeRate,
    current_7d_gmv: Number(totals.current_gmv.toFixed(2)),
    previous_7d_gmv: Number(totals.previous_gmv.toFixed(2)),
    gmv_change_rate: revenueChangeRate,
    trend_direction: trendDirection(sevenDayChangeRate),
  };
}

export function computeInventoryRiskScore(
  product: NormalizedShopeeProduct,
  inventory: NormalizedShopeeInventoryItem | undefined,
  stats: ProductOrderStats,
) {
  const availableStock = inventory?.available_stock ?? product.stock;
  const recentDailyUnits = stats.current_units / 7;
  const daysOfStock = recentDailyUnits > 0 ? availableStock / recentDailyUnits : availableStock > 100 ? 120 : 30;
  const lowStockPenalty = availableStock < 10 ? 80 : availableStock < 25 ? 45 : 10;
  const velocityPenalty = daysOfStock < 7 ? 55 : daysOfStock < 14 ? 35 : 5;
  const overstockPenalty = availableStock > 250 && stats.current_units <= 3 ? 65 : 0;

  return bounded(Math.max(lowStockPenalty, velocityPenalty, overstockPenalty));
}

export function computeRevenueImpact(
  product: NormalizedShopeeProduct,
  stats: ProductOrderStats,
) {
  const projected30DayGmv = stats.current_gmv > 0 ? (stats.current_gmv / 7) * 30 : product.price * Math.min(product.sales, 30);
  return bounded(rate(projected30DayGmv, 10_000) * 100);
}

function stockPressureScore(
  product: NormalizedShopeeProduct,
  inventory: NormalizedShopeeInventoryItem | undefined,
  stats: ProductOrderStats,
) {
  const availableStock = inventory?.available_stock ?? product.stock;
  const lowStockPressure = availableStock < 10 ? 95 : availableStock < 25 ? 65 : 15;
  const deadStockPressure = availableStock > 200 && stats.current_units <= 3 ? 85 : 0;
  return bounded(Math.max(lowStockPressure, deadStockPressure));
}

export function computeProductHealthScore(
  product: NormalizedShopeeProduct,
  orders: NormalizedShopeeOrder[],
  inventory: NormalizedShopeeInventoryItem[],
) {
  const productInventory = inventoryForProduct(product.product_id, inventory);
  const stats = productOrderStats(product.product_id, orders);
  const inventoryRiskScore = computeInventoryRiskScore(product, productInventory, stats);
  const revenueImpactScore = computeRevenueImpact(product, stats);
  const pressureScore = stockPressureScore(product, productInventory, stats);
  const salesDropPenalty = salesChangeRate(stats) < -0.3 ? 30 : 0;
  const healthScore = bounded(100 - inventoryRiskScore * 0.45 - pressureScore * 0.25 - salesDropPenalty + revenueImpactScore * 0.15);

  return {
    product_id: product.product_id,
    title: product.title,
    health_score: healthScore,
    risk_level: riskLevel(100 - healthScore),
    revenue_impact_score: revenueImpactScore,
    stock_pressure_score: pressureScore,
    inventory_risk_score: inventoryRiskScore,
    current_7d_units: stats.current_units,
    previous_7d_units: stats.previous_units,
    seven_day_change_rate: salesChangeRate(stats),
    current_7d_gmv: Number(stats.current_gmv.toFixed(2)),
    available_stock: productInventory?.available_stock ?? product.stock,
    anomaly_flags: [] as ShopeeAnomalyFlag["flag"][],
  } satisfies ShopeeProductHealthItem;
}

export function detectAnomalies(snapshot: ShopeeSnapshotBundle): ShopeeAnomalyFlag[] {
  const flags: ShopeeAnomalyFlag[] = [];

  snapshot.products.data.forEach((product) => {
    const inventory = inventoryForProduct(product.product_id, snapshot.inventory.data);
    const stats = productOrderStats(product.product_id, snapshot.orders.data);
    const availableStock = inventory?.available_stock ?? product.stock;
    const changeRate = salesChangeRate(stats);
    const revenueChange = gmvChangeRate(stats);
    const conversionProxy = rate(stats.current_units, Math.max(product.sales, 1));

    if (changeRate < -0.3) {
      flags.push({
        flag: "sales_drop",
        product_id: product.product_id,
        severity: "high",
        reason: "7-day unit sales declined by more than 30%.",
      });
    }

    if (availableStock < 10) {
      flags.push({
        flag: "low_stock",
        product_id: product.product_id,
        severity: "high",
        reason: "Available stock is below 10 units.",
      });
    }

    if (Math.abs(revenueChange) > 0.4 && stats.previous_gmv > 0) {
      flags.push({
        flag: "revenue_volatility",
        product_id: product.product_id,
        severity: Math.abs(revenueChange) > 0.7 ? "high" : "medium",
        reason: "GMV changed by more than 40% compared with the previous 7-day window.",
      });
    }

    if (conversionProxy < 0.01 && availableStock > 200) {
      flags.push({
        flag: "dead_stock",
        product_id: product.product_id,
        severity: "medium",
        reason: "Low conversion proxy combined with high stock suggests dead stock pressure.",
      });
    }
  });

  return flags;
}

async function writeAnalyticsLog(params: {
  action_type: OperationLogAction;
  target_id: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await recordOperationLog({
      action_type: params.action_type,
      actor_user_id: "system",
      actor_email: "system@local",
      target_type: "shopee_intelligence_engine",
      target_id: params.target_id,
      summary: params.summary,
      metadata: {
        readonly: true,
        ...params.metadata,
      },
    });
  } catch {
    // Analytics logs must not break read-only analysis.
  }
}

export async function getShopeeAnalyticsResponse(): Promise<ShopeeAnalyticsResponse> {
  const snapshot = await getLatestShopeeSnapshot();
  const salesTrend = analyzeSalesTrend(snapshot);
  const anomalyFlags = detectAnomalies(snapshot);
  const flagsByProduct = new Map<string, ShopeeAnomalyFlag["flag"][]>();

  anomalyFlags.forEach((flag) => {
    flagsByProduct.set(flag.product_id, [...(flagsByProduct.get(flag.product_id) ?? []), flag.flag]);
  });

  const healthItems = snapshot.products.data
    .map((product) => {
      const item = computeProductHealthScore(product, snapshot.orders.data, snapshot.inventory.data);
      return {
        ...item,
        anomaly_flags: flagsByProduct.get(product.product_id) ?? [],
      };
    })
    .sort((left, right) => left.health_score - right.health_score);

  await writeAnalyticsLog({
    action_type: "analytics_run",
    target_id: "shopee_analytics",
    summary: "Shopee snapshot intelligence analysis completed.",
    metadata: {
      product_count: healthItems.length,
      anomaly_count: anomalyFlags.length,
      source: snapshot.source,
    },
  });

  await Promise.all(
    anomalyFlags.slice(0, 20).map((flag) =>
      writeAnalyticsLog({
        action_type: flag.flag === "low_stock" || flag.flag === "dead_stock" ? "risk_flagged" : "anomaly_detected",
        target_id: flag.product_id,
        summary: `Shopee analytics flag detected: ${flag.flag}.`,
        metadata: flag,
      }),
    ),
  );

  return {
    source: snapshot.source,
    generated_at: nowIso(),
    sales_trend: salesTrend,
    product_health_score: healthItems,
    inventory_risk_score: healthItems
      .map((item) => ({
        product_id: item.product_id,
        title: item.title,
        inventory_risk_score: item.inventory_risk_score,
        risk_level: item.risk_level,
        available_stock: item.available_stock,
        stock_pressure_score: item.stock_pressure_score,
      }))
      .sort((left, right) => right.inventory_risk_score - left.inventory_risk_score),
    revenue_prediction: healthItems
      .map((item) => ({
        product_id: item.product_id,
        title: item.title,
        revenue_impact_score: item.revenue_impact_score,
        current_7d_gmv: item.current_7d_gmv,
        projected_30d_gmv: Number(((item.current_7d_gmv / 7) * 30).toFixed(2)),
      }))
      .sort((left, right) => right.revenue_impact_score - left.revenue_impact_score),
    anomaly_flags: anomalyFlags,
    readonly: true,
  };
}

export async function getShopeeProductHealthResponse() {
  const analytics = await getShopeeAnalyticsResponse();
  return {
    source: analytics.source,
    generated_at: analytics.generated_at,
    product_health_score: analytics.product_health_score,
    readonly: true,
  };
}

export async function getShopeeInventoryRiskResponse() {
  const analytics = await getShopeeAnalyticsResponse();
  return {
    source: analytics.source,
    generated_at: analytics.generated_at,
    inventory_risk_score: analytics.inventory_risk_score,
    anomaly_flags: analytics.anomaly_flags.filter((flag) => flag.flag === "low_stock" || flag.flag === "dead_stock"),
    readonly: true,
  };
}

export async function getShopeeTrendAnalysisResponse() {
  const analytics = await getShopeeAnalyticsResponse();
  return {
    source: analytics.source,
    generated_at: analytics.generated_at,
    sales_trend: analytics.sales_trend,
    revenue_prediction: analytics.revenue_prediction,
    anomaly_flags: analytics.anomaly_flags.filter(
      (flag) => flag.flag === "sales_drop" || flag.flag === "revenue_volatility",
    ),
    readonly: true,
  };
}
