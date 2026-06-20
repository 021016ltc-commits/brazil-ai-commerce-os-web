import { randomUUID } from "node:crypto";
import {
  operationLogMock,
  permissionMock,
  roleMock,
  userMock,
  userRoleMock,
} from "@/data/usersMock";
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

function nowIso() {
  return new Date().toISOString();
}

function asRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function tenantId() {
  return currentTenantId();
}

function defaultTenantUserFallback() {
  return tenantId() === DEFAULT_TENANT_ID ? mockUsersResponse() : { ...mockUsersResponse(), users: [], user_roles: [] };
}

function defaultTenantLogFallback() {
  return tenantId() === DEFAULT_TENANT_ID ? mockOperationLogsResponse() : { source: "mock" as const, operation_logs: [] };
}

function tenantRoleFromUserRole(role: UserRoleName) {
  if (role === "admin") return "admin";
  if (role === "viewer") return "viewer";
  return "operator";
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
    const payload = await readUsersPayload();
    if (payload.users.length === 0 || payload.roles.length === 0 || payload.permissions.length === 0) {
      return defaultTenantUserFallback();
    }
    return { source: "sqlite", ...payload };
  } catch {
    return defaultTenantUserFallback();
  }
}

export async function getRolesResponse(): Promise<RolesApiResponse> {
  if (shouldUseMockData()) return mockRolesResponse();

  try {
    const payload = await readUsersPayload();
    if (payload.roles.length === 0 || payload.permissions.length === 0) return mockRolesResponse();
    return { source: "sqlite", roles: payload.roles, permissions: payload.permissions };
  } catch {
    return mockRolesResponse();
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
    return defaultTenantLogFallback();
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
