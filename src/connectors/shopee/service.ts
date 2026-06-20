import { shopeeInventoryMock, shopeeOrdersMock, shopeeProductsMock } from "@/connectors/shopee/mock";
import { withDatabase } from "@/lib/sqlite";
import { currentTenantId } from "@/lib/tenantContext";
import type {
  ShopeeDataSource,
  ShopeeInventoryItem,
  ShopeeOrder,
  ShopeeProduct,
  ShopeeReadOnlyApiResponse,
  ShopeeSyncResult,
} from "@/types";

type ShopeeOrderRow = ShopeeOrder & { synced_at: string | null };
type ShopeeProductRow = ShopeeProduct & { synced_at: string | null };
type ShopeeInventoryRow = ShopeeInventoryItem & { synced_at: string | null };

type RemoteShopeePayload = {
  orders: ShopeeOrder[];
  products: ShopeeProduct[];
  inventory: ShopeeInventoryItem[];
};

function shouldUseMockData() {
  return process.env.DATA_SOURCE_MODE?.trim().toLowerCase() === "mock";
}

function shopeeApiConfigured() {
  return Boolean(process.env.SHOPEE_READONLY_API_BASE_URL?.trim());
}

function nowIso() {
  return new Date().toISOString();
}

function asRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function tenantId() {
  return currentTenantId();
}

function latestSyncedAt(rows: Array<{ synced_at?: string | null }>) {
  return rows
    .map((row) => row.synced_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
}

function normalizeOrder(value: Partial<ShopeeOrder>): ShopeeOrder {
  return {
    order_id: String(value.order_id ?? ""),
    product_id: String(value.product_id ?? ""),
    sku: String(value.sku ?? ""),
    quantity: Number(value.quantity ?? 0),
    price: Number(value.price ?? 0),
    order_status: String(value.order_status ?? "unknown"),
    created_at: String(value.created_at ?? nowIso()),
  };
}

function normalizeProduct(value: Partial<ShopeeProduct>): ShopeeProduct {
  return {
    product_id: String(value.product_id ?? ""),
    title: String(value.title ?? ""),
    price: Number(value.price ?? 0),
    stock: Number(value.stock ?? 0),
    sales_count: Number(value.sales_count ?? 0),
  };
}

function normalizeInventory(value: Partial<ShopeeInventoryItem>): ShopeeInventoryItem {
  return {
    product_id: String(value.product_id ?? ""),
    available_stock: Number(value.available_stock ?? 0),
    reserved_stock: Number(value.reserved_stock ?? 0),
  };
}

function extractArray<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>)[key])) {
    return (payload as Record<string, unknown>)[key] as T[];
  }
  return [];
}

async function fetchRemoteEndpoint<T>(path: string, key: string): Promise<T[]> {
  const baseUrl = process.env.SHOPEE_READONLY_API_BASE_URL?.trim();
  if (!baseUrl) throw new Error("Shopee read-only API base URL is not configured.");

  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  const token = process.env.SHOPEE_READONLY_ACCESS_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Shopee read-only endpoint ${path} returned ${response.status}.`);
  }

  return extractArray<T>(await response.json(), key);
}

async function fetchRemoteShopeeData(): Promise<RemoteShopeePayload> {
  const [orders, products, inventory] = await Promise.all([
    fetchRemoteEndpoint<Partial<ShopeeOrder>>("orders", "orders"),
    fetchRemoteEndpoint<Partial<ShopeeProduct>>("products", "products"),
    fetchRemoteEndpoint<Partial<ShopeeInventoryItem>>("inventory", "inventory"),
  ]);

  return {
    orders: orders.map(normalizeOrder).filter((item) => item.order_id),
    products: products.map(normalizeProduct).filter((item) => item.product_id),
    inventory: inventory.map(normalizeInventory).filter((item) => item.product_id),
  };
}

async function readCachedOrders() {
  return withDatabase((db) =>
    asRows<ShopeeOrderRow>(
      db
        .prepare(
          `SELECT order_id, product_id, sku, quantity, price, order_status, created_at, synced_at
             FROM shopee_orders
             WHERE tenant_id = ?
             ORDER BY created_at DESC, order_id ASC`,
        )
        .all(tenantId()),
    ),
  );
}

async function readCachedProducts() {
  return withDatabase((db) =>
    asRows<ShopeeProductRow>(
      db
        .prepare(
          `SELECT product_id, title, price, stock, sales_count, synced_at
             FROM shopee_products
             WHERE tenant_id = ?
             ORDER BY sales_count DESC, product_id ASC`,
        )
        .all(tenantId()),
    ),
  );
}

async function readCachedInventory() {
  return withDatabase((db) =>
    asRows<ShopeeInventoryRow>(
      db
        .prepare(
          `SELECT product_id, available_stock, reserved_stock, synced_at
             FROM shopee_inventory
             WHERE tenant_id = ?
             ORDER BY available_stock ASC, product_id ASC`,
        )
        .all(tenantId()),
    ),
  );
}

export async function writeShopeeCache(params: {
  orders: ShopeeOrder[];
  products: ShopeeProduct[];
  inventory: ShopeeInventoryItem[];
  syncedAt?: string;
}) {
  const syncedAt = params.syncedAt ?? nowIso();

  await withDatabase((db) => {
    const upsertOrder = db.prepare(
      `INSERT INTO shopee_orders (
         order_id, product_id, sku, quantity, price, order_status, created_at, synced_at, tenant_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(order_id) DO UPDATE SET
         product_id = excluded.product_id,
         sku = excluded.sku,
         quantity = excluded.quantity,
         price = excluded.price,
          order_status = excluded.order_status,
          created_at = excluded.created_at,
          synced_at = excluded.synced_at,
          tenant_id = excluded.tenant_id`,
    );

    params.orders.forEach((order) => {
      upsertOrder.run(
        order.order_id,
        order.product_id,
        order.sku,
        order.quantity,
        order.price,
        order.order_status,
        order.created_at,
        syncedAt,
        tenantId(),
      );
    });

    const upsertProduct = db.prepare(
      `INSERT INTO shopee_products (product_id, title, price, stock, sales_count, synced_at, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(product_id) DO UPDATE SET
         title = excluded.title,
         price = excluded.price,
          stock = excluded.stock,
          sales_count = excluded.sales_count,
          synced_at = excluded.synced_at,
          tenant_id = excluded.tenant_id`,
    );

    params.products.forEach((product) => {
      upsertProduct.run(
        product.product_id,
        product.title,
        product.price,
        product.stock,
        product.sales_count,
        syncedAt,
        tenantId(),
      );
    });

    const upsertInventory = db.prepare(
      `INSERT INTO shopee_inventory (product_id, available_stock, reserved_stock, synced_at, tenant_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(product_id) DO UPDATE SET
          available_stock = excluded.available_stock,
          reserved_stock = excluded.reserved_stock,
          synced_at = excluded.synced_at,
          tenant_id = excluded.tenant_id`,
    );

    params.inventory.forEach((item) => {
      upsertInventory.run(item.product_id, item.available_stock, item.reserved_stock, syncedAt, tenantId());
    });
  }, false);

  return syncedAt;
}

async function cachedOrMock<T extends { synced_at?: string | null }, U>(
  readCache: () => Promise<T[]>,
  mapCache: (rows: T[]) => U[],
  mockData: U[],
): Promise<{ source: ShopeeDataSource; data: U[]; synced_at: string | null }> {
  try {
    const rows = await readCache();
    if (rows.length > 0) {
      return {
        source: "sqlite",
        data: mapCache(rows),
        synced_at: latestSyncedAt(rows),
      };
    }
  } catch {
    // Fall through to mock fallback.
  }

  return {
    source: "mock",
    data: mockData,
    synced_at: null,
  };
}

export async function getShopeeOrdersResponse(): Promise<ShopeeReadOnlyApiResponse<ShopeeOrder>> {
  if (shouldUseMockData()) {
    return { source: "mock", data: shopeeOrdersMock, synced_at: null, readonly: true };
  }

  if (!shouldUseMockData() && shopeeApiConfigured()) {
    try {
      const remote = await fetchRemoteShopeeData();
      const syncedAt = await writeShopeeCache(remote);
      return { source: "shopee_api", data: remote.orders, synced_at: syncedAt, readonly: true };
    } catch {
      // Fall through to SQLite cache, then mock.
    }
  }

  const cached = await cachedOrMock(
    readCachedOrders,
    (rows) => rows.map(({ synced_at: _syncedAt, ...order }) => order),
    shopeeOrdersMock,
  );
  return { ...cached, readonly: true };
}

export async function getShopeeProductsResponse(): Promise<ShopeeReadOnlyApiResponse<ShopeeProduct>> {
  if (shouldUseMockData()) {
    return { source: "mock", data: shopeeProductsMock, synced_at: null, readonly: true };
  }

  if (!shouldUseMockData() && shopeeApiConfigured()) {
    try {
      const remote = await fetchRemoteShopeeData();
      const syncedAt = await writeShopeeCache(remote);
      return { source: "shopee_api", data: remote.products, synced_at: syncedAt, readonly: true };
    } catch {
      // Fall through to SQLite cache, then mock.
    }
  }

  const cached = await cachedOrMock(
    readCachedProducts,
    (rows) => rows.map(({ synced_at: _syncedAt, ...product }) => product),
    shopeeProductsMock,
  );
  return { ...cached, readonly: true };
}

export async function getShopeeInventoryResponse(): Promise<ShopeeReadOnlyApiResponse<ShopeeInventoryItem>> {
  if (shouldUseMockData()) {
    return { source: "mock", data: shopeeInventoryMock, synced_at: null, readonly: true };
  }

  if (!shouldUseMockData() && shopeeApiConfigured()) {
    try {
      const remote = await fetchRemoteShopeeData();
      const syncedAt = await writeShopeeCache(remote);
      return { source: "shopee_api", data: remote.inventory, synced_at: syncedAt, readonly: true };
    } catch {
      // Fall through to SQLite cache, then mock.
    }
  }

  const cached = await cachedOrMock(
    readCachedInventory,
    (rows) => rows.map(({ synced_at: _syncedAt, ...inventory }) => inventory),
    shopeeInventoryMock,
  );
  return { ...cached, readonly: true };
}

export async function syncShopeeReadOnlyData(): Promise<ShopeeSyncResult> {
  const syncedAt = nowIso();
  let source: ShopeeDataSource = "mock";
  let payload: RemoteShopeePayload = {
    orders: shopeeOrdersMock,
    products: shopeeProductsMock,
    inventory: shopeeInventoryMock,
  };

  if (!shouldUseMockData() && shopeeApiConfigured()) {
    try {
      payload = await fetchRemoteShopeeData();
      source = "shopee_api";
    } catch {
      source = "mock";
    }
  }

  await writeShopeeCache({ ...payload, syncedAt });

  return {
    source,
    readonly: true,
    synced_at: syncedAt,
    orders_count: payload.orders.length,
    products_count: payload.products.length,
    inventory_count: payload.inventory.length,
    message:
      source === "shopee_api"
        ? "Shopee read-only API data synced into local SQLite cache."
        : "Mock Shopee read-only data synced into local SQLite cache.",
  };
}
