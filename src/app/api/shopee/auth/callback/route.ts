import { NextRequest, NextResponse } from "next/server";
import {
  exchangeShopeeCodeForToken,
  shopeeOAuthCookieName,
} from "@/lib/connectors/shopeeOfficialClient";
import { logApiError } from "@/lib/errorHandler";
import { withTenant } from "@/lib/tenantContext";
import { recordOperationLog } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectToShopee(request: NextRequest, status: string) {
  return NextResponse.redirect(new URL(`/shopee?binding=${status}`, request.url));
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const shopId = url.searchParams.get("shop_id") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const expectedState = request.cookies.get(shopeeOAuthCookieName())?.value ?? "";
  const tenantId = request.cookies.get("baico_shopee_oauth_tenant")?.value ?? null;

  if (!code || !shopId || !state || !expectedState || state !== expectedState) {
    const response = redirectToShopee(request, "failed");
    response.cookies.delete(shopeeOAuthCookieName());
    response.cookies.delete("baico_shopee_oauth_tenant");
    return response;
  }

  try {
    await withTenant(tenantId, () => exchangeShopeeCodeForToken({ code, shop_id: shopId }));
    const response = redirectToShopee(request, "success");
    response.cookies.delete(shopeeOAuthCookieName());
    response.cookies.delete("baico_shopee_oauth_tenant");
    return response;
  } catch (error) {
    logApiError("/api/shopee/auth/callback", error);
    await withTenant(tenantId, () =>
      recordOperationLog({
        action_type: "shopee_binding_failed",
        actor_user_id: "system",
        actor_email: "system@local",
        target_type: "shopee_shop_binding",
        target_id: shopId,
        summary: "Shopee shop authorization failed.",
        status: "failed",
        metadata: {
          shop_id: shopId,
          error: error instanceof Error ? error.message : "Unknown Shopee authorization error.",
        },
      }),
    ).catch(() => undefined);

    const response = redirectToShopee(request, "failed");
    response.cookies.delete(shopeeOAuthCookieName());
    response.cookies.delete("baico_shopee_oauth_tenant");
    return response;
  }
}
