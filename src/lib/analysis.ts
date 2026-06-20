import { buildRiskAlerts, recommendationLevel } from "@/lib/opportunities";
import type {
  ActionQueueItem,
  AiRecommendationItem,
  AnalysisPriority,
  AnalysisQueueRecord,
  Keyword,
  MarketAnalysisItem,
  MarketScore,
  OpportunityAnalysisItem,
  OpportunityScore,
  Product,
  RiskAnalysisItem,
  RiskLevel,
} from "@/types";

export function analysisPriorityRank(priority: AnalysisPriority) {
  return { P1: 3, P2: 2, P3: 1 }[priority];
}

export function riskLevelRank(level: RiskLevel) {
  return { high: 3, medium: 2, low: 1 }[level];
}

function priorityFromContext(
  opportunity: Pick<OpportunityScore, "opportunity_score" | "risk_level">,
  queuePriority?: number,
): AnalysisPriority {
  if (queuePriority === 1 || opportunity.risk_level === "high" || opportunity.opportunity_score >= 88) return "P1";
  if (queuePriority === 2 || opportunity.risk_level === "medium" || opportunity.opportunity_score >= 78) return "P2";
  return "P3";
}

function opportunitySummary(
  opportunity: Pick<OpportunityScore, "opportunity_score" | "risk_level" | "recommendation_level" | "suggestion_level">,
) {
  const level = recommendationLevel(opportunity);

  if (level === "A" && opportunity.risk_level === "high") {
    return "高热度机会，但必须先过人工风控关口。";
  }
  if (level === "A") {
    return "高分机会，适合进入今天的人工优先队列。";
  }
  if (level === "B") {
    return "中高潜力机会，适合继续复核并补充判断。";
  }
  return "观察型机会，今天不建议投入过多处理带宽。";
}

function opportunityRecommendation(
  product: Pick<Product, "availability_status" | "review_count"> | undefined,
  opportunity: Pick<
    OpportunityScore,
    "opportunity_score" | "risk_level" | "market_score" | "decision_notes" | "reason"
  >,
) {
  if (opportunity.risk_level === "high") {
    return "先走人工审核，再决定是否推进到审批队列。";
  }
  if (product?.availability_status === "limited_stock" || product?.availability_status === "low_stock") {
    return "先确认供给窗口，再安排后续运营动作。";
  }
  if ((product?.review_count ?? 0) < 80) {
    return "先补强详情页和评论样本，再决定是否提升优先级。";
  }
  if (opportunity.market_score >= 80 || opportunity.opportunity_score >= 88) {
    return "优先复核标题、主图、卖点与价格带，准备进入人工审批。";
  }
  return opportunity.decision_notes ?? opportunity.reason;
}

function marketTrendDirection(
  keyword: Pick<Keyword, "trend_direction"> | undefined,
  market: Pick<MarketScore, "trend_score">,
): Keyword["trend_direction"] {
  if (keyword?.trend_direction) return keyword.trend_direction;
  if (market.trend_score >= 80) return "up";
  if (market.trend_score >= 65) return "flat";
  return "down";
}

export function buildOpportunityAnalysis(
  products: Product[],
  opportunityScores: OpportunityScore[],
  analysisQueue: AnalysisQueueRecord[],
): OpportunityAnalysisItem[] {
  return [...opportunityScores]
    .sort((left, right) => right.opportunity_score - left.opportunity_score)
    .map((opportunity, index) => {
      const product = products.find((item) => item.product_uid === opportunity.product_uid);
      const queueItem = analysisQueue[index];

      return {
        analysis_id: queueItem?.analysis_id ?? `analysis_${opportunity.opportunity_id}`,
        product_uid: opportunity.product_uid,
        platform: product?.platform ?? "Shopee",
        opportunity_score: opportunity.opportunity_score,
        risk_level: opportunity.risk_level,
        analysis_summary: opportunitySummary(opportunity),
        analysis_reason: opportunity.decision_notes ?? opportunity.reason,
        recommendation: opportunityRecommendation(product, opportunity),
      };
    });
}

export function buildRiskAnalysis(products: Product[], opportunityScores: OpportunityScore[]): RiskAnalysisItem[] {
  return buildRiskAlerts(products, opportunityScores).map((risk) => ({
    risk_id: risk.risk_id,
    risk_type: risk.risk_type,
    risk_level: risk.risk_level,
    product_uid: risk.product_uid,
    platform: risk.platform,
    risk_reason: risk.reason,
    mitigation_action: risk.suggested_action,
  }));
}

export function buildMarketAnalysis(
  keywords: Keyword[],
  marketScores: MarketScore[],
  opportunityScores: OpportunityScore[],
): MarketAnalysisItem[] {
  return [...marketScores]
    .sort((left, right) => right.market_demand_score - left.market_demand_score)
    .map((market) => {
      const keyword = keywords.find((item) => item.keyword_uid === market.keyword_uid);
      const opportunity = opportunityScores.find((item) => item.keyword_uid === market.keyword_uid);

      return {
        market_score_id: market.market_score_id,
        platform: market.platform,
        category: opportunity?.category_hint ?? keyword?.category_hint ?? "General",
        demand_score: market.market_demand_score,
        competition_score: market.competition_score,
        trend_direction: marketTrendDirection(keyword, market),
      };
    });
}

export function buildAiRecommendations(
  products: Product[],
  opportunityScores: OpportunityScore[],
  actions: ActionQueueItem[],
  analysisQueue: AnalysisQueueRecord[],
): AiRecommendationItem[] {
  const topOpportunities = [...opportunityScores]
    .sort((left, right) => right.opportunity_score - left.opportunity_score)
    .slice(0, 4);

  const opportunityRecommendations = topOpportunities.map((opportunity, index) => {
    const product = products.find((item) => item.product_uid === opportunity.product_uid);
    const queueItem = analysisQueue[index];
    const priority = priorityFromContext(opportunity, queueItem?.priority);

    let recommendationType = "listing_watch";
    let actionSuggestion = "继续观察市场反馈，先不推进额外动作。";
    let expectedImpact = "帮助团队把注意力留在更高优先级事项上。";

    if (opportunity.risk_level === "high") {
      recommendationType = "manual_risk_gate";
      actionSuggestion = "先做人工合规与风控审核，再决定是否推进审批。";
      expectedImpact = "降低错误推进、退款和合规损失风险。";
    } else if (product?.availability_status === "limited_stock" || product?.availability_status === "low_stock") {
      recommendationType = "supply_validation";
      actionSuggestion = "先确认库存与补货窗口，再安排放量或提级。";
      expectedImpact = "避免机会判断正确但供给承接失败。";
    } else if ((product?.review_count ?? 0) < 80) {
      recommendationType = "content_validation";
      actionSuggestion = "优先补详情页信息与评价观察，再决定是否提级。";
      expectedImpact = "减少因样本不足导致的误判。";
    } else if (opportunity.opportunity_score >= 88) {
      recommendationType = "listing_optimization";
      actionSuggestion = "优先复核标题、卖点、主图和价格带，准备进入人工审批。";
      expectedImpact = "预计提升点击率与转化承接效率。";
    }

    return {
      recommendation_id: `rec_${opportunity.opportunity_id}`,
      recommendation_type: recommendationType,
      priority,
      platform: product?.platform ?? "Shopee",
      product_uid: opportunity.product_uid,
      action_suggestion: actionSuggestion,
      expected_impact: expectedImpact,
    };
  });

  const approvalRecommendations: AiRecommendationItem[] = actions.slice(0, 2).map((action) => {
    const priority: AnalysisPriority = action.risk_level === "high" ? "P1" : "P2";

    return {
      recommendation_id: `rec_${action.action_id}`,
      recommendation_type: "approval_queue_cleanup",
      priority,
      platform: products.find((item) => item.product_uid === action.product_uid)?.platform ?? "Shopee",
      product_uid: action.product_uid,
      action_suggestion:
        action.risk_level === "high"
          ? "优先清空高风险审批项，避免后续动作在不明确状态下排队。"
          : "按顺序复核待审批建议，保持人工决策节奏稳定。",
      expected_impact:
        action.risk_level === "high"
          ? "降低审批拥堵对高风险品的放大效应。"
          : "缩短人工判断链路，提升日常处理效率。",
    };
  });

  return [...opportunityRecommendations, ...approvalRecommendations].sort((left, right) => {
    const priorityDelta = analysisPriorityRank(right.priority) - analysisPriorityRank(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.recommendation_id.localeCompare(right.recommendation_id);
  });
}
