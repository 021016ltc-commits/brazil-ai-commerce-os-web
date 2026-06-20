import type { DatabaseSync } from "node:sqlite";

const DEFAULT_DB_PATH = "data/brazil_ai_commerce_os.db";

function resolveDatabasePath() {
  const configuredPath = process.env.SQLITE_DB_PATH?.trim();

  return configuredPath || DEFAULT_DB_PATH;
}

export async function withDatabase<T>(callback: (db: DatabaseSync) => T, readOnly = true): Promise<T> {
  const dbPath = resolveDatabasePath();
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(dbPath, { readOnly });

  try {
    return callback(db);
  } finally {
    db.close();
  }
}
