import {
  generateApprovalRequests,
  type ApprovalRequestItem,
} from "@/lib/approval/approvalEngine";
import { getSystemHealthResponse } from "@/lib/systemHealth";
import { recordOperationLog } from "@/lib/users";
import type { OperationLogAction, ShopeeDataSource } from "@/types";

export type ExecutionGuardLevel = "SAFE" | "WARNING" | "BLOCKED";

export type ExecutionGuardCheckName =
  | "approval_status"
  | "risk_level"
  | "system_health"
  | "no_shopee_write";

export type ExecutionGuardCheck = {
  check_name: ExecutionGuardCheckName;
  passed: boolean;
  level: ExecutionGuardLevel;
  value: string | number | boolean;
  message: string;
};

export type ExecutionGuardItem = {
  action_id: string;
  product_id: string;
  action_type: ApprovalRequestItem["action_type"];
  approval_status: ApprovalRequestItem["approval_status"];
  risk_level: ApprovalRequestItem["risk_level"] | "HIGH_RISK_BLOCKED";
  guard_status: ExecutionGuardLevel;
  can_enter_execution_preparation: boolean;
  no_shopee_write_flag: boolean;
  system_health_score: number;
  checks: ExecutionGuardCheck[];
  block_reasons: string[];
  warnings: string[];
  trace_id: string;
  decision_source: ApprovalRequestItem["decision_source"];
  expected_impact: string;
  readonly: true;
};

export type ExecutionGuardSummary = {
  total_checked: number;
  safe_count: number;
  warning_count: number;
  blocked_count: number;
  execution_prevented_count: number;
  system_health_score: number;
  no_shopee_write_flag: boolean;
};

export type ExecutionGuardResponse = {
  source: ShopeeDataSource;
  generated_at: string;
  guard_results: ExecutionGuardItem[];
  safe_queue: ExecutionGuardItem[];
  blocked_executions: ExecutionGuardItem[];
  summary: ExecutionGuardSummary;
  readonly: true;
};

export type ExecutionGuardInput = {
  action_id?: string;
  no_shopee_write_flag?: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function guardStatusFromChecks(checks: ExecutionGuardCheck[]): ExecutionGuardLevel {
  if (checks.some((check) => !check.passed && check.level === "BLOCKED")) return "BLOCKED";
  if (checks.some((check) => check.level === "WARNING")) return "WARNING";
  return "SAFE";
}

export function checkApprovalStatus(item: ApprovalRequestItem): ExecutionGuardCheck {
  const passed = item.approval_status === "APPROVED";

  return {
    check_name: "approval_status",
    passed,
    level: passed ? "SAFE" : "BLOCKED",
    value: item.approval_status,
    message: passed
      ? "Approval status is APPROVED."
      : "Execution is blocked because approval status is not APPROVED.",
  };
}

export function checkRiskLevel(item: ApprovalRequestItem): ExecutionGuardCheck {
  const riskCode = String(item.risk_level);
  const blocked = riskCode === "HIGH_RISK_BLOCKED";
  const warning = riskCode === "high";

  return {
    check_name: "risk_level",
    passed: !blocked,
    level: blocked ? "BLOCKED" : warning ? "WARNING" : "SAFE",
    value: riskCode,
    message: blocked
      ? "Execution is blocked by HIGH_RISK_BLOCKED risk code."
      : warning
        ? "High risk detected. Entry to preparation is allowed only with warning logs."
        : "Risk level is within guard limits.",
  };
}

export function checkSystemSafety(systemHealthScore: number): ExecutionGuardCheck {
  const passed = systemHealthScore > 60;
  const warning = passed && systemHealthScore <= 75;

  return {
    check_name: "system_health",
    passed,
    level: passed ? (warning ? "WARNING" : "SAFE") : "BLOCKED",
    value: systemHealthScore,
    message: passed
      ? warning
        ? "System health is acceptable but below the preferred safety buffer."
        : "System health score is safe."
      : "Execution is blocked because system health score is not greater than 60.",
  };
}

function checkNoShopeeWriteFlag(noShopeeWriteFlag: boolean): ExecutionGuardCheck {
  return {
    check_name: "no_shopee_write",
    passed: noShopeeWriteFlag === true,
    level: noShopeeWriteFlag ? "SAFE" : "BLOCKED",
    value: noShopeeWriteFlag,
    message: noShopeeWriteFlag
      ? "Shopee write protection flag is enabled."
      : "Execution is blocked because Shopee write protection flag is not enabled.",
  };
}

export function blockUnsafeExecution(params: {
  item: ApprovalRequestItem;
  checks: ExecutionGuardCheck[];
  no_shopee_write_flag: boolean;
  system_health_score: number;
}): ExecutionGuardItem {
  const guardStatus = guardStatusFromChecks(params.checks);
  const blockReasons = params.checks
    .filter((check) => !check.passed && check.level === "BLOCKED")
    .map((check) => check.message);
  const warnings = params.checks
    .filter((check) => check.level === "WARNING")
    .map((check) => check.message);

  return {
    action_id: params.item.action_id,
    product_id: params.item.product_id,
    action_type: params.item.action_type,
    approval_status: params.item.approval_status,
    risk_level: params.item.risk_level,
    guard_status: guardStatus,
    can_enter_execution_preparation: guardStatus !== "BLOCKED",
    no_shopee_write_flag: params.no_shopee_write_flag,
    system_health_score: params.system_health_score,
    checks: params.checks,
    block_reasons: blockReasons,
    warnings,
    trace_id: `guard_${params.item.trace_id}`,
    decision_source: params.item.decision_source,
    expected_impact: params.item.expected_impact,
    readonly: true,
  };
}

async function writeGuardLog(params: {
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
      target_type: "execution_guard_layer",
      target_id: params.target_id,
      summary: params.summary,
      metadata: {
        readonly: true,
        no_external_execution: true,
        ...params.metadata,
      },
    });
  } catch {
    // Guard logs must never trigger or block execution decisions.
  }
}

async function writeGuardLogs(results: ExecutionGuardItem[]) {
  await Promise.all(
    results.slice(0, 20).flatMap((item) => {
      const logs: Array<ReturnType<typeof writeGuardLog>> = [];

      if (item.guard_status === "BLOCKED") {
        logs.push(
          writeGuardLog({
            action_type: "guard_check_blocked",
            target_id: item.action_id,
            summary: "Execution guard blocked an action before execution preparation.",
            metadata: item,
          }),
          writeGuardLog({
            action_type: "execution_prevented",
            target_id: item.action_id,
            summary: "Execution was prevented by final guard checks.",
            metadata: {
              action_id: item.action_id,
              block_reasons: item.block_reasons,
            },
          }),
        );
      } else {
        logs.push(
          writeGuardLog({
            action_type: "guard_check_passed",
            target_id: item.action_id,
            summary:
              item.guard_status === "WARNING"
                ? "Execution guard passed with warnings for preparation only."
                : "Execution guard passed for preparation only.",
            metadata: item,
          }),
        );
      }

      if (item.warnings.length > 0) {
        logs.push(
          writeGuardLog({
            action_type: "guard_risk_detected",
            target_id: item.action_id,
            summary: "Execution guard detected risk warnings.",
            metadata: {
              action_id: item.action_id,
              warnings: item.warnings,
            },
          }),
        );
      }

      return logs;
    }),
  );
}

function summarize(
  results: ExecutionGuardItem[],
  systemHealthScore: number,
  noShopeeWriteFlag: boolean,
): ExecutionGuardSummary {
  return {
    total_checked: results.length,
    safe_count: results.filter((item) => item.guard_status === "SAFE").length,
    warning_count: results.filter((item) => item.guard_status === "WARNING").length,
    blocked_count: results.filter((item) => item.guard_status === "BLOCKED").length,
    execution_prevented_count: results.filter((item) => !item.can_enter_execution_preparation).length,
    system_health_score: systemHealthScore,
    no_shopee_write_flag: noShopeeWriteFlag,
  };
}

export async function validateBeforeExecution(
  input: ExecutionGuardInput = {},
): Promise<ExecutionGuardResponse> {
  const [approvalResponse, systemHealth] = await Promise.all([
    generateApprovalRequests(),
    getSystemHealthResponse(),
  ]);
  const noShopeeWriteFlag = input.no_shopee_write_flag ?? true;
  const systemHealthScore = systemHealth.system_health_score;
  const approvalItems = input.action_id
    ? approvalResponse.approval_queue.filter((item) => item.action_id === input.action_id)
    : approvalResponse.approval_queue;

  const guardResults = approvalItems.map((item) =>
    blockUnsafeExecution({
      item,
      no_shopee_write_flag: noShopeeWriteFlag,
      system_health_score: systemHealthScore,
      checks: [
        checkApprovalStatus(item),
        checkRiskLevel(item),
        checkSystemSafety(systemHealthScore),
        checkNoShopeeWriteFlag(noShopeeWriteFlag),
      ],
    }),
  );

  await writeGuardLogs(guardResults);

  return {
    source: approvalResponse.source,
    generated_at: nowIso(),
    guard_results: guardResults,
    safe_queue: guardResults.filter((item) => item.can_enter_execution_preparation),
    blocked_executions: guardResults.filter((item) => item.guard_status === "BLOCKED"),
    summary: summarize(guardResults, systemHealthScore, noShopeeWriteFlag),
    readonly: true,
  };
}

export async function getExecutionSafeQueueResponse() {
  const response = await validateBeforeExecution();
  return {
    source: response.source,
    generated_at: response.generated_at,
    safe_queue: response.safe_queue,
    summary: response.summary,
    readonly: true,
  };
}

export async function getBlockedExecutionsResponse() {
  const response = await validateBeforeExecution();
  return {
    source: response.source,
    generated_at: response.generated_at,
    blocked_executions: response.blocked_executions,
    summary: response.summary,
    readonly: true,
  };
}
