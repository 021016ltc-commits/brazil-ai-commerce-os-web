import type {
  ActionExecutionHistoryApiResponse,
  ActionExecutionQueueApiResponse,
  AnalysisApiResponse,
  ApprovalsApiResponse,
  BusinessImpactApiResponse,
  DailyOpsApiResponse,
  DashboardSummary,
  DashboardSummaryApiResponse,
  DecisionHistoryApiResponse,
  DecisionLearningSystem,
  DecisionMetricSummary,
  DecisionMetricsApiResponse,
  InventoryApiResponse,
  InventorySnapshot,
  OperationLogsApiResponse,
  OpportunitiesApiResponse,
  ProfitApiResponse,
  ProfitSnapshot,
  RolesApiResponse,
  SelfOptimizationApiResponse,
  ShopeeInventoryItem,
  ShopeeAdCampaign,
  ShopeeAffiliatePerformance,
  ShopeeListingDiagnostic,
  ShopeeOrder,
  ShopeeProduct,
  ShopeeReadOnlyApiResponse,
  ShopeeShopWeightMetric,
  SystemHealthApiResponse,
  TasksApiResponse,
  TenantsApiResponse,
  UsersApiResponse,
  VerificationStatusApiResponse,
} from "@/types";

const generatedAt = new Date().toISOString();
const reportingDate = generatedAt.slice(0, 10);

export const emptyProfitSnapshot: ProfitSnapshot = {
  profit_snapshot_id: "empty_profit_snapshot",
  reporting_date: reportingDate,
  market_code: "br",
  yesterday_net_profit: 0,
  month_net_profit: 0,
  net_margin: 0,
  cash_flow: 0,
  inventory_turnover_days: 0,
  procurement_cost: 0,
  advertising_cost: 0,
  logistics_cost: 0,
  platform_commission: 0,
  tax_cost: 0,
};

export const emptyInventorySnapshot: InventorySnapshot = {
  inventory_snapshot_id: "empty_inventory_snapshot",
  reporting_date: reportingDate,
  market_code: "br",
  total_inventory_value: 0,
  inventory_turnover_days: 0,
  stock_health_score: 0,
  stockout_risk_count: 0,
  overstock_risk_count: 0,
  slow_moving_sku_count: 0,
};

export const emptyProfitResponse: ProfitApiResponse = {
  source: "sqlite",
  snapshot: emptyProfitSnapshot,
  cost_structure: [],
  profit_risk: {
    loss_products: 0,
    low_profit_products: 0,
    high_risk_products: 0,
  },
  product_profit: [],
};

export const emptyInventoryResponse: InventoryApiResponse = {
  source: "sqlite",
  snapshot: emptyInventorySnapshot,
  inventory_stock: [],
  inventory_risks: [],
  reorder_recommendations: [],
};

export const emptyOpportunitiesResponse: OpportunitiesApiResponse = {
  source: "sqlite",
  products: [],
  keywords: [],
  market_score: [],
  opportunity_score: [],
  today_opportunities: [],
  keyword_opportunities: [],
  risk_alerts: [],
};

export const emptyApprovalsResponse: ApprovalsApiResponse = {
  source: "sqlite",
  products: [],
  approval_queue: [],
  approval_history: [],
  approval_stats: {
    pending_count: 0,
    approved_count: 0,
    rejected_count: 0,
    deferred_count: 0,
  },
  action_queue: [],
  upload_queue: [],
};

export const emptyAnalysisResponse: AnalysisApiResponse = {
  source: "sqlite",
  opportunity_analysis: [],
  risk_analysis: [],
  market_analysis: [],
  ai_recommendations: [],
};

export const emptyTasksResponse: TasksApiResponse = {
  source: "sqlite",
  overview: {
    total_tasks: 0,
    high_priority_tasks: 0,
    medium_priority_tasks: 0,
    low_priority_tasks: 0,
    estimated_profit_impact: 0,
    estimated_gmv_impact: 0,
    estimated_inventory_impact: 0,
  },
  top_tasks: [],
  high_priority_tasks: [],
  medium_priority_tasks: [],
  low_priority_tasks: [],
  all_tasks: [],
  ai_recommendations: [],
  source_stats: {
    inventory_tasks: 0,
    profit_tasks: 0,
    approval_tasks: 0,
    analysis_tasks: 0,
    opportunity_tasks: 0,
  },
  impact_stats: {
    total_profit_impact: 0,
    total_gmv_impact: 0,
    total_inventory_impact: 0,
  },
};

export const emptyDecisionMetrics: DecisionMetricSummary = {
  decision_accuracy_score: 0,
  recommendation_hit_rate: 0,
  profit_accuracy: 0,
  recommendation_success_rate: 0,
  blocked_correct_rate: 0,
  roi_deviation_rate: 0,
  total_decisions: 0,
  evaluated_decisions: 0,
};

export const emptyDecisionLearning: DecisionLearningSystem = {
  scoring_weight_updates: [],
  recommendation_priority_updates: [],
  decision_engine_bias_corrections: [],
};

export const emptyDecisionHistoryResponse: DecisionHistoryApiResponse = {
  source: "sqlite",
  history: [],
};

export const emptyDecisionMetricsResponse: DecisionMetricsApiResponse = {
  source: "sqlite",
  generated_at: generatedAt,
  metrics: emptyDecisionMetrics,
  learning: emptyDecisionLearning,
  history_count: 0,
};

export const emptyActionQueueResponse: ActionExecutionQueueApiResponse = {
  source: "sqlite",
  queue: [],
  stats: {
    pending_count: 0,
    approved_count: 0,
    rejected_count: 0,
    executed_count: 0,
    simulated_profit_total: 0,
  },
};

export const emptyActionHistoryResponse: ActionExecutionHistoryApiResponse = {
  source: "sqlite",
  history: [],
};

export const emptyBusinessImpactResponse: BusinessImpactApiResponse = {
  source: "sqlite",
  generated_at: generatedAt,
  summary: {
    total_profit_impact: 0,
    total_gmv_impact: 0,
    total_stock_turnover_change: 0,
    decision_accuracy: 0,
    action_success_rate: 0,
    ROI_prediction_error: 0,
    analyzed_action_count: 0,
    successful_action_count: 0,
    best_strategy_rank: [],
    worst_strategy_rank: [],
  },
  action_impacts: [],
  best_strategies: [],
  worst_strategies: [],
  data_sources: [],
};

export const emptySelfOptimizationResponse: SelfOptimizationApiResponse = {
  source: "sqlite",
  generated_at: generatedAt,
  summary: {
    rule_hit_rate: 0,
    rule_bias_rate: 0,
    roi_prediction_error: 0,
    blocked_misjudgment_rate: 0,
    recommendation_count: 0,
    top_performing_rules: [],
    worst_performing_rules: [],
    learning_trend: [],
  },
  rule_performance: [],
  recommendations: [],
  failure_patterns: [],
  top_performing_rules: [],
  worst_performing_rules: [],
  data_sources: [],
  guardrails: [],
};

export const emptyDailyOpsResponse: DailyOpsApiResponse = {
  source: "sqlite",
  generated_at: generatedAt,
  core_goals: [],
  risk_overview: {
    stockout_risk_count: 0,
    profit_decline_risk_count: 0,
    high_risk_product_count: 0,
    approval_backlog_count: 0,
    top_risks: [],
  },
  opportunities: [],
  execution_queue: {
    pending_approval_count: 0,
    approved_unexecuted_count: 0,
    rejected_count: 0,
    total_queue_count: 0,
    queue_items: [],
  },
  metrics: {
    expected_gmv: 0,
    expected_profit: 0,
    stock_health_score: 0,
    decision_success_rate: 0,
  },
  guardrails: ["当前仅展示真实业务数据；测试数据已禁用。"],
};

export const emptyDashboardSummary: DashboardSummary = {
  reporting_date: reportingDate,
  market_code: "br",
  core_metrics: {
    yesterday_net_profit: 0,
    month_net_profit: 0,
    net_margin: 0,
    cash_flow: 0,
    inventory_turnover_days: 0,
    pending_approval_count: 0,
  },
  operating_status: {
    today_opportunity_count: 0,
    high_priority_recommendation_count: 0,
    stockout_risk_count: 0,
    low_profit_product_count: 0,
    high_risk_alert_count: 0,
  },
  profit_and_cash: {
    yesterday_net_profit: 0,
    month_net_profit: 0,
    net_margin: 0,
    cash_flow: 0,
    profit_risk_summary: emptyProfitResponse.profit_risk,
  },
  inventory_risk: {
    inventory_turnover_days: 0,
    stock_health_score: 0,
    stockout_risk_count: 0,
    overstock_risk_count: 0,
    slow_moving_sku_count: 0,
  },
  decision_feedback: {
    decision_accuracy_score: 0,
    recommendation_hit_rate: 0,
    recommendation_success_rate: 0,
    blocked_correct_rate: 0,
    roi_deviation_rate: 0,
  },
  execution_guard: {
    pending_count: 0,
    approved_count: 0,
    rejected_count: 0,
    simulated_profit_total: 0,
  },
  business_impact: {
    total_profit_impact: 0,
    decision_success_rate: 0,
    roi_prediction_error: 0,
    best_strategy: "暂无真实数据",
    worst_strategy: "暂无真实数据",
  },
  self_optimization: {
    rule_hit_rate: 0,
    rule_bias_rate: 0,
    recommendation_count: 0,
    top_recommendations: [],
    learning_trend: [],
  },
  ai_pending_approval: {
    pending_count: 0,
    high_priority_count: 0,
    deferred_count: 0,
    latest_recommendations: [],
  },
  opportunity_and_risk: {
    top_opportunities: [],
    top_risks: [],
    recommended_actions: [],
  },
  system_status: {
    data_source: "sqlite",
    last_updated_at: generatedAt,
    api_status: "fallback",
    database_status: "fallback",
  },
};

export const emptyDashboardResponse: DashboardSummaryApiResponse = {
  source: "sqlite",
  products: [],
  action_queue: [],
  crawl_logs: [],
  data_quality_report: [],
  dashboard_summary: emptyDashboardSummary,
};

export const emptyShopeeOrdersResponse: ShopeeReadOnlyApiResponse<ShopeeOrder> = {
  source: "sqlite",
  data: [],
  synced_at: null,
  readonly: true,
};

export const emptyShopeeProductsResponse: ShopeeReadOnlyApiResponse<ShopeeProduct> = {
  source: "sqlite",
  data: [],
  synced_at: null,
  readonly: true,
};

export const emptyShopeeInventoryResponse: ShopeeReadOnlyApiResponse<ShopeeInventoryItem> = {
  source: "sqlite",
  data: [],
  synced_at: null,
  readonly: true,
};

export const emptyShopeeAdsResponse: ShopeeReadOnlyApiResponse<ShopeeAdCampaign> = {
  source: "sqlite",
  data: [],
  synced_at: null,
  readonly: true,
};

export const emptyShopeeAffiliateResponse: ShopeeReadOnlyApiResponse<ShopeeAffiliatePerformance> = {
  source: "sqlite",
  data: [],
  synced_at: null,
  readonly: true,
};

export const emptyShopeeListingDiagnosticsResponse: ShopeeReadOnlyApiResponse<ShopeeListingDiagnostic> = {
  source: "sqlite",
  data: [],
  synced_at: null,
  readonly: true,
};

export const emptyShopeeShopWeightResponse: ShopeeReadOnlyApiResponse<ShopeeShopWeightMetric> = {
  source: "sqlite",
  data: [],
  synced_at: null,
  readonly: true,
};

export const emptyUsersResponse: UsersApiResponse = {
  source: "sqlite",
  users: [],
  roles: [],
  permissions: [],
  user_roles: [],
};

export const emptyRolesResponse: RolesApiResponse = {
  source: "sqlite",
  roles: [],
  permissions: [],
};

export const emptyOperationLogsResponse: OperationLogsApiResponse = {
  source: "sqlite",
  operation_logs: [],
};

export const emptyTenantsResponse: TenantsApiResponse = {
  source: "sqlite",
  tenant_id: "demo_tenant",
  tenants: [],
  workspaces: [],
  tenant_users: [],
  usage: [],
};

export const emptySystemHealthResponse: SystemHealthApiResponse = {
  source: "sqlite",
  generated_at: generatedAt,
  api_health: [],
  data_consistency: [],
  data_source_status: {
    sqlite_available: false,
    mock_fallback_active: false,
    last_db_init_time: null,
  },
  production_runtime: {
    system_mode: "production",
    production_mode_status: "active",
    scheduler_status: "disabled",
    scheduler_running_status: "disabled",
    scheduler: {
      enabled: false,
      running: false,
      started_at: null,
      last_run_at: null,
      next_run_at: null,
      last_cycle_runtime_ms: null,
      last_error: null,
      retry_count: 0,
      cycle_count: 0,
      cron_active: false,
      server_instance_id: "unavailable",
      production_trace_id: "unavailable",
    },
    database_status: "failed",
    database: {
      active_mode: "sqlite",
      postgres_configured: false,
      sqlite_fallback_active: false,
      connection_status: "failed",
      schema_compatible: false,
      missing_tables: [],
      checked_at: generatedAt,
      retry_count: 0,
      error: "真实数据源未连接。",
    },
    cache: {
      cache_mode: "disabled",
      enabled: false,
      entries: 0,
      hits: 0,
      misses: 0,
      writes: 0,
      hit_rate: 0,
      last_rebuild_at: null,
    },
    api_latency: 0,
    api_latency_ms: 0,
    cache_hit_rate: 0,
    sync_lag: null,
    sync_lag_seconds: null,
    last_cycle_time: null,
    last_cycle_runtime_ms: null,
    server_instance_id: "unavailable",
    production_trace_id: "unavailable",
    logs_converged: false,
  },
  system_health_score: 0,
  score_breakdown: {
    api_failure_rate: 1,
    data_missing_rate: 1,
    mock_ratio: 0,
    task_anomaly_rate: 0,
  },
  logs: [],
};

export const emptyVerificationResponse: VerificationStatusApiResponse = {
  source: "sqlite",
  generated_at: generatedAt,
  verification_mode: {
    current_version: "Production",
    newly_added_module: "真实数据模式",
    impact_scope: "禁用测试数据展示，保留真实数据入口。",
    existing_system_affected: "NO",
  },
  modules: [],
  api_health: [],
  quick_entries: [],
  runtime_summary: {
    system_available: "NO",
    module_completeness: 0,
    api_health_score: 0,
    data_consistency_status: "异常",
  },
};
