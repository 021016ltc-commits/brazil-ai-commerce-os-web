import type { PlatformShopBindingPublicItem, ShopeeBindingPublicStatus } from "@/types";

type ProxyJson = Record<string, unknown>;

export type ShopeeProxyHealthStatus = {
  configured: boolean;
  reachable: boolean;
  proxy_url: string | null;
  partner_configured: boolean;
  message: string;
  checked_at: string;
};

function proxyBaseUrl() {
  return process.env.SHOPEE_READONLY_API_BASE_URL?.trim().replace(/\/$/, "") || "";
}

function proxyToken() {
  return process.env.SHOPEE_READONLY_ACCESS_TOKEN?.trim() || "";
}

export function shopeeProxyConfigured() {
  return Boolean(proxyBaseUrl());
}

export function shopeeProxyPublicUrl() {
  const baseUrl = proxyBaseUrl();
  if (!baseUrl) return null;
  try {
    return new URL(baseUrl).origin;
  } catch {
    return baseUrl;
  }
}

export function shopeeProxyTokenConfigured() {
  return Boolean(proxyToken());
}

function proxyHeaders(): HeadersInit {
  const token = proxyToken();
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function proxyFetch(path: string, init?: RequestInit): Promise<ProxyJson> {
  const baseUrl = proxyBaseUrl();
  if (!baseUrl) throw new Error("Shopee read-only proxy is not configured.");

  const response = await fetch(new URL(path.replace(/^\//, ""), `${baseUrl}/`), {
    ...init,
    headers: {
      ...proxyHeaders(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as ProxyJson;
  if (!response.ok || payload.error) {
    throw new Error(String(payload.error || payload.message || `Shopee proxy returned ${response.status}.`));
  }

  return payload;
}

export async function checkShopeeProxyHealth(): Promise<ShopeeProxyHealthStatus> {
  const baseUrl = proxyBaseUrl();
  const checkedAt = new Date().toISOString();

  if (!baseUrl) {
    return {
      configured: false,
      reachable: false,
      proxy_url: null,
      partner_configured: false,
      message: "固定 IP 代理尚未配置。",
      checked_at: checkedAt,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(new URL("health", `${baseUrl}/`), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as ProxyJson;
    const partnerConfigured = Boolean(payload.configured);

    return {
      configured: true,
      reachable: response.ok,
      proxy_url: shopeeProxyPublicUrl(),
      partner_configured: partnerConfigured,
      message: response.ok
        ? partnerConfigured
          ? "固定 IP 代理运行正常。"
          : "固定 IP 代理可访问，但 Partner ID/Key 未配置。"
        : `固定 IP 代理返回 ${response.status}。`,
      checked_at: checkedAt,
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      proxy_url: shopeeProxyPublicUrl(),
      partner_configured: false,
      message: "固定 IP 代理暂时不可访问。",
      checked_at: checkedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function buildShopeeProxyAuthorizationUrl(params: {
  redirect_url: string;
  state: string;
}) {
  const url = new URL("auth/url", `${proxyBaseUrl()}/`);
  url.searchParams.set("redirect_url", params.redirect_url);
  url.searchParams.set("state", params.state);

  const response = await fetch(url, {
    method: "GET",
    headers: proxyHeaders(),
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as ProxyJson;
  if (!response.ok || payload.error || typeof payload.authorization_url !== "string") {
    throw new Error(String(payload.error || payload.message || "Shopee proxy did not return an authorization URL."));
  }

  return payload.authorization_url;
}

export async function exchangeShopeeProxyCodeForToken(params: { code: string; shop_id: string }) {
  return proxyFetch("auth/token", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function updateShopeeProxyShopBindingProfile(input: {
  shop_id: string;
  shop_name?: string | null;
  owner_name?: string | null;
  notes?: string | null;
}): Promise<ShopeeBindingPublicStatus> {
  const payload = await proxyFetch("binding/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return normalizeProxyBindingStatus(payload, "/api/shopee/auth/start");
}

function normalizeProxyBindingStatus(payload: ProxyJson, authUrl: string): ShopeeBindingPublicStatus {
  const rawShops = Array.isArray(payload.shops) ? payload.shops : [];
  const shops = rawShops
    .map((shop, index) => sanitizeProxyShop(shop, index))
    .filter((shop): shop is PlatformShopBindingPublicItem => Boolean(shop));
  const payloadShop = sanitizeProxyShop(payload, shops.length);
  if (!shops.length && payloadShop) shops.push(payloadShop);

  const firstShop = shops[0];
  const status = normalizeBindingStatus(payload.status || firstShop?.status || (shops.length ? "bound" : "unbound"));

  return {
    configured: true,
    bound: Boolean(payload.bound ?? shops.length > 0),
    status,
    shop_id: asString(payload.shop_id) ?? firstShop?.shop_id ?? null,
    shop_name: asString(payload.shop_name) ?? firstShop?.shop_name ?? null,
    region: asString(payload.region) ?? firstShop?.region ?? null,
    token_expire_at: asString(payload.token_expire_at) ?? firstShop?.token_expire_at ?? null,
    last_sync_at: asString(payload.last_sync_at) ?? firstShop?.last_sync_at ?? null,
    auth_url: authUrl,
    message: String(payload.message || (shops.length ? "已通过固定 IP 代理绑定店铺。" : "可通过固定 IP 代理授权店铺。")),
    shops,
  };
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeBindingStatus(value: unknown): ShopeeBindingPublicStatus["status"] {
  const status = asString(value);
  if (status === "bound" || status === "expired" || status === "error" || status === "unbound") return status;
  return "unbound";
}

function sanitizeProxyShop(value: unknown, index: number): PlatformShopBindingPublicItem | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const shopId = asString(raw.shop_id);
  if (!shopId) return null;

  const updatedAt = asString(raw.updated_at) ?? asString(raw.last_sync_at) ?? new Date().toISOString();

  return {
    binding_id: asString(raw.binding_id) ?? `shopee_proxy_binding_${shopId}_${index}`,
    platform: "Shopee",
    platform_label: "Shopee",
    shop_id: shopId,
    shop_name: asString(raw.shop_name),
    region: asString(raw.region) ?? "BR",
    owner_name: asString(raw.owner_name),
    notes: asString(raw.notes),
    status: normalizeBindingStatus(raw.status),
    bound_at: asString(raw.bound_at) ?? updatedAt,
    updated_at: updatedAt,
    last_sync_at: asString(raw.last_sync_at),
    token_expire_at: asString(raw.token_expire_at),
    readonly: true,
  };
}

export async function getShopeeProxyBindingStatus(authUrl: string): Promise<ShopeeBindingPublicStatus> {
  const payload = await proxyFetch("binding");
  return normalizeProxyBindingStatus(payload, authUrl);
}
