import { recordOperationLog } from "@/lib/users";
import { getClient } from "@/lib/database";
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
import * as fs from "node:fs";
import * as path from "node:path";

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
let activeSnapshotRefresh: Promise<ShopeeSnapshotBundle> | null = null;

const SNAPSHOT_TYPE = "shopee_readonly_bundle";
const DEFAULT_SNAPSHOT_MAX_AGE_MS = Number(process.env.SHOPEE_SNAPSHOT_MAX_AGE_MS ?? 60_000);
const SNAPSHOT_FILE = path.join(
  process.env.SHOPEE_SNAPSHOT_DIR || (process.env.VERCEL ? "/tmp/brazil-ai-commerce-os" : path.join(process.cwd(), "data", "runtime")),
  "shopee-readonly-snapshot.json",
);

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

function snapshotIsFresh(snapshot: ShopeeSnapshotBundle | null, maxAgeMs: number) {
  if (!snapshot) return false;
  const createdAt = new Date(snapshot.created_at).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt <= maxAgeMs;
}

function snapshotRowPayload(snapshot: ShopeeSnapshotBundle) {
  return {
    snapshot_id: `shopee_bundle_${Date.now()}`,
    platform: "Shopee",
    market_code: "BR",
    shop_id: inferShopId(snapshot),
    snapshot_type: SNAPSHOT_TYPE,
    source: snapshot.source,
    captured_at: snapshot.created_at,
    orders_count: snapshot.orders.data.length,
    products_count: snapshot.products.data.length,
    inventory_count: snapshot.inventory.data.length,
    payload_json: JSON.stringify(snapshot),
  };
}

function inferShopId(snapshot: ShopeeSnapshotBundle) {
  const orderShop = snapshot.orders.data.find((item) => "shop_id" in item)?.["shop_id"];
  const productShop = snapshot.products.data.find((item) => "shop_id" in item)?.["shop_id"];
  return String(orderShop || productShop || "authorized_shop");
}

function parseSnapshotPayload(payload: unknown): ShopeeSnapshotBundle | null {
  try {
    if (!payload) return null;
    const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!parsed || typeof parsed !== "object") return null;
    const snapshot = parsed as ShopeeSnapshotBundle;
    if (!snapshot.orders || !snapshot.products || !snapshot.inventory) return null;
    return snapshot;
  } catch {
    return null;
  }
}

function persistSnapshotFile(snapshot: ShopeeSnapshotBundle) {
  try {
    fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), "utf8");
  } catch {
    // File persistence is a best-effort warm-instance fallback.
  }
}

function readSnapshotFile() {
  try {
    return parseSnapshotPayload(fs.readFileSync(SNAPSHOT_FILE, "utf8"));
  } catch {
    return null;
  }
}

async function ensureSnapshotTable() {
  const client = await getClient();
  if (client.mode === "postgres") {
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_data_snapshots (
        snapshot_id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        market_code TEXT NOT NULL,
        shop_id TEXT,
        snapshot_type TEXT NOT NULL,
        source TEXT NOT NULL,
        payload_json JSONB NOT NULL,
        orders_count INTEGER NOT NULL DEFAULT 0,
        products_count INTEGER NOT NULL DEFAULT 0,
        inventory_count INTEGER NOT NULL DEFAULT 0,
        captured_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_platform_data_snapshots_lookup
      ON platform_data_snapshots (platform, market_code, snapshot_type, captured_at DESC)
    `);
    return client;
  }

  if (client.mode === "sqlite") {
    await client.withSQLite((db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS platform_data_snapshots (
          snapshot_id TEXT PRIMARY KEY,
          platform TEXT NOT NULL,
          market_code TEXT NOT NULL,
          shop_id TEXT,
          snapshot_type TEXT NOT NULL,
          source TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          orders_count INTEGER NOT NULL DEFAULT 0,
          products_count INTEGER NOT NULL DEFAULT 0,
          inventory_count INTEGER NOT NULL DEFAULT 0,
          captured_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_platform_data_snapshots_lookup
        ON platform_data_snapshots (platform, market_code, snapshot_type, captured_at DESC);
      `);
    }, false);
  }

  return client;
}

async function persistSnapshotBundle(snapshot: ShopeeSnapshotBundle) {
  persistSnapshotFile(snapshot);

  try {
    const client = await ensureSnapshotTable();
    const row = snapshotRowPayload(snapshot);

    if (client.mode === "postgres") {
      await client.query(
        `
          INSERT INTO platform_data_snapshots (
            snapshot_id, platform, market_code, shop_id, snapshot_type, source, payload_json,
            orders_count, products_count, inventory_count, captured_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)
        `,
        [
          row.snapshot_id,
          row.platform,
          row.market_code,
          row.shop_id,
          row.snapshot_type,
          row.source,
          row.payload_json,
          row.orders_count,
          row.products_count,
          row.inventory_count,
          row.captured_at,
        ],
      );
      return;
    }

    if (client.mode === "sqlite") {
      await client.withSQLite((db) => {
        db.prepare(
          `
            INSERT INTO platform_data_snapshots (
              snapshot_id, platform, market_code, shop_id, snapshot_type, source, payload_json,
              orders_count, products_count, inventory_count, captured_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          row.snapshot_id,
          row.platform,
          row.market_code,
          row.shop_id,
          row.snapshot_type,
          row.source,
          row.payload_json,
          row.orders_count,
          row.products_count,
          row.inventory_count,
          row.captured_at,
        );
      }, false);
    }
  } catch {
    // Database snapshot persistence must not interrupt read-only Shopee sync.
  }
}

async function readLatestPersistedSnapshot() {
  try {
    const client = await ensureSnapshotTable();

    if (client.mode === "postgres") {
      const result = await client.query<{ payload_json: unknown }>(
        `
          SELECT payload_json
          FROM platform_data_snapshots
          WHERE platform = $1 AND market_code = $2 AND snapshot_type = $3
          ORDER BY captured_at DESC
          LIMIT 1
        `,
        ["Shopee", "BR", SNAPSHOT_TYPE],
      );
      return parseSnapshotPayload(result.rows[0]?.payload_json);
    }

    if (client.mode === "sqlite") {
      return await client.withSQLite((db) => {
        const row = db
          .prepare(
            `
              SELECT payload_json
              FROM platform_data_snapshots
              WHERE platform = ? AND market_code = ? AND snapshot_type = ?
              ORDER BY captured_at DESC
              LIMIT 1
            `,
          )
          .get("Shopee", "BR", SNAPSHOT_TYPE) as { payload_json?: string } | undefined;
        return parseSnapshotPayload(row?.payload_json);
      }, true);
    }
  } catch {
    // Fall through to local warm-instance file snapshot.
  }

  return readSnapshotFile();
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
  if (activeSnapshotRefresh) return activeSnapshotRefresh;

  activeSnapshotRefresh = (async () => {
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
    await persistSnapshotBundle(bundle);
    return bundle;
  })();

  try {
    return await activeSnapshotRefresh;
  } finally {
    activeSnapshotRefresh = null;
  }
}

export async function getLatestShopeeSnapshot(options: { maxAgeMs?: number; forceRefresh?: boolean } = {}) {
  const maxAgeMs = options.maxAgeMs ?? DEFAULT_SNAPSHOT_MAX_AGE_MS;
  if (!options.forceRefresh && snapshotIsFresh(latestSnapshot, maxAgeMs)) return latestSnapshot as ShopeeSnapshotBundle;

  if (!options.forceRefresh) {
    const persistedSnapshot = await readLatestPersistedSnapshot();
    if (snapshotIsFresh(persistedSnapshot, maxAgeMs)) {
      latestSnapshot = persistedSnapshot;
      return persistedSnapshot as ShopeeSnapshotBundle;
    }
  }

  return createShopeeSnapshotBundle();
}

export function clearShopeeSnapshotMemory() {
  latestSnapshot = null;
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
