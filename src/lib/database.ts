import type { DatabaseSync } from "node:sqlite";
import { getRequestedDataSourceMode, isMockDataAllowed, isProductionMode } from "@/lib/runtime/config";
import { withDatabase } from "@/lib/sqlite";

type PgPoolLike = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  end(): Promise<void>;
};

type PgModuleLike = {
  Pool: new (config: { connectionString: string }) => PgPoolLike;
};

export type DatabaseMode = "postgres" | "sqlite" | "mock";

export type DatabaseClient =
  | {
      mode: "postgres";
      query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
      close(): Promise<void>;
    }
  | {
      mode: "sqlite";
      withSQLite<T>(callback: (db: DatabaseSync) => T, readOnly?: boolean): Promise<T>;
    }
  | {
      mode: "mock";
    };

let postgresPool: PgPoolLike | null = null;
let lastPostgresError: string | null = null;

function dataSourceMode() {
  const requestedMode = getRequestedDataSourceMode();
  if (requestedMode === "mock" && !isMockDataAllowed()) return "postgres";
  return requestedMode;
}

function databaseUrl() {
  return process.env.DATABASE_URL?.trim();
}

async function importPgModule(): Promise<PgModuleLike> {
  const importer = new Function("return import('pg')");
  return importer() as Promise<PgModuleLike>;
}

export async function connectPostgres(): Promise<Extract<DatabaseClient, { mode: "postgres" }>> {
  const connectionString = databaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  try {
    const pg = await importPgModule();
    postgresPool = postgresPool ?? new pg.Pool({ connectionString });

    await postgresPool.query("SELECT 1");

    return {
      mode: "postgres",
      query: <T = unknown>(sql: string, params?: unknown[]) => postgresPool!.query<T>(sql, params),
      close: async () => {
        if (!postgresPool) return;
        await postgresPool.end();
        postgresPool = null;
      },
    };
  } catch (error) {
    lastPostgresError = error instanceof Error ? error.message : "PostgreSQL connection failed.";
    throw new Error(lastPostgresError);
  }
}

export function fallbackToSQLite(): Extract<DatabaseClient, { mode: "sqlite" }> {
  return {
    mode: "sqlite",
    withSQLite: (callback, readOnly = true) => withDatabase(callback, readOnly),
  };
}

export async function getClient(): Promise<DatabaseClient> {
  const mode = dataSourceMode();

  if (mode === "mock") {
    return { mode: "mock" };
  }

  if (databaseUrl()) {
    try {
      return await connectPostgres();
    } catch {
      return fallbackToSQLite();
    }
  }

  return fallbackToSQLite();
}

export async function getDatabaseStatus() {
  const client = await getClient();

  return {
    mode: client.mode,
    postgres_configured: Boolean(databaseUrl()),
    postgres_last_error: lastPostgresError,
    mock_forced: dataSourceMode() === "mock" && !isProductionMode(),
  };
}

export async function migrateSQLiteToPostgres(tableNames: string[] = []) {
  const client = await getClient();
  if (client.mode !== "postgres") {
    return {
      migrated: false,
      source: client.mode,
      target: "postgres",
      table_count: 0,
      message: "PostgreSQL is not active; existing SQLite data remains the source of truth.",
    };
  }

  const sqlite = fallbackToSQLite();
  const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const tables = tableNames.length
    ? tableNames
    : await sqlite.withSQLite((db) =>
        db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
          .all()
          .map((row) => String((row as { name: string }).name)),
      );
  const tableResults: Array<{
    table: string;
    rows_seen: number;
    rows_copied: number;
    status: "copied" | "skipped" | "failed";
    error?: string;
  }> = [];

  for (const table of tables) {
    try {
      const columns = await sqlite.withSQLite((db) =>
        db
          .prepare(`PRAGMA table_info(${quoteIdentifier(table)})`)
          .all()
          .map((row) => String((row as { name: string }).name))
          .filter(Boolean),
      );

      if (columns.length === 0) {
        tableResults.push({ table, rows_seen: 0, rows_copied: 0, status: "skipped" });
        continue;
      }

      const rows = await sqlite.withSQLite((db) =>
        db.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all() as Record<string, unknown>[],
      );

      if (rows.length === 0) {
        tableResults.push({ table, rows_seen: 0, rows_copied: 0, status: "skipped" });
        continue;
      }

      const columnSql = columns.map(quoteIdentifier).join(", ");
      const valueSql = columns.map((_column, index) => `$${index + 1}`).join(", ");
      const insertSql = `INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES (${valueSql}) ON CONFLICT DO NOTHING`;

      let rowsCopied = 0;
      for (const row of rows) {
        await client.query(insertSql, columns.map((column) => row[column] ?? null));
        rowsCopied += 1;
      }

      tableResults.push({
        table,
        rows_seen: rows.length,
        rows_copied: rowsCopied,
        status: "copied",
      });
    } catch (error) {
      tableResults.push({
        table,
        rows_seen: 0,
        rows_copied: 0,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown migration error.",
      });
    }
  }

  return {
    migrated: true,
    source: "sqlite",
    target: "postgres",
    table_count: tableResults.length,
    rows_copied: tableResults.reduce((sum, item) => sum + item.rows_copied, 0),
    tables: tableResults,
    message: "SQLite rows were copied into PostgreSQL-compatible tables where the target schema exists.",
  };
}
