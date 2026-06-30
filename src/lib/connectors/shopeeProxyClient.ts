import type { ShopeeBindingPublicStatus } from "@/types";

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
  const shops = Array.isArray(payload.shops) ? payload.shops : [];
  const firstShop = shops[0] as Record<string, unknown> | undefined;
  const status = String(payload.status || firstShop?.status || (shops.length ? "bound" : "unbound"));

  return {
    configured: true,
    bound: Boolean(payload.bound ?? shops.length > 0),
    status: status as ShopeeBindingPublicStatus["status"],
    shop_id: typeof payload.shop_id === "string" ? payload.shop_id : typeof firstShop?.shop_id === "string" ? firstShop.shop_id : null,
    shop_name:
      typeof payload.shop_name === "string" ? payload.shop_name : typeof firstShop?.shop_name === "string" ? firstShop.shop_name : null,
    region: typeof payload.region === "string" ? payload.region : typeof firstShop?.region === "string" ? firstShop.region : null,
    token_expire_at:
      typeof payload.token_expire_at === "string"
        ? payload.token_expire_at
        : typeof firstShop?.token_expire_at === "string"
          ? firstShop.token_expire_at
          : null,
    last_sync_at:
      typeof payload.last_sync_at === "string"
        ? payload.last_sync_at
        : typeof firstShop?.last_sync_at === "string"
          ? firstShop.last_sync_at
          : null,
    auth_url: authUrl,
    message: String(payload.message || (shops.length ? "已通过固定 IP 代理绑定店铺。" : "可通过固定 IP 代理授权店铺。")),
    shops: shops as ShopeeBindingPublicStatus["shops"],
  };
}

export async function getShopeeProxyBindingStatus(authUrl: string): Promise<ShopeeBindingPublicStatus> {
  const payload = await proxyFetch("binding");
  return normalizeProxyBindingStatus(payload, authUrl);
}
