import type {
  ActionExecutionQueueApiResponse,
  AnalysisPriority,
  ApprovalsApiResponse,
  BusinessImpactApiResponse,
  DailyOpsApiResponse,
  DailyOpsCoreGoal,
  DailyOpsOpportunityItem,
  DailyOpsRiskOverview,
  DecisionMetricsApiResponse,
  InventoryApiResponse,
  ProfitApiResponse,
  RiskLevel,
  SelfOptimizationApiResponse,
  TaskPriority,
  TasksApiResponse,
  TodayTaskItem,
} from "@/types";

const riskWeight: Record<RiskLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const priorityWeight: Record<TaskPriority | AnalysisPriority | string, number> = {
  high: 3,
  medium: 2,
  low: 1,
  P1: 3,
  P2: 2,
  P3: 1,
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function priorityScore(priority: string) {
  return priorityWeight[priority] ?? 1;
}

function riskFromScore(score: number): RiskLevel {
  if (score >= 0.24) return "high";
  if (score >= 0.12) return "medium";
  return "low";
}

function taskGoal(task: TodayTaskItem, index: number): DailyOpsCoreGoal {
  return {
    goal_id: `goal_task_${task.task_id}`,
    rank: index + 1,
    title: task.task_title || task.title,
    source: "tasks",
    profit_impact: roundMoney(task.estimated_profit_impact),
    risk_level: task.risk_level,
    priority: task.priority,
    reason: task.summary || task.suggested_action,
    href: task.href,
  };
}

function sortGoals(goals: DailyOpsCoreGoal[]) {
  return goals
    .sort((left, right) => {
      const profitDelta = Math.abs(right.profit_impact) - Math.abs(left.profit_impact);
      if (profitDelta !== 0) return profitDelta;
      const riskDelta = riskWeight[right.risk_level] - riskWeight[left.risk_level];
      if (riskDelta !== 0) return riskDelta;
      return priorityScore(right.priority) - priorityScore(left.priority);
    })
    .slice(0, 3)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function buildCoreGoals(params: {
  tasks: TasksApiResponse;
  businessImpact: BusinessImpactApiResponse;
  decisionMetrics: DecisionMetricsApiResponse;
}): DailyOpsCoreGoal[] {
  const taskGoals = params.tasks.top_tasks.map(taskGoal);
  const bestStrategy = params.businessImpact.best_strategies[0];
  const worstStrategy = params.businessImpact.worst_strategies[0];
  const decisionAccuracy = params.decisionMetrics.metrics.decision_accuracy_score;

  const businessGoals: DailyOpsCoreGoal[] = [
    bestStrategy
      ? {
          goal_id: `goal_business_best_${bestStrategy.strategy_id}`,
          rank: 0,
          title: `放大高收益策略：${bestStrategy.action_type}`,
          source: "business_impact",
          profit_impact: roundMoney(bestStrategy.total_profit_delta),
          risk_level: bestStrategy.total_profit_delta < 0 ? "high" : "low",
          priority: "P1",
          reason: bestStrategy.rank_reason,
          href: "/business-impact",
        }
      : null,
    worstStrategy
      ? {
          goal_id: `goal_business_worst_${worstStrategy.strategy_id}`,
          rank: 0,
          title: `复盘低效策略：${worstStrategy.action_type}`,
          source: "business_impact",
          profit_impact: roundMoney(worstStrategy.total_profit_delta),
          risk_level: "high",
          priority: "P1",
          reason: worstStrategy.rank_reason,
          href: "/business-impact",
        }
      : null,
  ].filter((item): item is DailyOpsCoreGoal => item !== null);

  const decisionGoal: DailyOpsCoreGoal = {
    goal_id: "goal_decision_accuracy",
    rank: 0,
    title: decisionAccuracy >= 0.75 ? "延续高命中决策策略" : "复盘决策命中率偏低的问题",
    source: "decision_engine",
    profit_impact: roundMoney(params.businessImpact.summary.total_profit_impact * decisionAccuracy),
    risk_level: decisionAccuracy >= 0.75 ? "low" : "high",
    priority: decisionAccuracy >= 0.75 ? "P2" : "P1",
    reason: `当前决策命中率为 ${(decisionAccuracy * 100).toFixed(1)}%，需要作为今日运营节奏判断依据。`,
    href: "/decision-feedback",
  };

  return sortGoals([...taskGoals, ...businessGoals, decisionGoal]);
}

function buildRiskOverview(params: {
  tasks: TasksApiResponse;
  inventory: InventoryApiResponse;
  profit: ProfitApiResponse;
  approvals: ApprovalsApiResponse;
  actions: ActionExecutionQueueApiResponse;
}): DailyOpsRiskOverview {
  const profitRiskCount =
    params.profit.profit_risk.loss_products + params.profit.profit_risk.low_profit_products;
  const highRiskProductCount =
    params.inventory.inventory_risks.filter((item) => item.risk_level === "high").length +
    params.profit.product_profit.filter((item) => item.risk_level === "high").length +
    params.tasks.all_tasks.filter((item) => item.risk_level === "high").length;

  const topRisks = [
    ...params.inventory.inventory_risks.map((item) => ({
      risk_id: `daily_inventory_${item.risk_id}`,
      risk_type: item.risk_type,
      risk_level: item.risk_level,
      title: `${item.product_uid} 库存风险`,
      source: "inventory",
      suggested_action: item.suggested_action,
      href: "/inventory",
    })),
    ...params.profit.product_profit
      .filter((item) => item.net_margin < 0.1 || item.risk_level === "high")
      .map((item) => ({
        risk_id: `daily_profit_${item.profit_item_id}`,
        risk_type: "profit_decline",
        risk_level: item.risk_level,
        title: `${item.product_name} 利润风险`,
        source: "profit",
        suggested_action: `净利率 ${(item.net_margin * 100).toFixed(1)}%，优先复核售价、成本和广告消耗。`,
        href: "/profit",
      })),
    ...(params.approvals.approval_stats.pending_count > 0
      ? [
          {
            risk_id: "daily_approval_backlog",
            risk_type: "approval_backlog",
            risk_level: params.approvals.approval_stats.pending_count >= 3 ? "high" : ("medium" as RiskLevel),
            title: "审批积压",
            source: "approvals",
            suggested_action: "先处理高优先级审批，避免建议卡在人工审核前。",
            href: "/approvals",
          },
        ]
      : []),
  ]
    .sort((left, right) => riskWeight[right.risk_level] - riskWeight[left.risk_level])
    .slice(0, 6);

  return {
    stockout_risk_count: params.inventory.snapshot.stockout_risk_count,
    profit_decline_risk_count: profitRiskCount,
    high_risk_product_count: highRiskProductCount,
    approval_backlog_count:
      params.approvals.approval_stats.pending_count + params.actions.stats.pending_count,
    top_risks: topRisks,
  };
}

function buildOpportunities(params: {
  businessImpact: BusinessImpactApiResponse;
  decisionMetrics: DecisionMetricsApiResponse;
  selfOptimization: SelfOptimizationApiResponse;
}): DailyOpsOpportunityItem[] {
  const strategyOpportunities = params.businessImpact.best_strategies.map((item) => ({
    opportunity_id: `daily_strategy_${item.strategy_id}`,
    opportunity_type: "high_roi" as const,
    title: `高ROI策略：${item.action_type}`,
    source: "business_impact" as const,
    expected_roi: item.total_gmv_delta === 0 ? 0 : item.total_profit_delta / Math.abs(item.total_gmv_delta),
    expected_profit: roundMoney(item.total_profit_delta),
    priority: item.avg_decision_accuracy >= 0.8 ? "P1" : "P2",
    recommendation: item.rank_reason,
    href: "/business-impact",
  }));

  const learningOpportunities = params.decisionMetrics.learning.recommendation_priority_updates.map((item) => ({
    opportunity_id: `daily_decision_${item.product_id}`,
    opportunity_type: "recommended_purchase" as const,
    title: `推荐采购观察：${item.product_id}`,
    source: "decision_engine" as const,
    expected_roi: params.decisionMetrics.metrics.profit_accuracy,
    expected_profit: roundMoney(params.businessImpact.summary.total_profit_impact * 0.12),
    priority: item.suggested_priority,
    recommendation: item.reason,
    href: "/decision-feedback",
  }));

  const optimizationOpportunities = params.selfOptimization.recommendations.map((item) => ({
    opportunity_id: `daily_optimization_${item.recommendation_id}`,
    opportunity_type: "rule_optimization" as const,
    title: `规则优化建议：${item.rule_name}`,
    source: "self_optimization" as const,
    expected_roi: Math.max(0, item.suggested_weight - item.current_weight),
    expected_profit: roundMoney(params.businessImpact.summary.total_profit_impact * 0.08),
    priority: item.priority,
    recommendation: `${item.reason} ${item.expected_impact}`,
    href: "/self-optimization",
  }));

  return [...strategyOpportunities, ...learningOpportunities, ...optimizationOpportunities]
    .sort((left, right) => {
      const roiDelta = right.expected_roi - left.expected_roi;
      if (roiDelta !== 0) return roiDelta;
      return priorityScore(right.priority) - priorityScore(left.priority);
    })
    .slice(0, 8);
}

function buildMetrics(params: {
  tasks: TasksApiResponse;
  businessImpact: BusinessImpactApiResponse;
  inventory: InventoryApiResponse;
  decisionMetrics: DecisionMetricsApiResponse;
}) {
  return {
    expected_gmv: roundMoney(
      params.tasks.overview.estimated_gmv_impact + params.businessImpact.summary.total_gmv_impact,
    ),
    expected_profit: roundMoney(
      params.tasks.overview.estimated_profit_impact + params.businessImpact.summary.total_profit_impact,
    ),
    stock_health_score: params.inventory.snapshot.stock_health_score,
    decision_success_rate: params.decisionMetrics.metrics.recommendation_success_rate,
  };
}

export function buildDailyOpsResponse(params: {
  source: DailyOpsApiResponse["source"];
  generatedAt: string;
  tasks: TasksApiResponse;
  businessImpact: BusinessImpactApiResponse;
  decisionMetrics: DecisionMetricsApiResponse;
  actions: ActionExecutionQueueApiResponse;
  selfOptimization: SelfOptimizationApiResponse;
  inventory: InventoryApiResponse;
  profit: ProfitApiResponse;
  approvals: ApprovalsApiResponse;
}): DailyOpsApiResponse {
  return {
    source: params.source,
    generated_at: params.generatedAt,
    core_goals: buildCoreGoals(params),
    risk_overview: buildRiskOverview(params),
    opportunities: buildOpportunities(params),
    execution_queue: {
      pending_approval_count: params.actions.stats.pending_count,
      approved_unexecuted_count: params.actions.queue.filter((item) => item.status === "approved").length,
      rejected_count: params.actions.stats.rejected_count,
      total_queue_count: params.actions.queue.length,
      queue_items: params.actions.queue
        .filter((item) => item.status !== "executed")
        .sort((left, right) => {
          const statusDelta =
            (left.status === "pending" ? 0 : left.status === "approved" ? 1 : 2) -
            (right.status === "pending" ? 0 : right.status === "approved" ? 1 : 2);
          if (statusDelta !== 0) return statusDelta;
          return Math.abs(right.expected_profit_change) - Math.abs(left.expected_profit_change);
        })
        .slice(0, 6),
    },
    metrics: buildMetrics(params),
    guardrails: [
      "每日运营只做数据汇总与优先级排序。",
      "不自动执行采购、补货、调价、广告、上架或平台写入。",
      "所有关键动作必须进入审批与受控执行队列。",
      "授权店铺连接保持只读，不在每日运营中修改平台数据。",
    ],
  };
}
