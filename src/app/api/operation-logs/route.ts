import { NextResponse } from "next/server";
import { dataService } from "@/lib/dataService";
import { logApiError, tenantServiceJson } from "@/lib/errorHandler";
import { tenantIdFromRequest, withTenant } from "@/lib/tenantContext";
import type { OperationLogAction } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return tenantServiceJson(request, "/api/operation-logs", dataService.getOperationLogs);
}

const allowedActions = new Set<OperationLogAction>([
  "login",
  "user_login",
  "logout",
  "admin_seeded",
  "approval",
  "user_create",
  "user_update",
  "action_create",
  "action_approve",
  "action_reject",
  "action_execute",
  "shopee_api_request",
  "shopee_fallback",
  "shopee_token_refresh",
  "sync_start",
  "sync_complete",
  "snapshot_created",
  "drift_detected",
  "analytics_run",
  "anomaly_detected",
  "risk_flagged",
  "decision_generated",
  "action_ranked",
  "opportunity_detected",
  "queue_created",
  "queue_prioritized",
  "queue_grouped",
  "approval_created",
  "approval_approved",
  "approval_rejected",
  "approval_escalated",
  "guard_check_passed",
  "guard_check_blocked",
  "guard_risk_detected",
  "execution_prevented",
  "virtual_execution_started",
  "virtual_execution_completed",
  "execution_simulated",
  "execution_report_generated",
]);

export async function POST(request: Request) {
  const tenantId = tenantIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as
    | {
        action_type?: OperationLogAction;
        actor_user_id?: string;
        actor_email?: string;
        target_type?: string;
        target_id?: string;
        summary?: string;
        status?: "success" | "failed";
        metadata?: Record<string, unknown>;
      }
    | null;

  if (!body?.action_type || !allowedActions.has(body.action_type)) {
    return NextResponse.json({ error: "Invalid operation log action." }, { status: 400 });
  }

  const actionType = body.action_type;

  try {
    const result = await withTenant(tenantId, () =>
      dataService.createOperationLog({
        action_type: actionType,
        actor_user_id: body.actor_user_id,
        actor_email: body.actor_email,
        target_type: body.target_type,
        target_id: body.target_id,
        summary: body.summary,
        status: body.status,
        metadata: body.metadata,
      }),
    );
    return NextResponse.json({ tenant_id: tenantId, ...result }, { status: 201 });
  } catch (error) {
    logApiError("/api/operation-logs", error);
    return NextResponse.json(
      { tenant_id: tenantId, source: "mock", error: "Operation log write failed safely." },
      { status: 500 },
    );
  }
}
