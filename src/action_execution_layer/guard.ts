import type {
  ActionExecutionCreateInput,
  ActionExecutionHistoryItem,
  ActionExecutionQueueItem,
  ActionExecutionStats,
  ExecutionActionType,
  ExecutionActorRole,
  ExecutionStatus,
} from "@/types";

function nowIso() {
  return new Date().toISOString();
}

function slugTimestamp() {
  return nowIso().replace(/[^0-9]/g, "").slice(0, 14);
}

function baseSimulation(actionType: ExecutionActionType) {
  const map: Record<
    ExecutionActionType,
    { profit: number; risk: number; result: string }
  > = {
    purchase: {
      profit: 4200,
      risk: -0.08,
      result: "模拟采购后可覆盖 14 天销量，预计降低断货风险，但会占用现金流。",
    },
    stock: {
      profit: 1800,
      risk: -0.12,
      result: "模拟库存调整后可降低缺货风险，不会触发真实补货。",
    },
    price: {
      profit: 2600,
      risk: 0.04,
      result: "模拟价格调整后预计利润改善，但需人工确认不会伤害转化。",
    },
    ad: {
      profit: 1500,
      risk: 0.06,
      result: "模拟广告预算调整后预计带来增量利润，但 ACOS 风险略升。",
    },
    listing: {
      profit: 950,
      risk: -0.03,
      result: "模拟商品内容优化后预计提升转化，不会自动上架或修改平台内容。",
    },
  };

  return map[actionType];
}

export function simulateExecution(actionType: ExecutionActionType) {
  return baseSimulation(actionType);
}

export function createExecutionAction(input: ActionExecutionCreateInput): ActionExecutionQueueItem {
  const simulation = simulateExecution(input.action_type);
  const actionId = `exec_${slugTimestamp()}_${input.product_id}`;

  return {
    action_id: actionId,
    action_type: input.action_type,
    product_id: input.product_id,
    product_uid: input.product_uid,
    platform: input.platform,
    suggested_by: input.suggested_by,
    status: "pending",
    created_at: nowIso(),
    simulate_result: simulation.result,
    expected_profit_change: simulation.profit,
    expected_risk_change: simulation.risk,
    requested_by: input.requested_by ?? "local_operator",
    notes: input.notes,
  };
}

export function createExecutionHistory(params: {
  action: ActionExecutionQueueItem;
  historyAction: ActionExecutionHistoryItem["action"];
  actorRole: ExecutionActorRole;
  actorName?: string;
  previousStatus?: ExecutionStatus;
  newStatus: ExecutionStatus;
  notes?: string;
}): ActionExecutionHistoryItem {
  const timestamp = nowIso();
  return {
    history_id: `history_${params.action.action_id}_${params.historyAction}_${timestamp.replace(/[^0-9]/g, "").slice(0, 14)}`,
    action_id: params.action.action_id,
    action: params.historyAction,
    actor_role: params.actorRole,
    actor_name: params.actorName ?? params.actorRole,
    previous_status: params.previousStatus,
    new_status: params.newStatus,
    notes: params.notes ?? "",
    created_at: timestamp,
    simulate_result: params.action.simulate_result,
  };
}

export function buildExecutionStats(queue: ActionExecutionQueueItem[]): ActionExecutionStats {
  return {
    pending_count: queue.filter((item) => item.status === "pending").length,
    approved_count: queue.filter((item) => item.status === "approved").length,
    rejected_count: queue.filter((item) => item.status === "rejected").length,
    executed_count: queue.filter((item) => item.status === "executed").length,
    simulated_profit_total: queue
      .filter((item) => item.status === "pending" || item.status === "approved")
      .reduce((total, item) => total + item.expected_profit_change, 0),
  };
}

export function canApproveExecutionAction(
  actorRole: ExecutionActorRole,
  actionType: ExecutionActionType,
) {
  if (actorRole === "admin") return true;
  if (actorRole === "finance") return ["purchase", "price", "ad"].includes(actionType);
  return false;
}

export function approvalGuardMessage(actorRole: ExecutionActorRole, actionType: ExecutionActionType) {
  if (canApproveExecutionAction(actorRole, actionType)) return null;
  if (actorRole === "operator") return "operator 可以发起执行申请，但不能审批执行。";
  if (actorRole === "finance") return `finance 只能审核成本类操作，不能审批 ${actionType}。`;
  return `${actorRole} 无执行审批权限。`;
}
