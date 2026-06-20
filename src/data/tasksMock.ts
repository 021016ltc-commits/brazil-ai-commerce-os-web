import { approvalQueueMock } from "@/data/approvalsMock";
import { analysisQueueMock } from "@/data/analysisMock";
import { inventoryRiskMock, inventoryStockMock } from "@/data/inventoryMock";
import { action_queue as mockActionQueue } from "@/data/mock";
import { opportunityProductsMock, opportunityScoreMock } from "@/data/opportunitiesMock";
import { productProfitMock } from "@/data/profitMock";
import { buildAiRecommendations, buildRiskAnalysis } from "@/lib/analysis";
import { buildRiskAlerts, buildTodayOpportunities } from "@/lib/opportunities";
import { buildTasksResponse } from "@/lib/tasks";

const todayOpportunitiesMock = buildTodayOpportunities(opportunityProductsMock, opportunityScoreMock);
const opportunityRisksMock = buildRiskAlerts(opportunityProductsMock, opportunityScoreMock);
const riskAnalysisMock = buildRiskAnalysis(opportunityProductsMock, opportunityScoreMock);
const aiRecommendationsMock = buildAiRecommendations(
  opportunityProductsMock,
  opportunityScoreMock,
  mockActionQueue,
  analysisQueueMock,
);

export const tasksMock = buildTasksResponse({
  source: "mock",
  products: opportunityProductsMock,
  inventoryStock: inventoryStockMock,
  inventoryRisks: inventoryRiskMock,
  productProfit: productProfitMock,
  approvalQueue: approvalQueueMock,
  todayOpportunities: todayOpportunitiesMock,
  opportunityRisks: opportunityRisksMock,
  riskAnalysis: riskAnalysisMock,
  aiRecommendations: aiRecommendationsMock,
});
