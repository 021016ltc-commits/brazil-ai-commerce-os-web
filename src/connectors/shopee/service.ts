import { shopeeInventoryMock, shopeeOrdersMock, shopeeProductsMock } from "@/connectors/shopee/mock";
import { fetchOfficialShopeeReadOnlyData } from "@/lib/connectors/shopeeOfficialClient";
import { isMockDataAllowed } from "@/lib/runtime/config";
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

type RemotePageInfo = {
  more: boolean;
  nextCursor: string;
  nextOffset: number | null;
};

function shouldUseMockData() {
  return isMockDataAllowed() && process.env.DATA_SOURCE_MODE?.trim().toLowerCase() === "mock";
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

function firstNumber(values: unknown[], fallback = 0) {
  for (const value of values) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return fallback;
}

function valueOf<T extends Record<string, unknown>>(value: T, key: string) {
  return value[key];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function cleanText(value: unknown) {
  let text = String(value ?? "").trim();
  for (let attempt = 0; attempt < 2 && /[\u00c2\u00c3\u00e2\u0080-\u009f]/.test(text); attempt += 1) {
    try {
      text = Buffer.from(text, "latin1").toString("utf8");
    } catch {
      break;
    }
  }
  return text;
}

function normalizeOrder(value: Partial<ShopeeOrder> & Record<string, unknown>): ShopeeOrder {
  const quantity = Math.max(1, firstNumber([value.quantity, valueOf(value, "model_quantity_purchased"), valueOf(value, "item_quantity")], 1));
  const price = firstNumber([value.price, valueOf(value, "total_amount"), valueOf(value, "order_amount"), valueOf(value, "escrow_amount")], 0);

  return {
    order_id: String(value.order_id ?? ""),
    product_id: String(value.product_id ?? ""),
    sku: String(value.sku ?? ""),
    quantity,
    price,
    order_status: String(value.order_status ?? valueOf(value, "status") ?? "unknown"),
    created_at: String(value.created_at ?? nowIso()),
  };
}

function normalizeProduct(value: Partial<ShopeeProduct> & Record<string, unknown>): ShopeeProduct {
  return {
    product_id: String(value.product_id ?? ""),
    title: cleanText(value.title ?? valueOf(value, "item_name") ?? valueOf(value, "name")),
    price: firstNumber([value.price, valueOf(value, "current_price"), valueOf(value, "original_price")], 0),
    stock: firstNumber([value.stock, valueOf(value, "available_stock"), valueOf(value, "normal_stock"), valueOf(value, "current_stock")], 0),
    sales_count: firstNumber([value.sales_count, valueOf(value, "sales"), valueOf(value, "historical_sold"), valueOf(value, "sold")], 0),
  };
}

function normalizeInventory(value: Partial<ShopeeInventoryItem> & Record<string, unknown>): ShopeeInventoryItem {
  return {
    product_id: String(value.product_id ?? ""),
    available_stock: firstNumber([value.available_stock, valueOf(value, "stock"), valueOf(value, "normal_stock"), valueOf(value, "current_stock")], 0),
    reserved_stock: firstNumber([value.reserved_stock, valueOf(value, "reserved"), valueOf(value, "reserved_stock_qty")], 0),
  };
}

function extractArray<T>(payload: unknown, key: string): T[] {
  const arrayKeys = [key, "data", "items", "item", "item_list", "order_list"];

  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  for (const arrayKey of arrayKeys) {
    if (Array.isArray(record[arrayKey])) return record[arrayKey] as T[];
  }

  const response = record.response;
  if (response && typeof response === "object") {
    const responseRecord = response as Record<string, unknown>;
    for (const arrayKey of arrayKeys) {
      if (Array.isArray(responseRecord[arrayKey])) return responseRecord[arrayKey] as T[];
    }
  }

  return [];
}

function remoteFastReadItems() {
  const configured = Number(process.env.SHOPEE_FAST_READ_ITEMS ?? process.env.SHOPEE_READ_MAX_ITEMS ?? 200);
  return Math.max(50, Math.min(1000, Number.isFinite(configured) ? configured : 200));
}

function remoteOrderFastReadItems() {
  const configured = Number(process.env.SHOPEE_ORDER_FAST_READ_ITEMS ?? 10);
  return Math.max(5, Math.min(200, Number.isFinite(configured) ? configured : 10));
}

function remoteMaxSyncItems() {
  const configured = Number(process.env.SHOPEE_MAX_SYNC_ITEMS ?? process.env.SHOPEE_FULL_SYNC_MAX_ITEMS ?? 10000);
  return Math.max(50, Math.min(50000, Number.isFinite(configured) ? configured : 10000));
}

function remotePageSize(maxItems: number) {
  const configured = Number(process.env.SHOPEE_PAGE_SIZE ?? 50);
  return Math.max(10, Math.min(100, Number.isFinite(configured) ? configured : Math.min(50, maxItems)));
}

function remoteFetchTimeoutMs() {
  const configured = Number(process.env.SHOPEE_READ_TIMEOUT_MS ?? 12_000);
  return Math.max(3000, Math.min(12_000, Number.isFinite(configured) ? configured : 12_000));
}

function readPaginationInfo(payload: unknown, currentOffset: number, pageSize: number): RemotePageInfo {
  const records = [
    asRecord(payload),
    asRecord(asRecord(payload).response),
    asRecord(asRecord(payload).pagination),
    asRecord(asRecord(payload).meta),
  ];

  const more = records.some((record) =>
    Boolean(record.more ?? record.has_next_page ?? record.has_next ?? record.has_more ?? record.next_page),
  );

  const nextCursor =
    records
      .map((record) => record.next_cursor ?? record.nextCursor ?? record.cursor_next)
      .find((value) => String(value ?? "").trim()) ?? "";

  const nextOffsetValue = records
    .map((record) => record.next_offset ?? record.nextOffset)
    .find((value) => Number.isFinite(Number(value)));

  return {
    more,
    nextCursor: String(nextCursor || "").trim(),
    nextOffset:
      nextOffsetValue === undefined || nextOffsetValue === null
        ? null
        : Math.max(currentOffset + pageSize, Number(nextOffsetValue)),
  };
}

function uniqueRemoteKey(value: unknown, preferredKey: string) {
  const record = asRecord(value);
  const keys = [
    preferredKey,
    "order_id",
    "order_sn",
    "product_id",
    "item_id",
    "model_id",
    "sku",
  ];
  for (const key of keys) {
    const candidate = String(record[key] ?? "").trim();
    if (candidate) return candidate;
  }
  return JSON.stringify(record);
}

async function fetchRemotePage<T>(path: string, key: string, params: Record<string, string | number>): Promise<{
  items: T[];
  pageInfo: RemotePageInfo;
}> {
  const payload = await fetchRemoteJson(path, params);
  const items = extractArray<T>(payload, key);
  return {
    items,
    pageInfo: readPaginationInfo(payload, Number(params.offset ?? 0), Number(params.page_size ?? 50)),
  };
}

async function fetchRemoteJson(path: string, params: Record<string, string | number>): Promise<unknown> {
  const baseUrl = process.env.SHOPEE_READONLY_API_BASE_URL?.trim();
  if (!baseUrl) throw new Error("Shopee read-only API base URL is not configured.");

  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  Object.entries(params).forEach(([paramKey, value]) => {
    if (String(value) !== "") url.searchParams.set(paramKey, String(value));
  });
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  const token = process.env.SHOPEE_READONLY_ACCESS_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), remoteFetchTimeoutMs());
  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Shopee read-only endpoint ${path} returned ${response.status}.`);
  }

  return response.json();
}

async function fetchRemoteEndpoint<T>(
  path: string,
  key: string,
  preferredKey: string,
  options: { full?: boolean; maxItems?: number } = {},
): Promise<T[]> {
  const maxItems = options.maxItems ?? (options.full ? remoteMaxSyncItems() : remoteFastReadItems());
  const pageSize = remotePageSize(maxItems);
  const maxPages = Math.max(1, Math.min(1000, Math.ceil(maxItems / pageSize) + 5));
  const items: T[] = [];
  const seen = new Set<string>();
  let cursor = "";
  let offset = 0;

  for (let page = 0; page < maxPages && items.length < maxItems; page += 1) {
    const { items: pageItems, pageInfo } = await fetchRemotePage<T>(path, key, {
      ...(options.full ? { all: 1, full: 1 } : {}),
      limit: maxItems,
      max: maxItems,
      page_size: pageSize,
      offset,
      cursor,
    });

    let addedThisPage = 0;
    for (const item of pageItems) {
      const uniqueKey = uniqueRemoteKey(item, preferredKey);
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);
      items.push(item);
      addedThisPage += 1;
      if (items.length >= maxItems) break;
    }

    if (items.length >= maxItems) break;

    if (pageInfo.nextCursor && pageInfo.nextCursor !== cursor) {
      cursor = pageInfo.nextCursor;
      offset = 0;
      continue;
    }

    if (pageInfo.nextOffset !== null && pageInfo.nextOffset > offset) {
      offset = pageInfo.nextOffset;
      cursor = "";
      continue;
    }

    if ((pageInfo.more || pageItems.length >= pageSize) && addedThisPage > 0) {
      offset += pageItems.length || pageSize;
      cursor = "";
      continue;
    }

    break;
  }

  return items;
}

async function fetchRemoteOrders(): Promise<ShopeeOrder[]> {
  const orders = await fetchRemoteEndpoint<Partial<ShopeeOrder>>("orders", "orders", "order_id", {
    maxItems: remoteOrderFastReadItems(),
  });
  return orders.map(normalizeOrder).filter((item) => item.order_id);
}

async function fetchRemoteProducts(): Promise<ShopeeProduct[]> {
  const products = await fetchRemoteEndpoint<Partial<ShopeeProduct>>("products", "products", "product_id");
  return products.map(normalizeProduct).filter((item) => item.product_id);
}

async function fetchRemoteInventory(): Promise<ShopeeInventoryItem[]> {
  const inventory = await fetchRemoteEndpoint<Partial<ShopeeInventoryItem>>("inventory", "inventory", "product_id");
  return inventory.map(normalizeInventory).filter((item) => item.product_id);
}

async function fetchRemoteOrdersFull(): Promise<ShopeeOrder[]> {
  const orders = await fetchRemoteEndpoint<Partial<ShopeeOrder>>("orders", "orders", "order_id", { full: true });
  return orders.map(normalizeOrder).filter((item) => item.order_id);
}

async function fetchRemoteProductsFull(): Promise<ShopeeProduct[]> {
  const products = await fetchRemoteEndpoint<Partial<ShopeeProduct>>("products", "products", "product_id", { full: true });
  return products.map(normalizeProduct).filter((item) => item.product_id);
}

async function fetchRemoteInventoryFull(): Promise<ShopeeInventoryItem[]> {
  const inventory = await fetchRemoteEndpoint<Partial<ShopeeInventoryItem>>("inventory", "inventory", "product_id", { full: true });
  return inventory.map(normalizeInventory).filter((item) => item.product_id);
}

async function fetchRemoteShopeeBundle(): Promise<RemoteShopeePayload> {
  const maxItems = remoteMaxSyncItems();
  const pageSize = remotePageSize(maxItems);
  const payload = await fetchRemoteJson("sync", {
    all: 1,
    full: 1,
    limit: maxItems,
    max: maxItems,
    page_size: pageSize,
  });
  const orders = extractArray<Partial<ShopeeOrder>>(payload, "orders").map(normalizeOrder).filter((item) => item.order_id);
  const products = extractArray<Partial<ShopeeProduct>>(payload, "products").map(normalizeProduct).filter((item) => item.product_id);
  const inventory = extractArray<Partial<ShopeeInventoryItem>>(payload, "inventory")
    .map(normalizeInventory)
    .filter((item) => item.product_id);
  return { orders, products, inventory };
}

async function fetchRemoteShopeeDataPartial(): Promise<RemoteShopeePayload> {
  try {
    const bundle = await fetchRemoteShopeeBundle();
    if (bundle.orders.length > 0 || bundle.products.length > 0 || bundle.inventory.length > 0) return bundle;
  } catch {
    // Fall through to individual endpoints for compatibility with older proxies.
  }

  const [orders, products, inventory] = await Promise.all([
    fetchRemoteOrdersFull().catch(() => []),
    fetchRemoteProductsFull().catch(() => []),
    fetchRemoteInventoryFull().catch(() => []),
  ]);

  return { orders, products, inventory };
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

async function writeShopeeCacheBestEffort(payload: RemoteShopeePayload, syncedAt?: string) {
  try {
    return await writeShopeeCache({ ...payload, syncedAt });
  } catch {
    return syncedAt ?? nowIso();
  }
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
    // Fall through to empty response unless test data is explicitly enabled.
  }

  if (!isMockDataAllowed()) {
    return {
      source: "sqlite",
      data: [],
      synced_at: null,
    };
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

  if (!shouldUseMockData()) {
    try {
      const official = await fetchOfficialShopeeReadOnlyData();
      if (official) {
        const syncedAt = await writeShopeeCacheBestEffort(official);
        return { source: "shopee_api", data: official.orders, synced_at: syncedAt, readonly: true };
      }
    } catch {
      // Fall through to proxy, then SQLite cache.
    }
  }

  if (!shouldUseMockData() && shopeeApiConfigured()) {
    try {
      const orders = await fetchRemoteOrders();
      const syncedAt = await writeShopeeCacheBestEffort({ orders, products: [], inventory: [] });
      return { source: "shopee_api", data: orders, synced_at: syncedAt, readonly: true };
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

  if (!shouldUseMockData()) {
    try {
      const official = await fetchOfficialShopeeReadOnlyData();
      if (official) {
        const syncedAt = await writeShopeeCacheBestEffort(official);
        return { source: "shopee_api", data: official.products, synced_at: syncedAt, readonly: true };
      }
    } catch {
      // Fall through to proxy, then SQLite cache.
    }
  }

  if (!shouldUseMockData() && shopeeApiConfigured()) {
    try {
      const products = await fetchRemoteProducts();
      const syncedAt = await writeShopeeCacheBestEffort({ orders: [], products, inventory: [] });
      return { source: "shopee_api", data: products, synced_at: syncedAt, readonly: true };
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

  if (!shouldUseMockData()) {
    try {
      const official = await fetchOfficialShopeeReadOnlyData();
      if (official) {
        const syncedAt = await writeShopeeCacheBestEffort(official);
        return { source: "shopee_api", data: official.inventory, synced_at: syncedAt, readonly: true };
      }
    } catch {
      // Fall through to proxy, then SQLite cache.
    }
  }

  if (!shouldUseMockData() && shopeeApiConfigured()) {
    try {
      const inventory = await fetchRemoteInventory();
      const syncedAt = await writeShopeeCacheBestEffort({ orders: [], products: [], inventory });
      return { source: "shopee_api", data: inventory, synced_at: syncedAt, readonly: true };
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
  let source: ShopeeDataSource = "sqlite";
  let payload: RemoteShopeePayload = {
    orders: [],
    products: [],
    inventory: [],
  };

  if (!shouldUseMockData()) {
    try {
      const official = await fetchOfficialShopeeReadOnlyData();
      if (official) {
        payload = official;
        source = "shopee_api";
      }
    } catch {
      source = isMockDataAllowed() ? "mock" : "sqlite";
    }
  }

  if (!shouldUseMockData() && source !== "shopee_api" && shopeeApiConfigured()) {
    try {
      payload = await fetchRemoteShopeeDataPartial();
      source =
        payload.orders.length > 0 || payload.products.length > 0 || payload.inventory.length > 0
          ? "shopee_api"
          : isMockDataAllowed()
            ? "mock"
            : "sqlite";
      if (source === "mock") {
        payload = {
          orders: shopeeOrdersMock,
          products: shopeeProductsMock,
          inventory: shopeeInventoryMock,
        };
      }
    } catch {
      source = isMockDataAllowed() ? "mock" : "sqlite";
      if (isMockDataAllowed()) {
        payload = {
          orders: shopeeOrdersMock,
          products: shopeeProductsMock,
          inventory: shopeeInventoryMock,
        };
      }
    }
  }

  await writeShopeeCacheBestEffort(payload, syncedAt);

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
