import { NextResponse } from "next/server";
import { dataService } from "@/lib/dataService";
import { logApiError, tenantServiceJson } from "@/lib/errorHandler";
import { tenantIdFromRequest, withTenant } from "@/lib/tenantContext";
import type { PlanType } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const planTypes = new Set(["free", "pro", "enterprise"]);

function normalizePlan(value: unknown): PlanType {
  return typeof value === "string" && planTypes.has(value) ? (value as PlanType) : "free";
}

export async function GET(request: Request) {
  return tenantServiceJson(request, "/api/tenants", dataService.getTenants);
}

export async function POST(request: Request) {
  const tenantId = tenantIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as
    | { tenant_id?: string; name?: string; plan_type?: unknown }
    | null;

  if (!body?.name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  try {
    const result = await withTenant(tenantId, () =>
      dataService.createTenant({
        tenant_id: body.tenant_id,
        name: body.name!,
        plan_type: normalizePlan(body.plan_type),
      }),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logApiError("/api/tenants", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "租户创建失败。" },
      { status: 400 },
    );
  }
}
