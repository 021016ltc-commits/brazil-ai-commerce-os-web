import { approvalQueueMock } from "@/data/approvalsMock";
import { analysisQueueMock } from "@/data/analysisMock";
import { actionExecutionStatsMock } from "@/data/actionsMock";
import { businessImpactMock } from "@/data/businessImpactMock";
import { decisionMetricsMock } from "@/data/decisionFeedbackMock";
import { selfOptimizationMock } from "@/data/selfOptimizationMock";
import {
  inventoryRiskMock,
  inventorySnapshotMock,
} from "@/data/inventoryMock";
import {
  action_queue as mockActionQueue,
  crawl_logs as mockCrawlLogs,
  data_quality_report as mockDataQualityReport,
} from "@/data/mock";
import {
  opportunityProductsMock,
  opportunityScoreMock,
} from "@/data/opportunitiesMock";
import { productProfitMock, profitSnapshotMock } from "@/data/profitMock";
import { buildAiRecommendations } from "@/lib/analysis";
import { buildDashboardSummary } from "@/lib/dashboard";
import { buildRiskAlerts, buildTodayOpportunities } from "@/lib/opportunities";

const todayOpportunitiesMock = buildTodayOpportunities(
  opportunityProductsMock,
  opportunityScoreMock,
);

const opportunityRisksMock = buildRiskAlerts(
  opportunityProductsMock,
  opportunityScoreMock,
);

const aiRecommendationsMock = buildAiRecommendations(
  opportunityProductsMock,
  opportunityScoreMock,
  mockActionQueue,
  analysisQueueMock,
);

export const dashboardSummaryMock = buildDashboardSummary({
  source: "mock",
  products: opportunityProductsMock,
  profitSnapshot: profitSnapshotMock,
  productProfit: productProfitMock,
  inventorySnapshot: inventorySnapshotMock,
  approvalQueue: approvalQueueMock,
  todayOpportunities: todayOpportunitiesMock,
  opportunityRisks: opportunityRisksMock,
  inventoryRisks: inventoryRiskMock,
  aiRecommendations: aiRecommendationsMock,
  crawlLogs: mockCrawlLogs,
  dataQualityReports: mockDataQualityReport,
  decisionMetrics: decisionMetricsMock,
  executionStats: actionExecutionStatsMock,
  businessImpactSummary: businessImpactMock.summary,
  selfOptimizationSummary: selfOptimizationMock.summary,
  selfOptimizationRecommendations: selfOptimizationMock.recommendations,
});
