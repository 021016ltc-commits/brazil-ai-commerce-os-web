import {
  approveActionExecutionRequest,
  createActionExecutionRequest,
  getActionExecutionHistoryResponse,
  getActionExecutionQueueResponse,
  rejectActionExecutionRequest,
} from "@/lib/actionExecutionRepository";
import {
  getBusinessImpactActionsResponse,
  getBusinessImpactResponse,
  getBusinessImpactSummaryResponse,
} from "@/lib/businessImpactRepository";
import { withApiCache, clearCache } from "@/lib/cache";
import { getDailyOpsResponse } from "@/lib/dailyOpsRepository";
import {
  getAnalysisResponse,
  getApprovalsResponse,
  getDashboardSummaryResponse,
  getInventoryResponse,
  getOpportunitiesResponse,
  getProductsResponse,
  getProfitResponse,
  getTasksResponse,
  updateLocalActionStatus,
} from "@/lib/dbRepository";
import {
  createDecisionFeedback,
  getDecisionHistoryResponse,
  getDecisionMetricsResponse,
} from "@/lib/decisionFeedbackRepository";
import {
  getShopeeAnalyticsResponse,
  getShopeeInventoryRiskResponse,
  getShopeeProductHealthResponse,
  getShopeeTrendAnalysisResponse,
} from "@/lib/analytics/shopeeIntelligenceEngine";
import {
  getOperationalDecisionResponse,
  getOpportunityActionsResponse,
  getRiskActionsResponse,
  getTopActionsResponse,
} from "@/lib/decision/operationalDecisionEngine";
import {
  getExecutionQueueResponse,
  getHighPriorityQueueResponse,
  getQueueSummaryResponse,
} from "@/lib/execution/executionQueueEngine";
import {
  approveAction as approveControlledExecution,
  generateApprovalRequests,
  getApprovalHistoryResponse,
  rejectAction as rejectControlledExecution,
  type ApprovalActorRole,
} from "@/lib/approval/approvalEngine";
import {
  getBlockedExecutionsResponse,
  getExecutionSafeQueueResponse,
  validateBeforeExecution,
} from "@/lib/guard/executionGuard";
import {
  generateExecutionReport,
  getExecutionReportsResponse,
  getExecutionSimulationSummaryResponse,
} from "@/lib/execution/virtualExecutionEngine";
import {
  clearShopeeSnapshotMemory,
  getLatestShopeeSnapshot,
  getShopeeConsistencyReport as getShopeeConsistencyReportFromEngine,
  getShopeeSyncStatus as getShopeeSyncStatusFromEngine,
} from "@/lib/connectors/shopeeSyncEngine";
import {
  getInventory as getShopeeInventoryRealtime,
  getOrders as getShopeeOrdersRealtime,
  getProducts as getShopeeProductsRealtime,
  syncData as syncShopeeReadOnlyData,
} from "@/lib/connectors/shopee";
import {
  getRealShopeeAnalysisResponse,
  getRealShopeeDashboardResponse,
  getRealShopeeDailyOpsResponse,
  getRealShopeeInventoryResponse,
  getRealShopeeOpportunitiesResponse,
  getRealShopeeProductsResponse,
  getRealShopeeProfitResponse,
  getRealShopeeTasksResponse,
  clearRealShopeeBusinessCache,
} from "@/lib/realShopeeBusiness";
import { getSelfOptimizationAnalysisResponse, getSelfOptimizationRecommendationsResponse, getSelfOptimizationResponse } from "@/lib/selfOptimizationRepository";
import { getSystemHealthResponse } from "@/lib/systemHealth";
import {
  createLocalUser,
  authenticateLocalUser,
  getOperationLogsResponse,
  getRolesResponse,
  getUsersResponse,
  recordOperationLog,
  updateLocalUser,
} from "@/lib/users";
import { createTenant, createWorkspace, getTenantsResponse, getWorkspacesResponse } from "@/lib/tenants";
import { currentTenantId } from "@/lib/tenantContext";
import { getVerificationStatusResponse } from "@/lib/verificationRepository";
import type {
  ActionExecutionCreateInput,
  ActionExecutionDecisionInput,
  DecisionFeedbackInput,
  OperationLogAction,
  PlanType,
  ReviewStatus,
  UserRoleName,
  UserStatus,
} from "@/types";

const shortTtlMs = 30_000;
const mediumTtlMs = 60_000;
const analyticsTtlMs = 5 * 60_000;

function cacheKey(name: string) {
  return `${currentTenantId()}:${name}`;
}

function clearBusinessCaches() {
  clearCache(`${currentTenantId()}:`);
  clearRealShopeeBusinessCache();
}

async function realShopeeOrLocal<T>(
  realGetter: () => Promise<T | null>,
  localGetter: () => Promise<T>,
) {
  const realResponse = await realGetter();
  if (realResponse) return realResponse;
  return localGetter();
}

async function getShopeeSnapshotResource(resource: "orders" | "products" | "inventory") {
  const snapshot = await getLatestShopeeSnapshot({ maxAgeMs: shortTtlMs });
  const current = snapshot[resource];
  return {
    source: current.source,
    data: current.data,
    timestamp: current.created_at,
    synced_at: snapshot.created_at,
    readonly: true,
    snapshot: {
      snapshot_id: current.snapshot_id,
      table_name: current.table_name,
      bundle_created_at: snapshot.created_at,
    },
  };
}

export const dataService = {
  getProducts() {
    return realShopeeOrLocal(getRealShopeeProductsResponse, getProductsResponse);
  },

  getOrders() {
    return getShopeeSnapshotResource("orders");
  },

  getInventory() {
    return withApiCache(cacheKey("inventory"), shortTtlMs, () =>
      realShopeeOrLocal(getRealShopeeInventoryResponse, getInventoryResponse),
    );
  },

  getTasks() {
    return withApiCache(cacheKey("tasks"), shortTtlMs, () =>
      realShopeeOrLocal(getRealShopeeTasksResponse, getTasksResponse),
    );
  },

  getUsers() {
    return getUsersResponse();
  },

  getDecisions() {
    return getDecisionHistoryResponse();
  },

  getDashboardSummary() {
    return withApiCache(cacheKey("dashboard-summary"), shortTtlMs, () =>
      realShopeeOrLocal(getRealShopeeDashboardResponse, getDashboardSummaryResponse),
    );
  },

  getProfit() {
    return withApiCache(cacheKey("profit"), mediumTtlMs, () =>
      realShopeeOrLocal(getRealShopeeProfitResponse, getProfitResponse),
    );
  },

  getOpportunities() {
    return withApiCache(cacheKey("opportunities"), shortTtlMs, () =>
      realShopeeOrLocal(getRealShopeeOpportunitiesResponse, getOpportunitiesResponse),
    );
  },

  getAnalysis() {
    return withApiCache(cacheKey("analysis"), shortTtlMs, () =>
      realShopeeOrLocal(getRealShopeeAnalysisResponse, getAnalysisResponse),
    );
  },

  getApprovals() {
    return getApprovalsResponse();
  },

  async updateApprovalStatus(params: {
    approval_id: string;
    status: ReviewStatus;
    notes?: string;
    reviewer?: string;
  }) {
    const result = await updateLocalActionStatus(
      params.approval_id,
      params.status,
      params.notes,
      params.reviewer,
    );
    await recordOperationLog({
      action_type: "approval",
      actor_email: params.reviewer ?? "local_operator",
      target_type: "action_queue",
      target_id: params.approval_id,
      summary: `Local approval status changed to ${params.status}.`,
      metadata: { status: params.status, notes: params.notes },
    });
    clearBusinessCaches();
    return result;
  },

  getActionQueue() {
    return getActionExecutionQueueResponse();
  },

  getActionHistory() {
    return getActionExecutionHistoryResponse();
  },

  async createAction(input: ActionExecutionCreateInput) {
    const result = await createActionExecutionRequest(input);
    clearBusinessCaches();
    return result;
  },

  async approveAction(input: ActionExecutionDecisionInput) {
    const result = await approveActionExecutionRequest(input);
    clearBusinessCaches();
    return result;
  },

  async rejectAction(input: ActionExecutionDecisionInput) {
    const result = await rejectActionExecutionRequest(input);
    clearBusinessCaches();
    return result;
  },

  getShopeeOrders() {
    return withApiCache(cacheKey("shopee-orders"), shortTtlMs, getShopeeOrdersRealtime);
  },

  getShopeeProducts() {
    return withApiCache(cacheKey("shopee-products"), shortTtlMs, getShopeeProductsRealtime);
  },

  getShopeeInventory() {
    return withApiCache(cacheKey("shopee-inventory"), shortTtlMs, getShopeeInventoryRealtime);
  },

  async syncShopeeData() {
    clearShopeeSnapshotMemory();
    const result = await syncShopeeReadOnlyData();
    clearBusinessCaches();
    return {
      source: result.source,
      timestamp: result.synced_at,
      synced_at: result.synced_at,
      readonly: true,
      orders_count: result.orders_count,
      products_count: result.products_count,
      inventory_count: result.inventory_count,
      message:
        result.source === "shopee_api"
          ? "已同步授权店铺真实数据快照。"
          : "已完成店铺数据同步检查。",
    };
  },

  getShopeeSyncStatus() {
    return getShopeeSyncStatusFromEngine();
  },

  getShopeeSnapshot() {
    return getLatestShopeeSnapshot();
  },

  getShopeeConsistencyReport() {
    return getShopeeConsistencyReportFromEngine();
  },

  getShopeeAnalytics() {
    return withApiCache(cacheKey("shopee-analytics"), analyticsTtlMs, getShopeeAnalyticsResponse);
  },

  getShopeeProductHealth() {
    return withApiCache(cacheKey("shopee-product-health"), analyticsTtlMs, getShopeeProductHealthResponse);
  },

  getShopeeInventoryRisk() {
    return withApiCache(cacheKey("shopee-inventory-risk"), analyticsTtlMs, getShopeeInventoryRiskResponse);
  },

  getShopeeTrendAnalysis() {
    return withApiCache(cacheKey("shopee-trend-analysis"), analyticsTtlMs, getShopeeTrendAnalysisResponse);
  },

  getOperationalDecisions() {
    return withApiCache(cacheKey("operational-decisions"), analyticsTtlMs, getOperationalDecisionResponse);
  },

  getTopActions() {
    return withApiCache(cacheKey("operational-top-actions"), analyticsTtlMs, getTopActionsResponse);
  },

  getRiskActions() {
    return withApiCache(cacheKey("operational-risk-actions"), analyticsTtlMs, getRiskActionsResponse);
  },

  getOpportunityActions() {
    return withApiCache(cacheKey("operational-opportunity-actions"), analyticsTtlMs, getOpportunityActionsResponse);
  },

  getExecutionQueue() {
    return withApiCache(cacheKey("operational-execution-queue"), analyticsTtlMs, getExecutionQueueResponse);
  },

  getHighPriorityQueue() {
    return withApiCache(cacheKey("operational-high-priority-queue"), analyticsTtlMs, getHighPriorityQueueResponse);
  },

  getQueueSummary() {
    return withApiCache(cacheKey("operational-queue-summary"), analyticsTtlMs, getQueueSummaryResponse);
  },

  getApprovalQueue() {
    return withApiCache(cacheKey("approval-control-queue"), analyticsTtlMs, generateApprovalRequests);
  },

  async approveExecution(params: {
    action_id: string;
    actor_user_id: string;
    actor_role: ApprovalActorRole;
    notes?: string;
  }) {
    const result = await approveControlledExecution(params);
    clearBusinessCaches();
    return result;
  },

  async rejectExecution(params: {
    action_id: string;
    actor_user_id: string;
    actor_role: ApprovalActorRole;
    notes?: string;
    rejection_reason?: string;
  }) {
    const result = await rejectControlledExecution(params);
    clearBusinessCaches();
    return result;
  },

  getApprovalHistory() {
    return withApiCache(cacheKey("approval-control-history"), analyticsTtlMs, getApprovalHistoryResponse);
  },

  runExecutionGuardCheck(params?: { action_id?: string; no_shopee_write_flag?: boolean }) {
    const actionKey = params?.action_id ?? "all";
    const writeFlagKey = String(params?.no_shopee_write_flag ?? true);
    return withApiCache(
      cacheKey(`execution-guard-check:${actionKey}:${writeFlagKey}`),
      analyticsTtlMs,
      () => validateBeforeExecution(params),
    );
  },

  getExecutionSafeQueue() {
    return withApiCache(cacheKey("execution-safe-queue"), analyticsTtlMs, getExecutionSafeQueueResponse);
  },

  getBlockedExecutions() {
    return withApiCache(cacheKey("execution-blocked-queue"), analyticsTtlMs, getBlockedExecutionsResponse);
  },

  runVirtualExecution(params?: { action_id?: string; no_shopee_write_flag?: boolean }) {
    const actionKey = params?.action_id ?? "all";
    const writeFlagKey = String(params?.no_shopee_write_flag ?? true);
    return withApiCache(
      cacheKey(`virtual-execution:${actionKey}:${writeFlagKey}`),
      analyticsTtlMs,
      () => generateExecutionReport(params),
    );
  },

  getExecutionReports() {
    return withApiCache(cacheKey("virtual-execution-reports"), analyticsTtlMs, getExecutionReportsResponse);
  },

  getExecutionSimulationSummary() {
    return withApiCache(
      cacheKey("virtual-execution-summary"),
      analyticsTtlMs,
      getExecutionSimulationSummaryResponse,
    );
  },

  getBusinessImpact() {
    return getBusinessImpactResponse();
  },

  getBusinessImpactActions() {
    return getBusinessImpactActionsResponse();
  },

  getBusinessImpactSummary() {
    return getBusinessImpactSummaryResponse();
  },

  getSelfOptimization() {
    return getSelfOptimizationResponse();
  },

  getSelfOptimizationAnalysis() {
    return getSelfOptimizationAnalysisResponse();
  },

  getSelfOptimizationRecommendations() {
    return getSelfOptimizationRecommendationsResponse();
  },

  getDailyOps() {
    return withApiCache(cacheKey("daily-ops"), shortTtlMs, () =>
      realShopeeOrLocal(getRealShopeeDailyOpsResponse, getDailyOpsResponse),
    );
  },

  postDecisionFeedback(input: DecisionFeedbackInput) {
    clearBusinessCaches();
    return createDecisionFeedback(input);
  },

  getDecisionHistory() {
    return getDecisionHistoryResponse();
  },

  getDecisionMetrics() {
    return getDecisionMetricsResponse();
  },

  getSystemHealth() {
    return getSystemHealthResponse();
  },

  getVerificationStatus() {
    return getVerificationStatusResponse();
  },

  createUser(params: {
    email?: string;
    display_name?: string;
    roles?: UserRoleName[];
    status?: UserStatus;
    actor_user_id?: string;
    actor_email?: string;
  }) {
    clearBusinessCaches();
    return createLocalUser(params);
  },

  updateUser(params: {
    user_id?: string;
    display_name?: string;
    roles?: UserRoleName[];
    status?: UserStatus;
    last_login_at?: string | null;
    actor_user_id?: string;
    actor_email?: string;
  }) {
    clearBusinessCaches();
    return updateLocalUser(params);
  },

  loginUser(params: { user_id?: string; account?: string; username?: string; display_name?: string; password?: string }) {
    return authenticateLocalUser(params);
  },

  getRoles() {
    return getRolesResponse();
  },

  getOperationLogs() {
    return getOperationLogsResponse();
  },

  async createOperationLog(params: {
    action_type: OperationLogAction;
    actor_user_id?: string;
    actor_email?: string;
    target_type?: string;
    target_id?: string;
    summary?: string;
    status?: "success" | "failed";
    metadata?: Record<string, unknown>;
  }) {
    await recordOperationLog({
      action_type: params.action_type,
      actor_user_id: params.actor_user_id,
      actor_email: params.actor_email,
      target_type: params.target_type ?? "system",
      target_id: params.target_id ?? "",
      summary: params.summary ?? params.action_type,
      status: params.status ?? "success",
      metadata: params.metadata,
    });
    return getOperationLogsResponse();
  },

  getTenants() {
    return getTenantsResponse();
  },

  createTenant(params: { tenant_id?: string; name: string; plan_type?: PlanType }) {
    return createTenant(params);
  },

  getWorkspaces() {
    return getWorkspacesResponse();
  },

  createWorkspace(params: {
    tenant_id?: string;
    workspace_id?: string;
    name: string;
    shop_count?: number;
  }) {
    return createWorkspace(params);
  },
};
