import type { PermissionResource, UserItem, UserRoleName } from "@/types";
import { zhCN } from "@/locales/zh-CN";

export const localUserStorageKey = "baico_current_user";

const loginStateStorageKeys = [
  localUserStorageKey,
  "currentUser",
  "loginUser",
  "operationUser",
  "authUser",
  "sessionUser",
  "selectedUser",
  "rememberedUser",
  "baico_login_user",
  "baico_operation_user",
  "baico_auth_user",
  "baico_session_user",
  "baico_selected_user",
  "isLoggedIn",
  "token",
  "session",
  "role",
  "permission",
];

export const roleLabels: Record<UserRoleName, string> = {
  admin: zhCN.roles.admin,
  operator: zhCN.roles.operator,
  buyer: zhCN.roles.buyer,
  finance: zhCN.roles.finance,
  viewer: zhCN.roles.viewer,
};

export const resourceLabels: Record<PermissionResource, string> = {
  dashboard: zhCN.resources.dashboard,
  command_center: zhCN.resources.command_center,
  tenants: zhCN.resources.tenants,
  tasks: zhCN.resources.tasks,
  opportunities: zhCN.resources.opportunities,
  analysis: zhCN.resources.analysis,
  approvals: zhCN.resources.approvals,
  actions: zhCN.resources.actions,
  profit: zhCN.resources.profit,
  inventory: zhCN.resources.inventory,
  shopee: zhCN.resources.shopee,
  decision_feedback: zhCN.resources.decision_feedback,
  business_impact: zhCN.resources.business_impact,
  self_optimization: zhCN.resources.self_optimization,
  daily_ops: zhCN.resources.daily_ops,
  verification: zhCN.resources.verification,
  users: zhCN.resources.users,
  system: zhCN.resources.system,
  system_health: zhCN.resources.system_health,
};

export const routePermissionMap: Record<string, string> = {
  "/dashboard": "dashboard:view",
  "/command-center": "command_center:view",
  "/tenants": "tenants:view",
  "/tasks": "tasks:view",
  "/opportunities": "opportunities:view",
  "/analysis": "analysis:view",
  "/approvals": "approvals:view",
  "/actions": "actions:view",
  "/profit": "profit:view",
  "/inventory": "inventory:view",
  "/shopee": "shopee:view",
  "/decision-feedback": "decision_feedback:view",
  "/business-impact": "business_impact:view",
  "/self-optimization": "self_optimization:view",
  "/daily-ops": "daily_ops:view",
  "/verification": "verification:view",
  "/users": "users:view",
  "/system": "system:view",
  "/system-health": "system_health:view",
};

export function userHasPermission(user: UserItem | null | undefined, permissionKey: string) {
  if (!user || user.status !== "active") return false;
  if (user.roles.includes("admin")) return true;
  return user.permissions.includes(permissionKey);
}

export function userCanAccessPath(user: UserItem | null | undefined, pathname: string) {
  const permissionKey = routePermissionMap[pathname];
  if (!permissionKey) return true;
  return userHasPermission(user, permissionKey);
}

export function userCanManageUsers(user: UserItem | null | undefined) {
  return userHasPermission(user, "users:manage");
}

export function userCanApprove(user: UserItem | null | undefined) {
  return userHasPermission(user, "approvals:approve");
}

export function readStoredUser(): UserItem | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(localUserStorageKey);
    return raw ? (JSON.parse(raw) as UserItem) : null;
  } catch {
    return null;
  }
}

export function storeLocalUser(user: UserItem) {
  window.localStorage.setItem(localUserStorageKey, JSON.stringify(user));
  window.dispatchEvent(new Event("baico-auth-change"));
}

export function clearLocalUser() {
  loginStateStorageKeys.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // Browser storage can be unavailable in strict privacy modes.
    }
  });

  try {
    document.cookie.split(";").forEach((cookie) => {
      const cookieName = cookie.split("=")[0]?.trim();
      if (!cookieName || !/(user|session|auth|token|login)/i.test(cookieName)) return;
      document.cookie = `${cookieName}=; Max-Age=0; path=/`;
    });
  } catch {
    // Cookie cleanup is best-effort because this app primarily uses local storage.
  }

  window.dispatchEvent(new Event("baico-auth-change"));
}
