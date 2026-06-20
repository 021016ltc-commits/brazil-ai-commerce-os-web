import { actionExecutionQueueMock } from "@/data/actionsMock";
import { businessImpactActionsMock } from "@/data/businessImpactMock";
import { decisionHistoryMock } from "@/data/decisionFeedbackMock";
import { buildSelfOptimizationResponse } from "@/self_optimization_engine/engine";

export const selfOptimizationMock = buildSelfOptimizationResponse({
  source: "mock",
  generatedAt: "2026-06-18T21:00:00-03:00",
  decisionHistory: decisionHistoryMock,
  businessImpactActions: businessImpactActionsMock,
  actionQueue: actionExecutionQueueMock,
  platformOrderStats: {
    order_count: 3,
    total_gmv: 9210,
    total_quantity: 236,
  },
});
