import { getCached, getCacheStats, setCached, warmCacheMarker } from "@/lib/cache";
import { getProductionDatabaseStatus } from "@/lib/database/productionAdapter";
import { getDashboardSummaryResponse, getInventoryResponse, getTasksResponse } from "@/lib/dbRepository";
import {
  createProductionTraceId,
  getCacheMode,
  getLogLevel,
  getRuntimeEnvironmentTag,
  getServerInstanceId,
  getShopeeApiMode,
  getSystemMode,
  isProductionMode,
  shouldStartScheduler,
} from "@/lib/runtime/config";
import { recordOperationLog } from "@/lib/users";

type SchedulerState = {
  enabled: boolean;
  running: boolean;
  started_at: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  last_cycle_runtime_ms: number | null;
  last_error: string | null;
  retry_count: number;
  cycle_count: number;
  cron_active: boolean;
  server_instance_id: string;
  production_trace_id: string;
};

const SCHEDULER_INTERVAL_MS = 5 * 60_000;
const STARTUP_RETRY_LIMIT = 3;
const SCHEDULER_STATE_KEY = "__baios_scheduler_state__";
const SCHEDULER_TIMER_KEY = "__baios_scheduler_timer__";

type GlobalWithScheduler = typeof globalThis & {
  [SCHEDULER_STATE_KEY]?: SchedulerState;
  [SCHEDULER_TIMER_KEY]?: ReturnType<typeof setTimeout>;
};

function globalScheduler() {
  return globalThis as GlobalWithScheduler;
}

function nowIso() {
  return new Date().toISOString();
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initialState(): SchedulerState {
  return {
    enabled: shouldStartScheduler(),
    running: false,
    started_at: null,
    last_run_at: null,
    next_run_at: null,
    last_cycle_runtime_ms: null,
    last_error: null,
    retry_count: 0,
    cycle_count: 0,
    cron_active: false,
    server_instance_id: getServerInstanceId(),
    production_trace_id: createProductionTraceId("scheduler"),
  };
}

function getMutableState() {
  const store = globalScheduler();
  store[SCHEDULER_STATE_KEY] = store[SCHEDULER_STATE_KEY] ?? initialState();
  store[SCHEDULER_STATE_KEY]!.enabled = shouldStartScheduler();
  store[SCHEDULER_STATE_KEY]!.server_instance_id = getServerInstanceId();
  return store[SCHEDULER_STATE_KEY]!;
}

async function logRuntimeEvent(
  summary: string,
  status: "success" | "failed" = "success",
  metadata: Record<string, unknown> = {},
) {
  await recordOperationLog({
    action_type: "system_runtime",
    target_type: "runtime",
    target_id: getServerInstanceId(),
    summary,
    status,
    metadata: {
      ...getRuntimeEnvironmentTag(),
      production_trace_id: createProductionTraceId("runtime"),
      ...metadata,
    },
  });
}

export async function warmProductionCache() {
  const startedAt = Date.now();
  const [dashboard, tasks, inventory] = await Promise.all([
    getDashboardSummaryResponse(),
    getTasksResponse(),
    getInventoryResponse(),
  ]);

  setCached("production:warm:dashboard-summary", dashboard, SCHEDULER_INTERVAL_MS);
  setCached("production:warm:tasks", tasks, SCHEDULER_INTERVAL_MS);
  setCached("production:warm:inventory", inventory, SCHEDULER_INTERVAL_MS);
  warmCacheMarker();

  return {
    warmed: true,
    runtime_ms: Date.now() - startedAt,
    keys: ["dashboard-summary", "tasks", "inventory"],
  };
}

export const warmupCache = warmProductionCache;

export async function restoreSnapshots() {
  const status = await getProductionDatabaseStatus();
  return {
    restored: status.connection_status !== "failed",
    database_mode: status.active_mode,
    schema_compatible: status.schema_compatible,
    missing_tables: status.missing_tables,
  };
}

export async function validateProductionEnvironment() {
  const database = await getProductionDatabaseStatus();
  const warnings: string[] = [];
  const errors: string[] = [];
  const systemMode = getSystemMode();
  const cacheMode = getCacheMode();
  const shopeeMode = getShopeeApiMode();

  if (systemMode !== "production") {
    warnings.push("SYSTEM_MODE is not production; scheduler auto-start remains disabled.");
  }

  if (!process.env.DATABASE_URL?.trim()) {
    warnings.push("DATABASE_URL is empty; Supabase/PostgreSQL is not configured.");
  }

  if (database.active_mode === "mock") {
    errors.push("Production database adapter resolved to mock, which is not allowed for production.");
  }

  if (shopeeMode !== "readonly") {
    warnings.push("SHOPEE_MODE should remain readonly for production deployment.");
  }

  if (cacheMode === "disabled") {
    warnings.push("CACHE_MODE is disabled; production should use memory_or_upstash or memory.");
  }

  if (getLogLevel() !== "error" && isProductionMode()) {
    warnings.push("LOG_LEVEL should be error in production.");
  }

  return {
    ok: errors.length === 0,
    system_mode: systemMode,
    shopee_mode: shopeeMode,
    cache_mode: cacheMode,
    log_level: getLogLevel(),
    database,
    warnings,
    errors,
    checked_at: nowIso(),
  };
}

async function retryStartupStep<T>(label: string, run: () => Promise<T>) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= STARTUP_RETRY_LIMIT; attempt += 1) {
    try {
      return {
        ok: true,
        label,
        attempt,
        result: await run(),
      };
    } catch (error) {
      lastError = error;
      await logRuntimeEvent(`Production startup step failed: ${label}.`, "failed", {
        label,
        attempt,
        max_attempts: STARTUP_RETRY_LIMIT,
        error: error instanceof Error ? error.message : "Unknown startup error.",
      });
      if (attempt < STARTUP_RETRY_LIMIT) await wait(400 * attempt);
    }
  }

  return {
    ok: false,
    label,
    attempt: STARTUP_RETRY_LIMIT,
    error: lastError instanceof Error ? lastError.message : "Unknown startup error.",
  };
}

async function runSchedulerCycle(reason: string) {
  const state = getMutableState();
  const startedAt = Date.now();
  state.running = true;
  state.cron_active = true;
  state.last_error = null;

  try {
    const [database, cacheWarmup, snapshotRestore] = await Promise.all([
      getProductionDatabaseStatus(),
      warmProductionCache(),
      restoreSnapshots(),
    ]);

    state.last_run_at = nowIso();
    state.last_cycle_runtime_ms = Date.now() - startedAt;
    state.cycle_count += 1;
    state.retry_count = 0;
    state.next_run_at = new Date(Date.now() + SCHEDULER_INTERVAL_MS).toISOString();

    await logRuntimeEvent("Production scheduler cycle completed.", "success", {
      reason,
      database,
      cacheWarmup,
      snapshotRestore,
      cycle_count: state.cycle_count,
      last_cycle_runtime_ms: state.last_cycle_runtime_ms,
    });
  } catch (error) {
    state.retry_count += 1;
    state.last_error = error instanceof Error ? error.message : "Unknown scheduler failure.";
    state.last_run_at = nowIso();
    state.last_cycle_runtime_ms = Date.now() - startedAt;
    state.next_run_at = new Date(Date.now() + Math.min(SCHEDULER_INTERVAL_MS, 30_000 * state.retry_count)).toISOString();

    await logRuntimeEvent("Production scheduler cycle failed; retry scheduled.", "failed", {
      reason,
      retry_count: state.retry_count,
      error: state.last_error,
    });
  } finally {
    state.running = false;
  }
}

function scheduleNextCycle() {
  const store = globalScheduler();
  const state = getMutableState();

  if (!state.enabled) {
    state.cron_active = false;
    return;
  }

  if (store[SCHEDULER_TIMER_KEY]) clearTimeout(store[SCHEDULER_TIMER_KEY]);

  const delay = state.retry_count > 0 ? Math.min(SCHEDULER_INTERVAL_MS, 30_000 * state.retry_count) : SCHEDULER_INTERVAL_MS;
  state.next_run_at = new Date(Date.now() + delay).toISOString();
  state.cron_active = true;

  store[SCHEDULER_TIMER_KEY] = setTimeout(() => {
    void runSchedulerCycle("interval").finally(scheduleNextCycle);
  }, delay);
}

export async function startProductionScheduler(reason = "bootstrap") {
  const state = getMutableState();
  if (!state.enabled) return state;

  if (!state.started_at) state.started_at = nowIso();
  if (state.cron_active) return state;

  scheduleNextCycle();
  void runSchedulerCycle(reason).finally(scheduleNextCycle);
  return state;
}

export async function initScheduler(reason = "systemAutoStart") {
  if (!shouldStartScheduler()) return getSchedulerStatus();
  const result = await retryStartupStep("scheduler", () => startProductionScheduler(reason));
  if (!result.ok) {
    const state = getMutableState();
    state.last_error = result.error ?? null;
    return state;
  }
  return getSchedulerStatus();
}

export async function systemAutoStart(reason = "systemAutoStart") {
  const validation = await validateProductionEnvironment();

  if (!shouldStartScheduler()) {
    return {
      started: false,
      reason: "Scheduler auto-start is only enabled in production mode.",
      validation,
      scheduler: getSchedulerStatus(),
      cache_warmup: null,
    };
  }

  const [cacheWarmup, scheduler] = await Promise.all([
    retryStartupStep("cache_warmup", warmupCache),
    initScheduler(reason),
  ]);

  await logRuntimeEvent("Production system auto-start completed.", validation.ok ? "success" : "failed", {
    validation,
    cache_warmup: cacheWarmup,
    scheduler,
  });

  return {
    started: validation.ok,
    validation,
    scheduler,
    cache_warmup: cacheWarmup,
  };
}

export async function bootstrapProductionRuntime() {
  const state = getMutableState();
  const traceId = createProductionTraceId("bootstrap");

  if (!state.enabled) {
    return {
      bootstrapped: false,
      reason: "Scheduler is disabled outside production mode.",
      scheduler: state,
      trace_id: traceId,
    };
  }

  const [database, snapshotRestore, autoStart] = await Promise.all([
    getProductionDatabaseStatus(),
    restoreSnapshots(),
    systemAutoStart("bootstrap"),
  ]);

  await logRuntimeEvent("Production runtime bootstrap completed.", "success", {
    trace_id: traceId,
    database,
    snapshotRestore,
    autoStart,
  });

  return {
    bootstrapped: true,
    scheduler: getSchedulerStatus(),
    database,
    snapshot_restore: snapshotRestore,
    cache: getCacheStats(),
    auto_start: autoStart,
    trace_id: traceId,
  };
}

export function getSchedulerStatus(): SchedulerState {
  return { ...getMutableState() };
}

export function getProductionRuntimeSnapshot() {
  const scheduler = getSchedulerStatus();
  const cache = getCacheStats();
  const warmed = Boolean(getCached("production:warm:dashboard-summary"));

  return {
    scheduler,
    cache,
    warm_cache_available: warmed,
    environment: getRuntimeEnvironmentTag(),
  };
}
