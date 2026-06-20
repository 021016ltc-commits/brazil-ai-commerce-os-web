import { NextResponse } from "next/server";
import { dataService } from "@/lib/dataService";
import { logApiError } from "@/lib/errorHandler";
import { tenantIdFromRequest, withTenant } from "@/lib/tenantContext";
import type { DecisionFeedbackInput, DecisionState, DecisionUserAction } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const decisionStates: DecisionState[] = ["LOCKED", "RECOMMEND", "OBSERVE", "BLOCKED"];
const userActions: DecisionUserAction[] = ["buy", "ignore", "observe", "reject"];

function isDecisionFeedbackInput(value: unknown): value is DecisionFeedbackInput {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const userAction = record.user_action ?? record.userAction;
  const source = record.source ?? "manual";
  return (
    typeof record.product_id === "string" &&
    decisionStates.includes(record.decisionState as DecisionState) &&
    userActions.includes(userAction as DecisionUserAction) &&
    (source === "shopee" || source === "manual")
  );
}

export async function POST(request: Request) {
  const tenantId = tenantIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as unknown;

  if (!isDecisionFeedbackInput(body)) {
    return NextResponse.json(
      {
        error:
          "Invalid decision feedback payload. product_id, decisionState, user_action, and source are required.",
      },
      { status: 400 },
    );
  }

  try {
    const normalizedBody = {
      ...body,
      user_action: body.user_action ?? body.userAction,
      source: body.source ?? "manual",
    };
    const result = await withTenant(tenantId, () => dataService.postDecisionFeedback(normalizedBody));
    return NextResponse.json({ tenant_id: tenantId, ...result });
  } catch (error) {
    logApiError("/api/decision/feedback", error);
    return NextResponse.json(
      { tenant_id: tenantId, source: "mock", error: "Decision feedback failed safely." },
      { status: 500 },
    );
  }
}
