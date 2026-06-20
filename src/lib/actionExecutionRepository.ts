import {
  approvalGuardMessage,
  buildExecutionStats,
  canApproveExecutionAction,
  createExecutionAction,
  createExecutionHistory,
} from "@/action_execution_layer/guard";
import {
  actionExecutionHistoryMock,
  actionExecutionQueueMock,
} from "@/data/actionsMock";
import { emptyActionHistoryResponse, emptyActionQueueResponse } from "@/data/emptyResponses";
import { recordOperationLog } from "@/lib/users";
import { isMockDataAllowed } from "@/lib/runtime/config";
import { withDatabase } from "@/lib/sqlite";
import { currentTenantId, DEFAULT_TENANT_ID } from "@/lib/tenantContext";
import type {
  ActionExecutionCreateInput,
  ActionExecutionDecisionInput,
  ActionExecutionHistoryApiResponse,
  ActionExecutionHistoryItem,
  ActionExecutionMutationResponse,
  ActionExecutionQueueApiResponse,
  ActionExecutionQueueItem,
  ExecutionActionType,
  ExecutionActorRole,
  ExecutionStatus,
  ExecutionSuggestedBy,
  Platform,
} from "@/types";

type ExecutionActionRow = {
  action_id: string;
  action_type: ExecutionActionType;
  product_id: string | null;
  target_id: string | null;
  platform: Platform | null;
  suggested_by: ExecutionSuggestedBy | null;
  status: ExecutionStatus | string | null;
  created_at: string | null;
  simulate_result: string | null;
  expected_profit_change: number | null;
  expected_risk_change: number | null;
  approved_by: string | null;
  approved_at: string | null;
  recommendation_text: string | null;
  after_value_json: string | null;
};

type ExecutionHistoryRow = {
  history_id: string;
  action_id: string;
  action: ActionExecutionHistoryItem["action"];
  actor_role: ExecutionActorRole;
  actor_name: string | null;
  previous_status: ExecutionStatus | null;
  new_status: ExecutionStatus;
  notes: string | null;
  created_at: string | null;
  simulate_result: string | null;
};

function shouldUseMockData() {
  return isMockDataAllowed() && process.env.DATA_SOURCE_MODE?.trim().toLowerCase() === "mock";
}

function asRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function tenantId() {
  return currentTenantId();
}

function shouldUseDefaultMockFallback() {
  return isMockDataAllowed() && tenantId() === DEFAULT_TENANT_ID;
}

function rethrowIfProduction(error: unknown): void {
  if (!isMockDataAllowed()) {
    return;
  }
}

function parseJson(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function normalizeExecutionStatus(value: string | null | undefined): ExecutionStatus {
  if (value === "pending" || value === "approved" || value === "rejected" || value === "executed") {
    return value;
  }
  return "pending";
}

function mapActionRow(row: ExecutionActionRow): ActionExecutionQueueItem {
  const json = parseJson(row.after_value_json);
  return {
    action_id: row.action_id,
    action_type: row.action_type,
    product_id: row.product_id ?? row.target_id ?? "",
    product_uid: typeof json.product_uid === "string" ? json.product_uid : undefined,
    platform: row.platform ?? undefined,
    suggested_by:
      row.suggested_by ??
      (json.suggested_by === "decisionEngine" || json.suggested_by === "taskSystem"
        ? json.suggested_by
        : "taskSystem"),
    status: normalizeExecutionStatus(row.status),
    created_at: row.created_at ?? "",
    simulate_result:
      row.simulate_result ??
      (typeof json.simulate_result === "string" ? json.simulate_result : row.recommendation_text ?? ""),
    expected_profit_change:
      row.expected_profit_change ??
      (typeof json.expected_profit_change === "number" ? json.expected_profit_change : 0),
    expected_risk_change:
      row.expected_risk_change ??
      (typeof json.expected_risk_change === "number" ? json.expected_risk_change : 0),
    requested_by: typeof json.requested_by === "string" ? json.requested_by : undefined,
    approved_by: row.approved_by ?? undefined,
    approved_at: row.approved_at ?? undefined,
    notes: typeof json.notes === "string" ? json.notes : undefined,
  };
}

function mapHistoryRow(row: ExecutionHistoryRow): ActionExecutionHistoryItem {
  return {
    history_id: row.history_id,
    action_id: row.action_id,
    action: row.action,
    actor_role: row.actor_role,
    actor_name: row.actor_name ?? row.actor_role,
    previous_status: row.previous_status ?? undefined,
    new_status: row.new_status,
    notes: row.notes ?? "",
    created_at: row.created_at ?? "",
    simulate_result: row.simulate_result ?? "",
  };
}

export async function readActionExecutionQueue(): Promise<ActionExecutionQueueItem[]> {
  return withDatabase((db) =>
    asRows<ExecutionActionRow>(
      db
        .prepare(
          `SELECT action_id, action_type, product_id, target_id, platform, suggested_by,
                  status, created_at, simulate_result, expected_profit_change,
                  expected_risk_change, approved_by, approved_at,
                  recommendation_text, after_value_json
             FROM action_queue
            WHERE tenant_id = ?
              AND target_type = 'execution_action'
            ORDER BY created_at DESC, action_id DESC`,
        )
        .all(tenantId()),
    ).map(mapActionRow),
  );
}

async function readExecutionHistory(): Promise<ActionExecutionHistoryItem[]> {
  return withDatabase((db) =>
    asRows<ExecutionHistoryRow>(
      db
        .prepare(
          `SELECT history_id, action_id, action, actor_role, actor_name,
                  previous_status, new_status, notes, created_at, simulate_result
             FROM action_history
             WHERE tenant_id = ?
             ORDER BY created_at DESC, history_id DESC`,
        )
        .all(tenantId()),
    ).map(mapHistoryRow),
  );
}

async function readExecutionAction(actionId: string): Promise<ActionExecutionQueueItem | null> {
  const queue = await readActionExecutionQueue();
  return queue.find((item) => item.action_id === actionId) ?? null;
}

function mockQueueResponse(): ActionExecutionQueueApiResponse {
  return {
    source: "mock",
    queue: actionExecutionQueueMock,
    stats: buildExecutionStats(actionExecutionQueueMock),
  };
}

export async function getActionExecutionQueueResponse(): Promise<ActionExecutionQueueApiResponse> {
  if (shouldUseMockData()) return mockQueueResponse();

  try {
    const queue = await readActionExecutionQueue();
    return {
      source: "sqlite",
      queue: queue.length > 0 || !shouldUseDefaultMockFallback() ? queue : actionExecutionQueueMock,
      stats: buildExecutionStats(
        queue.length > 0 || !shouldUseDefaultMockFallback() ? queue : actionExecutionQueueMock,
      ),
    };
  } catch (error) {
    rethrowIfProduction(error);
    return emptyActionQueueResponse;
  }
}

export async function getActionExecutionHistoryResponse(): Promise<ActionExecutionHistoryApiResponse> {
  if (shouldUseMockData()) {
    return { source: "mock", history: actionExecutionHistoryMock };
  }

  try {
    const history = await readExecutionHistory();
    return {
      source: "sqlite",
      history: history.length > 0 || !shouldUseDefaultMockFallback() ? history : actionExecutionHistoryMock,
    };
  } catch (error) {
    rethrowIfProduction(error);
    return emptyActionHistoryResponse;
  }
}

export async function createActionExecutionRequest(
  input: ActionExecutionCreateInput,
): Promise<ActionExecutionMutationResponse> {
  const action = createExecutionAction(input);
  const history = createExecutionHistory({
    action,
    historyAction: "created",
    actorRole: "operator",
    actorName: input.requested_by ?? "local_operator",
    newStatus: "pending",
    notes: "执行申请已创建，等待审批。不会自动执行。",
  });

  if (shouldUseMockData()) {
    return {
      source: "sqlite",
      persisted: false,
      action,
      history,
      stats: buildExecutionStats([]),
      message: "测试数据已禁用，未写入 SQLite。",
    };
  }

  try {
    await withDatabase((db) => {
      const metadata = {
        product_uid: action.product_uid,
        suggested_by: action.suggested_by,
        requested_by: action.requested_by,
        notes: action.notes,
      };

      db
        .prepare(
          `INSERT INTO action_queue (
             action_id, package_id, created_at, platform, market_code,
             product_id, target_type, target_id, action_type, suggested_by,
             after_value_json, recommendation_text, confidence_score, risk_level,
             need_approval, approval_status, status, simulate_result,
             expected_profit_change, expected_risk_change, tenant_id
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          action.action_id,
          "action_execution_layer",
          action.created_at,
          action.platform ?? null,
          "br",
          action.product_id,
          "execution_action",
          action.product_id,
          action.action_type,
          action.suggested_by,
          JSON.stringify(metadata),
          action.simulate_result,
          0.72,
          action.expected_risk_change > 0.05 ? "high" : "medium",
          1,
          "pending",
          "pending",
          action.simulate_result,
          action.expected_profit_change,
          action.expected_risk_change,
          tenantId(),
        );

      db
        .prepare(
          `INSERT INTO action_history (
             history_id, action_id, action, actor_role, actor_name,
             previous_status, new_status, notes, created_at, simulate_result, tenant_id
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          history.history_id,
          history.action_id,
          history.action,
          history.actor_role,
          history.actor_name,
          history.previous_status ?? null,
          history.new_status,
          history.notes,
          history.created_at,
          history.simulate_result,
          tenantId(),
        );
    }, false);

    await recordOperationLog({
      action_type: "action_create",
      actor_user_id: input.requested_by,
      actor_email: input.requested_by,
      target_type: "action_queue",
      target_id: action.action_id,
      summary: `创建受控执行申请 ${action.action_type} / ${action.product_id}。`,
      metadata: { product_id: action.product_id, suggested_by: action.suggested_by },
    });

    const queue = await readActionExecutionQueue();
    return {
      source: "sqlite",
      persisted: true,
      action,
      history,
      stats: buildExecutionStats(queue),
      message: "执行申请已写入本地执行审批池，等待审批，不会自动执行。",
    };
  } catch (error) {
    rethrowIfProduction(error);
    const queue = [action, ...actionExecutionQueueMock];
    return {
      source: "mock",
      persisted: false,
      action,
      history,
      stats: buildExecutionStats(queue),
      message: "真实数据源不可用，未创建测试执行申请。",
    };
  }
}

async function decideActionExecutionRequest(
  input: ActionExecutionDecisionInput,
  decision: "approved" | "rejected",
): Promise<ActionExecutionMutationResponse> {
  const current = shouldUseMockData()
    ? null
    : await readExecutionAction(input.action_id).catch((error) => {
        rethrowIfProduction(error);
        return null;
      });
  const fallbackAction = isMockDataAllowed()
    ? actionExecutionQueueMock.find((item) => item.action_id === input.action_id)
    : undefined;
  const action = current ?? fallbackAction;

  if (!action) {
    throw new Error("Action not found.");
  }

  const guardMessage = approvalGuardMessage(input.actor_role, action.action_type);
  if (decision === "approved" && guardMessage) {
    throw new Error(guardMessage);
  }

  if (decision === "rejected" && !canApproveExecutionAction(input.actor_role, action.action_type)) {
    throw new Error(guardMessage ?? "当前角色无拒绝执行申请权限。");
  }

  if (action.status !== "pending") {
    throw new Error("Only pending actions can be approved or rejected.");
  }

  const nextAction: ActionExecutionQueueItem = {
    ...action,
    status: decision,
    approved_by: input.actor_name ?? input.actor_role,
    approved_at: new Date().toISOString(),
  };
  const history = createExecutionHistory({
    action: nextAction,
    historyAction: decision,
    actorRole: input.actor_role,
    actorName: input.actor_name,
    previousStatus: action.status,
    newStatus: decision,
    notes:
      input.notes ??
      (decision === "approved"
        ? "本地审批通过，仅允许后续人工模拟执行。"
        : "本地审批拒绝，不会执行任何平台动作。"),
  });

  if (shouldUseMockData() || (!current && isMockDataAllowed())) {
    const queue = actionExecutionQueueMock.map((item) =>
      item.action_id === action.action_id ? nextAction : item,
    );
    return {
      source: "mock",
      persisted: false,
      action: nextAction,
      history,
      stats: buildExecutionStats(queue),
      message: `测试数据已禁用，未${decision === "approved" ? "批准" : "驳回"}执行申请。`,
    };
  }

  await withDatabase((db) => {
    db
      .prepare(
        `UPDATE action_queue
            SET status = ?,
                approval_status = ?,
                approved_by = ?,
                approved_at = ?
          WHERE action_id = ?
            AND target_type = 'execution_action'
            AND tenant_id = ?`,
      )
      .run(
        decision,
        decision,
        nextAction.approved_by ?? null,
        nextAction.approved_at ?? null,
        action.action_id,
        tenantId(),
      );

    db
      .prepare(
        `INSERT INTO action_history (
           history_id, action_id, action, actor_role, actor_name,
           previous_status, new_status, notes, created_at, simulate_result, tenant_id
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        history.history_id,
        history.action_id,
        history.action,
        history.actor_role,
        history.actor_name,
        history.previous_status ?? null,
        history.new_status,
        history.notes,
        history.created_at,
        history.simulate_result,
        tenantId(),
      );
  }, false);

  await recordOperationLog({
    action_type: decision === "approved" ? "action_approve" : "action_reject",
    actor_user_id: input.actor_name,
    actor_email: input.actor_name,
    target_type: "action_queue",
    target_id: action.action_id,
    summary: `${input.actor_role} ${decision === "approved" ? "批准" : "拒绝"}受控执行申请 ${action.action_id}。`,
    metadata: { action_type: action.action_type, product_id: action.product_id },
  });

  const queue = await readActionExecutionQueue();
  return {
    source: "sqlite",
    persisted: true,
    action: nextAction,
    history,
    stats: buildExecutionStats(queue),
    message:
      decision === "approved"
        ? "执行申请已批准，但仍不会自动调用任何平台写操作。"
        : "执行申请已拒绝，不会执行任何平台动作。",
  };
}

export function approveActionExecutionRequest(input: ActionExecutionDecisionInput) {
  return decideActionExecutionRequest(input, "approved");
}

export function rejectActionExecutionRequest(input: ActionExecutionDecisionInput) {
  return decideActionExecutionRequest(input, "rejected");
}
