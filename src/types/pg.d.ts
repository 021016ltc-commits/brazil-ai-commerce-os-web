declare module "pg" {
  export class Pool {
    constructor(config: { connectionString: string });
    query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
    end(): Promise<void>;
  }
}
