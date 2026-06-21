import { createHmac, randomBytes } from "node:crypto";
import {
  listShopeeShopBindings,
  markShopeeBindingLastSync,
  markShopeeBindingStatus,
  saveShopeeShopBinding,
  updateShopeeBindingTokens,
} from "@/lib/connectors/shopeeBindingRepository";
import { recordOperationLog } from "@/lib/users";
import type { ShopeeInventoryItem, ShopeeOrder, ShopeeProduct, ShopeeShopBinding } from "@/types";

export type OfficialShopeePayload = {
  orders: ShopeeOrder[];
  products: ShopeeProduct[];
  inventory: ShopeeInventoryItem[];
};

type ShopeeJson = Record<string, unknown>;

const defaultOpenApiBaseUrl = "https://partner.shopeemobile.com";
const authStateMaxAgeSeconds = 10 * 60;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function nowIso() {
  return new Date().toISOString();
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function asNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function asRecord(value: unknown): ShopeeJson {
  return value && typeof value === "object" ? (value as ShopeeJson) : {};
}

function asArray(value: unknown): ShopeeJson[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function officialBaseUrl() {
  return (
    process.env.SHOPEE_OPEN_API_BASE_URL?.trim() ||
    process.env.SHOPEE_AUTH_BASE_URL?.trim() ||
    process.env.SHOPEE_API_BASE_URL?.trim() ||
    defaultOpenApiBaseUrl
  ).replace(/\/$/, "");
}

export function shopeePartnerId() {
  return process.env.SHOPEE_PARTNER_ID?.trim() || process.env.SHOPEE_CLIENT_ID?.trim() || process.env.SHOPEE_API_KEY?.trim() || "";
}

function shopeePartnerKey() {
  return (
    process.env.SHOPEE_PARTNER_KEY?.trim() ||
    process.env.SHOPEE_CLIENT_SECRET?.trim() ||
    process.env.SHOPEE_SECRET?.trim() ||
    ""
  );
}

export function officialShopeeConfigured() {
  return Boolean(shopeePartnerId() && shopeePartnerKey());
}

function redirectUrl(origin: string) {
  return process.env.SHOPEE_REDIRECT_URL?.trim() || `${origin.replace(/\/$/, "")}/api/shopee/auth/callback`;
}

function signPath(path: string, timestamp: number, accessToken?: string, shopId?: string) {
  const base = `${shopeePartnerId()}${path}${timestamp}${accessToken ?? ""}${shopId ?? ""}`;
  return createHmac("sha256", shopeePartnerKey()).update(base).digest("hex");
}

function buildSignedUrl(
  path: string,
  query: Record<string, string | number | null | undefined> = {},
  binding?: Pick<ShopeeShopBinding, "shop_id" | "access_token">,
) {
  const timestamp = nowSeconds();
  const url = new URL(path, officialBaseUrl());

  url.searchParams.set("partner_id", shopeePartnerId());
  url.searchParams.set("timestamp", String(timestamp));

  if (binding) {
    url.searchParams.set("access_token", binding.access_token);
    url.searchParams.set("shop_id", binding.shop_id);
  }

  Object.entries(query).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  url.searchParams.set("sign", signPath(path, timestamp, binding?.access_token, binding?.shop_id));
  return url;
}

async function fetchShopeeJson(url: URL, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as ShopeeJson;
  if (!response.ok || payload.error) {
    const message = asString(payload.message || payload.error || `Shopee API returned ${response.status}`);
    throw new Error(message);
  }

  return payload;
}

function nestedRecord(payload: ShopeeJson, key: string) {
  return asRecord(payload[key] ?? asRecord(payload.response)[key]);
}

function nestedArray(payload: ShopeeJson, key: string) {
  return asArray(payload[key] ?? asRecord(payload.response)[key]);
}

function tokenPayload(payload: ShopeeJson) {
  const response = asRecord(payload.response);
  return Object.keys(response).length ? response : payload;
}

export function createShopeeOAuthState() {
  return randomBytes(24).toString("base64url");
}

export function shopeeOAuthCookieName() {
  return "baico_shopee_oauth_state";
}

export function shopeeOAuthCookieMaxAge() {
  return authStateMaxAgeSeconds;
}

export function buildShopeeAuthorizationUrl(origin: string, state: string) {
  if (!officialShopeeConfigured()) {
    throw new Error("Shopee Partner ID and Partner Key are not configured.");
  }

  const path = "/api/v2/shop/auth_partner";
  const timestamp = nowSeconds();
  const url = new URL(path, officialBaseUrl());
  const callbackUrl = new URL(redirectUrl(origin));
  callbackUrl.searchParams.set("state", state);

  url.searchParams.set("partner_id", shopeePartnerId());
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", signPath(path, timestamp));
  url.searchParams.set("redirect", callbackUrl.toString());
  url.searchParams.set("state", state);

  return url.toString();
}

export async function exchangeShopeeCodeForToken(params: { code: string; shop_id: string }) {
  if (!officialShopeeConfigured()) {
    throw new Error("Shopee Partner ID and Partner Key are not configured.");
  }

  const path = "/api/v2/auth/token/get";
  const url = buildSignedUrl(path);
  const payload = tokenPayload(
    await fetchShopeeJson(url, {
      method: "POST",
      body: JSON.stringify({
        code: params.code,
        shop_id: Number(params.shop_id),
        partner_id: Number(shopeePartnerId()),
      }),
    }),
  );

  const accessToken = asString(payload.access_token);
  const refreshToken = asString(payload.refresh_token);
  if (!accessToken || !refreshToken) {
    throw new Error("Shopee did not return an access token.");
  }

  const expireIn = asNumber(payload.expire_in, 0);
  const tokenExpireAt = expireIn > 0 ? new Date(Date.now() + expireIn * 1000).toISOString() : null;

  const binding = await saveShopeeShopBinding({
    shop_id: params.shop_id,
    partner_id: shopeePartnerId(),
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expire_at: tokenExpireAt,
    binding_status: "bound",
  });

  await recordOperationLog({
    action_type: "shopee_binding_created",
    actor_user_id: "system",
    actor_email: "system@local",
    target_type: "shopee_shop_binding",
    target_id: params.shop_id,
    summary: "Shopee shop authorized in read-only mode.",
    metadata: { readonly: true, shop_id: params.shop_id },
  });

  return binding;
}

function tokenNeedsRefresh(binding: ShopeeShopBinding) {
  if (!binding.token_expire_at) return false;
  return new Date(binding.token_expire_at).getTime() - Date.now() < 10 * 60 * 1000;
}

export async function refreshOfficialShopeeToken(binding: ShopeeShopBinding) {
  const path = "/api/v2/auth/access_token/get";
  const url = buildSignedUrl(path);
  const payload = tokenPayload(
    await fetchShopeeJson(url, {
      method: "POST",
      body: JSON.stringify({
        refresh_token: binding.refresh_token,
        shop_id: Number(binding.shop_id),
        partner_id: Number(shopeePartnerId()),
      }),
    }),
  );

  const accessToken = asString(payload.access_token, binding.access_token);
  const refreshToken = asString(payload.refresh_token, binding.refresh_token);
  const expireIn = asNumber(payload.expire_in, 0);
  const tokenExpireAt = expireIn > 0 ? new Date(Date.now() + expireIn * 1000).toISOString() : binding.token_expire_at;

  await updateShopeeBindingTokens({
    shop_id: binding.shop_id,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expire_at: tokenExpireAt,
  });

  await recordOperationLog({
    action_type: "shopee_token_refresh",
    actor_user_id: "system",
    actor_email: "system@local",
    target_type: "shopee_shop_binding",
    target_id: binding.shop_id,
    summary: "Shopee token refreshed for read-only data access.",
    metadata: { readonly: true },
  });

  return {
    ...binding,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expire_at: tokenExpireAt,
    binding_status: "bound" as const,
  };
}

async function ensureFreshBinding(binding: ShopeeShopBinding) {
  if (!tokenNeedsRefresh(binding)) return binding;

  try {
    return await refreshOfficialShopeeToken(binding);
  } catch (error) {
    await markShopeeBindingStatus(binding.shop_id, "expired").catch(() => undefined);
    throw error;
  }
}

async function officialGet(path: string, binding: ShopeeShopBinding, query: Record<string, string | number> = {}) {
  const url = buildSignedUrl(path, query, binding);
  return fetchShopeeJson(url, { method: "GET" });
}

function normalizeOfficialOrder(order: ShopeeJson): ShopeeOrder {
  const item = asArray(order.item_list)[0] ?? {};
  const productId = asString(item.item_id ?? item.product_id ?? item.itemId);
  const sku = asString(item.model_sku ?? item.item_sku ?? item.sku);
  const quantity = asNumber(item.model_quantity_purchased ?? item.quantity ?? order.quantity, 1);
  const price = asNumber(item.model_discounted_price ?? item.model_original_price ?? order.total_amount ?? order.price);
  const createdAt = asNumber(order.create_time) > 0
    ? new Date(asNumber(order.create_time) * 1000).toISOString()
    : asString(order.created_at, nowIso());

  return {
    order_id: asString(order.order_sn ?? order.order_id),
    product_id: productId,
    sku,
    quantity,
    price,
    order_status: asString(order.order_status ?? order.status, "unknown"),
    created_at: createdAt,
  };
}

function stockFromItem(item: ShopeeJson) {
  const stockInfo = asRecord(item.stock_info_v2);
  const summary = asRecord(stockInfo.summary_info);
  return asNumber(summary.total_available_stock ?? summary.normal_stock ?? item.stock ?? item.normal_stock);
}

function priceFromItem(item: ShopeeJson) {
  const priceInfo = asArray(item.price_info)[0] ?? {};
  return asNumber(priceInfo.current_price ?? priceInfo.original_price ?? item.price);
}

function normalizeOfficialProduct(item: ShopeeJson): ShopeeProduct {
  return {
    product_id: asString(item.item_id ?? item.product_id),
    title: asString(item.item_name ?? item.title ?? item.name),
    price: priceFromItem(item),
    stock: stockFromItem(item),
    sales_count: asNumber(item.historical_sold ?? item.sold ?? item.sales_count),
  };
}

function productToInventory(item: ShopeeProduct): ShopeeInventoryItem {
  return {
    product_id: item.product_id,
    available_stock: item.stock,
    reserved_stock: 0,
  };
}

async function fetchOfficialOrders(binding: ShopeeShopBinding): Promise<ShopeeOrder[]> {
  const timeTo = nowSeconds();
  const days = Math.max(1, Math.min(14, Number(process.env.SHOPEE_ORDER_SYNC_DAYS ?? 14)));
  const timeFrom = timeTo - days * 24 * 60 * 60;

  const listPayload = await officialGet("/api/v2/order/get_order_list", binding, {
    time_range_field: "create_time",
    time_from: timeFrom,
    time_to: timeTo,
    page_size: 50,
  });
  const orderList = nestedArray(listPayload, "order_list");
  const orderSns = orderList.map((item) => asString(item.order_sn ?? item.order_id)).filter(Boolean).slice(0, 50);
  if (orderSns.length === 0) return [];

  const detailPayload = await officialGet("/api/v2/order/get_order_detail", binding, {
    order_sn_list: orderSns.join(","),
    response_optional_fields: "item_list,total_amount,order_status,create_time",
  });
  return nestedArray(detailPayload, "order_list").map(normalizeOfficialOrder).filter((item) => item.order_id);
}

async function fetchOfficialProducts(binding: ShopeeShopBinding): Promise<ShopeeProduct[]> {
  const listPayload = await officialGet("/api/v2/product/get_item_list", binding, {
    page_size: 50,
    item_status: "NORMAL",
  });
  const itemList = nestedArray(listPayload, "item");
  const itemIds = itemList.map((item) => asString(item.item_id ?? item.product_id)).filter(Boolean).slice(0, 50);
  if (itemIds.length === 0) return [];

  const detailPayload = await officialGet("/api/v2/product/get_item_base_info", binding, {
    item_id_list: itemIds.join(","),
    need_tax_info: "false",
    need_complaint_policy: "false",
  });
  return nestedArray(detailPayload, "item_list").map(normalizeOfficialProduct).filter((item) => item.product_id);
}

async function fetchOfficialShopeeReadOnlyDataForBinding(input: ShopeeShopBinding): Promise<OfficialShopeePayload> {
  const binding = await ensureFreshBinding(input);
  try {
    const [orders, products] = await Promise.all([
      fetchOfficialOrders(binding),
      fetchOfficialProducts(binding),
    ]);
    const inventory = products.map(productToInventory);
    const syncedAt = nowIso();
    await markShopeeBindingLastSync(binding.shop_id, syncedAt);
    await recordOperationLog({
      action_type: "shopee_api_request",
      actor_user_id: "system",
      actor_email: "system@local",
      target_type: "shopee_shop_binding",
      target_id: binding.shop_id,
      summary: "Shopee official read-only data pulled successfully.",
      metadata: {
        readonly: true,
        orders_count: orders.length,
        products_count: products.length,
        inventory_count: inventory.length,
      },
    });

    return { orders, products, inventory };
  } catch (error) {
    await recordOperationLog({
      action_type: "shopee_fallback",
      actor_user_id: "system",
      actor_email: "system@local",
      target_type: "shopee_shop_binding",
      target_id: binding.shop_id,
      summary: "Shopee official read-only pull failed; local cache will be used.",
      status: "failed",
      metadata: {
        readonly: true,
        error: error instanceof Error ? error.message : "Unknown Shopee API error.",
      },
    });
    throw error;
  }
}

export async function fetchOfficialShopeeReadOnlyData(): Promise<OfficialShopeePayload | null> {
  if (!officialShopeeConfigured()) return null;

  const bindings = (await listShopeeShopBindings().catch(() => [])).filter(
    (binding) => binding.binding_status === "bound" || binding.binding_status === "expired",
  );
  if (bindings.length === 0) return null;

  const merged: OfficialShopeePayload = {
    orders: [],
    products: [],
    inventory: [],
  };
  const errors: Error[] = [];

  for (const binding of bindings) {
    try {
      const payload = await fetchOfficialShopeeReadOnlyDataForBinding(binding);
      merged.orders.push(...payload.orders);
      merged.products.push(...payload.products);
      merged.inventory.push(...payload.inventory);
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error);
      }
    }
  }

  if (merged.orders.length || merged.products.length || merged.inventory.length) {
    return merged;
  }

  if (errors.length > 0) {
    throw errors[0];
  }

  return merged;
}
