export type DataSourceKind = "mock" | "sqlite" | "supabase" | "postgresql";

export const activeDataSource: DataSourceKind =
  process.env.SYSTEM_MODE === "production" ? "postgresql" : "sqlite";

export const futureDataSourceNotes = [
  "后续可从本地 SQLite 读取 Sprint 1 工作簿导出的数据。",
  "后续可在同一套数据结构下接入云端数据库。",
  "平台中立字段可以继续支持 PostgreSQL 等数据库迁移。",
];
