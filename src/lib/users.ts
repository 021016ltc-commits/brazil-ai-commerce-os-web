import { pbkdf2Sync, randomUUID, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  operationLogMock,
  permissionMock,
  roleMock,
  userMock,
  userRoleMock,
} from "@/data/usersMock";
import { emptyOperationLogsResponse } from "@/data/emptyResponses";
import { createProductionTraceId, getRuntimeEnvironmentTag, isMockDataAllowed } from "@/lib/runtime/config";
import { withDatabase } from "@/lib/sqlite";
import { currentTenantId, DEFAULT_TENANT_ID } from "@/lib/tenantContext";
import type {
  OperationLogAction,
  OperationLogItem,
  OperationLogsApiResponse,
  PermissionAction,
  PermissionItem,
  PermissionResource,
  RoleItem,
  RolesApiResponse,
  UserItem,
  UserRoleAssignment,
  UserRoleName,
  UsersApiResponse,
  UserStatus,
} from "@/types";

type PermissionRow = {
  permission_id: string;
  permission_key: string;
  resource: PermissionResource;
  action: PermissionAction;
  description: string | null;
};

type RoleRow = {
  role_id: UserRoleName;
  role_name: UserRoleName;
  description: string | null;
  is_system: number | boolean | null;
  permission_keys_json: string | null;
};

type UserRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  status: UserStatus | null;
  default_role: UserRoleName | null;
  last_login_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type UserAuthRow = UserRow & {
  password_hash: string | null;
  password_salt: string | null;
  password_algorithm: string | null;
};

type UserRoleRow = {
  user_id: string;
  role_id: UserRoleName;
  assigned_at: string | null;
  assigned_by: string | null;
};

type OperationLogRow = {
  log_id: string;
  action_type: OperationLogAction;
  actor_user_id: string | null;
  actor_email: string | null;
  target_type: string | null;
  target_id: string | null;
  summary: string | null;
  status: "success" | "failed" | null;
  created_at: string | null;
  metadata_json: string | null;
};

function shouldUseMockData() {
  return isMockDataAllowed() && process.env.DATA_SOURCE_MODE?.trim().toLowerCase() === "mock";
}

const defaultInternalAdmin = {
  user_id: "user_admin_001",
  account: "楼天城",
  display_name: "楼天城",
  password_hash: "g+D8BZ+QLxsgO3EJsdIIi0FchxyA5pvk5v/gLYDMl/g=",
  password_salt: "kWz9jaoFAO9WYkpkQ4xjsQ==",
  password_algorithm: "pbkdf2_sha256_100000",
} as const;

let systemIdentityEnsured = false;

function nowIso() {
  return new Date().toISOString();
}

function asRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function tenantId() {
  return currentTenantId();
}

function defaultTenantLogFallback() {
  return tenantId() === DEFAULT_TENANT_ID ? mockOperationLogsResponse() : { source: "mock" as const, operation_logs: [] };
}

function tenantRoleFromUserRole(role: UserRoleName) {
  if (role === "admin") return "admin";
  if (role === "viewer") return "viewer";
  return "operator";
}

function hashPassword(password: string, salt: string) {
  return pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("base64");
}

function verifyPassword(password: string, hash: string | null, salt: string | null) {
  if (!hash || !salt) return false;
  const candidate = Buffer.from(hashPassword(password, salt), "base64");
  const expected = Buffer.from(hash, "base64");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

function defaultAdminUser(now = nowIso()): UserItem {
  return {
    user_id: defaultInternalAdmin.user_id,
    email: defaultInternalAdmin.account,
    display_name: defaultInternalAdmin.display_name,
    status: "active",
    default_role: "admin",
    roles: ["admin"],
    permissions: permissionKeysForRoles(["admin"], roleMock),
    last_login_at: null,
    created_at: now,
    updated_at: now,
  };
}

function internalAdminUsersResponse(source: UsersApiResponse["source"] = "sqlite"): UsersApiResponse {
  const assignedAt = "2026-06-17T09:00:00-03:00";
  return {
    source,
    users: [defaultAdminUser(assignedAt)],
    roles: roleMock,
    permissions: permissionMock,
    user_roles: [
      {
        user_id: defaultInternalAdmin.user_id,
        role_id: "admin",
        assigned_at: assignedAt,
        assigned_by: "system",
      },
    ],
  };
}

function defaultTenantUserFallback() {
  if (tenantId() !== DEFAULT_TENANT_ID) {
    return { source: "sqlite" as const, users: [], roles: roleMock, permissions: permissionMock, user_roles: [] };
  }
  return internalAdminUsersResponse("sqlite");
}

function parsePermissionKeys(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mapPermission(row: PermissionRow): PermissionItem {
  return {
    permission_id: row.permission_id,
    permission_key: row.permission_key,
    resource: row.resource,
    action: row.action,
    description: row.description ?? row.permission_key,
  };
}

function mapRole(row: RoleRow, permissions: PermissionItem[]): RoleItem {
  const permissionKeys = new Set(parsePermissionKeys(row.permission_keys_json));
  return {
    role_id: row.role_id,
    role_name: row.role_name,
    description: row.description ?? row.role_name,
    is_system: Boolean(row.is_system),
    permissions: permissions.filter((item) => permissionKeys.has(item.permission_key)),
  };
}

function mapUserRole(row: UserRoleRow): UserRoleAssignment {
  return {
    user_id: row.user_id,
    role_id: row.role_id,
    assigned_at: row.assigned_at ?? "",
    assigned_by: row.assigned_by ?? "system",
  };
}

function permissionKeysForRoles(roles: UserRoleName[], roleItems: RoleItem[]) {
  return Array.from(
    new Set(
      roles.flatMap((role) =>
        roleItems.find((item) => item.role_id === role)?.permissions.map((permission) => permission.permission_key) ??
        [],
      ),
    ),
  ).sort();
}

function buildUsers(rows: UserRow[], assignments: UserRoleAssignment[], roles: RoleItem[]): UserItem[] {
  return rows.map((row) => {
    const assignedRoles = assignments
      .filter((assignment) => assignment.user_id === row.user_id)
      .map((assignment) => assignment.role_id);
    const userRoles = assignedRoles.length > 0 ? assignedRoles : [row.default_role ?? "viewer"];

    return {
      user_id: row.user_id,
      email: row.email,
      display_name: row.display_name ?? row.email,
      status: row.status ?? "active",
      default_role: row.default_role ?? userRoles[0] ?? "viewer",
      roles: userRoles,
      permissions: permissionKeysForRoles(userRoles, roles),
      last_login_at: row.last_login_at,
      created_at: row.created_at ?? "",
      updated_at: row.updated_at ?? "",
    };
  });
}

function mapOperationLog(row: OperationLogRow): OperationLogItem {
  return {
    log_id: row.log_id,
    action_type: row.action_type,
    actor_user_id: row.actor_user_id ?? "system",
    actor_email: row.actor_email ?? "system@local",
    target_type: row.target_type ?? "system",
    target_id: row.target_id ?? "",
    summary: row.summary ?? row.action_type,
    status: row.status ?? "success",
    created_at: row.created_at ?? "",
    metadata_json: row.metadata_json,
  };
}

function mockUsersResponse(): UsersApiResponse {
  return {
    source: "mock",
    users: userMock,
    roles: roleMock,
    permissions: permissionMock,
    user_roles: userRoleMock,
  };
}

function mockRolesResponse(): RolesApiResponse {
  return {
    source: "mock",
    roles: roleMock,
    permissions: permissionMock,
  };
}

function mockOperationLogsResponse(): OperationLogsApiResponse {
  return {
    source: "mock",
    operation_logs: operationLogMock,
  };
}

function ensureUserSecurityColumns(db: DatabaseSync) {
  const existingColumns = new Set(
    asRows<{ name: string }>(db.prepare("PRAGMA table_info(users)").all()).map((row) => row.name),
  );

  const columns: Record<string, string> = {
    password_hash: "TEXT",
    password_salt: "TEXT",
    password_algorithm: "TEXT",
  };

  Object.entries(columns).forEach(([columnName, columnType]) => {
    if (!existingColumns.has(columnName)) {
      db.prepare(`ALTER TABLE users ADD COLUMN ${columnName} ${columnType}`).run();
    }
  });
}

async function ensureSystemIdentityReady() {
  if (shouldUseMockData() || systemIdentityEnsured) return;

  try {
    await withDatabase((db) => {
      const createdAt = nowIso();
      ensureUserSecurityColumns(db);

      db
        .prepare(
          `INSERT OR IGNORE INTO tenants (tenant_id, name, plan_type, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(DEFAULT_TENANT_ID, "Brazil Internal Workspace", "free", createdAt);
      db
        .prepare(
          `INSERT OR IGNORE INTO workspaces (workspace_id, tenant_id, name, shop_count, created_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run("workspace_demo_default", DEFAULT_TENANT_ID, "默认工作空间", 1, createdAt);

      const insertPermission = db.prepare(
        `INSERT OR IGNORE INTO permissions (
           permission_id, permission_key, resource, action, description, created_at
         )
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      permissionMock.forEach((permission) => {
        insertPermission.run(
          permission.permission_id,
          permission.permission_key,
          permission.resource,
          permission.action,
          permission.description,
          createdAt,
        );
      });

      const upsertRole = db.prepare(
        `INSERT INTO roles (role_id, role_name, description, is_system, permission_keys_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(role_id) DO UPDATE SET
           description = excluded.description,
           is_system = excluded.is_system,
           permission_keys_json = excluded.permission_keys_json`,
      );
      roleMock.forEach((role) => {
        upsertRole.run(
          role.role_id,
          role.role_name,
          role.description,
          role.is_system ? 1 : 0,
          JSON.stringify(role.permissions.map((permission) => permission.permission_key)),
          createdAt,
        );
      });

      const usersCount = (db.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count;
      if (usersCount === 0) {
        db
          .prepare(
            `INSERT OR IGNORE INTO users (
               user_id, email, display_name, status, default_role, last_login_at,
               created_at, updated_at, password_hash, password_salt, password_algorithm
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            defaultInternalAdmin.user_id,
            defaultInternalAdmin.account,
            defaultInternalAdmin.display_name,
            "active",
            "admin",
            null,
            createdAt,
            createdAt,
            defaultInternalAdmin.password_hash,
            defaultInternalAdmin.password_salt,
            defaultInternalAdmin.password_algorithm,
          );
        db
          .prepare(
            `INSERT OR IGNORE INTO user_roles (user_id, role_id, assigned_at, assigned_by)
             VALUES (?, ?, ?, ?)`,
          )
          .run(defaultInternalAdmin.user_id, "admin", createdAt, "system");
        db
          .prepare(
            `INSERT OR IGNORE INTO tenant_users (tenant_id, user_id, role)
             VALUES (?, ?, ?)`,
          )
          .run(DEFAULT_TENANT_ID, defaultInternalAdmin.user_id, "owner");
        db
          .prepare(
            `INSERT OR IGNORE INTO operation_logs (
               log_id, action_type, actor_user_id, actor_email, target_type,
               target_id, summary, status, created_at, metadata_json, tenant_id
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            "oplog_internal_admin_seeded",
            "admin_seeded",
            "system",
            "system@local",
            "users",
            defaultInternalAdmin.user_id,
            "内部管理员账号已准备。",
            "success",
            createdAt,
            JSON.stringify({ mode: "internal_admin_bootstrap" }),
            DEFAULT_TENANT_ID,
          );
      } else {
        db
          .prepare(
            `UPDATE users
                SET password_hash = COALESCE(password_hash, ?),
                    password_salt = COALESCE(password_salt, ?),
                    password_algorithm = COALESCE(password_algorithm, ?),
                    status = CASE WHEN status IS NULL THEN 'active' ELSE status END,
                    default_role = CASE WHEN default_role IS NULL THEN 'admin' ELSE default_role END,
                    updated_at = COALESCE(updated_at, ?)
              WHERE user_id = ?
                 OR email = ?
                 OR display_name = ?`,
          )
          .run(
            defaultInternalAdmin.password_hash,
            defaultInternalAdmin.password_salt,
            defaultInternalAdmin.password_algorithm,
            createdAt,
            defaultInternalAdmin.user_id,
            defaultInternalAdmin.account,
            defaultInternalAdmin.display_name,
          );

        const adminRow = db
          .prepare("SELECT user_id FROM users WHERE user_id = ? OR email = ? OR display_name = ? LIMIT 1")
          .get(defaultInternalAdmin.user_id, defaultInternalAdmin.account, defaultInternalAdmin.display_name) as
          | { user_id: string }
          | undefined;

        if (adminRow) {
          db
            .prepare(
              `INSERT OR IGNORE INTO user_roles (user_id, role_id, assigned_at, assigned_by)
               VALUES (?, ?, ?, ?)`,
            )
            .run(adminRow.user_id, "admin", createdAt, "system");
          db
            .prepare(
              `INSERT OR IGNORE INTO tenant_users (tenant_id, user_id, role)
               VALUES (?, ?, ?)`,
            )
            .run(DEFAULT_TENANT_ID, adminRow.user_id, "owner");
        }
      }
    }, false);

    systemIdentityEnsured = true;
  } catch {
    // Missing or read-only SQLite should not block /login; API falls back to internal admin.
  }
}

async function readUsersPayload(): Promise<Omit<UsersApiResponse, "source">> {
  return withDatabase((db) => {
    const permissions = asRows<PermissionRow>(
      db
        .prepare(
          `SELECT permission_id, permission_key, resource, action, description
             FROM permissions
             ORDER BY resource ASC, action ASC, permission_key ASC`,
        )
        .all(),
    ).map(mapPermission);

    const roles = asRows<RoleRow>(
      db
        .prepare(
          `SELECT role_id, role_name, description, is_system, permission_keys_json
             FROM roles
             ORDER BY role_id ASC`,
        )
        .all(),
    ).map((row) => mapRole(row, permissions));

    const userRoles = asRows<UserRoleRow>(
      db
        .prepare(
          `SELECT ur.user_id, ur.role_id, ur.assigned_at, ur.assigned_by
             FROM user_roles ur
             INNER JOIN tenant_users tu
                ON tu.user_id = ur.user_id
               AND tu.tenant_id = ?
             ORDER BY user_id ASC, role_id ASC`,
        )
        .all(tenantId()),
    ).map(mapUserRole);

    const userRows = asRows<UserRow>(
      db
        .prepare(
          `SELECT u.user_id, u.email, u.display_name, u.status, u.default_role,
                  u.last_login_at, u.created_at, u.updated_at
             FROM users u
             INNER JOIN tenant_users tu
                ON tu.user_id = u.user_id
               AND tu.tenant_id = ?
             ORDER BY created_at ASC, user_id ASC`,
        )
        .all(tenantId()),
    );

    return {
      users: buildUsers(userRows, userRoles, roles),
      roles,
      permissions,
      user_roles: userRoles,
    };
  });
}

export async function getUsersResponse(): Promise<UsersApiResponse> {
  if (shouldUseMockData()) return defaultTenantUserFallback();

  try {
    await ensureSystemIdentityReady();
    const payload = await readUsersPayload();
    if (payload.users.length === 0 || payload.roles.length === 0 || payload.permissions.length === 0) {
      return defaultTenantUserFallback();
    }
    const hasActiveAdmin = payload.users.some((user) => user.status === "active" && user.roles.includes("admin"));
    if (!hasActiveAdmin && tenantId() === DEFAULT_TENANT_ID) {
      return {
        source: "sqlite",
        users: [...payload.users, defaultAdminUser()],
        roles: payload.roles.length ? payload.roles : roleMock,
        permissions: payload.permissions.length ? payload.permissions : permissionMock,
        user_roles: [
          ...payload.user_roles,
          {
            user_id: defaultInternalAdmin.user_id,
            role_id: "admin",
            assigned_at: nowIso(),
            assigned_by: "system",
          },
        ],
      };
    }
    return { source: "sqlite", ...payload };
  } catch {
    return defaultTenantUserFallback();
  }
}

export async function getRolesResponse(): Promise<RolesApiResponse> {
  if (shouldUseMockData()) return mockRolesResponse();

  try {
    await ensureSystemIdentityReady();
    const payload = await readUsersPayload();
    if (payload.roles.length === 0 || payload.permissions.length === 0) {
      return { source: "sqlite", roles: roleMock, permissions: permissionMock };
    }
    return { source: "sqlite", roles: payload.roles, permissions: payload.permissions };
  } catch {
    return { source: "sqlite", roles: roleMock, permissions: permissionMock };
  }
}

export async function getOperationLogsResponse(): Promise<OperationLogsApiResponse> {
  if (shouldUseMockData()) return defaultTenantLogFallback();

  try {
    const logs = await withDatabase((db) =>
      asRows<OperationLogRow>(
        db
          .prepare(
            `SELECT log_id, action_type, actor_user_id, actor_email, target_type,
                    target_id, summary, status, created_at, metadata_json
               FROM operation_logs
              WHERE tenant_id = ?
               ORDER BY created_at DESC, log_id DESC
               LIMIT 80`,
          )
          .all(tenantId()),
      ).map(mapOperationLog),
    );

    return {
      source: "sqlite",
      operation_logs: logs.length > 0 || tenantId() !== DEFAULT_TENANT_ID ? logs : operationLogMock,
    };
  } catch {
    return isMockDataAllowed() ? defaultTenantLogFallback() : emptyOperationLogsResponse;
  }
}

export async function recordOperationLog(params: {
  action_type: OperationLogAction;
  actor_user_id?: string;
  actor_email?: string;
  target_type: string;
  target_id: string;
  summary: string;
  status?: "success" | "failed";
  metadata?: Record<string, unknown>;
}) {
  if (shouldUseMockData()) return;

  try {
    const createdAt = nowIso();
    const traceId = createProductionTraceId("oplog");

    await withDatabase((db) => {
      db
        .prepare(
          `INSERT INTO operation_logs (
             log_id, action_type, actor_user_id, actor_email, target_type,
             target_id, summary, status, created_at, metadata_json, tenant_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          `oplog_${Date.now()}_${randomUUID().slice(0, 8)}`,
          params.action_type,
          params.actor_user_id ?? "system",
          params.actor_email ?? "system@local",
          params.target_type,
          params.target_id,
          params.summary,
          params.status ?? "success",
          createdAt,
          JSON.stringify({
            ...getRuntimeEnvironmentTag(),
            event_type: params.action_type,
            module: params.target_type,
            action: params.action_type,
            status: params.status ?? "success",
            trace_id: traceId,
            production_trace_id: traceId,
            timestamp: createdAt,
            ...(params.metadata ?? {}),
          }),
          tenantId(),
        );
    }, false);
  } catch {
    // Operation logging must not break the business action it observes.
  }
}

export async function createLocalUser(params: {
  email?: string;
  display_name?: string;
  roles?: UserRoleName[];
  status?: UserStatus;
  actor_user_id?: string;
  actor_email?: string;
}): Promise<UsersApiResponse & { user: UserItem }> {
  const now = nowIso();
  const roles: UserRoleName[] = params.roles?.length ? params.roles : ["viewer"];
  const userId = `user_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const email = params.email?.trim().toLowerCase();

  if (!email) {
    throw new Error("email is required.");
  }

  if (shouldUseMockData()) {
    const user: UserItem = {
      user_id: userId,
      email,
      display_name: params.display_name?.trim() || email,
      status: params.status ?? "active",
      default_role: roles[0],
      roles,
      permissions: permissionKeysForRoles(roles, roleMock),
      last_login_at: null,
      created_at: now,
      updated_at: now,
    };
    return { ...defaultTenantUserFallback(), user };
  }

  try {
    await withDatabase((db) => {
      db
        .prepare(
          `INSERT INTO users (
             user_id, email, display_name, status, default_role, last_login_at, created_at, updated_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          userId,
          email,
          params.display_name?.trim() || email,
          params.status ?? "active",
          roles[0],
          null,
          now,
          now,
        );

      const insertRole = db.prepare(
        `INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by)
         VALUES (?, ?, ?, ?)`,
      );
      roles.forEach((role) => insertRole.run(userId, role, now, params.actor_user_id ?? "system"));

      db
        .prepare(
          `INSERT INTO tenant_users (tenant_id, user_id, role)
           VALUES (?, ?, ?)`,
        )
        .run(tenantId(), userId, tenantRoleFromUserRole(roles[0]));
    }, false);

    await recordOperationLog({
      action_type: "user_create",
      actor_user_id: params.actor_user_id,
      actor_email: params.actor_email,
      target_type: "users",
      target_id: userId,
      summary: `创建本地用户 ${email}。`,
      metadata: { roles },
    });

    const response = await getUsersResponse();
    const user = response.users.find((item) => item.user_id === userId) ?? {
      user_id: userId,
      email,
      display_name: params.display_name?.trim() || email,
      status: params.status ?? "active",
      default_role: roles[0],
      roles,
      permissions: permissionKeysForRoles(roles, response.roles),
      last_login_at: null,
      created_at: now,
      updated_at: now,
    };

    return { ...response, user };
  } catch {
    const user: UserItem = {
      user_id: userId,
      email,
      display_name: params.display_name?.trim() || email,
      status: params.status ?? "active",
      default_role: roles[0],
      roles,
      permissions: permissionKeysForRoles(roles, roleMock),
      last_login_at: null,
      created_at: now,
      updated_at: now,
    };
    return { ...defaultTenantUserFallback(), user };
  }
}

export async function updateLocalUser(params: {
  user_id?: string;
  display_name?: string;
  roles?: UserRoleName[];
  status?: UserStatus;
  last_login_at?: string | null;
  actor_user_id?: string;
  actor_email?: string;
}): Promise<UsersApiResponse & { user: UserItem | null }> {
  if (!params.user_id) {
    throw new Error("user_id is required.");
  }

  const userId = params.user_id;
  const now = nowIso();
  const roles = params.roles?.length ? params.roles : undefined;

  if (shouldUseMockData()) {
    const user = userMock.find((item) => item.user_id === params.user_id) ?? null;
    return { ...defaultTenantUserFallback(), user };
  }

  try {
    await withDatabase((db) => {
      const existing = db
        .prepare("SELECT user_id, email FROM users WHERE user_id = ?")
        .get(userId) as { user_id: string; email: string } | undefined;

      if (!existing) {
        throw new Error("User not found.");
      }

      db
        .prepare(
          `UPDATE users
              SET display_name = COALESCE(?, display_name),
                  status = COALESCE(?, status),
                  default_role = COALESCE(?, default_role),
                  last_login_at = COALESCE(?, last_login_at),
                  updated_at = ?
            WHERE user_id = ?`,
        )
        .run(
          params.display_name?.trim() || null,
          params.status ?? null,
          roles?.[0] ?? null,
          params.last_login_at ?? null,
          now,
          userId,
        );

      if (roles) {
        db.prepare("DELETE FROM user_roles WHERE user_id = ?").run(userId);
        const insertRole = db.prepare(
          `INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by)
           VALUES (?, ?, ?, ?)`,
        );
        roles.forEach((role) => insertRole.run(userId, role, now, params.actor_user_id ?? "system"));

        db
          .prepare(
            `INSERT INTO tenant_users (tenant_id, user_id, role)
             VALUES (?, ?, ?)
             ON CONFLICT(tenant_id, user_id) DO UPDATE SET
               role = excluded.role`,
          )
          .run(tenantId(), userId, tenantRoleFromUserRole(roles[0]));
      }
    }, false);

    if (params.display_name || params.status || roles) {
      await recordOperationLog({
        action_type: "user_update",
        actor_user_id: params.actor_user_id,
        actor_email: params.actor_email,
        target_type: "users",
        target_id: userId,
        summary: `更新本地用户 ${userId}。`,
        metadata: { roles, status: params.status },
      });
    }

    const response = await getUsersResponse();
    return {
      ...response,
      user: response.users.find((item) => item.user_id === userId) ?? null,
    };
  } catch {
    const response = defaultTenantUserFallback();
    return {
      ...response,
      user: response.users.find((item) => item.user_id === userId) ?? null,
    };
  }
}

export async function authenticateLocalUser(params: {
  user_id?: string;
  account?: string;
  username?: string;
  display_name?: string;
  password?: string;
}): Promise<{ source: UsersApiResponse["source"]; user: UserItem; redirect_to: string; message: string }> {
  const account = params.account?.trim() || params.username?.trim() || params.display_name?.trim() || params.user_id?.trim();
  const password = params.password ?? "";

  if (!account || !password) {
    throw new Error("请输入账号和密码。");
  }

  const matchesAccount = (item: UserItem) =>
    item.user_id === account || item.email === account || item.display_name === account;

  if (shouldUseMockData()) {
    const fallback = defaultTenantUserFallback();
    const user = fallback.users.find(matchesAccount);
    if (!user || !verifyPassword(password, defaultInternalAdmin.password_hash, defaultInternalAdmin.password_salt)) {
      throw new Error("账号或密码不正确。");
    }
    return { source: fallback.source, user, redirect_to: "/dashboard", message: "登录成功。" };
  }

  try {
    await ensureSystemIdentityReady();

    const authenticatedUserId = await withDatabase((db) => {
      ensureUserSecurityColumns(db);

      const row = db
        .prepare(
          `SELECT user_id, email, display_name, status, default_role, last_login_at,
                  created_at, updated_at, password_hash, password_salt, password_algorithm
             FROM users
            WHERE status = 'active'
              AND (user_id = ? OR email = ? OR display_name = ?)
            LIMIT 1`,
        )
        .get(account, account, account) as UserAuthRow | undefined;

      if (!row || !verifyPassword(password, row.password_hash, row.password_salt)) {
        throw new Error("账号或密码不正确。");
      }

      const loginAt = nowIso();
      db
        .prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE user_id = ?")
        .run(loginAt, loginAt, row.user_id);
      return row.user_id;
    }, false);

    await recordOperationLog({
      action_type: "user_login",
      actor_user_id: authenticatedUserId,
      actor_email: authenticatedUserId === defaultInternalAdmin.user_id ? defaultInternalAdmin.account : authenticatedUserId,
      target_type: "session",
      target_id: "local_session",
      summary: "本地用户登录成功。",
      metadata: { login_method: "local_password" },
    });

    const response = await getUsersResponse();
    const user = response.users.find((item) => item.user_id === authenticatedUserId);
    if (!user) throw new Error("账号或密码不正确。");

    return { source: response.source, user, redirect_to: "/dashboard", message: "登录成功。" };
  } catch (error) {
    const fallback = defaultTenantUserFallback();
    const fallbackUser = fallback.users.find(matchesAccount);
    if (fallbackUser && verifyPassword(password, defaultInternalAdmin.password_hash, defaultInternalAdmin.password_salt)) {
      return { source: fallback.source, user: fallbackUser, redirect_to: "/dashboard", message: "登录成功。" };
    }
    throw error instanceof Error ? error : new Error("账号或密码不正确。");
  }
}
