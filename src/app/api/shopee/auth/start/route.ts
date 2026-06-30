import { NextRequest, NextResponse } from "next/server";
import {
  buildShopeeAuthorizationUrl,
  createShopeeOAuthState,
  shopeeOAuthCookieMaxAge,
  shopeeOAuthCookieName,
} from "@/lib/connectors/shopeeOfficialClient";
import { buildShopeeProxyAuthorizationUrl, shopeeProxyConfigured } from "@/lib/connectors/shopeeProxyClient";
import { logApiError } from "@/lib/errorHandler";
import { tenantIdFromRequest } from "@/lib/tenantContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tenantId = tenantIdFromRequest(request);
  const origin = new URL(request.url).origin;
  const state = createShopeeOAuthState();

  try {
    const redirectUrl = `${origin.replace(/\/$/, "")}/api/shopee/auth/callback`;
    const authorizationUrl = shopeeProxyConfigured()
      ? await buildShopeeProxyAuthorizationUrl({ redirect_url: redirectUrl, state })
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
