import { getShopeeOrdersResponse } from "@/connectors/shopee/service";
import { emptyVerificationResponse } from "@/data/emptyResponses";
import { verificationMock } from "@/data/verificationMock";
import { getActionExecutionQueueResponse } from "@/lib/actionExecutionRepository";
import { getBusinessImpactResponse } from "@/lib/businessImpactRepository";
import {
  getAnalysisResponse,
  getApprovalsResponse,
  getDashboardSummaryResponse,
  getInventoryResponse,
  getOpportunitiesResponse,
  getProfitResponse,
  getTasksResponse,
} from "@/lib/dbRepository";
import { getDecisionMetricsResponse } from "@/lib/decisionFeedbackRepository";
import { isMockDataAllowed } from "@/lib/runtime/config";
import { getSelfOptimizationResponse } from "@/lib/selfOptimizationRepository";
import { getSystemHealthResponse } from "@/lib/systemHealth";
import { getUsersResponse } from "@/lib/users";
import { zhCN } from "@/locales/zh-CN";
import type {
  ApiDataSource,
  ShopeeDataSource,
  VerificationApiHealthItem,
  VerificationEntryLink,
  VerificationModuleCheck,
  VerificationRuntimeSummary,
  VerificationStatus,
  VerificationStatusApiResponse,
} from "@/types";

type VerificationPayloadSource = ApiDataSource | ShopeeDataSource | "unknown";

type Measurement<T> = {
  status: VerificationStatus;
  response_time: number;
  data_source: VerificationPayloadSource;
  last_updated: string;
  notes: string;
  payload?: T;
};

const delayedThresholdMs = 800;

const quickEntries: VerificationEntryLink[] = [
  { label: `打开${zhCN.nav.dashboard}`, href: "/dashboard", module_id: "dashboard" },
  { label: `打开${zhCN.nav.tasks}`, href: "/tasks", module_id: "tasks" },
  { label: `打开${zhCN.nav.actions}`, href: "/actions", module_id: "actions" },
  { label: `打开${zhCN.nav.shopee}`, href: "/shopee", module_id: "shopee" },
  { label: `打开${zhCN.nav.decisionFeedback}`, href: "/decision-feedback", module_id: "decision_feedback" },
  { label: `打开${zhCN.nav.businessImpact}`, href: "/business-impact", module_id: "business_impact" },
  { label: `打开${zhCN.nav.selfOptimization}`, href: "/self-optimization", module_id: "self_optimization" },
];

function nowIso() {
  return new Date().toISOString();
}

function statusFromResponseTime(responseTime: number): VerificationStatus {
  return responseTime > delayedThresholdMs ? "延迟" : "正常";
}

function sourceFromPayload(payload: unknown): VerificationPayloadSource {
  if (payload && typeof payload === "object" && "source" in payload) {
    const source = (payload as { source?: unknown }).source;
    if (source === "sqlite" || source === "mock" || source === "shopee_api") return source;
  }
  return "unknown";
}

function lastUpdatedFromPayload(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;

  if (typeof record.generated_at === "string") return record.generated_at;
  if (typeof record.synced_at === "string") return record.synced_at;

  const dashboardSummary = record.dashboard_summary as
    | { system_status?: { last_updated_at?: string } }
    | undefined;
  if (dashboardSummary?.system_status?.last_updated_at) {
    return dashboardSummary.system_status.last_updated_at;
  }

  return fallback;
}

async function measure<T>(load: () => Promise<T>, notes: string): Promise<Measurement<T>> {
  const startedAt = Date.now();
  const fallbackTime = nowIso();

  try {
    const payload = await load();
    const responseTime = Date.now() - startedAt;

    return {
      status: statusFromResponseTime(responseTime),
      response_time: responseTime,
      data_source: sourceFromPayload(payload),
      last_updated: lastUpdatedFromPayload(payload, fallbackTime),
      notes,
      payload,
    };
  } catch (error) {
    return {
      status: "异常",
      response_time: Date.now() - startedAt,
      data_source: "unknown",
      last_updated: fallbackTime,
      notes: error instanceof Error ? error.message : "验收检查出现未知错误。",
    };
  }
}

function moduleCheck(params: {
  module_id: string;
  module_name: string;
  href: string;
  measurement: Measurement<unknown>;
}): VerificationModuleCheck {
  return {
    module_id: params.module_id,
    module_name: params.module_name,
    href: params.href,
    status: params.measurement.status,
    response_time: params.measurement.response_time,
    data_source: params.measurement.data_source,
    notes: params.measurement.notes,
  };
}

function apiHealthItem(endpoint: string, measurement: Measurement<unknown>): VerificationApiHealthItem {
  return {
    endpoint,
    status: measurement.status,
    response_time: measurement.response_time,
    data_source: measurement.data_source,
    last_updated: measurement.last_updated,
    notes: measurement.notes,
  };
}

function scoreStatus(status: VerificationStatus) {
  if (status === "正常") return 100;
  if (status === "延迟") return 70;
  return 0;
}

function runtimeSummary(
  modules: VerificationModuleCheck[],
  apiHealth: VerificationApiHealthItem[],
  systemHealthMeasurement: Measurement<unknown>,
): VerificationRuntimeSummary {
  const healthyModules = modules.filter((item) => item.status !== "异常").length;
  const moduleCompleteness = Math.round((healthyModules / Math.max(1, modules.length)) * 100);
  const apiHealthScore = Math.round(
    apiHealth.reduce((sum, item) => sum + scoreStatus(item.status), 0) / Math.max(1, apiHealth.length),
  );

  const systemHealthPayload = systemHealthMeasurement.payload as
    | { data_consistency?: Array<{ mismatch_count: number; severity: string }> }
    | undefined;
  const mismatchCount =
    systemHealthPayload?.data_consistency?.reduce((sum, item) => sum + item.mismatch_count, 0) ?? 0;
  const highSeverityMismatch =
    systemHealthPayload?.data_consistency?.some((item) => item.severity === "high") ?? false;
  const dataConsistencyStatus: VerificationStatus =
    mismatchCount === 0 ? "正常" : highSeverityMismatch ? "异常" : "延迟";

  return {
    system_available: moduleCompleteness >= 90 && apiHealthScore >= 80 && dataConsistencyStatus !== "异常" ? "YES" : "NO",
    module_completeness: moduleCompleteness,
    api_health_score: apiHealthScore,
    data_consistency_status: dataConsistencyStatus,
  };
}

function responseSource(measurements: Measurement<unknown>[]): ApiDataSource {
  const dataSources = measurements.map((item) => item.data_source);
  return dataSources.some((source) => source === "sqlite" || source === "shopee_api") ? "sqlite" : "mock";
}

export async function getVerificationStatusResponse(): Promise<VerificationStatusApiResponse> {
  try {
    const [
      dashboard,
      tasks,
      opportunities,
      analysis,
      profit,
      inventory,
      approvals,
      actions,
      shopee,
      decisionFeedback,
      businessImpact,
      selfOptimization,
      systemHealth,
      users,
    ] = await Promise.all([
      measure(getDashboardSummaryResponse, "运营总览接口可汇总核心经营指标。"),
      measure(getTasksResponse, "今日任务接口可生成优先处理事项。"),
      measure(getOpportunitiesResponse, "机会中心接口可返回商品、关键词和风险机会。"),
      measure(getAnalysisResponse, "数据分析接口可返回规则分析结果。"),
      measure(getProfitResponse, "利润中心接口可返回利润和成本数据。"),
      measure(getInventoryResponse, "库存中心接口可返回库存健康和补货数据。"),
      measure(getApprovalsResponse, "审批中心接口可返回待审批事项和审批历史。"),
      measure(getActionExecutionQueueResponse, "执行中心接口可返回受控执行审批数据。"),
      measure(getShopeeOrdersResponse, "Shopee店铺只读接口可返回订单数据。"),
      measure(getDecisionMetricsResponse, "决策复盘接口可计算历史决策效果。"),
      measure(getBusinessImpactResponse, "经营结果分析接口可计算利润、库存和GMV归因。"),
      measure(getSelfOptimizationResponse, "规则优化接口可生成仅供人工审核的规则建议。"),
      measure(getSystemHealthResponse, "系统健康接口可检查监控和一致性信号。"),
      measure(getUsersResponse, "用户管理接口可返回本地用户、角色和权限。"),
    ]);

    const modules = [
      moduleCheck({ module_id: "dashboard", module_name: zhCN.nav.dashboard, href: "/dashboard", measurement: dashboard }),
      moduleCheck({ module_id: "tasks", module_name: zhCN.nav.tasks, href: "/tasks", measurement: tasks }),
      moduleCheck({
        module_id: "opportunities",
        module_name: zhCN.nav.opportunities,
        href: "/opportunities",
        measurement: opportunities,
      }),
      moduleCheck({ module_id: "analysis", module_name: zhCN.nav.analysis, href: "/analysis", measurement: analysis }),
      moduleCheck({ module_id: "profit", module_name: zhCN.nav.profit, href: "/profit", measurement: profit }),
      moduleCheck({ module_id: "inventory", module_name: zhCN.nav.inventory, href: "/inventory", measurement: inventory }),
      moduleCheck({ module_id: "approvals", module_name: zhCN.nav.approvals, href: "/approvals", measurement: approvals }),
      moduleCheck({ module_id: "actions", module_name: zhCN.nav.actions, href: "/actions", measurement: actions }),
      moduleCheck({ module_id: "shopee", module_name: zhCN.nav.shopee, href: "/shopee", measurement: shopee }),
      moduleCheck({
        module_id: "decision_feedback",
        module_name: zhCN.nav.decisionFeedback,
        href: "/decision-feedback",
        measurement: decisionFeedback,
      }),
      moduleCheck({
        module_id: "business_impact",
        module_name: zhCN.nav.businessImpact,
        href: "/business-impact",
        measurement: businessImpact,
      }),
      moduleCheck({
        module_id: "self_optimization",
        module_name: zhCN.nav.selfOptimization,
        href: "/self-optimization",
        measurement: selfOptimization,
      }),
      moduleCheck({
        module_id: "system_health",
        module_name: zhCN.nav.systemHealth,
        href: "/system-health",
        measurement: systemHealth,
      }),
      moduleCheck({ module_id: "users", module_name: zhCN.nav.users, href: "/users", measurement: users }),
    ];

    const apiHealth = [
      apiHealthItem("/api/dashboard-summary", dashboard),
      apiHealthItem("/api/tasks", tasks),
      apiHealthItem("/api/actions/queue", actions),
      apiHealthItem("/api/shopee/orders", shopee),
      apiHealthItem("/api/system-health", systemHealth),
      apiHealthItem("/api/business-impact", businessImpact),
      apiHealthItem("/api/self-optimization", selfOptimization),
    ];

    const measurements = [
      dashboard,
      tasks,
      opportunities,
      analysis,
      profit,
      inventory,
      approvals,
      actions,
      shopee,
      decisionFeedback,
      businessImpact,
      selfOptimization,
      systemHealth,
      users,
    ];

    return {
      source: responseSource(measurements),
      generated_at: nowIso(),
      verification_mode: {
        current_version: "Lite V0.20 / 系统验收 V1",
        newly_added_module: "系统验收 V1",
        impact_scope: "只新增只读验收入口、状态聚合 API、菜单入口和本地查看权限。",
        existing_system_affected: "NO",
      },
      modules,
      api_health: apiHealth,
      quick_entries: quickEntries,
      runtime_summary: runtimeSummary(modules, apiHealth, systemHealth),
    };
  } catch {
    return isMockDataAllowed() ? verificationMock : emptyVerificationResponse;
  }
}
