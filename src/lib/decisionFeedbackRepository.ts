import {
  buildDecisionFeedbackRecord,
  buildDecisionLearningSystem,
  buildDecisionOutcomeRecord,
  calculateDecisionMetrics,
} from "@/decision_feedback_system/engine";
import {
  decisionHistoryMock,
  decisionLearningMock,
  decisionMetricsMock,
} from "@/data/decisionFeedbackMock";
import { emptyDecisionHistoryResponse, emptyDecisionMetricsResponse } from "@/data/emptyResponses";
import { isMockDataAllowed } from "@/lib/runtime/config";
import { withDatabase } from "@/lib/sqlite";
import { currentTenantId, DEFAULT_TENANT_ID } from "@/lib/tenantContext";
import type {
  DecisionFeedbackInput,
  DecisionFeedbackPostResponse,
  DecisionFeedbackRecord,
  DecisionFeedbackSource,
  DecisionHistoryApiResponse,
  DecisionHistoryItem,
  DecisionLearningSystem,
  DecisionMetricsApiResponse,
  DecisionOutcomeRecord,
  DecisionState,
  DecisionUserAction,
  Platform,
} from "@/types";

type DecisionHistoryRow = {
  decision_id: string;
  product_id: string;
  product_uid: string | null;
  platform: Platform | null;
  decision_state: DecisionState;
  user_action: DecisionUserAction;
  timestamp: string | null;
  source: DecisionFeedbackSource;
  created_at: string | null;
  outcome_id: string | null;
  actual_sales: number | null;
  actual_profit: number | null;
  roi_real: number | null;
  stock_change: number | null;
  conversion_rate: number | null;
  is_profitable: number | null;
  is_failed: number | null;
  recorded_at: string | null;
};

function shouldUseMockData() {
  return isMockDataAllowed() && process.env.DATA_SOURCE_MODE?.trim().toLowerCase() === "mock";
}

function asRows<T>(rows: unknown[]): T[] {
  return rows as T[];
}

function tenantId() {
  return currentTenantId();
}

function defaultTenantHistoryFallback() {
  if (!isMockDataAllowed()) return [];
  return tenantId() === DEFAULT_TENANT_ID ? decisionHistoryMock : [];
}

function nowIso() {
  return new Date().toISOString();
}

function mapHistoryRow(row: DecisionHistoryRow): DecisionHistoryItem {
  const feedback: DecisionFeedbackRecord = {
    decision_id: row.decision_id,
    product_id: row.product_id,
    product_uid: row.product_uid ?? undefined,
    platform: row.platform ?? undefined,
    decisionState: row.decision_state,
    user_action: row.user_action,
    userAction: row.user_action,
    timestamp: row.timestamp ?? "",
    source: row.source,
    created_at: row.created_at ?? "",
  };

  const outcome: DecisionOutcomeRecord | undefined = row.outcome_id
    ? {
        outcome_id: row.outcome_id,
        decision_id: row.decision_id,
        actual_sales: row.actual_sales ?? 0,
        actual_profit: row.actual_profit ?? 0,
        roi_real: row.roi_real ?? 0,
        stock_change: row.stock_change ?? 0,
        conversion_rate: row.conversion_rate ?? 0,
        is_profitable: Boolean(row.is_profitable),
        is_failed: Boolean(row.is_failed),
        recorded_at: row.recorded_at ?? "",
      }
    : undefined;

  return {
    ...feedback,
    ...(outcome ? { outcome } : {}),
    is_profitable: outcome?.is_profitable,
    is_failed: outcome?.is_failed,
    roi_real: outcome?.roi_real,
  };
}

export async function readDecisionHistory(): Promise<DecisionHistoryItem[]> {
  return withDatabase((db) =>
    asRows<DecisionHistoryRow>(
      db
        .prepare(
          `SELECT df.decision_id, df.product_id, df.product_uid, df.platform,
                  df.decision_state, df.user_action, df.timestamp, df.source, df.created_at,
                  dbo.outcome_id, dbo.actual_sales, dbo.actual_profit, dbo.roi_real,
                  dbo.stock_change, dbo.conversion_rate, dbo.is_profitable, dbo.is_failed,
                  dbo.recorded_at
             FROM decision_feedback df
             LEFT JOIN decision_business_outcomes dbo
               ON dbo.decision_id = df.decision_id
              AND dbo.tenant_id = df.tenant_id
             WHERE df.tenant_id = ?
             ORDER BY df.timestamp DESC, df.decision_id DESC`,
        )
        .all(tenantId()),
    ).map(mapHistoryRow),
  );
}

function priorityValue(priority: "P1" | "P2" | "P3") {
  return { P1: 3, P2: 2, P3: 1 }[priority];
}

function outcomeFlags(outcome: DecisionOutcomeRecord | undefined) {
  if (!outcome) {
    return {
      is_profitable: null,
      is_failed: null,
      roi_real: null,
    };
  }

  return {
    is_profitable: outcome.is_profitable ?? (outcome.actual_profit > 0 && outcome.roi_real >= 1),
    is_failed: outcome.is_failed ?? (outcome.actual_profit <= 0 || outcome.roi_real < 1),
    roi_real: outcome.roi_real,
  };
}

async function writeLearningAdjustments(learning: DecisionLearningSystem) {
  const generatedAt = nowIso();
  const suffix = generatedAt.replace(/[^0-9]/g, "").slice(0, 14);

  await withDatabase((db) => {
    const insert = db.prepare(
      `INSERT INTO decision_learning_adjustments (
         adjustment_id, adjustment_type, target_key, previous_value,
         suggested_value, reason, generated_at, tenant_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(adjustment_id) DO UPDATE SET
         previous_value = excluded.previous_value,
         suggested_value = excluded.suggested_value,
         reason = excluded.reason,
         generated_at = excluded.generated_at,
         tenant_id = excluded.tenant_id`,
    );

    learning.scoring_weight_updates.forEach((item) => {
      insert.run(
        `learning_${item.weight_key}_${suffix}`,
        "scoring_weight",
        item.weight_key,
        item.current_weight,
        item.suggested_weight,
        item.reason,
        generatedAt,
        tenantId(),
      );
    });

    learning.recommendation_priority_updates.forEach((item) => {
      insert.run(
        `learning_priority_${item.product_id}_${suffix}`,
        "recommendation_priority",
        item.product_id,
        priorityValue(item.current_priority),
        priorityValue(item.suggested_priority),
        item.reason,
        generatedAt,
        tenantId(),
      );
    });
  }, false);
}

export async function getDecisionHistoryResponse(): Promise<DecisionHistoryApiResponse> {
  if (shouldUseMockData()) {
    return { source: "mock", history: defaultTenantHistoryFallback() };
  }

  try {
    return { source: "sqlite", history: await readDecisionHistory() };
  } catch (error) {
    if (!isMockDataAllowed()) return emptyDecisionHistoryResponse;
    return { source: "mock", history: defaultTenantHistoryFallback() };
  }
}

export async function getDecisionMetricsResponse(): Promise<DecisionMetricsApiResponse> {
  if (shouldUseMockData()) {
    return {
      source: "mock",
      generated_at: nowIso(),
      metrics: decisionMetricsMock,
      learning: decisionLearningMock,
      history_count: defaultTenantHistoryFallback().length,
    };
  }

  try {
    const history = await readDecisionHistory();
    const metrics = calculateDecisionMetrics(history);
    return {
      source: "sqlite",
      generated_at: nowIso(),
      metrics,
      learning: buildDecisionLearningSystem(history, metrics),
      history_count: history.length,
    };
  } catch (error) {
    if (!isMockDataAllowed()) return emptyDecisionMetricsResponse;
    return {
      source: "mock",
      generated_at: nowIso(),
      metrics: decisionMetricsMock,
      learning: decisionLearningMock,
      history_count: defaultTenantHistoryFallback().length,
    };
  }
}

export async function createDecisionFeedback(
  input: DecisionFeedbackInput,
): Promise<DecisionFeedbackPostResponse> {
  const feedback = buildDecisionFeedbackRecord(input);
  const outcome = buildDecisionOutcomeRecord(feedback.decision_id, input);

  if (shouldUseMockData()) {
    const history = [{ ...feedback, ...(outcome ? { outcome } : {}) }, ...defaultTenantHistoryFallback()];
    const metrics = calculateDecisionMetrics(history);
    return {
      source: "mock",
      persisted: false,
      feedback,
      outcome,
      metrics,
      learning: buildDecisionLearningSystem(history, metrics),
      message: "测试数据已禁用，未写入 SQLite。",
    };
  }

  try {
    await withDatabase((db) => {
      db
        .prepare(
          `INSERT INTO decision_feedback (
             decision_id, product_id, product_uid, platform, decision_state,
             user_action, timestamp, source, created_at, tenant_id
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(decision_id) DO UPDATE SET
             product_id = excluded.product_id,
             product_uid = excluded.product_uid,
             platform = excluded.platform,
             decision_state = excluded.decision_state,
             user_action = excluded.user_action,
             timestamp = excluded.timestamp,
              source = excluded.source,
              created_at = excluded.created_at,
              tenant_id = excluded.tenant_id`,
        )
        .run(
          feedback.decision_id,
          feedback.product_id,
          feedback.product_uid ?? null,
          feedback.platform ?? null,
          feedback.decisionState,
          feedback.user_action,
          feedback.timestamp,
          feedback.source,
          feedback.created_at,
          tenantId(),
        );

      if (outcome) {
        const flags = outcomeFlags(outcome);
        db
          .prepare(
            `INSERT INTO decision_business_outcomes (
               outcome_id, decision_id, actual_sales, actual_profit, roi_real,
               stock_change, conversion_rate, is_profitable, is_failed, recorded_at, tenant_id
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(outcome_id) DO UPDATE SET
               actual_sales = excluded.actual_sales,
               actual_profit = excluded.actual_profit,
               roi_real = excluded.roi_real,
                stock_change = excluded.stock_change,
                conversion_rate = excluded.conversion_rate,
                is_profitable = excluded.is_profitable,
                is_failed = excluded.is_failed,
                recorded_at = excluded.recorded_at,
                tenant_id = excluded.tenant_id`,
          )
          .run(
            outcome.outcome_id,
            outcome.decision_id,
            outcome.actual_sales,
            outcome.actual_profit,
            outcome.roi_real,
            outcome.stock_change,
            outcome.conversion_rate,
            flags.is_profitable ? 1 : 0,
            flags.is_failed ? 1 : 0,
            outcome.recorded_at,
            tenantId(),
          );
      }

      const flags = outcomeFlags(outcome);
      db
        .prepare(
          `INSERT INTO decision_history (
             history_id, decision_id, product_id, product_uid, platform,
             decision_state, user_action, timestamp, is_profitable, is_failed,
             roi_real, source, created_at, tenant_id
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(history_id) DO UPDATE SET
             product_id = excluded.product_id,
             product_uid = excluded.product_uid,
             platform = excluded.platform,
             decision_state = excluded.decision_state,
             user_action = excluded.user_action,
             timestamp = excluded.timestamp,
             is_profitable = excluded.is_profitable,
             is_failed = excluded.is_failed,
             roi_real = excluded.roi_real,
             source = excluded.source,
             created_at = excluded.created_at,
             tenant_id = excluded.tenant_id`,
        )
        .run(
          `history_${feedback.decision_id}`,
          feedback.decision_id,
          feedback.product_id,
          feedback.product_uid ?? null,
          feedback.platform ?? null,
          feedback.decisionState,
          feedback.user_action,
          feedback.timestamp,
          flags.is_profitable === null ? null : flags.is_profitable ? 1 : 0,
          flags.is_failed === null ? null : flags.is_failed ? 1 : 0,
          flags.roi_real,
          feedback.source,
          feedback.created_at,
          tenantId(),
        );
    }, false);

    const history = await readDecisionHistory();
    const metrics = calculateDecisionMetrics(history);
    const learning = buildDecisionLearningSystem(history, metrics);
    await writeLearningAdjustments(learning);
    return {
      source: "sqlite",
      persisted: true,
      feedback,
      outcome,
      metrics,
      learning,
      message: "决策反馈已写入本地 SQLite，并重新计算反馈指标。",
    };
  } catch (error) {
    if (!isMockDataAllowed()) {
      return {
        source: "sqlite",
        persisted: false,
        feedback,
        outcome,
        metrics: emptyDecisionMetricsResponse.metrics,
        learning: emptyDecisionMetricsResponse.learning,
        message: "真实数据源不可用，未写入测试反馈。",
      };
    }
    const history = [{ ...feedback, ...(outcome ? { outcome } : {}) }, ...defaultTenantHistoryFallback()];
    const metrics = calculateDecisionMetrics(history);
    return {
      source: "mock",
      persisted: false,
      feedback,
      outcome,
      metrics,
      learning: buildDecisionLearningSystem(history, metrics),
      message: "真实数据源不可用，未写入测试反馈。",
    };
  }
}
