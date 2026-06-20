import { buildExecutionStats } from "@/action_execution_layer/guard";
import { actionExecutionQueueMock } from "@/data/actionsMock";
import { approvalHistoryMock, approvalQueueMock } from "@/data/approvalsMock";
import { businessImpactMock } from "@/data/businessImpactMock";
import { decisionMetricsMock, decisionLearningMock } from "@/data/decisionFeedbackMock";
import {
  inventoryRiskMock,
  inventorySnapshotMock,
  inventoryStockMock,
  reorderRecommendationMock,
} from "@/data/inventoryMock";
import { productProfitMock, profitSnapshotMock } from "@/data/profitMock";
import { selfOptimizationMock } from "@/data/selfOptimizationMock";
import { tasksMock } from "@/data/tasksMock";
import { buildApprovalStats } from "@/lib/approvals";
import { buildDailyOpsResponse } from "@/lib/dailyOps";
import { buildCostStructure, buildProfitRisk } from "@/lib/profit";

export const dailyOpsMock = buildDailyOpsResponse({
  source: "mock",
  generatedAt: "2026-06-19T09:00:00-03:00",
  tasks: tasksMock,
  businessImpact: businessImpactMock,
  decisionMetrics: {
    source: "mock",
    generated_at: "2026-06-19T09:00:00-03:00",
    metrics: decisionMetricsMock,
    learning: decisionLearningMock,
    history_count: 6,
  },
  actions: {
    source: "mock",
    queue: actionExecutionQueueMock,
    stats: buildExecutionStats(actionExecutionQueueMock),
  },
  selfOptimization: selfOptimizationMock,
  inventory: {
    source: "mock",
    snapshot: inventorySnapshotMock,
    inventory_stock: inventoryStockMock,
    inventory_risks: inventoryRiskMock,
    reorder_recommendations: reorderRecommendationMock,
  },
  profit: {
    source: "mock",
    snapshot: profitSnapshotMock,
    cost_structure: buildCostStructure(profitSnapshotMock),
    profit_risk: buildProfitRisk(productProfitMock),
    product_profit: productProfitMock,
  },
  approvals: {
    source: "mock",
    products: [],
    approval_queue: approvalQueueMock,
    approval_history: approvalHistoryMock,
    approval_stats: buildApprovalStats(approvalQueueMock),
  },
});
