import { recordOperationLog } from "@/lib/users";
import type {
  NormalizedShopeeInventoryItem,
  NormalizedShopeeOrder,
  NormalizedShopeeProduct,
} from "@/lib/connectors/shopee";
import {
  getInventory,
  getOrders,
  getProducts,
  normalizeInventoryData,
  normalizeOrderData,
  normalizeProductData,
} from "@/lib/connectors/shopee";
import type { OperationLogAction, ShopeeDataSource } from "@/types";

type SnapshotKind = "orders" | "products" | "inventory";

type Snapshot<T> = {
  snapshot_id: string;
  table_name: `shopee_${SnapshotKind}_snapshot`;
  source: ShopeeDataSource;
  created_at: string;
  data: T[];
  readonly: true;
};

export type ShopeeSnapshotBundle = {
  source: ShopeeDataSource;
  created_at: string;
  orders: Snapshot<NormalizedShopeeOrder>;
  products: Snapshot<NormalizedShopeeProduct>;
  inventory: Snapshot<NormalizedShopeeInventoryItem>;
};

export type ShopeeDriftReport = {
  product_count_drift: number;
  inventory_mismatch_rate: number;
  order_status_inconsistency: number;
  missing_product_count: number;
  missing_product_ids: string[];
  drift_items: Array<{
    check_name: string;
    severity: "low" | "medium" | "high";
    value: number;
    note: string;
  }>;
};

export type ShopeeConsistencyReport = {
  source: ShopeeDataSource;
  generated_at: string;
  consistency_score: number;
  drift_report: ShopeeDriftReport;
  snapshots: {
    orders_count: number;
    products_count: number;
    inventory_count: number;
  };
  readonly: true;
};

let latestSnapshot: ShopeeSnapshotBundle | null = null;

function nowIso() {
  return new Date().toISOString();
}

function snapshotId(kind: SnapshotKind) {
  return `shopee_${kind}_snapshot_${Date.now()}`;
}

function resolveSource(sources: ShopeeDataSource[]): ShopeeDataSource {
  if (sources.some((source) => source === "shopee_api")) return "shopee_api";
  if (sources.some((source) => source === "sqlite")) return "sqlite";
  return "mock";
}

async function writeSyncLog(params: {
  action_type: OperationLogAction;
  target_id: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await recordOperationLog({
      action_type: params.action_type,
      actor_user_id: "system",
      actor_email: "system@local",
      target_type: "shopee_sync_engine",
      target_id: params.target_id,
      summary: params.summary,
      metadata: {
        readonly: true,
        sync_mode: process.env.SHOPEE_SYNC_MODE?.trim() || "realtime",
        ...params.metadata,
      },
    });
  } catch {
    // Sync logs are observability only and must never break read-only sync.
  }
}

function createSnapshot<T>(
  kind: SnapshotKind,
  response: { source: ShopeeDataSource; data: T[]; timestamp: string },
): Snapshot<T> {
  return {
    snapshot_id: snapshotId(kind),
    table_name: `shopee_${kind}_snapshot`,
    source: response.source,
    created_at: response.timestamp,
    data: response.data,
    readonly: true,
  };
}

export async function syncOrdersSnapshot() {
  await writeSyncLog({
    action_type: "sync_start",
    target_id: "orders",
    summary: "Shopee orders read-only snapshot sync started.",
  });

  const response = await getOrders();
  const snapshot = createSnapshot("orders", {
    source: response.source,
    data: response.data.map(normalizeOrderData),
    timestamp: nowIso(),
  });

  await writeSyncLog({
    action_type: "snapshot_created",
    target_id: snapshot.snapshot_id,
    summary: "Shopee orders snapshot created in DataService memory layer.",
    metadata: {
      rows: snapshot.data.length,
      source: snapshot.source,
    },
  });

  await writeSyncLog({
    action_type: "sync_complete",
    target_id: "orders",
    summary: "Shopee orders read-only snapshot sync completed.",
    metadata: {
      rows: snapshot.data.length,
      source: snapshot.source,
    },
  });

  return snapshot;
}

export async function syncProductsSnapshot() {
  await writeSyncLog({
    action_type: "sync_start",
    target_id: "products",
    summary: "Shopee products read-only snapshot sync started.",
  });

  const response = await getProducts();
  const snapshot = createSnapshot("products", {
    source: response.source,
    data: response.data.map(normalizeProductData),
    timestamp: nowIso(),
  });

  await writeSyncLog({
    action_type: "snapshot_created",
    target_id: snapshot.snapshot_id,
    summary: "Shopee products snapshot created in DataService memory layer.",
    metadata: {
      rows: snapshot.data.length,
      source: snapshot.source,
    },
  });

  await writeSyncLog({
    action_type: "sync_complete",
    target_id: "products",
    summary: "Shopee products read-only snapshot sync completed.",
    metadata: {
      rows: snapshot.data.length,
      source: snapshot.source,
    },
  });

  return snapshot;
}

export async function syncInventorySnapshot() {
  await writeSyncLog({
    action_type: "sync_start",
    target_id: "inventory",
    summary: "Shopee inventory read-only snapshot sync started.",
  });

  const response = await getInventory();
  const snapshot = createSnapshot("inventory", {
    source: response.source,
    data: response.data.map(normalizeInventoryData),
    timestamp: nowIso(),
  });

  await writeSyncLog({
    action_type: "snapshot_created",
    target_id: snapshot.snapshot_id,
    summary: "Shopee inventory snapshot created in DataService memory layer.",
    metadata: {
      rows: snapshot.data.length,
      source: snapshot.source,
    },
  });

  await writeSyncLog({
    action_type: "sync_complete",
    target_id: "inventory",
    summary: "Shopee inventory read-only snapshot sync completed.",
    metadata: {
      rows: snapshot.data.length,
      source: snapshot.source,
    },
  });

  return snapshot;
}

export async function createShopeeSnapshotBundle(): Promise<ShopeeSnapshotBundle> {
  const [orders, products, inventory] = await Promise.all([
    syncOrdersSnapshot(),
    syncProductsSnapshot(),
    syncInventorySnapshot(),
  ]);

  const bundle = {
    source: resolveSource([orders.source, products.source, inventory.source]),
    created_at: nowIso(),
    orders,
    products,
    inventory,
  };

  latestSnapshot = bundle;
  return bundle;
}

export async function getLatestShopeeSnapshot() {
  return latestSnapshot ?? createShopeeSnapshotBundle();
}

function rate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function severity(value: number) {
  if (value >= 0.2) return "high";
  if (value >= 0.08) return "medium";
  return "low";
}

export function compareSnapshotDiff(snapshot: ShopeeSnapshotBundle): ShopeeConsistencyReport {
  const productIds = new Set(snapshot.products.data.map((item) => item.product_id).filter(Boolean));
  const inventoryProductIds = new Set(snapshot.inventory.data.map((item) => item.product_id).filter(Boolean));
  const orderProductIds = new Set(snapshot.orders.data.map((item) => item.product_id).filter(Boolean));
  const missingProductIds = Array.from(new Set([...inventoryProductIds, ...orderProductIds]))
    .filter((productId) => !productIds.has(productId))
    .sort();

  const productCountDrift = rate(
    Math.abs(snapshot.products.data.length - snapshot.inventory.data.length),
    Math.max(snapshot.products.data.length, snapshot.inventory.data.length, 1),
  );
  const inventoryMismatchRate = rate(missingProductIds.length, Math.max(productIds.size, inventoryProductIds.size, 1));
  const inconsistentOrders = snapshot.orders.data.filter((item) => {
    const status = item.status.trim().toLowerCase();
    return !status || status === "unknown" || item.quantity <= 0 || item.price < 0;
  }).length;
  const orderStatusInconsistency = rate(inconsistentOrders, snapshot.orders.data.length || 1);

  const driftItems = [
    {
      check_name: "product_count_drift",
      severity: severity(productCountDrift),
      value: productCountDrift,
      note: "Compares Shopee product snapshot count with inventory snapshot count.",
    },
    {
      check_name: "inventory_mismatch_rate",
      severity: severity(inventoryMismatchRate),
      value: inventoryMismatchRate,
      note: "Detects inventory/order product IDs missing from product snapshot.",
    },
    {
      check_name: "order_status_inconsistency",
      severity: severity(orderStatusInconsistency),
      value: orderStatusInconsistency,
      note: "Detects empty or unknown order status and invalid order quantity/price.",
    },
  ] as ShopeeDriftReport["drift_items"];

  const penalty = productCountDrift * 35 + inventoryMismatchRate * 40 + orderStatusInconsistency * 25;
  const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  const report: ShopeeConsistencyReport = {
    source: snapshot.source,
    generated_at: nowIso(),
    consistency_score: consistencyScore,
    drift_report: {
      product_count_drift: productCountDrift,
      inventory_mismatch_rate: inventoryMismatchRate,
      order_status_inconsistency: orderStatusInconsistency,
      missing_product_count: missingProductIds.length,
      missing_product_ids: missingProductIds,
      drift_items: driftItems,
    },
    snapshots: {
      orders_count: snapshot.orders.data.length,
      products_count: snapshot.products.data.length,
      inventory_count: snapshot.inventory.data.length,
    },
    readonly: true,
  };

  void writeSyncLog({
    action_type: "drift_detected",
    target_id: "consistency_report",
    summary: `Shopee read-only consistency score: ${consistencyScore}.`,
    metadata: {
      consistency_score: consistencyScore,
      missing_product_count: missingProductIds.length,
      product_count_drift: productCountDrift,
      inventory_mismatch_rate: inventoryMismatchRate,
      order_status_inconsistency: orderStatusInconsistency,
    },
  });

  return report;
}

export async function getShopeeConsistencyReport() {
  return compareSnapshotDiff(await getLatestShopeeSnapshot());
}

export async function getShopeeSyncStatus() {
  const snapshot = await getLatestShopeeSnapshot();
  const consistency = compareSnapshotDiff(snapshot);

  return {
    source: snapshot.source,
    sync_mode: process.env.SHOPEE_SYNC_MODE?.trim() || "realtime",
    last_snapshot_at: snapshot.created_at,
    consistency_score: consistency.consistency_score,
    snapshot_counts: consistency.snapshots,
    readonly: true,
  };
}
