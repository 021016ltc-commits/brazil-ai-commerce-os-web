import { zhCN } from "@/locales/zh-CN";
import type { VerificationStatusApiResponse } from "@/types";

const generatedAt = "2026-06-19T09:00:00-03:00";

const moduleDefinitions = [
  ["dashboard", zhCN.nav.dashboard, "/dashboard"],
  ["tasks", zhCN.nav.tasks, "/tasks"],
  ["opportunities", zhCN.nav.opportunities, "/opportunities"],
  ["analysis", zhCN.nav.analysis, "/analysis"],
  ["profit", zhCN.nav.profit, "/profit"],
  ["inventory", zhCN.nav.inventory, "/inventory"],
  ["approvals", zhCN.nav.approvals, "/approvals"],
  ["actions", zhCN.nav.actions, "/actions"],
  ["shopee", zhCN.nav.shopee, "/shopee"],
  ["decision_feedback", zhCN.nav.decisionFeedback, "/decision-feedback"],
  ["business_impact", zhCN.nav.businessImpact, "/business-impact"],
  ["self_optimization", zhCN.nav.selfOptimization, "/self-optimization"],
  ["system_health", zhCN.nav.systemHealth, "/system-health"],
  ["users", zhCN.nav.users, "/users"],
] as const;

const apiEndpoints = [
  "/api/dashboard-summary",
  "/api/tasks",
  "/api/actions/queue",
  "/api/shopee/orders",
  "/api/system-health",
  "/api/business-impact",
  "/api/self-optimization",
] as const;

export const verificationMock: VerificationStatusApiResponse = {
  source: "mock",
  generated_at: generatedAt,
  verification_mode: {
    current_version: "Lite V0.20 / 系统验收 V1",
    newly_added_module: "系统验收 V1",
    impact_scope: "只新增只读验收入口、状态聚合 API、菜单入口和本地查看权限。",
    existing_system_affected: "NO",
  },
  modules: moduleDefinitions.map(([moduleId, moduleName, href]) => ({
    module_id: moduleId,
    module_name: moduleName,
    href,
    status: "正常",
    response_time: 0,
    data_source: "mock",
    notes: "页面回退数据：用于 API 不可用时保持验收中心可展示。",
  })),
  api_health: apiEndpoints.map((endpoint) => ({
    endpoint,
    status: "正常",
    response_time: 0,
    data_source: "mock",
    last_updated: generatedAt,
    notes: "备用演示数据。",
  })),
  quick_entries: [
    { label: `打开${zhCN.nav.dashboard}`, href: "/dashboard", module_id: "dashboard" },
    { label: `打开${zhCN.nav.tasks}`, href: "/tasks", module_id: "tasks" },
    { label: `打开${zhCN.nav.actions}`, href: "/actions", module_id: "actions" },
    { label: `打开${zhCN.nav.shopee}`, href: "/shopee", module_id: "shopee" },
    { label: `打开${zhCN.nav.decisionFeedback}`, href: "/decision-feedback", module_id: "decision_feedback" },
    { label: `打开${zhCN.nav.businessImpact}`, href: "/business-impact", module_id: "business_impact" },
    { label: `打开${zhCN.nav.selfOptimization}`, href: "/self-optimization", module_id: "self_optimization" },
  ],
  runtime_summary: {
    system_available: "YES",
    module_completeness: 100,
    api_health_score: 100,
    data_consistency_status: "正常",
  },
};
