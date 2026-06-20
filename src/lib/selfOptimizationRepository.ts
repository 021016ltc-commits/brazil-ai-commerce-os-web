import { selfOptimizationMock } from "@/data/selfOptimizationMock";
import { emptySelfOptimizationResponse } from "@/data/emptyResponses";
import { readActionExecutionQueue } from "@/lib/actionExecutionRepository";
import { getBusinessImpactResponse } from "@/lib/businessImpactRepository";
import { readDecisionHistory } from "@/lib/decisionFeedbackRepository";
import { isMockDataAllowed } from "@/lib/runtime/config";
import { withDatabase } from "@/lib/sqlite";
import { buildSelfOptimizationResponse } from "@/self_optimization_engine/engine";
import type { SelfOptimizationApiResponse } from "@/types";

type PlatformOrderStatsRow = {
  order_count: number | null;
  total_gmv: number | null;
  total_quantity: number | null;
};

function shouldUseMockData() {
  return isMockDataAllowed() && process.env.DATA_SOURCE_MODE?.trim().toLowerCase() === "mock";
}

function nowIso() {
  return new Date().toISOString();
}

async function readPlatformOrderStats() {
  return withDatabase((db) => {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS order_count,
                COALESCE(SUM(quantity * price), 0) AS total_gmv,
                COALESCE(SUM(quantity), 0) AS total_quantity
           FROM shopee_orders`,
      )
      .get() as PlatformOrderStatsRow | undefined;

    return {
      order_count: row?.order_count ?? 0,
      total_gmv: row?.total_gmv ?? 0,
      total_quantity: row?.total_quantity ?? 0,
    };
  });
}

export async function getSelfOptimizationResponse(): Promise<SelfOptimizationApiResponse> {
  if (shouldUseMockData()) return selfOptimizationMock;

  try {
    const [decisionHistory, businessImpact, actionQueue, platformOrderStats] = await Promise.all([
      readDecisionHistory(),
      getBusinessImpactResponse(),
      readActionExecutionQueue(),
      readPlatformOrderStats(),
    ]);

    return buildSelfOptimizationResponse({
      source: "sqlite",
      generatedAt: nowIso(),
      decisionHistory,
      businessImpactActions: businessImpact.action_impacts,
      actionQueue,
      platformOrderStats,
    });
  } catch (error) {
    if (!isMockDataAllowed()) return emptySelfOptimizationResponse;
    return selfOptimizationMock;
  }
}

export async function getSelfOptimizationRecommendationsResponse() {
  const response = await getSelfOptimizationResponse();
  return {
    source: response.source,
    generated_at: response.generated_at,
    recommendations: response.recommendations,
    guardrails: response.guardrails,
    data_sources: response.data_sources,
  };
}

export async function getSelfOptimizationAnalysisResponse() {
  const response = await getSelfOptimizationResponse();
  return {
    source: response.source,
    generated_at: response.generated_at,
    summary: response.summary,
    rule_performance: response.rule_performance,
    failure_patterns: response.failure_patterns,
    top_performing_rules: response.top_performing_rules,
    worst_performing_rules: response.worst_performing_rules,
    data_sources: response.data_sources,
  };
}
