import { NextResponse } from "next/server";
import {
  getShopeeBindingStatus,
  updateShopeeShopBindingProfile,
} from "@/lib/connectors/shopeeBindingRepository";
import {
  checkShopeeProxyHealth,
  getShopeeProxyBindingStatus,
  shopeeProxyConfigured,
  shopeeProxyTokenConfigured,
  updateShopeeProxyShopBindingProfile,
  type ShopeeProxyHealthStatus,
} from "@/lib/connectors/shopeeProxyClient";
import { logApiError } from "@/lib/errorHandler";
import { tenantIdFromRequest, withTenant } from "@/lib/tenantContext";
import type { ShopeeBindingPublicStatus, ShopeeBindingReadiness } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fallbackBindingStatus(
  message: string,
  status: ShopeeBindingPublicStatus["status"] = "error",
): ShopeeBindingPublicStatus {
  return {
    configured: false,
    bound: false,
    status,
    shop_id: null,
    shop_name: null,
    region: null,
    token_expire_at: null,
    last_sync_at: null,
    auth_url: null,
    message,
    shops: [],
  };
}

function goLiveStatus(): ShopeeBindingReadiness["go_live_status"] {
  const raw = (process.env.SHOPEE_GO_LIVE_STATUS || "under_review").trim().toLowerCase();
  if (raw === "approved") return "approved";
  if (raw === "not_started") return "not_started";
  if (raw === "unknown") return "unknown";
  return "under_review";
}

function fixedIp() {
  return process.env.SHOPEE_FIXED_IP?.trim() || process.env.SHOPEE_WHITELIST_IP?.trim() || "47.236.75.140";
}

function redirectDomain(origin: string) {
  return process.env.SHOPEE_REDIRECT_DOMAIN?.trim() || origin;
}

function buildReadiness(params: {
  origin: string;
  binding: ShopeeBindingPublicStatus;
  proxyHealth: ShopeeProxyHealthStatus;
}): ShopeeBindingReadiness {
  const status = goLiveStatus();
  const proxyMode = shopeeProxyConfigured();
  const liveCredentialsConfigured = proxyMode ? params.proxyHealth.partner_configured : params.binding.configured;
  const canAuthorize =
    status === "approved" &&
    liveCredentialsConfigured &&
    params.binding.configured &&
    Boolean(params.binding.auth_url) &&
    (!proxyMode || (params.proxyHealth.reachable && shopeeProxyTokenConfigured()));
  const canSync =
    liveCredentialsConfigured &&
    params.binding.shops.some((shop) => shop.status === "bound" || shop.status === "expired") &&
    (!proxyMode || params.proxyHealth.reachable);
  const blockers: string[] = [];

  if (status !== "approved") blockers.push("Shopee Go Live 审核尚未通过。");
  if (!proxyMode) blockers.push("固定 IP 只读代理尚未接入线上系统。");
  if (proxyMode && !liveCredentialsConfigured) blockers.push("固定 IP 只读代理尚未配置 Shopee 凭证。");
  if (proxyMode && !params.proxyHealth.reachable) blockers.push("固定 IP 只读代理暂时不可访问。");
  if (proxyMode && !shopeeProxyTokenConfigured()) blockers.push("固定 IP 只读代理访问令牌尚未配置。");
  if (!params.binding.shops.length) blockers.push("尚未完成店铺授权。");

  return {
    go_live_status: status,
    redirect_domain: redirectDomain(params.origin),
    fixed_ip: fixedIp(),
    proxy_configured: proxyMode,
    proxy_reachable: params.proxyHealth.reachable,
    proxy_url: params.proxyHealth.proxy_url,
    live_credentials_configured: liveCredentialsConfigured,
    can_authorize: canAuthorize,
    can_sync: canSync,
    blockers,
    checked_at: params.proxyHealth.checked_at,
  };
}

function mergeBindingStatuses(
  primary: ShopeeBindingPublicStatus,
  secondary: ShopeeBindingPublicStatus | null,
): ShopeeBindingPublicStatus {
  if (!secondary?.shops?.length) return primary;

  const shopsById = new Map(primary.shops.map((shop) => [shop.shop_id, shop]));
  secondary.shops.forEach((shop) => {
    if (!shopsById.has(shop.shop_id)) shopsById.set(shop.shop_id, shop);
  });

  const shops = Array.from(shopsById.values());
  const preferred = shops.find((shop) => shop.status === "bound") ?? shops[0] ?? null;

  return {
    ...primary,
    bound: primary.bound || secondary.bound,
    status: primary.bound ? primary.status : secondary.status,
    shop_id: primary.shop_id ?? secondary.shop_id ?? preferred?.shop_id ?? null,
    shop_name: primary.shop_name ?? secondary.shop_name ?? preferred?.shop_name ?? null,
    region: primary.region ?? secondary.region ?? preferred?.region ?? null,
    token_expire_at: primary.token_expire_at ?? secondary.token_expire_at ?? preferred?.token_expire_at ?? null,
    last_sync_at: primary.last_sync_at ?? secondary.last_sync_at ?? preferred?.last_sync_at ?? null,
    message: primary.bound ? primary.message : secondary.message,
    shops,
  };
}

export async function GET(request: Request) {
  const tenantId = tenantIdFromRequest(request);
  const origin = new URL(request.url).origin;
  const proxyHealth = await checkShopeeProxyHealth();

  try {
    const result = await withTenant(tenantId, async () => {
      if (!shopeeProxyConfigured()) {
        return fallbackBindingStatus("Shopee Go Live 已通过，下一步需要接入固定 IP 只读代理后再授权店铺。", "unbound");
      }

      try {
        const proxyBinding = await getShopeeProxyBindingStatus("/api/shopee/auth/start");
        const localBinding = await getShopeeBindingStatus("/api/shopee/auth/start").catch(() => null);
        return mergeBindingStatuses(proxyBinding, localBinding);
      } catch (error) {
        logApiError("/api/shopee/binding/proxy", error);
        const localBinding = await getShopeeBindingStatus("/api/shopee/auth/start").catch(() => null);
        if (localBinding?.shops?.length) return localBinding;
        return fallbackBindingStatus("固定 IP 只读代理暂时不可用，店铺授权状态暂不可读。");
      }
    });

    return NextResponse.json({
      tenant_id: tenantId,
      ...result,
      readiness: buildReadiness({ origin, binding: result, proxyHealth }),
    });
  } catch (error) {
    logApiError("/api/shopee/binding", error);
    const result = fallbackBindingStatus("店铺授权状态暂不可用。");
    return NextResponse.json(
      {
        tenant_id: tenantId,
        ...result,
        readiness: buildReadiness({ origin, binding: result, proxyHealth }),
      },
      { status: 200 },
    );
  }
}

export async function PATCH(request: Request) {
  const tenantId = tenantIdFromRequest(request);
  const origin = new URL(request.url).origin;
  const proxyHealth = await checkShopeeProxyHealth();

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
      if (shopeeProxyConfigured()) {
        return updateShopeeProxyShopBindingProfile({
          shop_id: body.shop_id ?? "",
          shop_name: body.shop_name,
          owner_name: body.owner_name,
          notes: body.notes,
        });
      }

      await updateShopeeShopBindingProfile({
        shop_id: body.shop_id ?? "",
        shop_name: body.shop_name,
        owner_name: body.owner_name,
        notes: body.notes,
      });
      return getShopeeBindingStatus("/api/shopee/auth/start");
    });

    return NextResponse.json({
      tenant_id: tenantId,
      ...result,
      readiness: buildReadiness({ origin, binding: result, proxyHealth }),
    });
  } catch (error) {
    logApiError("/api/shopee/binding", error);
    return NextResponse.json({ tenant_id: tenantId, error: "店铺授权信息暂时无法保存。" }, { status: 500 });
  }
}
