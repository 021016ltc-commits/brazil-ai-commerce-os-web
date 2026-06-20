import { NextResponse } from "next/server";
import { dataService } from "@/lib/dataService";
import { logApiError } from "@/lib/errorHandler";
import { tenantIdFromRequest, withTenant } from "@/lib/tenantContext";
import type {
  ActionExecutionCreateInput,
  ExecutionActionType,
  ExecutionSuggestedBy,
} from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actionTypes: ExecutionActionType[] = ["purchase", "stock", "price", "ad", "listing"];
const suggestedByValues: ExecutionSuggestedBy[] = ["decisionEngine", "taskSystem"];

function isCreateInput(value: unknown): value is ActionExecutionCreateInput {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.product_id === "string" &&
    actionTypes.includes(record.action_type as ExecutionActionType) &&
    suggestedByValues.includes(record.suggested_by as ExecutionSuggestedBy)
  );
}

export async function POST(request: Request) {
  const tenantId = tenantIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as unknown;

  if (!isCreateInput(body)) {
    return NextResponse.json(
      {
        error: "Invalid action payload. action_type, product_id, and suggested_by are required.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await withTenant(tenantId, () => dataService.createAction(body));
    return NextResponse.json({ tenant_id: tenantId, ...result });
  } catch (error) {
    logApiError("/api/actions/create", error);
    return NextResponse.json(
      { tenant_id: tenantId, source: "mock", error: "Action creation failed safely." },
      { status: 500 },
    );
  }
}
