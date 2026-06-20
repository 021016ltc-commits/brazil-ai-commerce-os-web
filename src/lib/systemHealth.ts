import {
  getAnalysisResponse,
  getApprovalsResponse,
  getDashboardSummaryResponse,
  getInventoryResponse,
  getOpportunitiesResponse,
  getProfitResponse,
  getTasksResponse,
} from "@/lib/dbRepository";
import { getCacheStats } from "@/lib/cache";
import { getProductionDatabaseStatus } from "@/lib/database/productionAdapter";
import { ensureAutonomousScheduler } from "@/lib/runtime/autonomousScheduler";
import { getSchedulerStatus } from "@/lib/runtime/systemBootstrap";
import {
  createProductionTraceId,
  getServerInstanceId,
  getSystemMode,
  isMockDataAllowed,
  isProductionMode,
} from "@/lib/runtime/config";
import { withDatabase } from "@/lib/sqlite";
import type {
  AnalysisApiResponse,
  ApiDataSource,
  ApiHealthCheckItem,
  ApprovalsApiResponse,
  DataConsistencyCheck,
  DashboardSummaryApiResponse,
  InventoryApiResponse,
  OpportunitiesApiResponse,
  ProfitApiResponse,
  SystemHealthApiResponse,
  SystemHealthScoreBreakdown,
  SystemLogSummaryItem,
  TaskSourceModule,
  TasksApiResponse,
} from "@/types";

type ApiMeasurement<T extends { source: ApiDataSource }> = {
  health: ApiHealthCheckItem;
  payload?: T;
  missingData: boolean;
};

const HEALTH_ENDPOINTS = [
  "/api/dashboard-summary",
  "/api/tasks",
  "/api/opportunities",
  "/api/analysis",
  "/api/profit",
  "/api/inventory",
  "/api/approvals",
];

function nowIso() {
  return new Date().toISOString();
}

function roundRate(value: number) {
  return Number(value.toFixed(3));
}

function boundedScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function validTimestamp(value?: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function latestTimestamp(values: Array<string | undefined | null>, fallback: string) {
  const timestamps = values
    .map(validTimestamp)
    .filter((value): value is number => value !== null)
    .sort((left, right) => right - left);

  return timestamps[0] ? new Date(timestamps[0]).toISOString() : fallback;
}

async function getLastDbInitTime() {
  try {
    return await withDatabase((db) => {
      const qualityRow = db
        .prepare("SELECT MAX(generated_at) AS value FROM data_quality_report")
        .get() as { value?: string | null } | undefined;
      const crawlRow = db
        .prepare("SELECT MAX(started_at) AS value FROM crawl_logs")
        .get() as { value?: string | null } | undefined;

      const latest = latestTimestamp([qualityRow?.value, crawlRow?.value], "");
      return latest || null;
    });
  } catch {
    return null;
  }
}

async function isSqliteAvailable() {
  if (isMockDataAllowed() && process.env.DATA_SOURCE_MODE?.trim().toLowerCase() === "mock") {
    try {
      await withDatabase((db) => {
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' LIMIT 1").get();
        return true;
      });
      return true;
    } catch {
      return false;
    }
  }

  try {
    await withDatabase((db) => {
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' LIMIT 1").get();
      return true;
    });
    return true;
  } catch {
    return false;
  }
}

async function measureEndpoint<T extends { source: ApiDataSource }>(
  endpoint: string,
  load: () => Promise<T>,
  lastUpdated: (payload: T, fallback: string) => string,
  hasData: (payload: T) => boolean,
): Promise<ApiMeasurement<T>> {
  const startedAt = Date.now();
  const fallbackTime = nowIso();

  try {
    const payload = await load();
    const responseTime = Date.now() - startedAt;
    const missingData = !hasData(payload);

    return {
      health: {
        endpoint,
        status: "ok",
        response_time: responseTime,
        data_source: payload.source,
        last_updated: lastUpdated(payload, fallbackTime),
      },
      payload,
      missingData,
    };
  } catch (error) {
    return {
      health: {
        endpoint,
        status: "fail",
        response_time: Date.now() - startedAt,
        data_source: "unknown",
        last_updated: fallbackTime,
        error: error instanceof Error ? error.message : "接口健康检查出现未知错误。",
      },
      missingData: true,
    };
  }
}

function severityFromMismatch(count: number) {
  if (count >= 3) return "high";
  if (count > 0) return "medium";
  return "low";
}

function taskExists(tasks: TasksApiResponse, taskId: string, source: TaskSourceModule) {
  return tasks.all_tasks.some((task) => task.task_id === taskId && task.source_module === source);
}

function buildConsistencyChecks(params: {
  tasks?: TasksApiResponse;
  inventory?: InventoryApiResponse;
  profit?: ProfitApiResponse;
  approvals?: ApprovalsApiResponse;
}): { checks: DataConsistencyCheck[]; expectedCount: number } {
  const { tasks, inventory, profit, approvals } = params;
  let expectedCount = 0;

  const inventoryMismatchItems =
    inventory && tasks
      ? [
          ...inventory.inventory_stock
            .filter((item) => item.days_of_stock < 5)
            .map((item) => {
              expectedCount += 1;
              const taskId = `task_inventory_stock_${item.inventory_item_id}`;
              return taskExists(tasks, taskId, "inventory")
                ? null
                : {
                    check_id: `inventory_stock_${item.inventory_item_id}`,
                    source: "inventory_stock",
                    target: "tasks",
                    item_id: item.inventory_item_id,
                    product_uid: item.product_uid,
                    reason: "days_of_stock < 5, but no matching inventory task was found.",
                    expected_task_source: "inventory" as const,
                  };
            }),
          ...inventory.inventory_risks
            .filter((item) => item.risk_level === "high")
            .map((item) => {
              expectedCount += 1;
              const taskId = `task_inventory_risk_${item.risk_id}`;
              return taskExists(tasks, taskId, "inventory")
                ? null
                : {
                    check_id: `inventory_risk_${item.risk_id}`,
                    source: "inventory_risk",
                    target: "tasks",
                    item_id: item.risk_id,
                    product_uid: item.product_uid,
                    reason: "High inventory risk exists, but no matching inventory task was found.",
                    expected_task_source: "inventory" as const,
                  };
            }),
        ].filter((item): item is NonNullable<typeof item> => item !== null)
      : [
          {
            check_id: "inventory_to_tasks_unavailable",
            source: "inventory",
            target: "tasks",
            item_id: "inventory_or_tasks_payload",
            reason: "Inventory or tasks payload is unavailable.",
            expected_task_source: "inventory" as const,
          },
        ];

  const profitMismatchItems =
    profit && tasks
      ? profit.product_profit
          .filter((item) => item.net_margin < 0.1)
          .map((item) => {
            expectedCount += 1;
            const taskId = `task_profit_${item.profit_item_id}`;
            return taskExists(tasks, taskId, "profit")
              ? null
              : {
                  check_id: `profit_${item.profit_item_id}`,
                  source: "product_profit",
                  target: "tasks",
                  item_id: item.profit_item_id,
                  product_uid: item.product_uid,
                  reason: "net_margin < 10%, but no matching profit task was found.",
                  expected_task_source: "profit" as const,
                };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      : [
          {
            check_id: "profit_to_tasks_unavailable",
            source: "profit",
            target: "tasks",
            item_id: "profit_or_tasks_payload",
            reason: "Profit or tasks payload is unavailable.",
            expected_task_source: "profit" as const,
          },
        ];

  const approvalMismatchItems =
    approvals && tasks
      ? approvals.approval_queue
          .filter((item) => item.status === "pending_review")
          .map((item) => {
            expectedCount += 1;
            const taskId = `task_approval_${item.approval_id}`;
            return taskExists(tasks, taskId, "approval")
              ? null
              : {
                  check_id: `approval_${item.approval_id}`,
                  source: "approval_queue",
                  target: "tasks",
                  item_id: item.approval_id,
                  product_uid: item.product_uid,
                  reason: "存在待审批事项，但没有找到对应的今日任务。",
                  expected_task_source: "approval" as const,
                };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      : [
          {
            check_id: "approvals_to_tasks_unavailable",
            source: "approvals",
            target: "tasks",
            item_id: "approvals_or_tasks_payload",
            reason: "Approvals or tasks payload is unavailable.",
            expected_task_source: "approval" as const,
          },
        ];

  const checks: DataConsistencyCheck[] = [
    {
      check_name: "inventory_to_tasks",
      label: "inventory -> tasks",
      mismatch_count: inventoryMismatchItems.length,
      mismatch_items: inventoryMismatchItems,
      severity: severityFromMismatch(inventoryMismatchItems.length),
    },
    {
      check_name: "profit_to_tasks",
      label: "profit -> tasks",
      mismatch_count: profitMismatchItems.length,
      mismatch_items: profitMismatchItems,
      severity: severityFromMismatch(profitMismatchItems.length),
    },
    {
      check_name: "approvals_to_tasks",
      label: "approvals -> tasks",
      mismatch_count: approvalMismatchItems.length,
      mismatch_items: approvalMismatchItems,
      severity: severityFromMismatch(approvalMismatchItems.length),
    },
  ];

  return { checks, expectedCount: Math.max(expectedCount, 1) };
}

function buildLogSummary(params: {
  generatedAt: string;
  tasks?: TasksApiResponse;
  inventory?: InventoryApiResponse;
  approvals?: ApprovalsApiResponse;
}): SystemLogSummaryItem[] {
  const taskLogs =
    params.tasks?.top_tasks.slice(0, 3).map((task) => ({
      log_id: `log_${task.task_id}`,
      log_type: "task_generated" as const,
      source_module: task.source_module,
      message: `任务生成：${task.task_title}`,
      created_at: task.created_at || params.generatedAt,
      status: task.priority,
    })) ?? [];

  const approvalHistoryLogs =
    params.approvals?.approval_history.slice(0, 3).map((history) => ({
      log_id: `log_${history.history_id}`,
      log_type: "approval_action" as const,
      source_module: "approval" as const,
      message: `审批操作：${history.approval_id} -> ${history.action}`,
      created_at: history.reviewed_at || params.generatedAt,
      status: history.action,
    })) ?? [];

  const approvalQueueLogs =
    approvalHistoryLogs.length > 0
      ? []
      : params.approvals?.approval_queue.slice(0, 2).map((approval) => ({
          log_id: `log_pending_${approval.approval_id}`,
          log_type: "approval_action" as const,
          source_module: "approval" as const,
          message: `审批队列：${approval.approval_id} 等待人工处理`,
          created_at: approval.created_at || params.generatedAt,
          status: approval.status,
        })) ?? [];

  const inventoryRiskLogs =
    params.inventory?.inventory_risks.slice(0, 3).map((risk) => ({
      log_id: `log_${risk.risk_id}`,
      log_type: "inventory_update" as const,
      source_module: "inventory" as const,
      message: `库存更新：${risk.product_uid} ${risk.risk_type}`,
      created_at: params.inventory?.snapshot.reporting_date || params.generatedAt,
      status: risk.risk_level,
    })) ?? [];

  return [...taskLogs, ...approvalHistoryLogs, ...approvalQueueLogs, ...inventoryRiskLogs]
    .sort((left, right) => {
      const rightTime = validTimestamp(right.created_at) ?? 0;
      const leftTime = validTimestamp(left.created_at) ?? 0;
      return rightTime - leftTime;
    })
    .slice(0, 9);
}

export async function getSystemHealthResponse(): Promise<SystemHealthApiResponse> {
  const generatedAt = nowIso();
  const healthStartedAt = Date.now();
  if (isProductionMode()) {
    await ensureAutonomousScheduler("system-health-recovery");
  }

  const [
    dashboard,
    tasks,
    opportunities,
    analysis,
    profit,
    inventory,
    approvals,
    sqliteAvailable,
    lastDbInitTime,
    productionDatabase,
  ] = await Promise.all([
    measureEndpoint<DashboardSummaryApiResponse>(
      "/api/dashboard-summary",
      getDashboardSummaryResponse,
      (payload, fallback) => payload.dashboard_summary.system_status.last_updated_at || fallback,
      (payload) => Boolean(payload.dashboard_summary),
    ),
    measureEndpoint<TasksApiResponse>(
      "/api/tasks",
      getTasksResponse,
      (payload, fallback) => latestTimestamp(payload.all_tasks.map((task) => task.created_at), fallback),
      (payload) => payload.all_tasks.length > 0,
    ),
    measureEndpoint<OpportunitiesApiResponse>(
      "/api/opportunities",
      getOpportunitiesResponse,
      (payload, fallback) => latestTimestamp(payload.products.map((product) => product.snapshot_date), fallback),
      (payload) => payload.today_opportunities.length > 0,
    ),
    measureEndpoint<AnalysisApiResponse>(
      "/api/analysis",
      getAnalysisResponse,
      (_payload, fallback) => fallback,
      (payload) =>
        payload.opportunity_analysis.length +
          payload.risk_analysis.length +
          payload.market_analysis.length +
          payload.ai_recommendations.length >
        0,
    ),
    measureEndpoint<ProfitApiResponse>(
      "/api/profit",
      getProfitResponse,
      (payload, fallback) => payload.snapshot.reporting_date || fallback,
      (payload) => payload.product_profit.length > 0,
    ),
    measureEndpoint<InventoryApiResponse>(
      "/api/inventory",
      getInventoryResponse,
      (payload, fallback) => payload.snapshot.reporting_date || fallback,
      (payload) => payload.inventory_stock.length > 0,
    ),
    measureEndpoint<ApprovalsApiResponse>(
      "/api/approvals",
      getApprovalsResponse,
      (payload, fallback) =>
        latestTimestamp(
          [
            ...payload.approval_queue.map((item) => item.created_at),
            ...payload.approval_history.map((item) => item.reviewed_at),
          ],
          fallback,
        ),
      (payload) => payload.approval_queue.length > 0,
    ),
    isSqliteAvailable(),
    getLastDbInitTime(),
    getProductionDatabaseStatus(),
  ]);

  const apiMeasurements = [dashboard, tasks, opportunities, analysis, profit, inventory, approvals];
  const apiHealth = apiMeasurements.map((item) => item.health);
  const successfulApiHealth = apiHealth.filter((item) => item.status === "ok");
  const mockFallbackActive =
    (isMockDataAllowed() && process.env.DATA_SOURCE_MODE?.trim().toLowerCase() === "mock") ||
    successfulApiHealth.some((item) => item.data_source === "mock");
  const source: ApiDataSource = mockFallbackActive ? "mock" : "sqlite";

  const consistency = buildConsistencyChecks({
    tasks: tasks.payload,
    inventory: inventory.payload,
    profit: profit.payload,
    approvals: approvals.payload,
  });

  const mismatchCount = consistency.checks.reduce((sum, item) => sum + item.mismatch_count, 0);
  const breakdown: SystemHealthScoreBreakdown = {
    api_failure_rate: roundRate(apiHealth.filter((item) => item.status === "fail").length / HEALTH_ENDPOINTS.length),
    data_missing_rate: roundRate(apiMeasurements.filter((item) => item.missingData).length / HEALTH_ENDPOINTS.length),
    mock_ratio: roundRate(
      successfulApiHealth.length === 0
        ? 1
        : successfulApiHealth.filter((item) => item.data_source === "mock").length / successfulApiHealth.length,
    ),
    task_anomaly_rate: roundRate(mismatchCount / consistency.expectedCount),
  };

  const systemHealthScore = boundedScore(
    100 -
      breakdown.api_failure_rate * 40 -
      breakdown.data_missing_rate * 20 -
      breakdown.mock_ratio * 20 -
      breakdown.task_anomaly_rate * 20,
  );
  const scheduler = getSchedulerStatus();
  const cache = getCacheStats();
  const apiLatencyMs = Math.round(
    apiHealth.reduce((sum, item) => sum + item.response_time, 0) / Math.max(1, apiHealth.length),
  );
  const syncLagSeconds = scheduler.last_run_at
    ? Math.max(0, Math.round((Date.now() - Date.parse(scheduler.last_run_at)) / 1000))
    : null;

  return {
    source,
    generated_at: generatedAt,
    api_health: apiHealth,
    data_consistency: consistency.checks,
    data_source_status: {
      sqlite_available: sqliteAvailable,
      mock_fallback_active: mockFallbackActive,
      last_db_init_time: lastDbInitTime,
    },
    production_runtime: {
      system_mode: getSystemMode(),
      production_mode_status: isProductionMode() ? "active" : "inactive",
      scheduler_status: !scheduler.enabled ? "disabled" : scheduler.running ? "running" : "idle",
      scheduler_running_status: !scheduler.enabled ? "disabled" : scheduler.running ? "running" : "idle",
      scheduler,
      database_status: productionDatabase.connection_status,
      database: productionDatabase,
      cache,
      api_latency: apiLatencyMs || Date.now() - healthStartedAt,
      api_latency_ms: apiLatencyMs || Date.now() - healthStartedAt,
      cache_hit_rate: cache.hit_rate,
      sync_lag: syncLagSeconds,
      sync_lag_seconds: syncLagSeconds,
      last_cycle_time: scheduler.last_run_at,
      last_cycle_runtime_ms: scheduler.last_cycle_runtime_ms,
      server_instance_id: getServerInstanceId(),
      production_trace_id: createProductionTraceId("health"),
      logs_converged: true,
    },
    system_health_score: systemHealthScore,
    score_breakdown: breakdown,
    logs: buildLogSummary({
      generatedAt,
      tasks: tasks.payload,
      inventory: inventory.payload,
      approvals: approvals.payload,
    }),
  };
}
