import { NextResponse } from "next/server";
import { dataService } from "@/lib/dataService";
import { logApiError } from "@/lib/errorHandler";
import { tenantIdFromRequest, withTenant } from "@/lib/tenantContext";
import type { ActionExecutionDecisionInput, ExecutionActorRole } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actorRoles: ExecutionActorRole[] = ["admin", "operator", "buyer", "finance", "viewer"];

function isDecisionInput(value: unknown): value is ActionExecutionDecisionInput {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.action_id === "string" && actorRoles.includes(record.actor_role as ExecutionActorRole);
}

export async function POST(request: Request) {
  const tenantId = tenantIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as unknown;

  if (!isDecisionInput(body)) {
    return NextResponse.json(
      {
        error: "Invalid approval payload. action_id and actor_role are required.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await withTenant(tenantId, () => dataService.approveAction(body));
    return NextResponse.json({ tenant_id: tenantId, ...result });
  } catch (error) {
    logApiError("/api/actions/approve", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Approval failed." },
      { status: 403 },
    );
  }
}
