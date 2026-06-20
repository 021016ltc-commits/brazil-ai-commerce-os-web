import { dailyOpsMock } from "@/data/dailyOpsMock";
import { emptyDailyOpsResponse } from "@/data/emptyResponses";
import { getActionExecutionQueueResponse } from "@/lib/actionExecutionRepository";
import { getBusinessImpactResponse } from "@/lib/businessImpactRepository";
import { buildDailyOpsResponse } from "@/lib/dailyOps";
import {
  getApprovalsResponse,
  getInventoryResponse,
  getProfitResponse,
  getTasksResponse,
} from "@/lib/dbRepository";
import { getDecisionMetricsResponse } from "@/lib/decisionFeedbackRepository";
import { isMockDataAllowed } from "@/lib/runtime/config";
import { getSelfOptimizationResponse } from "@/lib/selfOptimizationRepository";
import type { ApiDataSource, DailyOpsApiResponse } from "@/types";

function nowIso() {
  return new Date().toISOString();
}

function shouldUseMockData() {
  return isMockDataAllowed() && process.env.DATA_SOURCE_MODE?.trim().toLowerCase() === "mock";
}

function resolveSource(sources: Array<ApiDataSource | "shopee_api">): ApiDataSource {
  return sources.some((source) => source === "sqlite" || source === "shopee_api") ? "sqlite" : "mock";
}

export async function getDailyOpsResponse(): Promise<DailyOpsApiResponse> {
  if (shouldUseMockData()) return dailyOpsMock;

  try {
    const [
      tasks,
      businessImpact,
      decisionMetrics,
      actions,
      selfOptimization,
      inventory,
      profit,
      approvals,
    ] = await Promise.all([
      getTasksResponse(),
      getBusinessImpactResponse(),
      getDecisionMetricsResponse(),
      getActionExecutionQueueResponse(),
      getSelfOptimizationResponse(),
      getInventoryResponse(),
      getProfitResponse(),
      getApprovalsResponse(),
    ]);

    return buildDailyOpsResponse({
      source: resolveSource([
        tasks.source,
        businessImpact.source,
        decisionMetrics.source,
        actions.source,
        selfOptimization.source,
        inventory.source,
        profit.source,
        approvals.source,
      ]),
      generatedAt: nowIso(),
      tasks,
      businessImpact,
      decisionMetrics,
      actions,
      selfOptimization,
      inventory,
      profit,
      approvals,
    });
  } catch (error) {
    if (!isMockDataAllowed()) return emptyDailyOpsResponse;
    return dailyOpsMock;
  }
}
