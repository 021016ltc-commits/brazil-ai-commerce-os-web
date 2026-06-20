import { NextResponse } from "next/server";
import { dataService } from "@/lib/dataService";
import { logApiError, tenantServiceJson } from "@/lib/errorHandler";
import { tenantIdFromRequest, withTenant } from "@/lib/tenantContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return tenantServiceJson(request, "/api/workspaces", dataService.getWorkspaces);
}

export async function POST(request: Request) {
  const tenantId = tenantIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as
    | { workspace_id?: string; tenant_id?: string; name?: string; shop_count?: unknown }
    | null;

  if (!body?.name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  try {
    const result = await withTenant(body.tenant_id ?? tenantId, () =>
      dataService.createWorkspace({
        workspace_id: body.workspace_id,
        tenant_id: body.tenant_id ?? tenantId,
        name: body.name!,
        shop_count: Number(body.shop_count ?? 0),
      }),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logApiError("/api/workspaces", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "工作空间创建失败。" },
      { status: 400 },
    );
  }
}
