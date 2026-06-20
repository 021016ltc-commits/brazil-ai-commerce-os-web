import {
  validateBeforeExecution,
  type ExecutionGuardInput,
  type ExecutionGuardItem,
} from "@/lib/guard/executionGuard";
import { recordOperationLog } from "@/lib/users";
import type { OperationLogAction, RiskLevel, ShopeeDataSource } from "@/types";

export type VirtualExecutionItem = {
  execution_id: string;
  product_id: string;
  action_type: ExecutionGuardItem["action_type"];
  simulated_result: string;
  expected_profit_change: number;
  expected_inventory_change: number;
  expected_order_change: number;
  expected_revenue_change: number;
  risk_after_execution: RiskLevel;
  confidence_score: number;
  guard_status: ExecutionGuardItem["guard_status"];
  source_action_id: string;
  trace_id: string;
  readonly: true;
};

export type ExecutionReportSummary = {
  total_simulated: number;
  execution_success_rate: number;
  total_expected_profit_change: number;
  total_expected_inventory_change: number;
  total_expected_order_change: number;
  total_expected_revenue_change: number;
  average_confidence_score: number;
};

export type ExecutionRiskDistribution = Record<RiskLevel, number>;

export type ExecutionImpactAnalysis = {
  inventory_change_total: number;
  order_change_total: number;
  revenue_change_total: number;
  profit_change_total: number;
  highest_profit_action: VirtualExecutionItem | null;
  highest_risk_action: VirtualExecutionItem | null;
};

export type VirtualExecutionReport = {
  source: ShopeeDataSource;
  generated_at: string;
  execution_items: VirtualExecutionItem[];
  execution_report_summary: ExecutionReportSummary;
  execution_success_rate: number;
  execution_risk_distribution: ExecutionRiskDistribution;
  execution_impact_analysis: ExecutionImpactAnalysis;
  guard_summary: {
    safe_count: number;
    warning_count: number;
    blocked_count: number;
    excluded_blocked_count: number;
  };
  readonly: true;
};

function nowIso() {
  return new Date().toISOString();
}

function rounded(value: number) {
  return Number(value.toFixed(2));
}

function bounded(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function riskRank(level: RiskLevel) {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function normalizedRiskLevel(item: ExecutionGuardItem): RiskLevel {
  return item.risk_level === "HIGH_RISK_BLOCKED" ? "high" : item.risk_level;
}

function riskAfterExecution(item: ExecutionGuardItem): RiskLevel {
  const currentRisk = normalizedRiskLevel(item);

  if (item.action_type === "STOP_LOSS") return currentRisk === "high" ? "medium" : "low";
  if (item.action_type === "REPLENISH_STOCK") return currentRisk === "high" ? "medium" : currentRisk;
  if (item.action_type === "BOOST_SALES") return item.guard_status === "WARNING" ? "medium" : "low";
  return currentRisk === "high" ? "medium" : currentRisk;
}

export function simulateInventoryChange(item: ExecutionGuardItem) {
  const base = Math.max(1, Math.round(item.system_health_score / 10));

  switch (item.action_type) {
    case "REPLENISH_STOCK":
      return base * 8;
    case "STOP_LOSS":
      return -base * 4;
    case "BOOST_SALES":
      return -base * 3;
    case "MONITOR":
      return 0;
  }
}

export function simulateOrderImpact(item: ExecutionGuardItem) {
  const currentRisk = normalizedRiskLevel(item);
  const riskMultiplier = currentRisk === "high" ? 1.4 : currentRisk === "medium" ? 1.1 : 0.8;
  const priorityBase = Math.max(1, Math.round(item.system_health_score / 20));

  switch (item.action_type) {
    case "REPLENISH_STOCK":
      return Math.round(priorityBase * 2 * riskMultiplier);
    case "STOP_LOSS":
      return -Math.max(1, Math.round(priorityBase * 0.8));
    case "BOOST_SALES":
      return Math.round(priorityBase * 3 * riskMultiplier);
    case "MONITOR":
      return 0;
  }
}

export function simulateRevenueImpact(item: ExecutionGuardItem) {
  const orderImpact = simulateOrderImpact(item);
  const averageOrderValue = item.action_type === "STOP_LOSS" ? 85 : 120;
  const protectedRevenue =
    item.action_type === "REPLENISH_STOCK" && item.risk_level === "high" ? 950 : 0;

  return rounded(orderImpact * averageOrderValue + protectedRevenue);
}

function simulateProfitImpact(item: ExecutionGuardItem) {
  const revenueImpact = simulateRevenueImpact(item);
  const margin = item.action_type === "STOP_LOSS" ? 0.32 : item.action_type === "BOOST_SALES" ? 0.22 : 0.18;
  const riskReductionValue = riskRank(normalizedRiskLevel(item)) > riskRank(riskAfterExecution(item)) ? 260 : 0;

  return rounded(Math.max(0, revenueImpact * margin) + riskReductionValue);
}

function confidenceScore(item: ExecutionGuardItem) {
  const guardBase = item.guard_status === "SAFE" ? 88 : 72;
  const currentRisk = normalizedRiskLevel(item);
  const riskPenalty = currentRisk === "high" ? 10 : currentRisk === "medium" ? 5 : 0;
  const healthAdjustment = item.system_health_score >= 80 ? 4 : item.system_health_score <= 70 ? -4 : 0;

  return bounded(guardBase - riskPenalty + healthAdjustment);
}

function simulatedResult(item: ExecutionGuardItem) {
  switch (item.action_type) {
    case "REPLENISH_STOCK":
      return "Simulated stock recovery plan only. No inventory write was performed.";
    case "STOP_LOSS":
      return "Simulated stop-loss containment only. No listing, price, or ad change was performed.";
    case "BOOST_SALES":
      return "Simulated sales lift scenario only. No campaign, price, or listing change was performed.";
    case "MONITOR":
      return "Simulated monitoring scenario only. No operational change was performed.";
  }
}

export function simulateExecution(item: ExecutionGuardItem): VirtualExecutionItem {
  return {
    execution_id: `virtual_${item.action_id}`,
    product_id: item.product_id,
    action_type: item.action_type,
    simulated_result: simulatedResult(item),
    expected_profit_change: simulateProfitImpact(item),
    expected_inventory_change: simulateInventoryChange(item),
    expected_order_change: simulateOrderImpact(item),
    expected_revenue_change: simulateRevenueImpact(item),
    risk_after_execution: riskAfterExecution(item),
    confidence_score: confidenceScore(item),
    guard_status: item.guard_status,
    source_action_id: item.action_id,
    trace_id: `virtual_${item.trace_id}`,
    readonly: true,
  };
}

function riskDistribution(items: VirtualExecutionItem[]): ExecutionRiskDistribution {
  return items.reduce<ExecutionRiskDistribution>(
    (distribution, item) => {
      distribution[item.risk_after_execution] += 1;
      return distribution;
    },
    { low: 0, medium: 0, high: 0 },
  );
}

function reportSummary(items: VirtualExecutionItem[]): ExecutionReportSummary {
  const totalConfidence = items.reduce((sum, item) => sum + item.confidence_score, 0);
  const successfulSimulations = items.filter((item) => item.confidence_score >= 60).length;

  return {
    total_simulated: items.length,
    execution_success_rate: items.length === 0 ? 0 : rounded(successfulSimulations / items.length),
    total_expected_profit_change: rounded(items.reduce((sum, item) => sum + item.expected_profit_change, 0)),
    total_expected_inventory_change: rounded(items.reduce((sum, item) => sum + item.expected_inventory_change, 0)),
    total_expected_order_change: rounded(items.reduce((sum, item) => sum + item.expected_order_change, 0)),
    total_expected_revenue_change: rounded(items.reduce((sum, item) => sum + item.expected_revenue_change, 0)),
    average_confidence_score: items.length === 0 ? 0 : rounded(totalConfidence / items.length),
  };
}

function impactAnalysis(items: VirtualExecutionItem[]): ExecutionImpactAnalysis {
  const sortedByProfit = [...items].sort((left, right) => right.expected_profit_change - left.expected_profit_change);
  const sortedByRisk = [...items].sort((left, right) => riskRank(right.risk_after_execution) - riskRank(left.risk_after_execution));

  return {
    inventory_change_total: rounded(items.reduce((sum, item) => sum + item.expected_inventory_change, 0)),
    order_change_total: rounded(items.reduce((sum, item) => sum + item.expected_order_change, 0)),
    revenue_change_total: rounded(items.reduce((sum, item) => sum + item.expected_revenue_change, 0)),
    profit_change_total: rounded(items.reduce((sum, item) => sum + item.expected_profit_change, 0)),
    highest_profit_action: sortedByProfit[0] ?? null,
    highest_risk_action: sortedByRisk[0] ?? null,
  };
}

async function writeVirtualExecutionLog(params: {
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
      target_type: "virtual_execution_layer",
      target_id: params.target_id,
      summary: params.summary,
      metadata: {
        readonly: true,
        simulated_only: true,
        no_external_execution: true,
        ...params.metadata,
      },
    });
  } catch {
    // Virtual execution logs must not block simulation report generation.
  }
}

async function writeSimulationLogs(items: VirtualExecutionItem[], summary: ExecutionReportSummary) {
  await writeVirtualExecutionLog({
    action_type: "virtual_execution_started",
    target_id: "virtual_execution",
    summary: "Virtual execution simulation started from Guard safe queue.",
    metadata: {
      item_count: items.length,
    },
  });

  await Promise.all(
    items.slice(0, 20).map((item) =>
      writeVirtualExecutionLog({
        action_type: "execution_simulated",
        target_id: item.execution_id,
        summary: "Execution item simulated without real external operation.",
        metadata: item,
      }),
    ),
  );

  await writeVirtualExecutionLog({
    action_type: "virtual_execution_completed",
    target_id: "virtual_execution",
    summary: "Virtual execution simulation completed.",
    metadata: summary,
  });

  await writeVirtualExecutionLog({
    action_type: "execution_report_generated",
    target_id: "virtual_execution_report",
    summary: "Virtual execution report generated for audit review.",
    metadata: summary,
  });
}

export async function generateExecutionReport(
  input: ExecutionGuardInput = {},
): Promise<VirtualExecutionReport> {
  const guardResponse = await validateBeforeExecution(input);
  const executionItems = guardResponse.safe_queue
    .filter((item) => item.approval_status === "APPROVED")
    .filter((item) => item.guard_status === "SAFE" || item.guard_status === "WARNING")
    .map(simulateExecution);
  const summary = reportSummary(executionItems);

  await writeSimulationLogs(executionItems, summary);

  return {
    source: guardResponse.source,
    generated_at: nowIso(),
    execution_items: executionItems,
    execution_report_summary: summary,
    execution_success_rate: summary.execution_success_rate,
    execution_risk_distribution: riskDistribution(executionItems),
    execution_impact_analysis: impactAnalysis(executionItems),
    guard_summary: {
      safe_count: guardResponse.summary.safe_count,
      warning_count: guardResponse.summary.warning_count,
      blocked_count: guardResponse.summary.blocked_count,
      excluded_blocked_count: guardResponse.blocked_executions.length,
    },
    readonly: true,
  };
}

export async function getExecutionReportsResponse() {
  const report = await generateExecutionReport();
  return {
    source: report.source,
    generated_at: report.generated_at,
    execution_items: report.execution_items,
    execution_report_summary: report.execution_report_summary,
    execution_risk_distribution: report.execution_risk_distribution,
    execution_impact_analysis: report.execution_impact_analysis,
    readonly: true,
  };
}

export async function getExecutionSimulationSummaryResponse() {
  const report = await generateExecutionReport();
  return {
    source: report.source,
    generated_at: report.generated_at,
    execution_report_summary: report.execution_report_summary,
    execution_success_rate: report.execution_success_rate,
    execution_risk_distribution: report.execution_risk_distribution,
    readonly: true,
  };
}
