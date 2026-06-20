import type {
  BusinessImpactActionItem,
  BusinessImpactStrategyRank,
  BusinessImpactSummary,
} from "@/types";

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function safeDivide(numerator: number, denominator: number) {
  if (!Number.isFinite(denominator) || denominator === 0) return 0;
  return numerator / denominator;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculateBusinessImpactAccuracy(expectedImpact: number, actualImpact: number) {
  if (Math.abs(expectedImpact) < 1) {
    return actualImpact >= 0 ? 1 : 0;
  }

  const error = Math.abs(actualImpact - expectedImpact) / Math.abs(expectedImpact);
  return clamp(1 - error);
}

export function calculateRoiPredictionError(expectedImpact: number, actualImpact: number) {
  if (Math.abs(expectedImpact) < 1) return 0;
  return Math.abs(actualImpact - expectedImpact) / Math.abs(expectedImpact);
}

export function enrichBusinessImpactItem(
  item: Omit<BusinessImpactActionItem, "decision_accuracy" | "roi_prediction_error">,
): BusinessImpactActionItem {
  return {
    ...item,
    decision_accuracy: calculateBusinessImpactAccuracy(item.expected_impact, item.actual_impact),
    roi_prediction_error: calculateRoiPredictionError(item.expected_impact, item.actual_impact),
  };
}

export function buildStrategyRanks(items: BusinessImpactActionItem[]): BusinessImpactStrategyRank[] {
  const grouped = new Map<string, BusinessImpactActionItem[]>();

  items.forEach((item) => {
    const current = grouped.get(item.action_type) ?? [];
    current.push(item);
    grouped.set(item.action_type, current);
  });

  return Array.from(grouped.entries())
    .map(([actionType, actionItems]) => {
      const totalProfit = actionItems.reduce((sum, item) => sum + item.profit_delta, 0);
      const totalGmv = actionItems.reduce((sum, item) => sum + item.gmv_delta, 0);
      const avgAccuracy = average(actionItems.map((item) => item.decision_accuracy));
      const roiError = average(actionItems.map((item) => item.roi_prediction_error));
      const successCount = actionItems.filter((item) => item.profit_delta > 0 && item.actual_impact >= 0).length;

      return {
        strategy_id: `strategy_${actionType}`,
        action_type: actionType,
        action_count: actionItems.length,
        total_profit_delta: totalProfit,
        total_gmv_delta: totalGmv,
        avg_decision_accuracy: avgAccuracy,
        roi_prediction_error: roiError,
        rank_reason:
          successCount === actionItems.length
            ? "利润和 GMV 表现稳定为正，适合继续观察扩大样本。"
            : "存在利润、GMV 或预测偏差压力，需要人工复盘后再扩大使用。",
      };
    })
    .sort((left, right) => {
      const profitDelta = right.total_profit_delta - left.total_profit_delta;
      if (profitDelta !== 0) return profitDelta;
      return right.avg_decision_accuracy - left.avg_decision_accuracy;
    });
}

export function buildBusinessImpactSummary(items: BusinessImpactActionItem[]): BusinessImpactSummary {
  const strategyRanks = buildStrategyRanks(items);
  const successfulItems = items.filter((item) => item.profit_delta > 0 && item.actual_impact >= 0);

  return {
    total_profit_impact: items.reduce((sum, item) => sum + item.profit_delta, 0),
    total_gmv_impact: items.reduce((sum, item) => sum + item.gmv_delta, 0),
    total_stock_turnover_change: items.reduce((sum, item) => sum + item.stock_turnover_change, 0),
    decision_accuracy: average(items.map((item) => item.decision_accuracy)),
    action_success_rate: safeDivide(successfulItems.length, items.length),
    ROI_prediction_error: average(items.map((item) => item.roi_prediction_error)),
    analyzed_action_count: items.length,
    successful_action_count: successfulItems.length,
    best_strategy_rank: strategyRanks.slice(0, 5),
    worst_strategy_rank: [...strategyRanks]
      .sort((left, right) => {
        const profitDelta = left.total_profit_delta - right.total_profit_delta;
        if (profitDelta !== 0) return profitDelta;
        return left.avg_decision_accuracy - right.avg_decision_accuracy;
      })
      .slice(0, 5),
  };
}
