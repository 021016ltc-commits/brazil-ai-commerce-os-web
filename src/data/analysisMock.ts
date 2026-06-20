import type { AnalysisQueueRecord } from "@/types";

export const analysisQueueMock: AnalysisQueueRecord[] = [
  {
    analysis_id: "analysis_20260617_001",
    analysis_type: "daily_opportunity_scan",
    priority: 1,
    notes: "优先筛出今天值得进入人工复核的高分商品。",
    status: "pending_analysis",
  },
  {
    analysis_id: "analysis_20260617_002",
    analysis_type: "risk_gate_review",
    priority: 1,
    notes: "先识别高热度但必须先防守的风险项。",
    status: "pending_analysis",
  },
  {
    analysis_id: "analysis_20260617_003",
    analysis_type: "category_market_watch",
    priority: 2,
    notes: "补充类目需求、竞争与趋势方向判断。",
    status: "pending_analysis",
  },
  {
    analysis_id: "analysis_20260617_004",
    analysis_type: "manual_approval_precheck",
    priority: 2,
    notes: "为后续人工审批准备执行前建议。",
    status: "pending_analysis",
  },
  {
    analysis_id: "analysis_20260617_005",
    analysis_type: "inventory_and_supply_watch",
    priority: 2,
    notes: "优先识别供给偏紧但分数仍高的品。",
    status: "pending_analysis",
  },
  {
    analysis_id: "analysis_20260617_006",
    analysis_type: "content_gap_watch",
    priority: 3,
    notes: "持续观察需要补内容和样本的机会品。",
    status: "pending_analysis",
  },
];
