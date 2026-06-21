import { NextResponse } from "next/server";
import {
  getShopeeBindingStatus,
  updateShopeeShopBindingProfile,
} from "@/lib/connectors/shopeeBindingRepository";
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
        message: "店铺授权状态暂不可用。",
        shops: [],
      },
      { status: 200 },
    );
  }
}

export async function PATCH(request: Request) {
  const tenantId = tenantIdFromRequest(request);

  try {
    const body = (await request.json().catch(() => ({}))) as {
      shop_id?: string;
      shop_name?: string | null;
      owner_name?: string | null;
      notes?: string | null;
    };

    if (!body.shop_id) {
      return NextResponse.json({ tenant_id: tenantId, error: "缺少店铺编号。" }, { status: 400 });
    }

    const result = await withTenant(tenantId, async () => {
      await updateShopeeShopBindingProfile({
        shop_id: body.shop_id ?? "",
        shop_name: body.shop_name,
        owner_name: body.owner_name,
        notes: body.notes,
      });
      return getShopeeBindingStatus("/api/shopee/auth/start");
    });

    return NextResponse.json({ tenant_id: tenantId, ...result });
  } catch (error) {
    logApiError("/api/shopee/binding", error);
    return NextResponse.json({ tenant_id: tenantId, error: "店铺授权信息暂时无法保存。" }, { status: 500 });
  }
}
