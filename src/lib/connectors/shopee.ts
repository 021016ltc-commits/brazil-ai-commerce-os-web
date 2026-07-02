import {
  getShopeeInventoryResponse,
  getShopeeOrdersResponse,
  getShopeeProductsResponse,
  syncShopeeReadOnlyData,
} from "@/connectors/shopee/service";
import type {
  ShopeeInventoryItem,
  ShopeeOrder,
  ShopeeProduct,
  ShopeeReadOnlyApiResponse,
  ShopeeSyncResult,
} from "@/types";

type ShopeeTokenState = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
};

export type NormalizedShopeeOrder = {
  order_id: string;
  product_id: string;
  sku: string;
  quantity: number;
  price: number;
  status: string;
  order_status: string;
  created_at: string;
};

export type NormalizedShopeeProduct = {
  product_id: string;
  title: string;
  price: number;
  stock: number;
  sales: number;
  sales_count: number;
  reserved_stock?: number;
  model_count?: number;
  stock_known?: boolean;
  shop_id?: string;
};

export type NormalizedShopeeInventoryItem = {
  product_id: string;
  available_stock: number;
  reserved_stock: number;
  model_count?: number;
  stock_known?: boolean;
  shop_id?: string;
};

const tokenState: ShopeeTokenState = {
  accessToken: process.env.SHOPEE_ACCESS_TOKEN?.trim() || process.env.SHOPEE_READONLY_ACCESS_TOKEN?.trim() || null,
  refreshToken: process.env.SHOPEE_REFRESH_TOKEN?.trim() || null,
  expiresAt: null,
};

function now() {
  return Date.now();
}

function tokenRefreshConfigured() {
  return Boolean(
    process.env.SHOPEE_TOKEN_URL?.trim() &&
      (process.env.SHOPEE_API_KEY?.trim() || process.env.SHOPEE_CLIENT_ID?.trim()) &&
      (process.env.SHOPEE_SECRET?.trim() || process.env.SHOPEE_CLIENT_SECRET?.trim()),
  );
}

export function buildAuthHeader(accessToken = tokenState.accessToken) {
  return accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      }
    : {
        Accept: "application/json",
      };
}

export function validateToken() {
  const hasToken = Boolean(tokenState.accessToken);
  const expired = Boolean(tokenState.expiresAt && tokenState.expiresAt <= now());

  return {
    valid: hasToken && !expired,
    has_access_token: hasToken,
    has_refresh_token: Boolean(tokenState.refreshToken),
    expires_at: tokenState.expiresAt ? new Date(tokenState.expiresAt).toISOString() : null,
  };
}

export async function refreshTokenFlow() {
  if ((!tokenState.accessToken && !tokenState.refreshToken) || !tokenRefreshConfigured()) {
    return {
      refreshed: false,
      access_token: tokenState.accessToken,
      reason: "Shopee token refresh is not configured.",
    };
  }

  if (tokenState.expiresAt && tokenState.expiresAt - 60_000 > now()) {
    return {
      refreshed: false,
      access_token: tokenState.accessToken,
      expires_at: new Date(tokenState.expiresAt).toISOString(),
      reason: "Shopee access token is still valid.",
    };
  }

  return {
    refreshed: false,
    ready: true,
    access_token: tokenState.accessToken,
    expires_at: tokenState.expiresAt ? new Date(tokenState.expiresAt).toISOString() : null,
    reason: "Shopee token refresh flow is configured. Real refresh is disabled in the foundation layer.",
  };
}

async function refreshTokenIfNeeded() {
  const result = await refreshTokenFlow();
  return result.access_token;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

export function normalizeOrderData(value: Partial<ShopeeOrder> | Record<string, unknown>): NormalizedShopeeOrder {
  const record = asRecord(value);
  const status = asString(record.status ?? record.order_status ?? record.orderStatus, "unknown");

  return {
    order_id: asString(record.order_id ?? record.orderId),
    product_id: asString(record.product_id ?? record.productId ?? record.item_id ?? record.itemId),
    sku: asString(record.sku ?? record.model_sku ?? record.modelSku),
    quantity: asNumber(record.quantity ?? record.qty),
    price: asNumber(record.price ?? record.item_price ?? record.itemPrice),
    status,
    order_status: status,
    created_at: asString(record.created_at ?? record.create_time ?? record.createdAt, new Date().toISOString()),
  };
}

export function normalizeProductData(value: Partial<ShopeeProduct> | Record<string, unknown>): NormalizedShopeeProduct {
  const record = asRecord(value);
  const sales = asNumber(record.sales ?? record.sales_count ?? record.sold ?? record.sold_count);

  return {
    product_id: asString(record.product_id ?? record.productId ?? record.item_id ?? record.itemId),
    title: asString(record.title ?? record.item_name ?? record.name),
    price: asNumber(record.price ?? record.item_price),
    stock: asNumber(record.stock ?? record.available_stock),
    sales,
    sales_count: sales,
    reserved_stock: asNumber(record.reserved_stock ?? record.reservedStock ?? record.reserved),
    model_count: asNumber(record.model_count ?? record.modelCount),
    stock_known: Boolean(record.stock_known ?? record.stockKnown ?? false),
    shop_id: asString(record.shop_id ?? record.shopId),
  };
}

export function normalizeInventoryData(
  value: Partial<ShopeeInventoryItem> | Record<string, unknown>,
): NormalizedShopeeInventoryItem {
  const record = asRecord(value);

  return {
    product_id: asString(record.product_id ?? record.productId ?? record.item_id ?? record.itemId),
    available_stock: asNumber(record.available_stock ?? record.availableStock ?? record.stock),
    reserved_stock: asNumber(record.reserved_stock ?? record.reservedStock ?? record.reserved),
    model_count: asNumber(record.model_count ?? record.modelCount),
    stock_known: Boolean(record.stock_known ?? record.stockKnown ?? false),
    shop_id: asString(record.shop_id ?? record.shopId),
  };
}

async function withRateLimitHandling<T>(load: () => Promise<T>, retries = 2): Promise<T> {
  try {
    return await load();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const rateLimited = message.includes("429") || message.toLowerCase().includes("rate");

    if (!rateLimited || retries <= 0) {
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500 * (3 - retries)));
    return withRateLimitHandling(load, retries - 1);
  }
}

export async function authenticate() {
  try {
    const accessToken = await refreshTokenIfNeeded();
    return {
      authenticated: Boolean(accessToken || process.env.SHOPEE_READONLY_API_BASE_URL?.trim()),
      readonly: true,
      token_refresh_supported: tokenRefreshConfigured(),
    };
  } catch (error) {
    return {
      authenticated: false,
      readonly: true,
      token_refresh_supported: tokenRefreshConfigured(),
      error: error instanceof Error ? error.message : "Shopee authentication failed.",
    };
  }
}

export async function getOrders(): Promise<ShopeeReadOnlyApiResponse<ShopeeOrder>> {
  await authenticate();
  return withRateLimitHandling(getShopeeOrdersResponse);
}

export async function getProducts(): Promise<ShopeeReadOnlyApiResponse<ShopeeProduct>> {
  await authenticate();
  return withRateLimitHandling(getShopeeProductsResponse);
}

export async function getInventory(): Promise<ShopeeReadOnlyApiResponse<ShopeeInventoryItem>> {
  await authenticate();
  return withRateLimitHandling(getShopeeInventoryResponse);
}

export async function syncData(): Promise<ShopeeSyncResult> {
  await authenticate();
  return withRateLimitHandling(syncShopeeReadOnlyData);
}
