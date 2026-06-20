import type {
  AiRecommendationItem,
  AnalysisPriority,
  ApprovalQueueItem,
  InventoryRiskItem,
  InventoryStockItem,
  OpportunityProductItem,
  OpportunityRiskAlert,
  Product,
  ProductProfitItem,
  RiskAnalysisItem,
  RiskLevel,
  TaskPriority,
  TasksApiResponse,
  TaskSourceModule,
  TodayTaskItem,
} from "@/types";

function riskRank(level: RiskLevel) {
  return { high: 3, medium: 2, low: 1 }[level];
}

function priorityRank(priority: TaskPriority) {
  return { high: 3, medium: 2, low: 1 }[priority];
}

function priorityFromSignals(params: {
  riskLevel: RiskLevel;
  profitImpact: number;
  gmvImpact: number;
  inventoryImpact: number;
}): TaskPriority {
  if (
    params.riskLevel === "high" ||
    params.profitImpact >= 8000 ||
    params.inventoryImpact >= 120 ||
    params.gmvImpact >= 12000
  ) {
    return "high";
  }

  if (
    params.riskLevel === "medium" ||
    params.profitImpact >= 3000 ||
    params.inventoryImpact >= 40 ||
    params.gmvImpact >= 5000
  ) {
    return "medium";
  }

  return "low";
}

function taskSort(left: TodayTaskItem, right: TodayTaskItem) {
  const profitDelta = right.estimated_profit_impact - left.estimated_profit_impact;
  if (profitDelta !== 0) return profitDelta;

  const riskDelta = riskRank(right.risk_level) - riskRank(left.risk_level);
  if (riskDelta !== 0) return riskDelta;

  const inventoryDelta = right.estimated_inventory_impact - left.estimated_inventory_impact;
  if (inventoryDelta !== 0) return inventoryDelta;

  const gmvDelta = right.estimated_gmv_impact - left.estimated_gmv_impact;
  if (gmvDelta !== 0) return gmvDelta;

  const priorityDelta = priorityRank(right.priority) - priorityRank(left.priority);
  if (priorityDelta !== 0) return priorityDelta;

  return left.task_id.localeCompare(right.task_id);
}

function sourceHref(source: TaskSourceModule) {
  return {
    inventory: "/inventory",
    profit: "/profit",
    approval: "/approvals",
    analysis: "/analysis",
    opportunity: "/opportunities",
  }[source];
}

function productPrice(products: Product[], productUid: string) {
  return products.find((item) => item.product_uid === productUid)?.price_amount ?? 50;
}

function productTitle(products: Product[], productUid: string, fallback?: string) {
  const product = products.find((item) => item.product_uid === productUid);
  return product?.title_current ?? product?.title ?? fallback ?? productUid;
}

function makeTask(params: Omit<TodayTaskItem, "priority"> & { priority?: TaskPriority }): TodayTaskItem {
  return {
    ...params,
    priority:
      params.priority ??
      priorityFromSignals({
        riskLevel: params.risk_level,
        profitImpact: params.estimated_profit_impact,
        gmvImpact: params.estimated_gmv_impact,
        inventoryImpact: params.estimated_inventory_impact,
      }),
  };
}

function buildInventoryStockTasks(products: Product[], inventoryStock: InventoryStockItem[]): TodayTaskItem[] {
  return inventoryStock
    .filter((item) => item.days_of_stock < 5)
    .map((item) => {
      const price = productPrice(products, item.product_uid);
      const missingDays = Math.max(1, 5 - item.days_of_stock);
      const estimatedUnits = Math.ceil(missingDays * item.daily_sales_avg);
      const gmvImpact = Math.round(estimatedUnits * price);

      return makeTask({
        task_id: `task_inventory_stock_${item.inventory_item_id}`,
        task_title: `${item.product_name} 预计 ${item.days_of_stock.toFixed(1)} 天内断货`,
        task_type: "inventory_alert",
        source_module: "inventory",
        impact_type: "inventory",
        title: "库存预警任务",
        summary: `${item.product_name} 当前库存只能覆盖 ${item.days_of_stock.toFixed(1)} 天，低于 5 天安全线。`,
        product_uid: item.product_uid,
        platform: item.platform,
        estimated_profit_impact: Math.round(gmvImpact * 0.18),
        estimated_gmv_impact: gmvImpact,
        estimated_inventory_impact: estimatedUnits,
        risk_level: "high",
        expected_impact: `避免约 ${estimatedUnits} 件潜在缺货影响。`,
        suggested_action: "进入库存中心人工复核补货节奏、供应交期和是否需要临时收紧投放。",
        created_at: new Date().toISOString(),
        href: sourceHref("inventory"),
      });
    });
}

function buildInventoryRiskTasks(products: Product[], inventoryRisks: InventoryRiskItem[]): TodayTaskItem[] {
  return inventoryRisks
    .filter((item) => item.risk_level === "high")
    .map((item) => {
      const title = productTitle(products, item.product_uid);

      return makeTask({
        task_id: `task_inventory_risk_${item.risk_id}`,
        task_title: `${title} 出现高库存风险`,
        task_type: "risk_handling",
        source_module: "inventory",
        impact_type: "inventory",
        title: "高风险库存处理任务",
        summary: item.risk_reason,
        product_uid: item.product_uid,
        platform: item.platform,
        estimated_profit_impact: item.risk_type === "stockout_risk" ? 12000 : 5200,
        estimated_gmv_impact: item.risk_type === "stockout_risk" ? 18000 : 6000,
        estimated_inventory_impact: item.risk_type === "overstock_risk" ? 180 : 80,
        risk_level: item.risk_level,
        expected_impact:
          item.risk_type === "stockout_risk"
            ? "降低断货造成的销售损失和履约波动。"
            : "降低库存积压对现金流和利润的占压。",
        suggested_action: item.suggested_action,
        created_at: new Date().toISOString(),
        href: sourceHref("inventory"),
      });
    });
}

function buildProfitTasks(productProfit: ProductProfitItem[]): TodayTaskItem[] {
  return productProfit
    .filter((item) => item.net_margin < 0.1)
    .map((item) => {
      const marginGap = Math.max(0.1 - item.net_margin, 0.02);
      const estimatedProfitImpact = Math.round(Math.max(Math.abs(item.net_profit), item.revenue * marginGap));

      return makeTask({
        task_id: `task_profit_${item.profit_item_id}`,
        task_title: `${item.product_name} 利润率低于 10%`,
        task_type: "profit_alert",
        source_module: "profit",
        impact_type: "profit",
        title: "利润异常任务",
        summary: `${item.product_name} 当前净利润率为 ${(item.net_margin * 100).toFixed(1)}%，低于 10% 安全线。`,
        product_uid: item.product_uid,
        platform: item.platform,
        estimated_profit_impact: estimatedProfitImpact,
        estimated_gmv_impact: Math.round(item.revenue),
        estimated_inventory_impact: Math.round(item.inventory_days),
        risk_level: item.net_profit < 0 || item.risk_level === "high" ? "high" : "medium",
        expected_impact: `预计可优先保护约 R$${estimatedProfitImpact.toLocaleString("pt-BR")} 的利润风险敞口。`,
        suggested_action: "进入利润中心人工复核采购、广告、物流、佣金和税费结构，不自动改价。",
        created_at: new Date().toISOString(),
        href: sourceHref("profit"),
      });
    });
}

function buildApprovalTasks(products: Product[], approvals: ApprovalQueueItem[]): TodayTaskItem[] {
  return approvals
    .filter((item) => item.status === "pending_review")
    .map((item) => {
      const title = productTitle(products, item.product_uid);
      const riskLevel: RiskLevel = item.priority === "P1" ? "high" : item.priority === "P2" ? "medium" : "low";
      const profitImpact = item.priority === "P1" ? 6800 : item.priority === "P2" ? 3200 : 1200;

      return makeTask({
        task_id: `task_approval_${item.approval_id}`,
        task_title: `${title} 有待审批建议`,
        task_type: "approval_review",
        source_module: "approval",
        impact_type: "approval",
        title: "待审批任务",
        summary: item.recommendation_summary,
        product_uid: item.product_uid,
        platform: item.platform,
        estimated_profit_impact: profitImpact,
        estimated_gmv_impact: Math.round(profitImpact * 1.45),
        estimated_inventory_impact: item.priority === "P1" ? 45 : 18,
        priority: item.priority === "P1" ? "high" : item.priority === "P2" ? "medium" : "low",
        risk_level: riskLevel,
        expected_impact: "减少建议堆积，让高价值动作进入人工判断流程。",
        suggested_action: "进入审批中心人工批准、拒绝或延后处理；不执行真实平台动作。",
        created_at: item.created_at,
        href: sourceHref("approval"),
      });
    });
}

function buildOpportunityTasks(opportunities: OpportunityProductItem[]): TodayTaskItem[] {
  return opportunities
    .filter((item) => item.opportunity_score > 90)
    .map((item) => {
      const profitImpact = Math.round(item.opportunity_score * 110);
      const gmvImpact = Math.round(item.opportunity_score * 165);

      return makeTask({
        task_id: `task_opportunity_${item.product_uid}`,
        task_title: `${item.title_current} 机会评分 ${item.opportunity_score}`,
        task_type: "opportunity_follow_up",
        source_module: "opportunity",
        impact_type: "gmv",
        title: "机会跟进任务",
        summary: item.decision_notes,
        product_uid: item.product_uid,
        platform: item.platform,
        estimated_profit_impact: profitImpact,
        estimated_gmv_impact: gmvImpact,
        estimated_inventory_impact: Math.round(item.opportunity_score / 2),
        risk_level: item.risk_level,
        expected_impact: `预计带来约 R$${gmvImpact.toLocaleString("pt-BR")} 的 GMV 机会敞口。`,
        suggested_action: "进入机会中心人工复核标题、价格带、主图、库存和风险后再决定是否推进。",
        created_at: new Date().toISOString(),
        href: sourceHref("opportunity"),
      });
    });
}

function buildOpportunityRiskTasks(risks: OpportunityRiskAlert[]): TodayTaskItem[] {
  return risks
    .filter((item) => item.risk_level === "high")
    .map((item) =>
      makeTask({
        task_id: `task_opportunity_risk_${item.risk_id}`,
        task_title: `${item.affected_product} 出现高风险信号`,
        task_type: "risk_handling",
        source_module: "opportunity",
        impact_type: "risk",
        title: "机会风险处理任务",
        summary: item.reason,
        product_uid: item.product_uid,
        platform: item.platform,
        estimated_profit_impact: 7600,
        estimated_gmv_impact: 11200,
        estimated_inventory_impact: 35,
        risk_level: item.risk_level,
        expected_impact: "避免高机会商品在合规、库存或履约风险未清楚前被推进。",
        suggested_action: item.suggested_action,
        created_at: new Date().toISOString(),
        href: sourceHref("opportunity"),
      }),
    );
}

function buildAnalysisRiskTasks(risks: RiskAnalysisItem[]): TodayTaskItem[] {
  return risks
    .filter((item) => item.risk_level === "high")
    .map((item) =>
      makeTask({
        task_id: `task_analysis_${item.risk_id}`,
        task_title: `${item.product_uid} 需要高风险分析复核`,
        task_type: "analysis_review",
        source_module: "analysis",
        impact_type: "risk",
        title: "分析复核任务",
        summary: item.risk_reason,
        product_uid: item.product_uid,
        platform: item.platform,
        estimated_profit_impact: 5800,
        estimated_gmv_impact: 9200,
        estimated_inventory_impact: 22,
        risk_level: item.risk_level,
        expected_impact: "让高风险判断先进入人工复核，避免后续动作误推进。",
        suggested_action: item.mitigation_action,
        created_at: new Date().toISOString(),
        href: sourceHref("analysis"),
      }),
    );
}

function buildAiTaskRecommendations(recommendations: AiRecommendationItem[]) {
  return recommendations.map((item) => ({
    recommendation_id: item.recommendation_id,
    recommendation_type: item.recommendation_type,
    recommendation_summary: item.action_suggestion,
    recommendation_reason: `来自规则引擎的 ${item.priority} 建议，关联商品 ${item.product_uid}。`,
    expected_benefit: item.expected_impact,
    approval_required: true,
    priority: item.priority,
    href: sourceHref("approval"),
  }));
}

export function buildTasksResponse(params: {
  source: "sqlite" | "mock";
  products: Product[];
  inventoryStock: InventoryStockItem[];
  inventoryRisks: InventoryRiskItem[];
  productProfit: ProductProfitItem[];
  approvalQueue: ApprovalQueueItem[];
  todayOpportunities: OpportunityProductItem[];
  opportunityRisks: OpportunityRiskAlert[];
  riskAnalysis: RiskAnalysisItem[];
  aiRecommendations: AiRecommendationItem[];
}): TasksApiResponse {
  const allTasks = [
    ...buildInventoryStockTasks(params.products, params.inventoryStock),
    ...buildInventoryRiskTasks(params.products, params.inventoryRisks),
    ...buildProfitTasks(params.productProfit),
    ...buildApprovalTasks(params.products, params.approvalQueue),
    ...buildOpportunityTasks(params.todayOpportunities),
    ...buildOpportunityRiskTasks(params.opportunityRisks),
    ...buildAnalysisRiskTasks(params.riskAnalysis),
  ].sort(taskSort);

  const highPriorityTasks = allTasks.filter((item) => item.priority === "high");
  const mediumPriorityTasks = allTasks.filter((item) => item.priority === "medium");
  const lowPriorityTasks = allTasks.filter((item) => item.priority === "low");
  const topTasks = allTasks.slice(0, 5).map((item, index) => ({ ...item, rank: index + 1 }));

  const overview = {
    total_tasks: allTasks.length,
    high_priority_tasks: highPriorityTasks.length,
    medium_priority_tasks: mediumPriorityTasks.length,
    low_priority_tasks: lowPriorityTasks.length,
    estimated_profit_impact: allTasks.reduce((sum, item) => sum + item.estimated_profit_impact, 0),
    estimated_gmv_impact: allTasks.reduce((sum, item) => sum + item.estimated_gmv_impact, 0),
    estimated_inventory_impact: allTasks.reduce((sum, item) => sum + item.estimated_inventory_impact, 0),
  };

  const sourceStats = {
    inventory_tasks: allTasks.filter((item) => item.source_module === "inventory").length,
    profit_tasks: allTasks.filter((item) => item.source_module === "profit").length,
    approval_tasks: allTasks.filter((item) => item.source_module === "approval").length,
    analysis_tasks: allTasks.filter((item) => item.source_module === "analysis").length,
    opportunity_tasks: allTasks.filter((item) => item.source_module === "opportunity").length,
  };

  return {
    source: params.source,
    overview,
    top_tasks: topTasks,
    high_priority_tasks: highPriorityTasks,
    medium_priority_tasks: mediumPriorityTasks,
    low_priority_tasks: lowPriorityTasks,
    all_tasks: allTasks,
    ai_recommendations: buildAiTaskRecommendations(params.aiRecommendations),
    source_stats: sourceStats,
    impact_stats: {
      total_profit_impact: overview.estimated_profit_impact,
      total_gmv_impact: overview.estimated_gmv_impact,
      total_inventory_impact: overview.estimated_inventory_impact,
    },
  };
}
