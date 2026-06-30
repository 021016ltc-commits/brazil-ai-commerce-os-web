import { NextRequest, NextResponse } from "next/server";
import {
  buildShopeeAuthorizationUrl,
  createShopeeOAuthState,
  shopeePartnerId,
  shopeeOAuthCookieMaxAge,
  shopeeOAuthCookieName,
} from "@/lib/connectors/shopeeOfficialClient";
import { shopeeProxyConfigured } from "@/lib/connectors/shopeeProxyClient";
import { logApiError } from "@/lib/errorHandler";
import { tenantIdFromRequest } from "@/lib/tenantContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildShopeeOpenPlatformAuthorizationUrl(state: string) {
  const partnerId = shopeePartnerId();
  if (!partnerId) {
    throw new Error("Shopee Partner ID is not configured.");
  }

  const url = new URL("https://open.shopee.com/authorize");
  url.searchParams.set("auth_shop", "true");
  url.searchParams.set("auth_type", "shop");
  url.searchParams.set("id", partnerId);
  url.searchParams.set("isRedirect", "true");
  url.searchParams.set("is_agent", "false");
  url.searchParams.set("random", state);
  return url.toString();
}

export async function GET(request: NextRequest) {
  const tenantId = tenantIdFromRequest(request);
  const origin = new URL(request.url).origin;
  const state = createShopeeOAuthState();

  try {
    // Shopee's live shop authorization flow currently lands on the classic
    // Open Platform authorization page. Keep token exchange in the fixed-IP
    // proxy/callback layer, but send sellers to the stable authorization UI.
    const authorizationUrl = shopeeProxyConfigured()
      ? buildShopeeOpenPlatformAuthorizationUrl(state)
      : buildShopeeAuthorizationUrl(origin, state);
    const response = NextResponse.redirect(authorizationUrl);

    response.cookies.set(shopeeOAuthCookieName(), state, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https://"),
      maxAge: shopeeOAuthCookieMaxAge(),
      path: "/",
    });
    response.cookies.set("baico_shopee_oauth_tenant", tenantId, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https://"),
      maxAge: shopeeOAuthCookieMaxAge(),
      path: "/",
    });

    return response;
  } catch (error) {
    logApiError("/api/shopee/auth/start", error);
    return NextResponse.redirect(new URL("/shopee?binding=not_configured", origin));
  }
}
