import type {
  Keyword,
  KeywordOpportunityItem,
  MarketScore,
  OpportunityProductItem,
  OpportunityRiskAlert,
  OpportunityScore,
  Product,
  RiskLevel,
} from "@/types";

export function recommendationLevel(score: Pick<OpportunityScore, "recommendation_level" | "suggestion_level">) {
  return score.recommendation_level ?? score.suggestion_level;
}

export function riskLevelRank(level: RiskLevel) {
  return { high: 3, medium: 2, low: 1 }[level];
}

export function opportunityRiskScore(
  score: Pick<OpportunityScore, "risk_score" | "risk_level">,
  product?: Pick<Product, "availability_status" | "review_count">,
) {
  if (typeof score.risk_score === "number") return score.risk_score;
  if (product?.availability_status === "limited_stock") return 34;
  if (product?.availability_status === "low_stock") return 29;
  if ((product?.review_count ?? 0) < 80) return 27;
  if (score.risk_level === "high") return 44;
  if (score.risk_level === "medium") return 28;
  return 16;
}

export function buildTodayOpportunities(
  products: Product[],
  opportunityScores: OpportunityScore[],
): OpportunityProductItem[] {
  return opportunityScores
    .map((score) => {
      const product = products.find((item) => item.product_uid === score.product_uid);

      return {
        product_uid: score.product_uid,
        platform: product?.platform ?? "Shopee",
        title_current: product?.title_current ?? product?.title ?? score.product_uid,
        price_amount: product?.price_amount ?? 0,
        rating: product?.rating ?? 0,
        sold_count_text: product?.sold_count_text ?? "-",
        market_score: score.market_score,
        opportunity_score: score.opportunity_score,
        recommendation_level: recommendationLevel(score),
        decision_notes: score.decision_notes ?? score.reason,
        risk_level: score.risk_level,
        risk_score: opportunityRiskScore(score, product),
      };
    })
    .sort((left, right) => right.opportunity_score - left.opportunity_score);
}

export function buildKeywordOpportunities(
  keywords: Keyword[],
  marketScores: MarketScore[],
  opportunityScores: OpportunityScore[],
): KeywordOpportunityItem[] {
  return marketScores
    .map((marketScore) => {
      const keyword = keywords.find((item) => item.keyword_uid === marketScore.keyword_uid);
      const score = opportunityScores.find((item) => item.keyword_uid === marketScore.keyword_uid);

      return {
        keyword_uid: marketScore.keyword_uid,
        keyword: keyword?.keyword ?? marketScore.keyword,
        category_hint: score?.category_hint ?? keyword?.category_hint ?? "General",
        market_demand_score: marketScore.market_demand_score,
        competition_score: marketScore.competition_score,
        trend_score: marketScore.trend_score,
        total_score: marketScore.total_score,
        platform: marketScore.platform,
      };
    })
    .sort((left, right) => right.total_score - left.total_score);
}

export function buildRiskAlerts(products: Product[], opportunityScores: OpportunityScore[]): OpportunityRiskAlert[] {
  return opportunityScores
    .map((score) => {
      const product = products.find((item) => item.product_uid === score.product_uid);
      const titleCurrent = product?.title_current ?? product?.title ?? score.product_uid;
      const stockRisk =
        product?.availability_status === "limited_stock" || product?.availability_status === "low_stock";
      const reviewRisk = (product?.review_count ?? 0) < 80;
      const riskScore = opportunityRiskScore(score, product);

      let riskType = "competition_pressure";
      let reason = score.decision_notes ?? score.reason;
      let suggestedAction = "继续观察评分变化，暂不触发任何自动动作。";

      if (score.risk_level === "high") {
        riskType = "policy_compliance";
        reason = `${titleCurrent} 当前机会高，但需要先确认合规表达和平台规则。`;
        suggestedAction = "优先进入人工审核，确认标题、卖点和类目表述。";
      } else if (stockRisk) {
        riskType = "inventory_tension";
        reason = `${titleCurrent} 当前库存状态偏紧，若放量容易出现缺货或履约波动。`;
        suggestedAction = "先确认补货和履约窗口，再决定是否放大流量。";
      } else if (riskScore >= 30) {
        riskType = "logistics_latency";
        reason = `${titleCurrent} 机会分高，但履约链路波动会放大退款和时效风险。`;
        suggestedAction = "先核对物流时效与售后承接，再安排人工运营跟进。";
      } else if (reviewRisk) {
        riskType = "review_sample_gap";
        reason = `${titleCurrent} 评论样本偏少，当前判断更依赖趋势而不是稳定口碑。`;
        suggestedAction = "优先补充详情页信息和评价观察，再决定是否提升优先级。";
      } else {
        reason = `${titleCurrent} 竞争压力仍在，短期需要控制节奏，避免误判机会。`;
        suggestedAction = "先做人审比较，再决定是否进入更深的运营动作。";
      }

      return {
        risk_id: `risk_${score.opportunity_id}`,
        risk_type: riskType,
        risk_level: score.risk_level,
        affected_product: titleCurrent,
        platform: product?.platform ?? "Shopee",
        product_uid: score.product_uid,
        reason,
        suggested_action: suggestedAction,
      };
    })
    .sort((left, right) => riskLevelRank(right.risk_level) - riskLevelRank(left.risk_level));
}
