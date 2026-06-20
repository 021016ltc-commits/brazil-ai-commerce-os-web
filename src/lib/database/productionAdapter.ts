import type { DatabaseClient, DatabaseMode } from "@/lib/database";
import { fallbackToSQLite, getClient, getDatabaseStatus } from "@/lib/database";
import { getRequestedDataSourceMode, isProductionMode } from "@/lib/runtime/config";

const REQUIRED_TABLES = [
  "products",
  "sellers",
  "keywords",
  "market_score",
  "opportunity_score",
  "analysis_queue",
  "action_queue",
  "upload_queue",
  "operation_logs",
  "shopee_orders",
  "shopee_products",
  "shopee_inventory",
];

export type ProductionDatabaseStatus = {
  active_mode: DatabaseMode;
  postgres_configured: boolean;
  sqlite_fallback_active: boolean;
  connection_status: "connected" | "fallback" | "failed";
  schema_compatible: boolean;
  missing_tables: string[];
  checked_at: string;
  retry_count: number;
  error?: string | null;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkPostgresSchema(client: Extract<DatabaseClient, { mode: "postgres" }>) {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1)`,
    [REQUIRED_TABLES],
  );
  const existing = new Set(result.rows.map((row) => row.table_name));
  return REQUIRED_TABLES.filter((table) => !existing.has(table));
}

async function checkSQLiteSchema() {
  const sqlite = fallbackToSQLite();
  return sqlite.withSQLite((db) => {
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const existing = new Set(rows.map((row) => row.name));
    return REQUIRED_TABLES.filter((table) => !existing.has(table));
  });
}

export async function connectProductionDatabase(options: { retries?: number; retryDelayMs?: number } = {}) {
  const retries = options.retries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 350;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const client = await getClient();
      return { client, retry_count: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < retries) await wait(retryDelayMs * (attempt + 1));
    }
  }

  return {
    client: fallbackToSQLite(),
    retry_count: retries,
    error: lastError instanceof Error ? lastError.message : "Database connection failed.",
  };
}

export async function checkProductionSchemaCompatibility(client: DatabaseClient) {
  if (client.mode === "mock") {
    return {
      schema_compatible: false,
      missing_tables: REQUIRED_TABLES,
    };
  }

  try {
    const missingTables = client.mode === "postgres" ? await checkPostgresSchema(client) : await checkSQLiteSchema();
    return {
      schema_compatible: missingTables.length === 0,
      missing_tables: missingTables,
    };
  } catch {
    return {
      schema_compatible: false,
      missing_tables: REQUIRED_TABLES,
    };
  }
}

export async function getProductionDatabaseStatus(): Promise<ProductionDatabaseStatus> {
  const connection = await connectProductionDatabase();
  const baseStatus = await getDatabaseStatus();
  const compatibility = await checkProductionSchemaCompatibility(connection.client);
  const postgresExpected = getRequestedDataSourceMode() === "postgres" || getRequestedDataSourceMode() === "supabase";
  const sqliteFallbackActive =
    connection.client.mode === "sqlite" &&
    (baseStatus.postgres_configured || (isProductionMode() && postgresExpected));

  return {
    active_mode: connection.client.mode,
    postgres_configured: baseStatus.postgres_configured,
    sqlite_fallback_active: sqliteFallbackActive,
    connection_status:
      connection.client.mode === "mock" ? "failed" : sqliteFallbackActive ? "fallback" : "connected",
    schema_compatible: compatibility.schema_compatible,
    missing_tables: compatibility.missing_tables,
    checked_at: new Date().toISOString(),
    retry_count: connection.retry_count,
    error: "error" in connection ? connection.error : baseStatus.postgres_last_error,
  };
}
