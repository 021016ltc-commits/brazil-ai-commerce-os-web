import type {
  TenantItem,
  TenantUsageStats,
  TenantUserItem,
  WorkspaceItem,
} from "@/types";

export const tenantMock: TenantItem[] = [
  {
    tenant_id: "demo_tenant",
    name: "Brazil Demo Tenant",
    plan_type: "pro",
    created_at: "2026-06-19T09:00:00-03:00",
  },
  {
    tenant_id: "growth_tenant",
    name: "Growth Sandbox Tenant",
    plan_type: "free",
    created_at: "2026-06-19T09:20:00-03:00",
  },
];

export const workspaceMock: WorkspaceItem[] = [
  {
    workspace_id: "demo_workspace_br",
    tenant_id: "demo_tenant",
    name: "Brazil Commerce Workspace",
    shop_count: 6,
    created_at: "2026-06-19T09:05:00-03:00",
  },
  {
    workspace_id: "growth_workspace_br",
    tenant_id: "growth_tenant",
    name: "Growth Testing Workspace",
    shop_count: 1,
    created_at: "2026-06-19T09:25:00-03:00",
  },
];

export const tenantUserMock: TenantUserItem[] = [
  { tenant_id: "demo_tenant", user_id: "user_admin_001", role: "owner" },
  { tenant_id: "demo_tenant", user_id: "user_operator_001", role: "operator" },
  { tenant_id: "demo_tenant", user_id: "user_buyer_001", role: "operator" },
  { tenant_id: "demo_tenant", user_id: "user_finance_001", role: "admin" },
  { tenant_id: "demo_tenant", user_id: "user_viewer_001", role: "viewer" },
  { tenant_id: "growth_tenant", user_id: "user_viewer_001", role: "viewer" },
];

export const tenantUsageMock: TenantUsageStats[] = [
  {
    tenant_id: "demo_tenant",
    workspace_count: 1,
    user_count: 5,
    product_count: 6,
    action_count: 7,
    shop_count: 6,
  },
  {
    tenant_id: "growth_tenant",
    workspace_count: 1,
    user_count: 1,
    product_count: 0,
    action_count: 0,
    shop_count: 1,
  },
];
