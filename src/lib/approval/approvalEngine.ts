import {
  getExecutionQueueResponse,
  type ExecutionQueueItem,
  type ExecutionQueuePriorityGroup,
} from "@/lib/execution/executionQueueEngine";
import { recordOperationLog } from "@/lib/users";
import type { OperationLogAction, ShopeeDataSource } from "@/types";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ApprovalActorRole =
  | "admin"
  | "manager"
  | "operator"
  | "finance"
  | "viewer";

export type ApprovalRequestItem = ExecutionQueueItem & {
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string;
  approval_required_roles: ApprovalActorRole[];
  execution_allowed: boolean;
  execution_blocked_reason: string;
  approval_trace: {
    action_id: string;
    queue_trace_id: string;
    decision_source: ExecutionQueueItem["decision_source"];
    required_approval: true;
  };
};

export type ApprovalHistoryRecord = {
  history_id: string;
  action_id: string;
  product_id: string;
  approval_status: ApprovalStatus;
  actor_user_id: string;
  actor_role: ApprovalActorRole;
  reviewed_at: string;
  notes: string;
  trace_id: string;
  readonly: true;
};

export type ApprovalQueueSummary = {
  total_requests: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  admin_required_count: number;
  manager_required_count: number;
  execution_allowed_count: number;
  execution_blocked_count: number;
};

export type ApprovalQueueResponse = {
  source: ShopeeDataSource;
  generated_at: string;
  approval_queue: ApprovalRequestItem[];
  approval_history: ApprovalHistoryRecord[];
  summary: ApprovalQueueSummary;
  readonly: true;
};

export type ApprovalMutationInput = {
  action_id: string;
  actor_user_id: string;
  actor_role: ApprovalActorRole;
  notes?: string;
  rejection_reason?: string;
};

export type ApprovalMutationResponse = {
  source: ShopeeDataSource;
  generated_at: string;
  approved: boolean;
  rejected: boolean;
  item: ApprovalRequestItem | null;
  validation: ApprovalValidationResult;
  history: ApprovalHistoryRecord[];
  message: string;
  readonly: true;
};

export type ApprovalValidationResult = {
  action_id: string;
  is_valid_queue_item: boolean;
  required_roles: ApprovalActorRole[];
  actor_allowed: boolean;
  execution_allowed: boolean;
  reason: string;
};

type ApprovalState = {
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string;
};

const approvalStateStore = new Map<string, ApprovalState>();
const approvalHistoryStore: ApprovalHistoryRecord[] = [];

function nowIso() {
  return new Date().toISOString();
}

function requiredRolesFor(group: ExecutionQueuePriorityGroup): ApprovalActorRole[] {
  if (group === "HIGH_PRIORITY") return ["admin"];
  if (group === "MEDIUM_PRIORITY") return ["manager", "admin"];
  return ["operator", "manager", "admin"];
}

function defaultState(): ApprovalState {
  return {
    approval_status: "PENDING",
    approved_by: null,
    approved_at: null,
    rejection_reason: "",
  };
}

function stateFor(actionId: string) {
  return approvalStateStore.get(actionId) ?? defaultState();
}

function executionBlockedReason(status: ApprovalStatus) {
  if (status === "APPROVED") return "";
  if (status === "REJECTED") return "Rejected actions are permanently blocked from execution.";
  return "Action is pending approval and cannot enter execution.";
}

export function attachApprovalTrace(item: ExecutionQueueItem): ApprovalRequestItem {
  const state = stateFor(item.action_id);

  return {
    ...item,
    approval_status: state.approval_status,
    approved_by: state.approved_by,
    approved_at: state.approved_at,
    rejection_reason: state.rejection_reason,
    approval_required_roles: requiredRolesFor(item.priority_group),
    execution_allowed: state.approval_status === "APPROVED",
    execution_blocked_reason: executionBlockedReason(state.approval_status),
    approval_trace: {
      action_id: item.action_id,
      queue_trace_id: item.trace_id,
      decision_source: item.decision_source,
      required_approval: true,
    },
  };
}

export function validateQueueItem(
  item: ExecutionQueueItem | ApprovalRequestItem,
  actorRole?: ApprovalActorRole,
): ApprovalValidationResult {
  const requiredRoles = requiredRolesFor(item.priority_group);
  const approvalStatus = "approval_status" in item ? item.approval_status : "PENDING";
  const actorAllowed = actorRole ? requiredRoles.includes(actorRole) : false;

  return {
    action_id: item.action_id,
    is_valid_queue_item: item.required_approval === true,
    required_roles: requiredRoles,
    actor_allowed: actorAllowed,
    execution_allowed: approvalStatus === "APPROVED",
    reason:
      approvalStatus === "APPROVED"
        ? "Action is approved but remains non-executing until a future controlled execution layer handles it."
        : executionBlockedReason(approvalStatus),
  };
}

function summarize(items: ApprovalRequestItem[]): ApprovalQueueSummary {
  return {
    total_requests: items.length,
    pending_count: items.filter((item) => item.approval_status === "PENDING").length,
    approved_count: items.filter((item) => item.approval_status === "APPROVED").length,
    rejected_count: items.filter((item) => item.approval_status === "REJECTED").length,
    admin_required_count: items.filter((item) => item.approval_required_roles.length === 1 && item.approval_required_roles[0] === "admin").length,
    manager_required_count: items.filter((item) => item.approval_required_roles.includes("manager")).length,
    execution_allowed_count: items.filter((item) => item.execution_allowed).length,
    execution_blocked_count: items.filter((item) => !item.execution_allowed).length,
  };
}

async function writeApprovalLog(params: {
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
      target_type: "approval_control_layer",
      target_id: params.target_id,
      summary: params.summary,
      metadata: {
        readonly: true,
        no_external_execution: true,
        ...params.metadata,
      },
    });
  } catch {
    // Approval logs are audit hints only and must not block approval control reads.
  }
}

export async function generateApprovalRequests(): Promise<ApprovalQueueResponse> {
  const queueResponse = await getExecutionQueueResponse();
  const approvalQueue = queueResponse.queue.map(attachApprovalTrace);
  const adminEscalations = approvalQueue.filter((item) => item.approval_required_roles.length === 1 && item.approval_required_roles[0] === "admin");

  await writeApprovalLog({
    action_type: "approval_created",
    target_id: "approval_queue",
    summary: "Approval requests generated from the read-only execution queue.",
    metadata: {
      request_count: approvalQueue.length,
      source: queueResponse.source,
    },
  });

  if (adminEscalations.length > 0) {
    await writeApprovalLog({
      action_type: "approval_escalated",
      target_id: "approval_queue",
      summary: "High-priority approval requests require admin review.",
      metadata: {
        admin_required_count: adminEscalations.length,
        action_ids: adminEscalations.map((item) => item.action_id),
      },
    });
  }

  return {
    source: queueResponse.source,
    generated_at: nowIso(),
    approval_queue: approvalQueue,
    approval_history: [...approvalHistoryStore],
    summary: summarize(approvalQueue),
    readonly: true,
  };
}

function historyRecord(
  item: ApprovalRequestItem,
  input: ApprovalMutationInput,
  approvalStatus: ApprovalStatus,
): ApprovalHistoryRecord {
  const reviewedAt = nowIso();
  return {
    history_id: `approval_${item.action_id}_${approvalStatus.toLowerCase()}_${reviewedAt.replace(/[^0-9]/g, "")}`,
    action_id: item.action_id,
    product_id: item.product_id,
    approval_status: approvalStatus,
    actor_user_id: input.actor_user_id,
    actor_role: input.actor_role,
    reviewed_at: reviewedAt,
    notes: input.notes ?? input.rejection_reason ?? "",
    trace_id: item.trace_id,
    readonly: true,
  };
}

function findApprovalItem(response: ApprovalQueueResponse, actionId: string) {
  return response.approval_queue.find((item) => item.action_id === actionId) ?? null;
}

export async function approveAction(input: ApprovalMutationInput): Promise<ApprovalMutationResponse> {
  const response = await generateApprovalRequests();
  const item = findApprovalItem(response, input.action_id);

  if (!item) {
    return mutationFailure(response.source, input.action_id, "Approval request was not found.");
  }

  const validation = validateQueueItem(item, input.actor_role);

  if (!validation.actor_allowed) {
    return {
      source: response.source,
      generated_at: nowIso(),
      approved: false,
      rejected: false,
      item,
      validation,
      history: [...approvalHistoryStore],
      message: "Actor role is not allowed to approve this priority group.",
      readonly: true,
    };
  }

  const approvedAt = nowIso();
  approvalStateStore.set(item.action_id, {
    approval_status: "APPROVED",
    approved_by: input.actor_user_id,
    approved_at: approvedAt,
    rejection_reason: "",
  });

  const approvedItem = attachApprovalTrace(item);
  const record = historyRecord(approvedItem, input, "APPROVED");
  approvalHistoryStore.unshift(record);

  await writeApprovalLog({
    action_type: "approval_approved",
    target_id: item.action_id,
    summary: "Execution queue item approved for future controlled execution review.",
    metadata: {
      action_id: item.action_id,
      actor_user_id: input.actor_user_id,
      actor_role: input.actor_role,
      execution_allowed: approvedItem.execution_allowed,
      no_external_execution: true,
    },
  });

  return {
    source: response.source,
    generated_at: approvedAt,
    approved: true,
    rejected: false,
    item: approvedItem,
    validation: validateQueueItem(approvedItem, input.actor_role),
    history: [...approvalHistoryStore],
    message: "Approval recorded locally. No external execution was triggered.",
    readonly: true,
  };
}

export async function rejectAction(input: ApprovalMutationInput): Promise<ApprovalMutationResponse> {
  const response = await generateApprovalRequests();
  const item = findApprovalItem(response, input.action_id);

  if (!item) {
    return mutationFailure(response.source, input.action_id, "Approval request was not found.");
  }

  const validation = validateQueueItem(item, input.actor_role);

  if (!validation.actor_allowed) {
    return {
      source: response.source,
      generated_at: nowIso(),
      approved: false,
      rejected: false,
      item,
      validation,
      history: [...approvalHistoryStore],
      message: "Actor role is not allowed to reject this priority group.",
      readonly: true,
    };
  }

  const rejectedAt = nowIso();
  approvalStateStore.set(item.action_id, {
    approval_status: "REJECTED",
    approved_by: null,
    approved_at: null,
    rejection_reason: input.rejection_reason ?? input.notes ?? "Rejected by approval control layer.",
  });

  const rejectedItem = attachApprovalTrace(item);
  const record = historyRecord(rejectedItem, input, "REJECTED");
  approvalHistoryStore.unshift(record);

  await writeApprovalLog({
    action_type: "approval_rejected",
    target_id: item.action_id,
    summary: "Execution queue item rejected and blocked from future execution.",
    metadata: {
      action_id: item.action_id,
      actor_user_id: input.actor_user_id,
      actor_role: input.actor_role,
      rejection_reason: rejectedItem.rejection_reason,
      execution_allowed: rejectedItem.execution_allowed,
    },
  });

  return {
    source: response.source,
    generated_at: rejectedAt,
    approved: false,
    rejected: true,
    item: rejectedItem,
    validation: validateQueueItem(rejectedItem, input.actor_role),
    history: [...approvalHistoryStore],
    message: "Rejection recorded locally. Rejected actions cannot enter execution.",
    readonly: true,
  };
}

function mutationFailure(
  source: ShopeeDataSource,
  actionId: string,
  message: string,
): ApprovalMutationResponse {
  return {
    source,
    generated_at: nowIso(),
    approved: false,
    rejected: false,
    item: null,
    validation: {
      action_id: actionId,
      is_valid_queue_item: false,
      required_roles: [],
      actor_allowed: false,
      execution_allowed: false,
      reason: message,
    },
    history: [...approvalHistoryStore],
    message,
    readonly: true,
  };
}

export async function getApprovalHistoryResponse() {
  const response = await generateApprovalRequests();
  return {
    source: response.source,
    generated_at: response.generated_at,
    approval_history: response.approval_history,
    readonly: true,
  };
}
