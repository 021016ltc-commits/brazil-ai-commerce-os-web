import { NextRequest, NextResponse } from "next/server";
import {
  exchangeShopeeCodeForToken,
  officialShopeeConfigured,
  shopeeOAuthCookieName,
} from "@/lib/connectors/shopeeOfficialClient";
import { exchangeShopeeProxyCodeForToken, shopeeProxyConfigured } from "@/lib/connectors/shopeeProxyClient";
import { logApiError } from "@/lib/errorHandler";
import { withTenant } from "@/lib/tenantContext";
import { recordOperationLog } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectToShopee(request: NextRequest, status: string, reason?: string, detail?: string) {
  const target = new URL("/shopee", request.url);
  target.searchParams.set("binding", status);
  if (reason) target.searchParams.set("reason", reason);
  if (detail) target.searchParams.set("detail", detail);
  return NextResponse.redirect(target);
}

function firstParam(url: URL, names: string[]) {
  for (const name of names) {
    const value = url.searchParams.get(name);
    if (value) return value;
  }
  return "";
}

function firstShopIdFromList(raw: string) {
  const value = raw.trim();
  if (!value) return "";

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === "string" || typeof item === "number") {
          const shopId = String(item).trim();
          if (/^\d+$/.test(shopId)) return shopId;
        }
        if (item && typeof item === "object" && "shop_id" in item) {
          const shopId = String((item as { shop_id: unknown }).shop_id).trim();
          if (/^\d+$/.test(shopId)) return shopId;
        }
      }
    }
  } catch {
    // Shopee may return comma-separated shop IDs instead of JSON.
  }

  const match = value.match(/\d+/);
  return match?.[0] ?? "";
}

function resolveShopId(url: URL) {
  const directShopId = firstParam(url, ["shop_id", "shopId", "shopid"]);
  if (directShopId) return directShopId;

  const shopIdList = firstParam(url, ["shop_id_list", "shop_ids", "shopIds"]);
  if (shopIdList) return firstShopIdFromList(shopIdList);

  return "";
}

function safeParamKeys(url: URL) {
  return Array.from(url.searchParams.keys()).filter((key) => key !== "code");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Shopee authorization error.";
}

function publicFailureDetail(error: unknown) {
  const message = errorMessage(error)
    .replace(/[A-Za-z0-9_-]{24,}/g, "[hidden]")
    .replace(/\s+/g, " ")
    .trim();

  if (!message) return "授权服务没有返回明确原因。";
  return message.slice(0, 180);
}

async function exchangeCodeForBinding(params: { code: string; shop_id: string }) {
  const errors: string[] = [];

  if (shopeeProxyConfigured()) {
    try {
      return await exchangeShopeeProxyCodeForToken(params);
    } catch (error) {
      errors.push(`固定 IP 代理：${errorMessage(error)}`);
    }
  }

  if (officialShopeeConfigured()) {
    try {
      return await exchangeShopeeCodeForToken(params);
    } catch (error) {
      errors.push(`官方接口直连：${errorMessage(error)}`);
    }
  }

  throw new Error(errors.length ? errors.join("；") : "Shopee token exchange is not configured.");
}

async function recordCallbackIssue(params: {
  tenantId: string | null;
  issueType: string;
  shopId: string;
  reason: string;
  metadata: Record<string, unknown>;
}) {
  await withTenant(params.tenantId, () =>
    recordOperationLog({
      action_type: "shopee_binding_failed",
      actor_user_id: "system",
      actor_email: "system@local",
      target_type: "shopee_shop_binding",
      target_id: params.shopId || "unknown",
      summary: params.reason,
      status: "failed",
      metadata: { issue_type: params.issueType, ...params.metadata },
    }),
  ).catch(() => undefined);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const shopId = resolveShopId(url);
  const state = url.searchParams.get("state") ?? url.searchParams.get("random") ?? "";
  const expectedState = request.cookies.get(shopeeOAuthCookieName())?.value ?? "";
  const tenantId = request.cookies.get("baico_shopee_oauth_tenant")?.value ?? null;

  if (!code) {
    await recordCallbackIssue({
      tenantId,
      issueType: "missing_code",
      shopId,
      reason: "Shopee authorization callback did not include code.",
      metadata: { param_keys: safeParamKeys(url) },
    });
    const response = redirectToShopee(request, "failed", "missing_code");
    response.cookies.delete(shopeeOAuthCookieName());
    response.cookies.delete("baico_shopee_oauth_tenant");
    return response;
  }

  if (!shopId) {
    await recordCallbackIssue({
      tenantId,
      issueType: "missing_shop_id",
      shopId,
      reason: "Shopee authorization callback did not include a shop ID.",
      metadata: {
        param_keys: safeParamKeys(url),
        has_shop_id_list: Boolean(firstParam(url, ["shop_id_list", "shop_ids", "shopIds"])),
        main_account_id: firstParam(url, ["main_account_id", "mainAccountId"]),
        merchant_id: firstParam(url, ["merchant_id", "merchantId"]),
      },
    });
    const response = redirectToShopee(request, "failed", "missing_shop_id");
    response.cookies.delete(shopeeOAuthCookieName());
    response.cookies.delete("baico_shopee_oauth_tenant");
    return response;
  }

  if (state && expectedState && state !== expectedState) {
    await recordCallbackIssue({
      tenantId,
      issueType: "state_mismatch",
      shopId,
      reason: "Shopee authorization callback state did not match.",
      metadata: { param_keys: safeParamKeys(url), shop_id: shopId },
    });
    const response = redirectToShopee(request, "failed", "state_mismatch");
    response.cookies.delete(shopeeOAuthCookieName());
    response.cookies.delete("baico_shopee_oauth_tenant");
    return response;
  }

  try {
    await withTenant(tenantId, () =>
      exchangeCodeForBinding({ code, shop_id: shopId }),
    );
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
          error: errorMessage(error),
        },
      }),
    ).catch(() => undefined);

    const response = redirectToShopee(request, "failed", "token_exchange_failed", publicFailureDetail(error));
    response.cookies.delete(shopeeOAuthCookieName());
    response.cookies.delete("baico_shopee_oauth_tenant");
    return response;
  }
}
