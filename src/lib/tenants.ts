import {
  tenantMock,
  tenantUsageMock,
  tenantUserMock,
  workspaceMock,
} from "@/data/tenantsMock";
import { currentTenantId, DEFAULT_TENANT_ID } from "@/lib/tenantContext";
import { isMockDataAllowed } from "@/lib/runtime/config";
import { withDatabase } from "@/lib/sqlite";
import type {
  PlanType,
  TenantItem,
  TenantMutationResponse,
  TenantsApiResponse,
  TenantUsageStats,
  TenantUserItem,
  TenantRole,
  WorkspaceItem,
  WorkspacesApiResponse,
} from "@/types";

type CountRow = { count: number | bigint | null };

function shouldUseMockData() {
  return isMockDataAllowed() && process.env.DATA_SOURCE_MODE?.trim().toLowerCase() === "mock";
}

function nowIso() {
  return new Date().toISOString();
}

function idSafe(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function asRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function toCount(row: CountRow | undefined) {
  return Number(row?.count ?? 0);
}

function mockTenantsResponse(): TenantsApiResponse {
  const tenantId = currentTenantId();
  return {
    source: "mock",
    tenant_id: tenantId,
    tenants: tenantMock,
    workspaces: workspaceMock,
    tenant_users: tenantUserMock,
    usage: tenantUsageMock,
  };
}

function mockWorkspacesResponse(): WorkspacesApiResponse {
  const tenantId = currentTenantId();
  return {
    source: "mock",
    tenant_id: tenantId,
    workspaces: workspaceMock.filter((workspace) => workspace.tenant_id === tenantId),
  };
}

export async function getTenantsResponse(): Promise<TenantsApiResponse> {
  if (shouldUseMockData()) {
    return mockTenantsResponse();
  }

  try {
    return withDatabase((db) => {
      const tenants = asRows<TenantItem>(
        db
          .prepare(
            `SELECT tenant_id, name, plan_type, created_at
               FROM tenants
              ORDER BY created_at ASC, tenant_id ASC`,
          )
          .all(),
      );

      const workspaces = asRows<WorkspaceItem>(
        db
          .prepare(
            `SELECT workspace_id, tenant_id, name, shop_count, created_at
               FROM workspaces
              ORDER BY created_at ASC, workspace_id ASC`,
          )
          .all(),
      );

      const tenantUsers = asRows<TenantUserItem>(
        db
          .prepare(
            `SELECT tenant_id, user_id, role
               FROM tenant_users
              ORDER BY tenant_id ASC, user_id ASC`,
          )
          .all(),
      );

      const usage: TenantUsageStats[] = tenants.map((tenant) => {
        const tenantId = tenant.tenant_id;
        const workspaceCount = toCount(
          db.prepare("SELECT COUNT(*) AS count FROM workspaces WHERE tenant_id = ?").get(tenantId) as
            | CountRow
            | undefined,
        );
        const userCount = toCount(
          db.prepare("SELECT COUNT(*) AS count FROM tenant_users WHERE tenant_id = ?").get(tenantId) as
            | CountRow
            | undefined,
        );
        const productCount = toCount(
          db.prepare("SELECT COUNT(*) AS count FROM products WHERE tenant_id = ?").get(tenantId) as
            | CountRow
            | undefined,
        );
        const actionCount = toCount(
          db.prepare("SELECT COUNT(*) AS count FROM action_queue WHERE tenant_id = ?").get(tenantId) as
            | CountRow
            | undefined,
        );
        const shopCount = workspaces
          .filter((workspace) => workspace.tenant_id === tenantId)
          .reduce((total, workspace) => total + Number(workspace.shop_count ?? 0), 0);

        return {
          tenant_id: tenantId,
          workspace_count: workspaceCount,
          user_count: userCount,
          product_count: productCount,
          action_count: actionCount,
          shop_count: shopCount,
        };
      });

      return {
        source: "sqlite",
        tenant_id: currentTenantId(),
        tenants,
        workspaces,
        tenant_users: tenantUsers,
        usage,
      };
    });
  } catch (error) {
    if (!isMockDataAllowed()) throw error instanceof Error ? error : new Error("Tenants read failed.");
    return mockTenantsResponse();
  }
}

export async function getWorkspacesResponse(): Promise<WorkspacesApiResponse> {
  if (shouldUseMockData()) {
    return mockWorkspacesResponse();
  }

  try {
    return withDatabase((db) => {
      const tenantId = currentTenantId();
      const workspaces = asRows<WorkspaceItem>(
        db
          .prepare(
            `SELECT workspace_id, tenant_id, name, shop_count, created_at
               FROM workspaces
              WHERE tenant_id = ?
              ORDER BY created_at ASC, workspace_id ASC`,
          )
          .all(tenantId),
      );

      return {
        source: "sqlite",
        tenant_id: tenantId,
        workspaces,
      };
    });
  } catch (error) {
    if (!isMockDataAllowed()) throw error instanceof Error ? error : new Error("Workspaces read failed.");
    return mockWorkspacesResponse();
  }
}

export async function createTenant(params: {
  tenant_id?: string;
  name: string;
  plan_type?: PlanType;
}): Promise<TenantMutationResponse> {
  const createdAt = nowIso();
  const tenantId = params.tenant_id?.trim() || `tenant_${idSafe(params.name) || Date.now()}`;
  const tenant: TenantItem = {
    tenant_id: tenantId,
    name: params.name,
    plan_type: params.plan_type ?? "free",
    created_at: createdAt,
  };

  if (shouldUseMockData()) {
    return {
      source: "mock",
      tenant_id: tenantId,
      tenant,
      message: "备用数据模式：仅创建本地工作空间预览。",
    };
  }

  return withDatabase((db) => {
    db
      .prepare(
        `INSERT INTO tenants (tenant_id, name, plan_type, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(tenant_id) DO UPDATE SET
           name = excluded.name,
           plan_type = excluded.plan_type`,
      )
      .run(tenant.tenant_id, tenant.name, tenant.plan_type, tenant.created_at);

    db
      .prepare(
        `INSERT OR IGNORE INTO workspaces (workspace_id, tenant_id, name, shop_count, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(`${tenant.tenant_id}_workspace`, tenant.tenant_id, `${tenant.name} Workspace`, 0, createdAt);

    return {
      source: "sqlite",
      tenant_id: tenant.tenant_id,
      tenant,
      message: "工作空间已创建到本地 SQLite，未触发支付或外部登录。",
    };
  }, false);
}

export async function createWorkspace(params: {
  tenant_id?: string;
  workspace_id?: string;
  name: string;
  shop_count?: number;
}): Promise<TenantMutationResponse> {
  const tenantId = params.tenant_id?.trim() || currentTenantId() || DEFAULT_TENANT_ID;
  const createdAt = nowIso();
  const workspace: WorkspaceItem = {
    workspace_id: params.workspace_id?.trim() || `workspace_${idSafe(params.name) || Date.now()}`,
    tenant_id: tenantId,
    name: params.name,
    shop_count: Math.max(0, Number(params.shop_count ?? 0)),
    created_at: createdAt,
  };

  if (shouldUseMockData()) {
    return {
      source: "mock",
      tenant_id: tenantId,
      workspace,
      message: "备用数据模式：运营空间预览记录仅在本地生成。",
    };
  }

  return withDatabase((db) => {
    db
      .prepare(
        `INSERT OR IGNORE INTO tenants (tenant_id, name, plan_type, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(tenantId, tenantId === DEFAULT_TENANT_ID ? "Brazil Demo Tenant" : tenantId, "free", createdAt);

    db
      .prepare(
        `INSERT INTO workspaces (workspace_id, tenant_id, name, shop_count, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(workspace_id) DO UPDATE SET
           tenant_id = excluded.tenant_id,
           name = excluded.name,
           shop_count = excluded.shop_count`,
      )
      .run(
        workspace.workspace_id,
        workspace.tenant_id,
        workspace.name,
        workspace.shop_count,
        workspace.created_at,
      );

    return {
      source: "sqlite",
      tenant_id: tenantId,
      workspace,
      message: "Workspace created in local SQLite. Billing remains mock-only.",
    };
  }, false);
}

export function isTenantRole(value: unknown): value is TenantRole {
  return value === "owner" || value === "admin" || value === "operator" || value === "viewer";
}
