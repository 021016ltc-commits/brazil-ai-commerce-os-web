import type {
  AnalysisPriority,
  DashboardDecisionFeedbackSummary,
  DecisionEngineBiasCorrection,
  DecisionFeedbackInput,
  DecisionFeedbackRecord,
  DecisionHistoryItem,
  DecisionLearningSystem,
  DecisionMetricSummary,
  DecisionOutcomeRecord,
  DecisionRecommendationPriorityUpdate,
  DecisionScoringWeightUpdate,
  DecisionState,
} from "@/types";

function clampRatio(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function roundRatio(value: number) {
  return Math.round(clampRatio(value) * 10000) / 10000;
}

function nowIso() {
  return new Date().toISOString();
}

function userActionFor(input: DecisionFeedbackInput) {
  return input.user_action ?? input.userAction ?? "observe";
}

function sourceFor(input: DecisionFeedbackInput) {
  return input.source ?? "manual";
}

function isProfitable(input: DecisionFeedbackInput) {
  if (typeof input.is_profitable === "boolean") return input.is_profitable;
  if (typeof input.actual_profit === "number") return input.actual_profit > 0;
  if (typeof input.roi_real === "number") return input.roi_real >= 1;
  return false;
}

function isFailed(input: DecisionFeedbackInput) {
  if (typeof input.is_failed === "boolean") return input.is_failed;
  if (typeof input.actual_profit === "number") return input.actual_profit <= 0;
  if (typeof input.roi_real === "number") return input.roi_real < 1;
  return false;
}

function targetRoiForDecision(decisionState: DecisionState) {
  if (decisionState === "LOCKED") return 1.35;
  if (decisionState === "RECOMMEND") return 1.25;
  if (decisionState === "OBSERVE") return 1.05;
  return 0.85;
}

function hasPositiveOutcome(item: DecisionHistoryItem) {
  const outcome = item.outcome;
  if (!outcome) return false;
  return outcome.actual_profit > 0 && outcome.roi_real >= 1 && outcome.conversion_rate >= 0.02;
}

function hasPoorOutcome(item: DecisionHistoryItem) {
  const outcome = item.outcome;
  if (!outcome) return false;
  return (
    outcome.actual_profit <= 0 ||
    outcome.roi_real < 1 ||
    outcome.conversion_rate < 0.018 ||
    outcome.actual_sales <= 0
  );
}

function isDecisionCorrect(item: DecisionHistoryItem) {
  if (!item.outcome) return false;

  if (item.decisionState === "LOCKED" || item.decisionState === "RECOMMEND") {
    return item.user_action === "buy" && hasPositiveOutcome(item);
  }

  if (item.decisionState === "OBSERVE") {
    return item.user_action === "observe" && !hasPoorOutcome(item);
  }

  return (item.user_action === "reject" || item.user_action === "ignore") && hasPoorOutcome(item);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function priorityForOutcome(item: DecisionHistoryItem): DecisionRecommendationPriorityUpdate | null {
  const outcome = item.outcome;
  if (!outcome) return null;

  if (
    (item.decisionState === "LOCKED" || item.decisionState === "RECOMMEND") &&
    item.user_action === "buy" &&
    outcome.actual_profit >= 1200 &&
    outcome.roi_real >= 1.35
  ) {
    return {
      product_id: item.product_id,
      current_priority: "P2",
      suggested_priority: "P1",
      reason: "推荐后真实利润和 ROI 均高于目标，后续同类机会应提高优先级。",
    };
  }

  if (
    (item.decisionState === "LOCKED" || item.decisionState === "RECOMMEND") &&
    item.user_action === "buy" &&
    outcome.actual_profit < 0
  ) {
    return {
      product_id: item.product_id,
      current_priority: "P1",
      suggested_priority: "P3",
      reason: "推荐后真实利润为负，后续同类机会应降低推荐优先级并加强利润校验。",
    };
  }

  if (item.decisionState === "BLOCKED" && hasPoorOutcome(item)) {
    return {
      product_id: item.product_id,
      current_priority: "P3",
      suggested_priority: "P3",
      reason: "BLOCKED 判断被业务结果验证，继续保持拦截优先级。",
    };
  }

  return null;
}

export function buildDecisionFeedbackRecord(input: DecisionFeedbackInput): DecisionFeedbackRecord {
  const timestamp = input.timestamp || nowIso();
  const userAction = userActionFor(input);
  return {
    decision_id:
      input.decision_id ||
      `decision_${timestamp.replace(/[^0-9]/g, "").slice(0, 14)}_${input.product_id}`,
    product_id: input.product_id,
    product_uid: input.product_uid,
    platform: input.platform,
    decisionState: input.decisionState,
    user_action: userAction,
    userAction,
    timestamp,
    source: sourceFor(input),
    created_at: nowIso(),
  };
}

export function buildDecisionOutcomeRecord(
  decisionId: string,
  input: DecisionFeedbackInput,
): DecisionOutcomeRecord | undefined {
  const hasOutcome =
    input.actual_sales !== undefined ||
    input.actual_profit !== undefined ||
    input.roi_real !== undefined ||
    input.stock_change !== undefined ||
    input.conversion_rate !== undefined;

  if (!hasOutcome) return undefined;

  return {
    outcome_id: `outcome_${decisionId}`,
    decision_id: decisionId,
    actual_sales: Number(input.actual_sales ?? 0),
    actual_profit: Number(input.actual_profit ?? 0),
    roi_real: Number(input.roi_real ?? 0),
    stock_change: Number(input.stock_change ?? 0),
    conversion_rate: Number(input.conversion_rate ?? 0),
    is_profitable: isProfitable(input),
    is_failed: isFailed(input),
    recorded_at: nowIso(),
  };
}

export function calculateDecisionMetrics(history: DecisionHistoryItem[]): DecisionMetricSummary {
  const evaluated = history.filter((item) => Boolean(item.outcome));
  const correct = evaluated.filter(isDecisionCorrect);
  const profitAligned = evaluated.filter((item) => {
    const profit = item.outcome?.actual_profit ?? 0;
    if (item.decisionState === "BLOCKED") return profit <= 0;
    if (item.decisionState === "OBSERVE") return profit >= 0;
    return item.user_action === "buy" && profit > 0;
  });

  const recommended = evaluated.filter(
    (item) => item.decisionState === "LOCKED" || item.decisionState === "RECOMMEND",
  );
  const successfulRecommendations = recommended.filter(
    (item) => item.user_action === "buy" && hasPositiveOutcome(item),
  );

  const blocked = evaluated.filter((item) => item.decisionState === "BLOCKED");
  const correctlyBlocked = blocked.filter((item) => hasPoorOutcome(item));

  const roiDeviation = average(
    evaluated.map((item) => {
      const target = targetRoiForDecision(item.decisionState);
      const actual = item.outcome?.roi_real ?? target;
      return Math.abs(actual - target) / target;
    }),
  );

  const hitRate = roundRatio(evaluated.length ? correct.length / evaluated.length : 0);

  return {
    decision_accuracy_score: hitRate,
    recommendation_hit_rate: hitRate,
    profit_accuracy: roundRatio(evaluated.length ? profitAligned.length / evaluated.length : 0),
    recommendation_success_rate: roundRatio(
      recommended.length ? successfulRecommendations.length / recommended.length : 0,
    ),
    blocked_correct_rate: roundRatio(blocked.length ? correctlyBlocked.length / blocked.length : 0),
    roi_deviation_rate: roundRatio(roiDeviation),
    total_decisions: history.length,
    evaluated_decisions: evaluated.length,
  };
}

export function buildDecisionLearningSystem(
  history: DecisionHistoryItem[],
  metrics: DecisionMetricSummary,
): DecisionLearningSystem {
  const scoringWeightUpdates: DecisionScoringWeightUpdate[] = [
    {
      weight_key: "profit_score_weight",
      current_weight: 0.32,
      suggested_weight: metrics.profit_accuracy < 0.75 ? 0.38 : 0.32,
      reason:
        metrics.profit_accuracy < 0.75
          ? "利润命中率低于 75%，后续评分应提高真实利润权重。"
          : "利润命中率稳定，暂时保持利润权重。",
    },
    {
      weight_key: "roi_score_weight",
      current_weight: 0.2,
      suggested_weight: metrics.roi_deviation_rate > 0.22 ? 0.26 : 0.2,
      reason:
        metrics.roi_deviation_rate > 0.22
          ? "ROI 偏差率偏高，后续推荐应提高 ROI 校验权重。"
          : "ROI 偏差率可控，暂时保持 ROI 权重。",
    },
    {
      weight_key: "risk_block_weight",
      current_weight: 0.24,
      suggested_weight: metrics.blocked_correct_rate < 0.75 ? 0.3 : 0.24,
      reason:
        metrics.blocked_correct_rate < 0.75
          ? "BLOCKED 准确率不足，后续应增强风险拦截权重。"
          : "BLOCKED 拦截表现稳定，暂时保持风险权重。",
    },
  ];

  const priorityUpdates = history
    .map(priorityForOutcome)
    .filter((item): item is DecisionRecommendationPriorityUpdate => Boolean(item))
    .slice(0, 6);

  const biasCorrections: DecisionEngineBiasCorrection[] = [
    {
      bias_key: "recommendation_overconfidence",
      correction_direction: metrics.recommendation_success_rate < 0.7 ? "decrease" : "hold",
      confidence: metrics.evaluated_decisions >= 3 ? 0.72 : 0.45,
      reason:
        metrics.recommendation_success_rate < 0.7
          ? "推荐成功率不足，应降低过度推荐倾向，优先要求更多利润和库存证据。"
          : "推荐成功率处于可接受区间，暂不修正推荐倾向。",
    },
    {
      bias_key: "blocked_strictness",
      correction_direction: metrics.blocked_correct_rate < 0.7 ? "decrease" : "hold",
      confidence: metrics.evaluated_decisions >= 3 ? 0.68 : 0.42,
      reason:
        metrics.blocked_correct_rate < 0.7
          ? "BLOCKED 判断准确率偏低，应减少过度拦截。"
          : "BLOCKED 判断基本有效，保持当前风险拦截强度。",
    },
  ];

  return {
    scoring_weight_updates: scoringWeightUpdates,
    recommendation_priority_updates: priorityUpdates,
    decision_engine_bias_corrections: biasCorrections,
  };
}

export function buildDashboardDecisionFeedbackSummary(
  metrics: DecisionMetricSummary,
): DashboardDecisionFeedbackSummary {
  return {
    decision_accuracy_score: metrics.decision_accuracy_score,
    recommendation_hit_rate: metrics.recommendation_hit_rate,
    recommendation_success_rate: metrics.recommendation_success_rate,
    blocked_correct_rate: metrics.blocked_correct_rate,
    roi_deviation_rate: metrics.roi_deviation_rate,
  };
}

export function priorityRank(priority: AnalysisPriority) {
  return { P1: 3, P2: 2, P3: 1 }[priority];
}
