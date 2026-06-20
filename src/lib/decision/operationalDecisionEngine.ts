import {
  getShopeeAnalyticsResponse,
  type ShopeeAnalyticsResponse,
  type ShopeeProductHealthItem,
} from "@/lib/analytics/shopeeIntelligenceEngine";
import { recordOperationLog } from "@/lib/users";
import type { OperationLogAction, RiskLevel, ShopeeDataSource } from "@/types";

export type OperationalDecisionType =
  | "REPLENISH_STOCK"
  | "STOP_LOSS"
  | "BOOST_SALES"
  | "MONITOR"
  | "IGNORE";

export type OperationalDecision = {
  product_id: string;
  decision_type: OperationalDecisionType;
  priority_score: number;
  action_recommendation: string;
  expected_impact: string;
  risk_level: RiskLevel;
  source_signals: string[];
  trace_id: string;
  readonly: true;
};

export type OperationalDecisionResponse = {
  source: ShopeeDataSource;
  generated_at: string;
  decisions: OperationalDecision[];
  top_actions: OperationalDecision[];
  risk_actions: OperationalDecision[];
  opportunity_actions: OperationalDecision[];
  readonly: true;
};

function nowIso() {
  return new Date().toISOString();
}

function bounded(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function riskScore(item: ShopeeProductHealthItem) {
  return bounded(Math.max(item.inventory_risk_score, 100 - item.health_score));
}

function trendMomentum(item: ShopeeProductHealthItem) {
  return bounded(50 + item.seven_day_change_rate * 100);
}

function priorityScore(item: ShopeeProductHealthItem) {
  return bounded(
    item.revenue_impact_score * 0.4 +
      riskScore(item) * 0.3 +
      item.stock_pressure_score * 0.2 +
      trendMomentum(item) * 0.1,
  );
}

function hasFlag(item: ShopeeProductHealthItem, flag: ShopeeProductHealthItem["anomaly_flags"][number]) {
  return item.anomaly_flags.includes(flag);
}

function riskLevelFor(item: ShopeeProductHealthItem, decisionType: OperationalDecisionType): RiskLevel {
  if (
    decisionType === "REPLENISH_STOCK" ||
    decisionType === "STOP_LOSS" ||
    item.risk_level === "high" ||
    riskScore(item) >= 70
  ) {
    return "high";
  }

  if (item.risk_level === "medium" || riskScore(item) >= 40 || decisionType === "MONITOR") {
    return "medium";
  }

  return "low";
}

function isLowConversionHighRevenue(item: ShopeeProductHealthItem) {
  return (
    item.revenue_impact_score >= 60 &&
    (hasFlag(item, "dead_stock") ||
      (item.available_stock >= 80 && item.current_7d_units <= 3) ||
      item.seven_day_change_rate <= 0.05)
  );
}

function decisionTypeFor(item: ShopeeProductHealthItem): OperationalDecisionType {
  if (item.inventory_risk_score > 70 || hasFlag(item, "low_stock")) return "REPLENISH_STOCK";
  if (item.health_score < 40) return "STOP_LOSS";
  if (isLowConversionHighRevenue(item)) return "BOOST_SALES";
  if (Math.abs(item.seven_day_change_rate) >= 0.08 || hasFlag(item, "sales_drop") || hasFlag(item, "revenue_volatility")) {
    return "MONITOR";
  }
  return "IGNORE";
}

function sourceSignals(item: ShopeeProductHealthItem) {
  return [
    `health_score=${item.health_score}`,
    `inventory_risk_score=${item.inventory_risk_score}`,
    `revenue_impact_score=${item.revenue_impact_score}`,
    `stock_pressure_score=${item.stock_pressure_score}`,
    `trend_momentum=${trendMomentum(item)}`,
    ...item.anomaly_flags.map((flag) => `anomaly=${flag}`),
  ];
}

function recommendationFor(item: ShopeeProductHealthItem, decisionType: OperationalDecisionType) {
  switch (decisionType) {
    case "REPLENISH_STOCK":
      return "建议进入人工补货评估，核对供应周期、现金流和可售库存后再处理。";
    case "STOP_LOSS":
      return "建议进入止损复盘，检查售价、广告、库存占用和商品健康度。";
    case "BOOST_SALES":
      return "建议提升销量测试，优先检查内容、流量入口和促销空间。";
    case "MONITOR":
      return "建议持续观察，等待更多销量、库存和收入信号后再做审批动作。";
    case "IGNORE":
      return "暂不建议处理，保持只读观察。";
  }
}

function expectedImpactFor(item: ShopeeProductHealthItem, decisionType: OperationalDecisionType) {
  const projected30dGmv = Number(((item.current_7d_gmv / 7) * 30).toFixed(2));

  switch (decisionType) {
    case "REPLENISH_STOCK":
      return `降低断货风险，保护约 R$${projected30dGmv.toLocaleString("en-US")} 的30日销售机会。`;
    case "STOP_LOSS":
      return `减少低健康商品继续占用库存，当前健康分 ${item.health_score}/100。`;
    case "BOOST_SALES":
      return `放大高收入潜力，收入影响评分 ${item.revenue_impact_score}/100。`;
    case "MONITOR":
      return `控制波动风险，7日销量变化率 ${(item.seven_day_change_rate * 100).toFixed(1)}%。`;
    case "IGNORE":
      return "当前未发现明显经营影响。";
  }
}

function toDecision(item: ShopeeProductHealthItem): OperationalDecision {
  const decisionType = decisionTypeFor(item);

  return {
    product_id: item.product_id,
    decision_type: decisionType,
    priority_score: priorityScore(item),
    action_recommendation: recommendationFor(item, decisionType),
    expected_impact: expectedImpactFor(item, decisionType),
    risk_level: riskLevelFor(item, decisionType),
    source_signals: sourceSignals(item),
    trace_id: `decision_${item.product_id}_${decisionType.toLowerCase()}`,
    readonly: true,
  };
}

async function writeDecisionLog(params: {
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
      target_type: "operational_decision_engine",
      target_id: params.target_id,
      summary: params.summary,
      metadata: {
        readonly: true,
        ...params.metadata,
      },
    });
  } catch {
    // Decision logs are observability-only and must not block read-only suggestions.
  }
}

export async function generateProductDecisions(
  analytics?: ShopeeAnalyticsResponse,
): Promise<OperationalDecision[]> {
  const sourceAnalytics = analytics ?? (await getShopeeAnalyticsResponse());
  return sourceAnalytics.product_health_score.map(toDecision);
}

export async function generateInventoryDecisions(
  analytics?: ShopeeAnalyticsResponse,
): Promise<OperationalDecision[]> {
  const decisions = await generateProductDecisions(analytics);
  return rankOpportunities(
    decisions.filter((decision) => decision.decision_type === "REPLENISH_STOCK"),
  );
}

export async function generateRevenueDecisions(
  analytics?: ShopeeAnalyticsResponse,
): Promise<OperationalDecision[]> {
  const decisions = await generateProductDecisions(analytics);
  return rankOpportunities(
    decisions.filter((decision) => decision.decision_type === "BOOST_SALES" || decision.decision_type === "STOP_LOSS"),
  );
}

export function rankOpportunities(decisions: OperationalDecision[]) {
  return [...decisions].sort((left, right) => {
    const scoreDelta = right.priority_score - left.priority_score;
    if (scoreDelta !== 0) return scoreDelta;
    return riskRank(right.risk_level) - riskRank(left.risk_level);
  });
}

function riskRank(level: RiskLevel) {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

export async function getOperationalDecisionResponse(): Promise<OperationalDecisionResponse> {
  const analytics = await getShopeeAnalyticsResponse();
  const ranked = rankOpportunities(await generateProductDecisions(analytics));
  const topActions = ranked.filter((decision) => decision.decision_type !== "IGNORE").slice(0, 10);
  const riskActions = ranked.filter((decision) => decision.risk_level === "high").slice(0, 10);
  const opportunityActions = ranked.filter((decision) => decision.decision_type === "BOOST_SALES").slice(0, 10);

  await writeDecisionLog({
    action_type: "decision_generated",
    target_id: "operational_decisions",
    summary: "Operational decision suggestions generated from Shopee intelligence signals.",
    metadata: {
      source: analytics.source,
      decision_count: ranked.length,
      top_action_count: topActions.length,
      risk_action_count: riskActions.length,
      opportunity_action_count: opportunityActions.length,
    },
  });

  await Promise.all(
    topActions.slice(0, 5).map((decision, index) =>
      writeDecisionLog({
        action_type: "action_ranked",
        target_id: decision.product_id,
        summary: `Read-only operational action ranked at position ${index + 1}.`,
        metadata: decision,
      }),
    ),
  );

  await Promise.all(
    opportunityActions.slice(0, 5).map((decision) =>
      writeDecisionLog({
        action_type: "opportunity_detected",
        target_id: decision.product_id,
        summary: "Read-only sales opportunity detected from Shopee intelligence signals.",
        metadata: decision,
      }),
    ),
  );

  return {
    source: analytics.source,
    generated_at: nowIso(),
    decisions: ranked,
    top_actions: topActions,
    risk_actions: riskActions,
    opportunity_actions: opportunityActions,
    readonly: true,
  };
}

export async function getTopActionsResponse() {
  const response = await getOperationalDecisionResponse();
  return {
    source: response.source,
    generated_at: response.generated_at,
    top_actions: response.top_actions,
    readonly: true,
  };
}

export async function getRiskActionsResponse() {
  const response = await getOperationalDecisionResponse();
  return {
    source: response.source,
    generated_at: response.generated_at,
    risk_actions: response.risk_actions,
    readonly: true,
  };
}

export async function getOpportunityActionsResponse() {
  const response = await getOperationalDecisionResponse();
  return {
    source: response.source,
    generated_at: response.generated_at,
    opportunity_actions: response.opportunity_actions,
    readonly: true,
  };
}
