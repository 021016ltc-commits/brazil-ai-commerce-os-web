import { buildProfitRisk } from "@/lib/profit";
import { buildDashboardDecisionFeedbackSummary } from "@/decision_feedback_system/engine";
import type {
  AiRecommendationItem,
  ApiDataSource,
  ApprovalQueueItem,
  CrawlLog,
  DashboardRecommendedActionItem,
  DashboardRiskSummaryItem,
  DashboardSummary,
  DataQualityReport,
  DecisionMetricSummary,
  ActionExecutionStats,
  BusinessImpactSummary,
  SelfOptimizationSummary,
  SelfOptimizationRecommendation,
  InventoryRiskItem,
  InventorySnapshot,
  MarketCode,
  OpportunityProductItem,
  OpportunityRiskAlert,
  Product,
  ProductProfitItem,
  ProfitSnapshot,
  RiskLevel,
} from "@/types";

function priorityRank(priority: DashboardRecommendedActionItem["priority"]) {
  return { P1: 3, P2: 2, P3: 1 }[priority];
}

function riskRank(level: RiskLevel) {
  return { high: 3, medium: 2, low: 1 }[level];
}

function productName(product?: Pick<Product, "title_current" | "title" | "product_uid">) {
  return product?.title_current ?? product?.title ?? product?.product_uid ?? "-";
}

function latestTimestamp(values: Array<string | undefined | null>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];
}

function buildProfitRiskItems(
  productProfit: ProductProfitItem[],
): DashboardRiskSummaryItem[] {
  return productProfit
    .filter((item) => item.net_profit < 0 || item.net_margin < 0.12 || item.risk_level === "high")
    .map((item) => {
      if (item.net_profit < 0) {
        return {
          risk_id: `profit_${item.profit_item_id}`,
          source: "profit" as const,
          risk_type: "negative_profit",
          risk_level: "high" as const,
          product_uid: item.product_uid,
          product_name: item.product_name,
          platform: item.platform,
          summary: `${item.product_name} 当前净利润为负，继续放量会直接压缩现金流。`,
          suggested_action: "先人工复核售价、广告投入和库存节奏，再决定是否继续推进。",
        };
      }

      if (item.net_margin < 0.12) {
        return {
          risk_id: `profit_${item.profit_item_id}`,
          source: "profit" as const,
          risk_type: "low_margin",
          risk_level: item.net_margin < 0.08 ? "high" : "medium",
          product_uid: item.product_uid,
          product_name: item.product_name,
          platform: item.platform,
          summary: `${item.product_name} 利润率偏薄，任何流量放大都可能把利润快速吃掉。`,
          suggested_action: "优先人工复核价格带、物流成本和广告承接，再决定是否继续加量。",
        };
      }

      return {
        risk_id: `profit_${item.profit_item_id}`,
        source: "profit" as const,
        risk_type: "high_profit_risk",
        risk_level: "high" as const,
        product_uid: item.product_uid,
        product_name: item.product_name,
        platform: item.platform,
        summary: `${item.product_name} 当前利润空间与经营波动叠加，属于高风险利润品。`,
        suggested_action: "先保利润和现金流安全，再安排后续运营动作。",
      };
    });
}

export function buildDashboardSummary(params: {
  source: ApiDataSource;
  products: Product[];
  profitSnapshot: ProfitSnapshot;
  productProfit: ProductProfitItem[];
  inventorySnapshot: InventorySnapshot;
  approvalQueue: ApprovalQueueItem[];
  todayOpportunities: OpportunityProductItem[];
  opportunityRisks: OpportunityRiskAlert[];
  inventoryRisks: InventoryRiskItem[];
  aiRecommendations: AiRecommendationItem[];
  crawlLogs: CrawlLog[];
  dataQualityReports: DataQualityReport[];
  decisionMetrics: DecisionMetricSummary;
  executionStats: ActionExecutionStats;
  businessImpactSummary: BusinessImpactSummary;
  selfOptimizationSummary: SelfOptimizationSummary;
  selfOptimizationRecommendations: SelfOptimizationRecommendation[];
}): DashboardSummary {
  const productById = new Map(params.products.map((item) => [item.product_uid, item]));
  const pendingApprovals = params.approvalQueue.filter((item) => item.status === "pending_review");
  const deferredApprovals = params.approvalQueue.filter((item) => item.status === "deferred_local");
  const highPriorityRecommendations = params.aiRecommendations.filter((item) => item.priority === "P1");
  const lowProfitProductCount = params.productProfit.filter((item) => item.net_margin < 0.12).length;
  const profitRiskSummary = buildProfitRisk(params.productProfit);

  const opportunityRiskItems: DashboardRiskSummaryItem[] = params.opportunityRisks.map((item) => {
    const product = productById.get(item.product_uid);

    return {
      risk_id: item.risk_id,
      source: "opportunity",
      risk_type: item.risk_type,
      risk_level: item.risk_level,
      product_uid: item.product_uid,
      product_name: item.affected_product || productName(product),
      platform: item.platform,
      summary: item.reason,
      suggested_action: item.suggested_action,
    };
  });

  const inventoryRiskItems: DashboardRiskSummaryItem[] = params.inventoryRisks.map((item) => {
    const product = productById.get(item.product_uid);

    return {
      risk_id: item.risk_id,
      source: "inventory",
      risk_type: item.risk_type,
      risk_level: item.risk_level,
      product_uid: item.product_uid,
      product_name: productName(product),
      platform: item.platform,
      summary: item.risk_reason,
      suggested_action: item.suggested_action,
    };
  });

  const combinedRisks = [
    ...opportunityRiskItems,
    ...inventoryRiskItems,
    ...buildProfitRiskItems(params.productProfit),
  ].sort((left, right) => {
    const riskDelta = riskRank(right.risk_level) - riskRank(left.risk_level);
    if (riskDelta !== 0) return riskDelta;
    return left.risk_id.localeCompare(right.risk_id);
  });

  const lastUpdatedAt =
    latestTimestamp([
      params.crawlLogs[0]?.finished_at,
      params.crawlLogs[0]?.started_at,
      params.approvalQueue[0]?.created_at,
      params.profitSnapshot.reporting_date,
      params.inventorySnapshot.reporting_date,
      params.dataQualityReports[0]?.report_date,
    ]) ?? new Date().toISOString();

  return {
    reporting_date: params.profitSnapshot.reporting_date || params.inventorySnapshot.reporting_date,
    market_code: (params.profitSnapshot.market_code || params.inventorySnapshot.market_code) as MarketCode,
    core_metrics: {
      yesterday_net_profit: params.profitSnapshot.yesterday_net_profit,
      month_net_profit: params.profitSnapshot.month_net_profit,
      net_margin: params.profitSnapshot.net_margin,
      cash_flow: params.profitSnapshot.cash_flow,
      inventory_turnover_days: params.inventorySnapshot.inventory_turnover_days,
      pending_approval_count: pendingApprovals.length,
    },
    operating_status: {
      today_opportunity_count: params.todayOpportunities.length,
      high_priority_recommendation_count: highPriorityRecommendations.length,
      stockout_risk_count: params.inventorySnapshot.stockout_risk_count,
      low_profit_product_count: lowProfitProductCount,
      high_risk_alert_count: combinedRisks.filter((item) => item.risk_level === "high").length,
    },
    profit_and_cash: {
      yesterday_net_profit: params.profitSnapshot.yesterday_net_profit,
      month_net_profit: params.profitSnapshot.month_net_profit,
      net_margin: params.profitSnapshot.net_margin,
      cash_flow: params.profitSnapshot.cash_flow,
      profit_risk_summary: profitRiskSummary,
    },
    inventory_risk: {
      inventory_turnover_days: params.inventorySnapshot.inventory_turnover_days,
      stock_health_score: params.inventorySnapshot.stock_health_score,
      stockout_risk_count: params.inventorySnapshot.stockout_risk_count,
      overstock_risk_count: params.inventorySnapshot.overstock_risk_count,
      slow_moving_sku_count: params.inventorySnapshot.slow_moving_sku_count,
    },
    decision_feedback: buildDashboardDecisionFeedbackSummary(params.decisionMetrics),
    execution_guard: {
      pending_count: params.executionStats.pending_count,
      approved_count: params.executionStats.approved_count,
      rejected_count: params.executionStats.rejected_count,
      simulated_profit_total: params.executionStats.simulated_profit_total,
    },
    business_impact: {
      total_profit_impact: params.businessImpactSummary.total_profit_impact,
      decision_success_rate: params.businessImpactSummary.action_success_rate,
      roi_prediction_error: params.businessImpactSummary.ROI_prediction_error,
      best_strategy: params.businessImpactSummary.best_strategy_rank[0]?.action_type ?? "-",
      worst_strategy: params.businessImpactSummary.worst_strategy_rank[0]?.action_type ?? "-",
    },
    self_optimization: {
      rule_hit_rate: params.selfOptimizationSummary.rule_hit_rate,
      rule_bias_rate: params.selfOptimizationSummary.rule_bias_rate,
      recommendation_count: params.selfOptimizationSummary.recommendation_count,
      top_recommendations: params.selfOptimizationRecommendations.slice(0, 3),
      learning_trend: params.selfOptimizationSummary.learning_trend.slice(-4),
    },
    ai_pending_approval: {
      pending_count: pendingApprovals.length,
      high_priority_count: pendingApprovals.filter((item) => item.priority === "P1").length,
      deferred_count: deferredApprovals.length,
      latest_recommendations: pendingApprovals.slice(0, 4).map((item) => ({
        approval_id: item.approval_id,
        recommendation_type: item.recommendation_type,
        product_uid: item.product_uid,
        product_name: productName(productById.get(item.product_uid)),
        platform: item.platform,
        priority: item.priority,
        recommendation_summary: item.recommendation_summary,
        created_at: item.created_at,
        status: item.status,
      })),
    },
    opportunity_and_risk: {
      top_opportunities: [...params.todayOpportunities]
        .sort((left, right) => right.opportunity_score - left.opportunity_score)
        .slice(0, 4)
        .map((item) => ({
          product_uid: item.product_uid,
          platform: item.platform,
          title_current: item.title_current,
          price_amount: item.price_amount,
          opportunity_score: item.opportunity_score,
          market_score: item.market_score,
          recommendation_level: item.recommendation_level,
          decision_notes: item.decision_notes,
        })),
      top_risks: combinedRisks.slice(0, 4),
      recommended_actions: [...params.aiRecommendations]
        .sort((left, right) => {
          const priorityDelta = priorityRank(right.priority) - priorityRank(left.priority);
          if (priorityDelta !== 0) return priorityDelta;
          return left.recommendation_id.localeCompare(right.recommendation_id);
        })
        .slice(0, 4)
        .map((item) => ({
          action_id: item.recommendation_id,
          recommendation_type: item.recommendation_type,
          priority: item.priority,
          platform: item.platform,
          product_uid: item.product_uid,
          product_name: productName(productById.get(item.product_uid)),
          action_suggestion: item.action_suggestion,
          expected_impact: item.expected_impact,
        })),
    },
    system_status: {
      data_source: params.source,
      last_updated_at: lastUpdatedAt,
      api_status: params.source === "sqlite" ? "healthy" : "fallback",
      database_status: params.source === "sqlite" ? "connected" : "fallback",
    },
  };
}
