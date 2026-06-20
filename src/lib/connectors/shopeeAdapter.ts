import {
  buildAuthHeader,
  getInventory,
  getOrders,
  getProducts,
  normalizeInventoryData,
  normalizeOrderData,
  normalizeProductData,
  refreshTokenFlow,
  validateToken,
  type NormalizedShopeeInventoryItem,
  type NormalizedShopeeOrder,
  type NormalizedShopeeProduct,
} from "@/lib/connectors/shopee";
import { getShopeeApiMode, isMockDataAllowed } from "@/lib/runtime/config";
import { recordOperationLog } from "@/lib/users";
import type { OperationLogAction, ShopeeDataSource, ShopeeReadOnlyApiResponse, ShopeeSyncResult } from "@/types";

type ShopeeResource = "orders" | "products" | "inventory";
type ShopeeSyncMode = "realtime" | "snapshot" | "hybrid";

export type ShopeeAdapterResponse<T> = {
  source: ShopeeDataSource;
  data: T[];
  timestamp: string;
  synced_at: string | null;
  readonly: true;
};

function nowIso() {
  return new Date().toISOString();
}

function configuredRealApi() {
  return Boolean(
    process.env.SHOPEE_API_BASE_URL?.trim() ||
      process.env.SHOPEE_READONLY_API_BASE_URL?.trim(),
  );
}

function requestedMode() {
  const shopeeMode = getShopeeApiMode();
  if (shopeeMode === "readonly" || shopeeMode === "real") return "real_api";
  const mode = process.env.DATA_SOURCE_MODE?.trim().toLowerCase();
  if (mode === "mock" && isMockDataAllowed()) return "mock";
  if (configuredRealApi()) return "real_api";
  return "sqlite";
}

function syncMode(): ShopeeSyncMode {
  const mode = process.env.SHOPEE_SYNC_MODE?.trim().toLowerCase();
  if (mode === "snapshot" || mode === "hybrid") return mode;
  return "realtime";
}

function assertReadOnlyMethod(method: string) {
  if (method.toUpperCase() !== "GET") {
    throw new Error("Shopee adapter only allows read-only GET requests.");
  }
}

async function writeShopeeLog(params: {
  action_type: OperationLogAction;
  resource: ShopeeResource | "token" | "sync";
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await recordOperationLog({
      action_type: params.action_type,
      actor_user_id: "system",
      actor_email: "system@local",
      target_type: "shopee_readonly_connector",
      target_id: params.resource,
      summary: params.summary,
      metadata: {
        mode: requestedMode(),
        readonly: true,
        ...params.metadata,
      },
    });
  } catch {
    // Connector logs must never break read-only data access.
  }
}

async function prepareTokenLifecycle(resource: ShopeeResource) {
  const tokenBefore = validateToken();
  const refreshResult = await refreshTokenFlow();

  await writeShopeeLog({
    action_type: "shopee_token_refresh",
    resource: "token",
    summary: `Shopee token lifecycle checked before reading ${resource}.`,
    metadata: {
      token_valid_before: tokenBefore.valid,
      token_refresh_supported: Boolean(refreshResult.ready || refreshResult.refreshed),
      refreshed: refreshResult.refreshed,
      reason: refreshResult.reason,
    },
  });

  return {
    tokenBefore,
    refreshResult,
    authHeader: buildAuthHeader(refreshResult.access_token),
  };
}

async function readResource<Raw, Normalized>(
  resource: ShopeeResource,
  load: () => Promise<ShopeeReadOnlyApiResponse<Raw>>,
  normalize: (value: Raw) => Normalized,
): Promise<ShopeeAdapterResponse<Normalized>> {
  assertReadOnlyMethod("GET");

  const tokenLifecycle = await prepareTokenLifecycle(resource);

  await writeShopeeLog({
    action_type: "shopee_api_request",
    resource,
    summary: `Shopee ${resource} read requested through adapter.`,
    metadata: {
      method: "GET",
      auth_header_ready: "Authorization" in tokenLifecycle.authHeader,
    },
  });

  const raw = await load();
  const timestamp = nowIso();

  if (raw.source !== "shopee_api") {
    await writeShopeeLog({
      action_type: "shopee_fallback",
      resource,
      summary: `Shopee ${resource} used ${raw.source} fallback.`,
      metadata: {
        fallback_source: raw.source,
        synced_at: raw.synced_at,
      },
    });
  }

  return {
    source: raw.source,
    data: raw.data.map(normalize),
    timestamp,
    synced_at: raw.synced_at,
    readonly: true,
  };
}

export function getShopeeOrders(): Promise<ShopeeAdapterResponse<NormalizedShopeeOrder>> {
  return getModeData("orders", () => readResource("orders", getOrders, normalizeOrderData));
}

export function getShopeeProducts(): Promise<ShopeeAdapterResponse<NormalizedShopeeProduct>> {
  return getModeData("products", () => readResource("products", getProducts, normalizeProductData));
}

export function getShopeeInventory(): Promise<ShopeeAdapterResponse<NormalizedShopeeInventoryItem>> {
  return getModeData("inventory", () => readResource("inventory", getInventory, normalizeInventoryData));
}

export async function syncShopeeReadOnlyCache(): Promise<ShopeeSyncResult & { timestamp: string }> {
  await writeShopeeLog({
    action_type: "shopee_api_request",
    resource: "sync",
    summary: "Manual Shopee read-only cache sync requested through adapter.",
    metadata: {
      method: "GET",
      automatic_sync: false,
    },
  });

  const { createShopeeSnapshotBundle } = await import("@/lib/connectors/shopeeSyncEngine");
  const snapshot = await createShopeeSnapshotBundle();
  const result: ShopeeSyncResult = {
    source: snapshot.source,
    readonly: true,
    synced_at: snapshot.created_at,
    orders_count: snapshot.orders.data.length,
    products_count: snapshot.products.data.length,
    inventory_count: snapshot.inventory.data.length,
    message: "Shopee read-only snapshot generated in DataService memory layer. No platform write was executed.",
  };

  return {
    ...result,
    timestamp: result.synced_at,
  };
}

export async function getRealtimeModeData<T>(load: () => Promise<ShopeeAdapterResponse<T>>) {
  return load();
}

export async function getSnapshotModeData(
  resource: ShopeeResource,
): Promise<
  ShopeeAdapterResponse<
    NormalizedShopeeOrder | NormalizedShopeeProduct | NormalizedShopeeInventoryItem
  >
> {
  const { getLatestShopeeSnapshot } = await import("@/lib/connectors/shopeeSyncEngine");
  const snapshot = await getLatestShopeeSnapshot();
  const selected = snapshot[resource];

  return {
    source: selected.source,
    data: selected.data,
    timestamp: selected.created_at,
    synced_at: selected.created_at,
    readonly: true,
  };
}

export function mergeWithSnapshot<T>(
  realtime: ShopeeAdapterResponse<T>,
  snapshot: ShopeeAdapterResponse<T>,
): ShopeeAdapterResponse<T> {
  if (realtime.data.length > 0) return realtime;
  return {
    ...snapshot,
    source: snapshot.source,
    timestamp: realtime.timestamp || snapshot.timestamp,
  };
}

async function getModeData<T>(
  resource: ShopeeResource,
  loadRealtime: () => Promise<ShopeeAdapterResponse<T>>,
): Promise<ShopeeAdapterResponse<T>> {
  const mode = syncMode();

  if (mode === "snapshot") {
    return getSnapshotModeData(resource) as Promise<ShopeeAdapterResponse<T>>;
  }

  const realtime = await getRealtimeModeData(loadRealtime);
  if (mode === "hybrid") {
    const snapshot = (await getSnapshotModeData(resource)) as ShopeeAdapterResponse<T>;
    return mergeWithSnapshot(realtime, snapshot);
  }

  return realtime;
}
