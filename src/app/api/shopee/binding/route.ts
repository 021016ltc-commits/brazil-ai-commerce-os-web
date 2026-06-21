import { NextResponse } from "next/server";
import { getShopeeBindingStatus } from "@/lib/connectors/shopeeBindingRepository";
import { logApiError } from "@/lib/errorHandler";
import { tenantIdFromRequest, withTenant } from "@/lib/tenantContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenantId = tenantIdFromRequest(request);

  try {
    const result = await withTenant(tenantId, () => getShopeeBindingStatus("/api/shopee/auth/start"));
    return NextResponse.json({ tenant_id: tenantId, ...result });
  } catch (error) {
    logApiError("/api/shopee/binding", error);
    return NextResponse.json(
      {
        tenant_id: tenantId,
        configured: false,
        bound: false,
        status: "error",
        shop_id: null,
        shop_name: null,
        region: null,
        token_expire_at: null,
        last_sync_at: null,
        auth_url: null,
        message: "Shopee 店铺绑定状态暂不可用。",
      },
      { status: 200 },
    );
  }
}
