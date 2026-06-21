import { NextResponse } from "next/server";
import { dataService } from "@/lib/dataService";
import { logApiError } from "@/lib/errorHandler";
import { tenantIdFromRequest, withTenant } from "@/lib/tenantContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const tenantId = tenantIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as
    | {
        user_id?: string;
        account?: string;
        username?: string;
        display_name?: string;
        password?: string;
      }
    | null;

  if (!(body?.account || body?.username || body?.display_name || body?.user_id) || !body.password) {
    return NextResponse.json(
      { tenant_id: tenantId, error: "请输入账号和密码。" },
      { status: 400 },
    );
  }

  try {
    const result = await withTenant(tenantId, () =>
      dataService.loginUser({
        user_id: body.user_id,
        account: body.account,
        username: body.username,
        display_name: body.display_name,
        password: body.password,
      }),
    );
    return NextResponse.json({ tenant_id: tenantId, ...result });
  } catch (error) {
    logApiError("/api/login", error);
    return NextResponse.json(
      { tenant_id: tenantId, error: error instanceof Error ? error.message : "账号或密码不正确。" },
      { status: 401 },
    );
  }
}
