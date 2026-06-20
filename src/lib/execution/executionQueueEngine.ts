import {
  getOperationalDecisionResponse,
  type OperationalDecision,
  type OperationalDecisionType,
} from "@/lib/decision/operationalDecisionEngine";
import { recordOperationLog } from "@/lib/users";
import type { OperationLogAction, RiskLevel, ShopeeDataSource } from "@/types";

export type ExecutionQueueActionType = Exclude<OperationalDecisionType, "IGNORE">;

export type ExecutionQueuePriorityGroup =
  | "HIGH_PRIORITY"
  | "MEDIUM_PRIORITY"
  | "LOW_PRIORITY";

export type ExecutionQueueItem = {
  action_id: string;
  product_id: string;
  action_type: ExecutionQueueActionType;
  priority_score: number;
  risk_level: RiskLevel;
  decision_source: "operational_decision_engine";
  trace_id: string;
  expected_impact: string;
  required_approval: true;
  priority_group: ExecutionQueuePriorityGroup;
  action_recommendation: string;
  decision_trace: {
    decision_type: ExecutionQueueActionType;
    source_trace_id: string;
    source_signals: string[];
  };
  readonly: true;
};

export type ExecutionQueueSummary = {
  total_queue_items: number;
  high_priority_count: number;
  medium_priority_count: number;
  low_priority_count: number;
  approval_required_count: number;
  highest_priority_score: number;
  risk_group_counts: Record<RiskLevel, number>;
};

export type ExecutionQueueResponse = {
  source: ShopeeDataSource;
  generated_at: string;
  queue: ExecutionQueueItem[];
  high_priority_queue: ExecutionQueueItem[];
  medium_priority_queue: ExecutionQueueItem[];
  low_priority_queue: ExecutionQueueItem[];
  risk_groups: Record<RiskLevel, ExecutionQueueItem[]>;
  summary: ExecutionQueueSummary;
  readonly: true;
};

function nowIso() {
  return new Date().toISOString();
}

function riskRank(level: RiskLevel) {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function priorityGroupFor(decision: OperationalDecision): ExecutionQueuePriorityGroup {
  if (decision.decision_type === "STOP_LOSS") return "HIGH_PRIORITY";
  if (decision.decision_type === "REPLENISH_STOCK" && decision.risk_level === "high") {
    return "HIGH_PRIORITY";
  }
  if (decision.decision_type === "REPLENISH_STOCK") return "MEDIUM_PRIORITY";
  return "LOW_PRIORITY";
}

function isQueueDecision(decision: OperationalDecision): decision is OperationalDecision & {
  decision_type: ExecutionQueueActionType;
} {
  return decision.decision_type !== "IGNORE";
}

function actionIdFor(decision: OperationalDecision) {
  return `exec_${decision.product_id}_${decision.decision_type.toLowerCase()}`;
}

export function attachDecisionTrace(
  decision: OperationalDecision & { decision_type: ExecutionQueueActionType },
): ExecutionQueueItem {
  return {
    action_id: actionIdFor(decision),
    product_id: decision.product_id,
    action_type: decision.decision_type,
    priority_score: decision.priority_score,
    risk_level: decision.risk_level,
    decision_source: "operational_decision_engine",
    trace_id: decision.trace_id,
    expected_impact: decision.expected_impact,
    required_approval: true,
    priority_group: priorityGroupFor(decision),
    action_recommendation: decision.action_recommendation,
    decision_trace: {
      decision_type: decision.decision_type,
      source_trace_id: decision.trace_id,
      source_signals: decision.source_signals,
    },
    readonly: true,
  };
}

export function prioritizeQueueItems(items: ExecutionQueueItem[]) {
  return [...items].sort((left, right) => {
    const groupDelta = priorityGroupRank(right.priority_group) - priorityGroupRank(left.priority_group);
    if (groupDelta !== 0) return groupDelta;

    const scoreDelta = right.priority_score - left.priority_score;
    if (scoreDelta !== 0) return scoreDelta;

    return riskRank(right.risk_level) - riskRank(left.risk_level);
  });
}

function priorityGroupRank(group: ExecutionQueuePriorityGroup) {
  if (group === "HIGH_PRIORITY") return 3;
  if (group === "MEDIUM_PRIORITY") return 2;
  return 1;
}

export function groupByRiskLevel(items: ExecutionQueueItem[]) {
  return items.reduce<Record<RiskLevel, ExecutionQueueItem[]>>(
    (groups, item) => {
      groups[item.risk_level].push(item);
      return groups;
    },
    {
      low: [],
      medium: [],
      high: [],
    },
  );
}

function queueSummary(items: ExecutionQueueItem[]): ExecutionQueueSummary {
  const riskGroups = groupByRiskLevel(items);
  return {
    total_queue_items: items.length,
    high_priority_count: items.filter((item) => item.priority_group === "HIGH_PRIORITY").length,
    medium_priority_count: items.filter((item) => item.priority_group === "MEDIUM_PRIORITY").length,
    low_priority_count: items.filter((item) => item.priority_group === "LOW_PRIORITY").length,
    approval_required_count: items.filter((item) => item.required_approval).length,
    highest_priority_score: Math.max(0, ...items.map((item) => item.priority_score)),
    risk_group_counts: {
      high: riskGroups.high.length,
      medium: riskGroups.medium.length,
      low: riskGroups.low.length,
    },
  };
}

async function writeQueueLog(params: {
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
      target_type: "operational_execution_queue",
      target_id: params.target_id,
      summary: params.summary,
      metadata: {
        readonly: true,
        required_approval: true,
        ...params.metadata,
      },
    });
  } catch {
    // Queue logs are audit hints only and must not block read-only queue generation.
  }
}

export async function buildExecutionQueue(
  decisions?: OperationalDecision[],
): Promise<ExecutionQueueItem[]> {
  const sourceDecisions = decisions ?? (await getOperationalDecisionResponse()).decisions;
  const queue = sourceDecisions.filter(isQueueDecision).map(attachDecisionTrace);

  await writeQueueLog({
    action_type: "queue_created",
    target_id: "execution_queue",
    summary: "Read-only execution queue created from operational decisions.",
    metadata: {
      queue_count: queue.length,
      source_decision_count: sourceDecisions.length,
      ignored_decision_count: sourceDecisions.length - queue.length,
    },
  });

  return queue;
}

export async function getExecutionQueueResponse(): Promise<ExecutionQueueResponse> {
  const decisionResponse = await getOperationalDecisionResponse();
  const queue = await buildExecutionQueue(decisionResponse.decisions);
  const prioritizedQueue = prioritizeQueueItems(queue);
  const riskGroups = groupByRiskLevel(prioritizedQueue);
  const highPriorityQueue = prioritizedQueue.filter((item) => item.priority_group === "HIGH_PRIORITY");
  const mediumPriorityQueue = prioritizedQueue.filter((item) => item.priority_group === "MEDIUM_PRIORITY");
  const lowPriorityQueue = prioritizedQueue.filter((item) => item.priority_group === "LOW_PRIORITY");
  const summary = queueSummary(prioritizedQueue);

  await writeQueueLog({
    action_type: "queue_prioritized",
    target_id: "execution_queue",
    summary: "Read-only execution queue prioritized for approval review.",
    metadata: {
      highest_priority_score: summary.highest_priority_score,
      high_priority_count: summary.high_priority_count,
      medium_priority_count: summary.medium_priority_count,
      low_priority_count: summary.low_priority_count,
    },
  });

  await writeQueueLog({
    action_type: "queue_grouped",
    target_id: "execution_queue",
    summary: "Read-only execution queue grouped by risk level.",
    metadata: {
      risk_group_counts: summary.risk_group_counts,
    },
  });

  return {
    source: decisionResponse.source,
    generated_at: nowIso(),
    queue: prioritizedQueue,
    high_priority_queue: highPriorityQueue,
    medium_priority_queue: mediumPriorityQueue,
    low_priority_queue: lowPriorityQueue,
    risk_groups: riskGroups,
    summary,
    readonly: true,
  };
}

export async function getHighPriorityQueueResponse() {
  const response = await getExecutionQueueResponse();
  return {
    source: response.source,
    generated_at: response.generated_at,
    high_priority_queue: response.high_priority_queue,
    readonly: true,
  };
}

export async function getQueueSummaryResponse() {
  const response = await getExecutionQueueResponse();
  return {
    source: response.source,
    generated_at: response.generated_at,
    summary: response.summary,
    readonly: true,
  };
}
