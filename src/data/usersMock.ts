import type {
  OperationLogItem,
  PermissionItem,
  RoleItem,
  UserItem,
  UserRoleAssignment,
  UserRoleName,
} from "@/types";

export const permissionMock: PermissionItem[] = [
  { permission_id: "perm_dashboard_view", permission_key: "dashboard:view", resource: "dashboard", action: "view", description: "查看老板驾驶舱。" },
  { permission_id: "perm_tasks_view", permission_key: "tasks:view", resource: "tasks", action: "view", description: "查看今日任务。" },
  { permission_id: "perm_opportunities_view", permission_key: "opportunities:view", resource: "opportunities", action: "view", description: "查看机会中心。" },
  { permission_id: "perm_analysis_view", permission_key: "analysis:view", resource: "analysis", action: "view", description: "查看数据分析。" },
  { permission_id: "perm_approvals_view", permission_key: "approvals:view", resource: "approvals", action: "view", description: "查看审批中心。" },
  { permission_id: "perm_approvals_approve", permission_key: "approvals:approve", resource: "approvals", action: "approve", description: "执行本地审批状态流转。" },
  { permission_id: "perm_actions_view", permission_key: "actions:view", resource: "actions", action: "view", description: "查看执行中心。" },
  { permission_id: "perm_actions_approve", permission_key: "actions:approve", resource: "actions", action: "approve", description: "审批本地受控执行申请。" },
  { permission_id: "perm_profit_view", permission_key: "profit:view", resource: "profit", action: "view", description: "查看利润中心。" },
  { permission_id: "perm_inventory_view", permission_key: "inventory:view", resource: "inventory", action: "view", description: "查看库存中心。" },
  { permission_id: "perm_shopee_view", permission_key: "shopee:view", resource: "shopee", action: "view", description: "查看 Shopee店铺。" },
  { permission_id: "perm_decision_feedback_view", permission_key: "decision_feedback:view", resource: "decision_feedback", action: "view", description: "查看决策复盘。" },
  { permission_id: "perm_business_impact_view", permission_key: "business_impact:view", resource: "business_impact", action: "view", description: "查看业务结果归因分析。" },
  { permission_id: "perm_self_optimization_view", permission_key: "self_optimization:view", resource: "self_optimization", action: "view", description: "查看规则优化。" },
  { permission_id: "perm_daily_ops_view", permission_key: "daily_ops:view", resource: "daily_ops", action: "view", description: "查看每日运营。" },
  { permission_id: "perm_verification_view", permission_key: "verification:view", resource: "verification", action: "view", description: "查看系统验收。" },
  { permission_id: "perm_users_view", permission_key: "users:view", resource: "users", action: "view", description: "查看用户和权限。" },
  { permission_id: "perm_users_manage", permission_key: "users:manage", resource: "users", action: "manage", description: "创建和修改本地用户。" },
  { permission_id: "perm_system_view", permission_key: "system:view", resource: "system", action: "view", description: "查看系统设置。" },
  { permission_id: "perm_system_health_view", permission_key: "system_health:view", resource: "system_health", action: "view", description: "查看系统健康监控。" },
];

permissionMock.splice(1, 0, {
  permission_id: "perm_command_center_view",
  permission_key: "command_center:view",
  resource: "command_center",
  action: "view",
  description: "查看运营指挥中心。",
});

permissionMock.splice(2, 0, {
  permission_id: "perm_tenants_view",
  permission_key: "tenants:view",
  resource: "tenants",
  action: "view",
  description: "查看工作空间、运营空间、方案状态和用量。",
});

const rolePermissionKeys: Record<UserRoleName, string[]> = {
  admin: permissionMock.map((item) => item.permission_key),
  operator: [
    "dashboard:view",
    "command_center:view",
    "tenants:view",
    "tasks:view",
    "opportunities:view",
    "analysis:view",
    "approvals:view",
    "approvals:approve",
    "actions:view",
    "shopee:view",
    "decision_feedback:view",
    "business_impact:view",
    "self_optimization:view",
    "daily_ops:view",
    "verification:view",
  ],
  buyer: ["dashboard:view", "command_center:view", "tenants:view", "daily_ops:view", "tasks:view", "inventory:view", "verification:view"],
  finance: ["dashboard:view", "command_center:view", "tenants:view", "daily_ops:view", "profit:view", "actions:view", "actions:approve", "business_impact:view", "self_optimization:view", "verification:view"],
  viewer: permissionMock
    .filter((item) => item.action === "view")
    .map((item) => item.permission_key),
};

function permissionsFor(role: UserRoleName) {
  const allowed = new Set(rolePermissionKeys[role]);
  return permissionMock.filter((item) => allowed.has(item.permission_key));
}

export const roleMock: RoleItem[] = [
  {
    role_id: "admin",
    role_name: "admin",
    description: "系统管理员，拥有全部查看、管理和审批权限。",
    is_system: true,
    permissions: permissionsFor("admin"),
  },
  {
    role_id: "operator",
    role_name: "operator",
    description: "运营角色，可处理运营总览、今日任务、机会中心、数据分析和审批中心。",
    is_system: true,
    permissions: permissionsFor("operator"),
  },
  {
    role_id: "buyer",
    role_name: "buyer",
    description: "采购角色，可查看运营总览、今日任务和库存中心。",
    is_system: true,
    permissions: permissionsFor("buyer"),
  },
  {
    role_id: "finance",
    role_name: "finance",
    description: "财务角色，可查看运营总览和利润中心。",
    is_system: true,
    permissions: permissionsFor("finance"),
  },
  {
    role_id: "viewer",
    role_name: "viewer",
    description: "只读角色，可查看页面但不能管理用户或执行审批。",
    is_system: true,
    permissions: permissionsFor("viewer"),
  },
];

export const userRoleMock: UserRoleAssignment[] = [
  { user_id: "user_admin_001", role_id: "admin", assigned_at: "2026-06-17T09:00:00-03:00", assigned_by: "system" },
  { user_id: "user_operator_001", role_id: "operator", assigned_at: "2026-06-17T09:05:00-03:00", assigned_by: "user_admin_001" },
  { user_id: "user_buyer_001", role_id: "buyer", assigned_at: "2026-06-17T09:10:00-03:00", assigned_by: "user_admin_001" },
  { user_id: "user_finance_001", role_id: "finance", assigned_at: "2026-06-17T09:15:00-03:00", assigned_by: "user_admin_001" },
  { user_id: "user_viewer_001", role_id: "viewer", assigned_at: "2026-06-17T09:20:00-03:00", assigned_by: "user_admin_001" },
];

function permissionKeysForRoles(roles: UserRoleName[]) {
  return Array.from(
    new Set(
      roles.flatMap((role) =>
        roleMock
          .find((item) => item.role_id === role)
          ?.permissions.map((permission) => permission.permission_key) ?? [],
      ),
    ),
  ).sort();
}

function makeUser(params: Omit<UserItem, "permissions">): UserItem {
  return {
    ...params,
    permissions: permissionKeysForRoles(params.roles),
  };
}

export const userMock: UserItem[] = [
  makeUser({
    user_id: "user_admin_001",
    email: "楼天城",
    display_name: "楼天城",
    status: "active",
    default_role: "admin",
    roles: ["admin"],
    last_login_at: "2026-06-17T09:30:00-03:00",
    created_at: "2026-06-17T09:00:00-03:00",
    updated_at: "2026-06-17T09:00:00-03:00",
  }),
  makeUser({
    user_id: "user_operator_001",
    email: "operator@local.br",
    display_name: "Operador Local",
    status: "active",
    default_role: "operator",
    roles: ["operator"],
    last_login_at: "2026-06-17T09:35:00-03:00",
    created_at: "2026-06-17T09:05:00-03:00",
    updated_at: "2026-06-17T09:05:00-03:00",
  }),
  makeUser({
    user_id: "user_buyer_001",
    email: "buyer@local.br",
    display_name: "Compras Local",
    status: "active",
    default_role: "buyer",
    roles: ["buyer"],
    last_login_at: "2026-06-17T09:40:00-03:00",
    created_at: "2026-06-17T09:10:00-03:00",
    updated_at: "2026-06-17T09:10:00-03:00",
  }),
  makeUser({
    user_id: "user_finance_001",
    email: "finance@local.br",
    display_name: "Financeiro Local",
    status: "active",
    default_role: "finance",
    roles: ["finance"],
    last_login_at: "2026-06-17T09:45:00-03:00",
    created_at: "2026-06-17T09:15:00-03:00",
    updated_at: "2026-06-17T09:15:00-03:00",
  }),
  makeUser({
    user_id: "user_viewer_001",
    email: "viewer@local.br",
    display_name: "Viewer Local",
    status: "active",
    default_role: "viewer",
    roles: ["viewer"],
    last_login_at: null,
    created_at: "2026-06-17T09:20:00-03:00",
    updated_at: "2026-06-17T09:20:00-03:00",
  }),
];

export const operationLogMock: OperationLogItem[] = [
  {
    log_id: "oplog_internal_admin_seeded_001",
    action_type: "admin_seeded",
    actor_user_id: "system",
    actor_email: "system@local",
    target_type: "users",
    target_id: "user_admin_001",
    summary: "内部管理员账号已准备。",
    status: "success",
    created_at: "2026-06-17T09:00:00-03:00",
    metadata_json: "{\"mode\":\"internal_admin_bootstrap\"}",
  },
  {
    log_id: "oplog_20260617_login_001",
    action_type: "user_login",
    actor_user_id: "user_admin_001",
    actor_email: "楼天城",
    target_type: "session",
    target_id: "local_session_admin",
    summary: "楼天城 登录本地系统。",
    status: "success",
    created_at: "2026-06-17T09:30:00-03:00",
    metadata_json: "{\"mode\":\"local\"}",
  },
  {
    log_id: "oplog_20260617_logout_001",
    action_type: "logout",
    actor_user_id: "user_operator_001",
    actor_email: "operator@local.br",
    target_type: "session",
    target_id: "local_session_operator",
    summary: "Operador Local 退出本地系统。",
    status: "success",
    created_at: "2026-06-17T09:50:00-03:00",
    metadata_json: "{\"mode\":\"local\"}",
  },
  {
    log_id: "oplog_20260617_approval_001",
    action_type: "approval",
    actor_user_id: "user_operator_001",
    actor_email: "operator@local.br",
    target_type: "action_queue",
    target_id: "act_20260617_003",
    summary: "本地审批状态更新为 approved_local。",
    status: "success",
    created_at: "2026-06-17T10:06:00-03:00",
    metadata_json: "{\"status\":\"approved_local\"}",
  },
  {
    log_id: "oplog_20260617_user_create_001",
    action_type: "user_create",
    actor_user_id: "user_admin_001",
    actor_email: "admin@local.br",
    target_type: "users",
    target_id: "user_viewer_001",
    summary: "创建 viewer 本地用户。",
    status: "success",
    created_at: "2026-06-17T09:20:00-03:00",
    metadata_json: "{\"role\":\"viewer\"}",
  },
  {
    log_id: "oplog_20260617_user_update_001",
    action_type: "user_update",
    actor_user_id: "user_admin_001",
    actor_email: "admin@local.br",
    target_type: "users",
    target_id: "user_operator_001",
    summary: "更新 operator 本地用户资料。",
    status: "success",
    created_at: "2026-06-17T10:12:00-03:00",
    metadata_json: "{\"role\":\"operator\"}",
  },
];
