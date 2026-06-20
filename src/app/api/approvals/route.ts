import { NextResponse } from "next/server";
import { dataService } from "@/lib/dataService";
import { logApiError, tenantServiceJson } from "@/lib/errorHandler";
import { tenantIdFromRequest, withTenant } from "@/lib/tenantContext";
import type { ReviewStatus } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedStatuses = new Set(["pending_review", "approved_local", "rejected_local", "deferred_local"]);

export async function GET(request: Request) {
  return tenantServiceJson(request, "/api/approvals", dataService.getApprovals);
}

export async function PATCH(request: Request) {
  const tenantId = tenantIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as
    | { approval_id?: string; action_id?: string; status?: ReviewStatus; notes?: string; reviewer?: string }
    | null;

  const approvalId = body?.approval_id ?? body?.action_id;

  if (!approvalId || !body?.status || !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "Invalid local approval payload." }, { status: 400 });
  }

  const status = body.status;

  return withTenant(tenantId, async () => {
    try {
      const result = await dataService.updateApprovalStatus({
        approval_id: approvalId,
        status,
        notes: body.notes,
        reviewer: body.reviewer,
      });
      return NextResponse.json({ source: "sqlite", tenant_id: tenantId, ...result });
    } catch (error) {
      logApiError("/api/approvals", error);
      return NextResponse.json({
        source: "mock",
        tenant_id: tenantId,
        action: {
          action_id: approvalId,
          status,
        },
        history: {
          approval_id: approvalId,
          action: status,
          reviewer: body.reviewer ?? "local_operator",
          notes: body.notes ?? "No notes.",
        },
      });
    }
  });
}
