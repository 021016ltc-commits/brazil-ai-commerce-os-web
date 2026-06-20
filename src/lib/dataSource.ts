export type DataSourceKind = "sqlite" | "supabase" | "postgresql";

export const activeDataSource: DataSourceKind =
  process.env.SYSTEM_MODE === "production" ? "postgresql" : "sqlite";

export const futureDataSourceNotes = [
  "本地模式可读取 SQLite 中的真实业务数据。",
  "生产模式可接入 PostgreSQL 或 Supabase。",
  "平台中立字段可继续支持多平台数据迁移。",
];
