export type Platform =
  | "Shopee"
  | "Mercado Livre"
  | "Amazon BR"
  | "TikTok Shop BR"
  | "Temu"
  | "AliExpress";

export type MarketCode = "br";

export type RiskLevel = "low" | "medium" | "high";

export type ReviewStatus = "pending_review" | "approved_local" | "rejected_local" | "deferred_local";

export type MetricTone = "neutral" | "good" | "warn" | "risk";

export type DashboardValueUnit = "currency" | "percent" | "days" | "count" | "ratio";

export type ApiDataSource = "sqlite" | "mock";

export type ShopeeDataSource = "shopee_api" | "sqlite" | "mock";

export type ShopeeBindingStatusValue = "unbound" | "bound" | "expired" | "error";

export type PlanType = "free" | "pro" | "enterprise";

export type TenantRole = "owner" | "admin" | "operator" | "viewer";

export type DecisionState = "LOCKED" | "RECOMMEND" | "OBSERVE" | "BLOCKED";

export type DecisionUserAction = "buy" | "ignore" | "observe" | "reject";

export type DecisionFeedbackSource = "shopee" | "manual";

export type ExecutionActionType = "purchase" | "stock" | "price" | "ad" | "listing";

export type ExecutionSuggestedBy = "decisionEngine" | "taskSystem";

export type ExecutionStatus = "pending" | "approved" | "rejected" | "executed";

export type ExecutionActorRole = "admin" | "operator" | "buyer" | "finance" | "viewer";

export type AnalysisPriority = "P1" | "P2" | "P3";

export type TaskPriority = "high" | "medium" | "low";

export type TaskSourceModule = "inventory" | "profit" | "approval" | "analysis" | "opportunity";

export type TaskImpactType = "profit" | "gmv" | "inventory" | "risk" | "approval";

export type TaskType =
  | "inventory_alert"
  | "profit_alert"
  | "approval_review"
  | "opportunity_follow_up"
  | "risk_handling"
  | "analysis_review";

export interface Product {
  product_uid: string;
  seller_uid: string;
  keyword_uid: string;
  platform: Platform;
  market_code: MarketCode;
  platform_product_id: string;
  platform_shop_id: string;
  title: string;
  title_current?: string;
  price_amount: number;
  market_currency: "BRL";
  rating: number;
  review_count: number;
  sold_count_text: string;
  snapshot_date: string;
  availability_status?: string;
}

export interface Keyword {
  keyword_uid: string;
  platform?: Platform;
  market_code: MarketCode;
  keyword?: string;
  normalized_keyword: string;
  category_hint?: string;
  search_volume_index: number;
  trend_direction: "up" | "flat" | "down";
}

export interface MarketScore {
  market_score_id: string;
  keyword_uid: string;
  platform: Platform;
  market_code: MarketCode;
  keyword: string;
  market_demand_score: number;
  competition_score: number;
  trend_score: number;
  total_score: number;
}

export interface OpportunityScore {
  opportunity_id: string;
  product_uid: string;
  keyword_uid: string;
  category_hint?: string;
  market_demand_score?: number;
  competition_score?: number;
  market_score: number;
  opportunity_score: number;
  recommendation_level?: "A" | "B" | "C";
  suggestion_level: "A" | "B" | "C";
  decision_notes?: string;
  risk_level: RiskLevel;
  risk_score?: number;
  reason: string;
}

export interface OpportunityProductItem {
  product_uid: string;
  platform: Platform;
  title_current: string;
  price_amount: number;
  rating: number;
  sold_count_text: string;
  market_score: number;
  opportunity_score: number;
  recommendation_level: "A" | "B" | "C";
  decision_notes: string;
  risk_level: RiskLevel;
  risk_score: number;
}

export interface KeywordOpportunityItem {
  keyword_uid: string;
  keyword: string;
  category_hint: string;
  market_demand_score: number;
  competition_score: number;
  trend_score: number;
  total_score: number;
  platform: Platform;
}

export interface OpportunityRiskAlert {
  risk_id: string;
  risk_type: string;
  risk_level: RiskLevel;
  affected_product: string;
  platform: Platform;
  product_uid: string;
  reason: string;
  suggested_action: string;
}

export interface AnalysisQueueRecord {
  analysis_id: string;
  analysis_type: string;
  priority: number;
  notes: string;
  status: string;
}

export interface OpportunityAnalysisItem {
  analysis_id: string;
  product_uid: string;
  platform: Platform;
  opportunity_score: number;
  risk_level: RiskLevel;
  analysis_summary: string;
  analysis_reason: string;
  recommendation: string;
}

export interface RiskAnalysisItem {
  risk_id: string;
  risk_type: string;
  risk_level: RiskLevel;
  product_uid: string;
  platform: Platform;
  risk_reason: string;
  mitigation_action: string;
}

export interface MarketAnalysisItem {
  market_score_id: string;
  platform: Platform;
  category: string;
  demand_score: number;
  competition_score: number;
  trend_direction: Keyword["trend_direction"];
}

export interface AiRecommendationItem {
  recommendation_id: string;
  recommendation_type: string;
  priority: AnalysisPriority;
  platform: Platform;
  product_uid: string;
  action_suggestion: string;
  expected_impact: string;
}

export interface ActionQueueItem {
  action_id: string;
  product_uid: string;
  platform?: Platform;
  action_type: "title_review" | "price_review" | "image_review" | "listing_review";
  suggestion_text: string;
  target_object: string;
  risk_level: RiskLevel;
  confidence_score: number;
  status: ReviewStatus;
  created_at: string;
  reviewer?: string;
  reviewed_at?: string;
}

export interface UploadQueueItem {
  upload_id: string;
  product_uid: string;
  request_type: "listing_review" | "content_review";
  status: ReviewStatus;
  created_at: string;
}

export interface DataQualityReport {
  report_id: string;
  report_date: string;
  source_table: string;
  check_name: string;
  severity: RiskLevel;
  quality_status: "pass" | "warning" | "failed";
  details: string;
}

export interface CrawlLog {
  crawl_run_id: string;
  platform: Platform;
  market_code: MarketCode;
  started_at: string;
  finished_at: string;
  status: "success" | "partial_success" | "failed";
  records_seen: number;
  records_inserted: number;
  message: string;
}

export interface DashboardMetric {
  metric_id: string;
  label: string;
  value: number;
  unit: DashboardValueUnit;
  note: string;
  tone: MetricTone;
}

export interface DashboardRisk {
  risk_id: string;
  title: string;
  level: RiskLevel;
  signal: string;
  note: string;
}

export interface DashboardWatchItem {
  watch_id: string;
  product_uid: string;
  focus_metric: string;
  focus_value: string;
  risk_level: RiskLevel;
  next_action: string;
}

export interface DashboardSnapshot {
  reporting_date: string;
  market_code: MarketCode;
  bossMetrics: DashboardMetric[];
  riskCenter: DashboardRisk[];
  operationSafety: DashboardMetric[];
  trafficFunnel: DashboardMetric[];
  adsCenter: DashboardMetric[];
  inventoryCenter: DashboardMetric[];
  watchlist: DashboardWatchItem[];
}

export interface DashboardCoreMetrics {
  yesterday_net_profit: number;
  month_net_profit: number;
  net_margin: number;
  cash_flow: number;
  inventory_turnover_days: number;
  pending_approval_count: number;
}

export interface DashboardOperatingStatus {
  today_opportunity_count: number;
  high_priority_recommendation_count: number;
  stockout_risk_count: number;
  low_profit_product_count: number;
  high_risk_alert_count: number;
}

export interface DashboardApprovalRecommendation {
  approval_id: string;
  recommendation_type: ActionQueueItem["action_type"];
  product_uid: string;
  product_name: string;
  platform: Platform;
  priority: AnalysisPriority;
  recommendation_summary: string;
  created_at: string;
  status: ReviewStatus;
}

export interface DashboardOpportunitySummaryItem {
  product_uid: string;
  platform: Platform;
  title_current: string;
  price_amount: number;
  opportunity_score: number;
  market_score: number;
  recommendation_level: "A" | "B" | "C";
  decision_notes: string;
}

export interface DashboardRiskSummaryItem {
  risk_id: string;
  source: "opportunity" | "inventory" | "profit";
  risk_type: string;
  risk_level: RiskLevel;
  product_uid: string;
  product_name: string;
  platform: Platform;
  summary: string;
  suggested_action: string;
}

export interface DashboardRecommendedActionItem {
  action_id: string;
  recommendation_type: string;
  priority: AnalysisPriority;
  platform: Platform;
  product_uid: string;
  product_name: string;
  action_suggestion: string;
  expected_impact: string;
}

export interface DashboardProfitAndCash {
  yesterday_net_profit: number;
  month_net_profit: number;
  net_margin: number;
  cash_flow: number;
  profit_risk_summary: ProfitRiskSummary;
}

export interface DashboardInventoryRiskSummary {
  inventory_turnover_days: number;
  stock_health_score: number;
  stockout_risk_count: number;
  overstock_risk_count: number;
  slow_moving_sku_count: number;
}

export interface DashboardDecisionFeedbackSummary {
  decision_accuracy_score: number;
  recommendation_hit_rate: number;
  recommendation_success_rate: number;
  blocked_correct_rate: number;
  roi_deviation_rate: number;
}

export interface DashboardExecutionGuardSummary {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  simulated_profit_total: number;
}

export interface DashboardBusinessImpactSummary {
  total_profit_impact: number;
  decision_success_rate: number;
  roi_prediction_error: number;
  best_strategy: string;
  worst_strategy: string;
}

export interface DashboardSelfOptimizationSummary {
  rule_hit_rate: number;
  rule_bias_rate: number;
  recommendation_count: number;
  top_recommendations: SelfOptimizationRecommendation[];
  learning_trend: SelfOptimizationTrendPoint[];
}

export interface DashboardApprovalSummary {
  pending_count: number;
  high_priority_count: number;
  deferred_count: number;
  latest_recommendations: DashboardApprovalRecommendation[];
}

export interface DashboardOpportunityRiskSummary {
  top_opportunities: DashboardOpportunitySummaryItem[];
  top_risks: DashboardRiskSummaryItem[];
  recommended_actions: DashboardRecommendedActionItem[];
}

export interface DashboardSystemStatus {
  data_source: ApiDataSource;
  last_updated_at: string;
  api_status: "healthy" | "fallback";
  database_status: "connected" | "fallback";
}

export interface DashboardSummary {
  reporting_date: string;
  market_code: MarketCode;
  core_metrics: DashboardCoreMetrics;
  operating_status: DashboardOperatingStatus;
  profit_and_cash: DashboardProfitAndCash;
  inventory_risk: DashboardInventoryRiskSummary;
  decision_feedback: DashboardDecisionFeedbackSummary;
  execution_guard: DashboardExecutionGuardSummary;
  business_impact: DashboardBusinessImpactSummary;
  self_optimization: DashboardSelfOptimizationSummary;
  ai_pending_approval: DashboardApprovalSummary;
  opportunity_and_risk: DashboardOpportunityRiskSummary;
  system_status: DashboardSystemStatus;
}

export interface ProductsApiResponse {
  source: ApiDataSource;
  products: Product[];
}

export interface TenantItem {
  tenant_id: string;
  name: string;
  plan_type: PlanType;
  created_at: string;
}

export interface WorkspaceItem {
  workspace_id: string;
  tenant_id: string;
  name: string;
  shop_count: number;
  created_at: string;
}

export interface TenantUserItem {
  tenant_id: string;
  user_id: string;
  role: TenantRole;
}

export interface TenantUsageStats {
  tenant_id: string;
  workspace_count: number;
  user_count: number;
  product_count: number;
  action_count: number;
  shop_count: number;
}

export interface TenantsApiResponse {
  source: ApiDataSource;
  tenant_id: string;
  tenants: TenantItem[];
  workspaces: WorkspaceItem[];
  tenant_users: TenantUserItem[];
  usage: TenantUsageStats[];
}

export interface WorkspacesApiResponse {
  source: ApiDataSource;
  tenant_id: string;
  workspaces: WorkspaceItem[];
}

export interface TenantMutationResponse {
  source: ApiDataSource;
  tenant_id: string;
  message: string;
  tenant?: TenantItem;
  workspace?: WorkspaceItem;
}

export interface OpportunitiesApiResponse {
  source: ApiDataSource;
  products: Product[];
  keywords: Keyword[];
  market_score: MarketScore[];
  opportunity_score: OpportunityScore[];
  today_opportunities: OpportunityProductItem[];
  keyword_opportunities: KeywordOpportunityItem[];
  risk_alerts: OpportunityRiskAlert[];
}

export interface ApprovalsApiResponse {
  source: ApiDataSource;
  products: Product[];
  approval_queue: ApprovalQueueItem[];
  approval_history: ApprovalHistoryItem[];
  approval_stats: ApprovalStats;
  action_queue?: ActionQueueItem[];
  upload_queue?: UploadQueueItem[];
}

export interface DashboardSummaryApiResponse {
  source: ApiDataSource;
  products: Product[];
  action_queue: ActionQueueItem[];
  crawl_logs: CrawlLog[];
  data_quality_report: DataQualityReport[];
  dashboard_summary: DashboardSummary;
  dashboard_snapshot?: DashboardSnapshot;
}

export interface AnalysisApiResponse {
  source: ApiDataSource;
  opportunity_analysis: OpportunityAnalysisItem[];
  risk_analysis: RiskAnalysisItem[];
  market_analysis: MarketAnalysisItem[];
  ai_recommendations: AiRecommendationItem[];
}

export interface TodayTaskItem {
  task_id: string;
  task_title: string;
  task_type: TaskType;
  source_module: TaskSourceModule;
  impact_type: TaskImpactType;
  title: string;
  summary: string;
  product_uid?: string;
  platform?: Platform;
  estimated_profit_impact: number;
  estimated_gmv_impact: number;
  estimated_inventory_impact: number;
  priority: TaskPriority;
  risk_level: RiskLevel;
  expected_impact: string;
  suggested_action: string;
  created_at: string;
  href: string;
}

export interface TopTaskItem extends TodayTaskItem {
  rank: number;
}

export interface TaskOverview {
  total_tasks: number;
  high_priority_tasks: number;
  medium_priority_tasks: number;
  low_priority_tasks: number;
  estimated_profit_impact: number;
  estimated_gmv_impact: number;
  estimated_inventory_impact: number;
}

export interface AiTaskRecommendation {
  recommendation_id: string;
  recommendation_type: string;
  recommendation_summary: string;
  recommendation_reason: string;
  expected_benefit: string;
  approval_required: boolean;
  priority: AnalysisPriority;
  href: string;
}

export interface TaskSourceStats {
  inventory_tasks: number;
  profit_tasks: number;
  approval_tasks: number;
  analysis_tasks: number;
  opportunity_tasks: number;
}

export interface TaskImpactStats {
  total_profit_impact: number;
  total_gmv_impact: number;
  total_inventory_impact: number;
}

export interface TasksApiResponse {
  source: ApiDataSource;
  overview: TaskOverview;
  top_tasks: TopTaskItem[];
  high_priority_tasks: TodayTaskItem[];
  medium_priority_tasks: TodayTaskItem[];
  low_priority_tasks: TodayTaskItem[];
  all_tasks: TodayTaskItem[];
  ai_recommendations: AiTaskRecommendation[];
  source_stats: TaskSourceStats;
  impact_stats: TaskImpactStats;
}

export type DailyOpsSource =
  | "tasks"
  | "business_impact"
  | "decision_engine"
  | "self_optimization"
  | "action_queue";

export type DailyOpsOpportunityType =
  | "high_roi"
  | "recommended_purchase"
  | "test_product"
  | "rule_optimization";

export interface DailyOpsCoreGoal {
  goal_id: string;
  rank: number;
  title: string;
  source: DailyOpsSource;
  profit_impact: number;
  risk_level: RiskLevel;
  priority: string;
  reason: string;
  href: string;
}

export interface DailyOpsRiskOverview {
  stockout_risk_count: number;
  profit_decline_risk_count: number;
  high_risk_product_count: number;
  approval_backlog_count: number;
  top_risks: Array<{
    risk_id: string;
    risk_type: string;
    risk_level: RiskLevel;
    title: string;
    source: string;
    suggested_action: string;
    href: string;
  }>;
}

export interface DailyOpsOpportunityItem {
  opportunity_id: string;
  opportunity_type: DailyOpsOpportunityType;
  title: string;
  source: "decision_engine" | "self_optimization" | "business_impact";
  expected_roi: number;
  expected_profit: number;
  priority: string;
  recommendation: string;
  href: string;
}

export interface DailyOpsExecutionQueueSummary {
  pending_approval_count: number;
  approved_unexecuted_count: number;
  rejected_count: number;
  total_queue_count: number;
  queue_items: ActionExecutionQueueItem[];
}

export interface DailyOpsMetricsPanel {
  expected_gmv: number;
  expected_profit: number;
  stock_health_score: number;
  decision_success_rate: number;
}

export interface DailyOpsApiResponse {
  source: ApiDataSource;
  generated_at: string;
  core_goals: DailyOpsCoreGoal[];
  risk_overview: DailyOpsRiskOverview;
  opportunities: DailyOpsOpportunityItem[];
  execution_queue: DailyOpsExecutionQueueSummary;
  metrics: DailyOpsMetricsPanel;
  guardrails: string[];
}

export interface ProfitSnapshot {
  profit_snapshot_id: string;
  reporting_date: string;
  market_code: MarketCode;
  yesterday_net_profit: number;
  month_net_profit: number;
  net_margin: number;
  cash_flow: number;
  inventory_turnover_days: number;
  procurement_cost: number;
  advertising_cost: number;
  logistics_cost: number;
  platform_commission: number;
  tax_cost: number;
}

export interface ProfitCostStructureItem {
  cost_key: "procurement_cost" | "advertising_cost" | "logistics_cost" | "platform_commission" | "tax_cost";
  label: string;
  value: number;
  share: number;
}

export interface ProfitRiskSummary {
  loss_products: number;
  low_profit_products: number;
  high_risk_products: number;
}

export interface ProductProfitItem {
  profit_item_id: string;
  product_uid: string;
  platform: Platform;
  product_name: string;
  revenue: number;
  cost: number;
  gross_profit: number;
  net_profit: number;
  net_margin: number;
  inventory_days: number;
  risk_level: RiskLevel;
}

export interface ProfitApiResponse {
  source: ApiDataSource;
  snapshot: ProfitSnapshot;
  cost_structure: ProfitCostStructureItem[];
  profit_risk: ProfitRiskSummary;
  product_profit: ProductProfitItem[];
}

export type StockStatus =
  | "healthy"
  | "reorder_soon"
  | "stockout_risk"
  | "overstock_risk"
  | "slow_moving";

export interface InventorySnapshot {
  inventory_snapshot_id: string;
  reporting_date: string;
  market_code: MarketCode;
  total_inventory_value: number;
  inventory_turnover_days: number;
  stock_health_score: number;
  stockout_risk_count: number;
  overstock_risk_count: number;
  slow_moving_sku_count: number;
}

export interface InventoryStockItem {
  inventory_item_id: string;
  product_uid: string;
  product_name: string;
  platform: Platform;
  stock_qty: number;
  daily_sales_avg: number;
  days_of_stock: number;
  reorder_point: number;
  suggested_reorder_qty: number;
  stock_status: StockStatus;
}

export interface InventoryRiskItem {
  risk_id: string;
  product_uid: string;
  platform: Platform;
  risk_type: string;
  risk_level: RiskLevel;
  risk_reason: string;
  suggested_action: string;
}

export interface ReorderRecommendationItem {
  recommendation_id: string;
  product_uid: string;
  product_name: string;
  platform: Platform;
  current_stock: number;
  daily_sales_avg: number;
  lead_time_days: number;
  recommended_reorder_qty: number;
  reorder_priority: AnalysisPriority;
  decision_notes: string;
}

export interface InventoryApiResponse {
  source: ApiDataSource;
  snapshot: InventorySnapshot;
  inventory_stock: InventoryStockItem[];
  inventory_risks: InventoryRiskItem[];
  reorder_recommendations: ReorderRecommendationItem[];
}

export interface ApprovalQueueItem {
  approval_id: string;
  recommendation_type: ActionQueueItem["action_type"];
  product_uid: string;
  platform: Platform;
  priority: AnalysisPriority;
  recommendation_summary: string;
  created_at: string;
  status: ReviewStatus;
  risk_level: RiskLevel;
  confidence_score: number;
  reviewer?: string;
  reviewed_at?: string;
  notes?: string;
}

export interface ApprovalHistoryItem {
  history_id: string;
  approval_id: string;
  action: ReviewStatus;
  reviewer: string;
  reviewed_at: string;
  notes: string;
}

export interface ApprovalStats {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  deferred_count: number;
}

export type UserRoleName = "admin" | "operator" | "buyer" | "finance" | "viewer";

export type UserStatus = "active" | "disabled";

export type PermissionAction = "view" | "manage" | "approve" | "write";

export type PermissionResource =
  | "dashboard"
  | "command_center"
  | "tenants"
  | "tasks"
  | "opportunities"
  | "analysis"
  | "approvals"
  | "profit"
  | "inventory"
  | "shopee"
  | "decision_feedback"
  | "actions"
  | "business_impact"
  | "self_optimization"
  | "daily_ops"
  | "verification"
  | "users"
  | "system"
  | "system_health";

export type OperationLogAction =
  | "login"
  | "user_login"
  | "logout"
  | "admin_seeded"
  | "approval"
  | "action_create"
  | "action_approve"
  | "action_reject"
  | "action_execute"
  | "user_create"
  | "user_update"
  | "shopee_api_request"
  | "shopee_fallback"
  | "shopee_token_refresh"
  | "shopee_binding_created"
  | "shopee_binding_failed"
  | "shopee_binding_disconnected"
  | "sync_start"
  | "sync_complete"
  | "snapshot_created"
  | "drift_detected"
  | "analytics_run"
  | "anomaly_detected"
  | "risk_flagged"
  | "decision_generated"
  | "action_ranked"
  | "opportunity_detected"
  | "queue_created"
  | "queue_prioritized"
  | "queue_grouped"
  | "approval_created"
  | "approval_approved"
  | "approval_rejected"
  | "approval_escalated"
  | "guard_check_passed"
  | "guard_check_blocked"
  | "guard_risk_detected"
  | "execution_prevented"
  | "virtual_execution_started"
  | "virtual_execution_completed"
  | "execution_simulated"
  | "execution_report_generated"
  | "system_runtime";

export interface PermissionItem {
  permission_id: string;
  permission_key: string;
  resource: PermissionResource;
  action: PermissionAction;
  description: string;
}

export interface RoleItem {
  role_id: UserRoleName;
  role_name: UserRoleName;
  description: string;
  is_system: boolean;
  permissions: PermissionItem[];
}

export interface UserRoleAssignment {
  user_id: string;
  role_id: UserRoleName;
  assigned_at: string;
  assigned_by: string;
}

export interface UserItem {
  user_id: string;
  email: string;
  display_name: string;
  status: UserStatus;
  default_role: UserRoleName;
  roles: UserRoleName[];
  permissions: string[];
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OperationLogItem {
  log_id: string;
  action_type: OperationLogAction;
  actor_user_id: string;
  actor_email: string;
  target_type: string;
  target_id: string;
  summary: string;
  status: "success" | "failed";
  created_at: string;
  metadata_json?: string | null;
}

export interface UsersApiResponse {
  source: ApiDataSource;
  users: UserItem[];
  roles: RoleItem[];
  permissions: PermissionItem[];
  user_roles: UserRoleAssignment[];
}

export interface RolesApiResponse {
  source: ApiDataSource;
  roles: RoleItem[];
  permissions: PermissionItem[];
}

export interface OperationLogsApiResponse {
  source: ApiDataSource;
  operation_logs: OperationLogItem[];
}

export interface ShopeeOrder {
  order_id: string;
  product_id: string;
  sku: string;
  quantity: number;
  price: number;
  order_status: string;
  created_at: string;
}

export interface ShopeeProduct {
  product_id: string;
  title: string;
  price: number;
  stock: number;
  sales_count: number;
}

export interface ShopeeInventoryItem {
  product_id: string;
  available_stock: number;
  reserved_stock: number;
}

export interface ShopeeReadOnlyApiResponse<T> {
  source: ShopeeDataSource;
  data: T[];
  synced_at: string | null;
  readonly: true;
}

export interface ShopeeSyncResult {
  source: ShopeeDataSource;
  readonly: true;
  synced_at: string;
  orders_count: number;
  products_count: number;
  inventory_count: number;
  message: string;
}

export interface ShopeeShopBinding {
  binding_id: string;
  tenant_id: string;
  shop_id: string;
  shop_name: string | null;
  region: string | null;
  partner_id: string;
  access_token: string;
  refresh_token: string;
  token_expire_at: string | null;
  binding_status: ShopeeBindingStatusValue;
  bound_at: string;
  updated_at: string;
  last_sync_at: string | null;
}

export interface ShopeeBindingPublicStatus {
  configured: boolean;
  bound: boolean;
  status: ShopeeBindingStatusValue;
  shop_id: string | null;
  shop_name: string | null;
  region: string | null;
  token_expire_at: string | null;
  last_sync_at: string | null;
  auth_url: string | null;
  message: string;
}

export interface DecisionFeedbackRecord {
    decision_id: string;
    product_id: string;
    product_uid?: string;
    platform?: Platform;
    decisionState: DecisionState;
    user_action: DecisionUserAction;
    userAction?: DecisionUserAction;
    timestamp: string;
    source: DecisionFeedbackSource;
    created_at: string;
  }

export interface DecisionOutcomeRecord {
  outcome_id: string;
  decision_id: string;
  actual_sales: number;
  actual_profit: number;
    roi_real: number;
    stock_change: number;
    conversion_rate: number;
    is_profitable?: boolean;
    is_failed?: boolean;
    recorded_at: string;
  }
  
  export interface DecisionHistoryItem extends DecisionFeedbackRecord {
    outcome?: DecisionOutcomeRecord;
    is_profitable?: boolean;
    is_failed?: boolean;
    roi_real?: number;
  }
  
  export interface DecisionFeedbackInput {
    decision_id?: string;
    product_id: string;
    product_uid?: string;
    platform?: Platform;
    decisionState: DecisionState;
    user_action?: DecisionUserAction;
    userAction?: DecisionUserAction;
    timestamp?: string;
    source?: DecisionFeedbackSource;
    actual_sales?: number;
    actual_profit?: number;
    roi_real?: number;
    stock_change?: number;
    conversion_rate?: number;
    is_profitable?: boolean;
    is_failed?: boolean;
  }

export interface DecisionMetricSummary {
  decision_accuracy_score: number;
  recommendation_hit_rate: number;
  profit_accuracy: number;
  recommendation_success_rate: number;
  blocked_correct_rate: number;
  roi_deviation_rate: number;
  total_decisions: number;
  evaluated_decisions: number;
}

export interface DecisionScoringWeightUpdate {
  weight_key: string;
  current_weight: number;
  suggested_weight: number;
  reason: string;
}

export interface DecisionRecommendationPriorityUpdate {
  product_id: string;
  current_priority: AnalysisPriority;
  suggested_priority: AnalysisPriority;
  reason: string;
}

export interface DecisionEngineBiasCorrection {
  bias_key: string;
  correction_direction: "increase" | "decrease" | "hold";
  confidence: number;
  reason: string;
}

export interface DecisionLearningSystem {
  scoring_weight_updates: DecisionScoringWeightUpdate[];
  recommendation_priority_updates: DecisionRecommendationPriorityUpdate[];
  decision_engine_bias_corrections: DecisionEngineBiasCorrection[];
}

export interface DecisionHistoryApiResponse {
  source: ApiDataSource;
  history: DecisionHistoryItem[];
}

export interface DecisionMetricsApiResponse {
  source: ApiDataSource;
  generated_at: string;
  metrics: DecisionMetricSummary;
  learning: DecisionLearningSystem;
  history_count: number;
}

export interface DecisionFeedbackPostResponse {
  source: ApiDataSource;
  persisted: boolean;
  feedback: DecisionFeedbackRecord;
  outcome?: DecisionOutcomeRecord;
  metrics: DecisionMetricSummary;
  learning: DecisionLearningSystem;
  message: string;
}

export interface ActionExecutionQueueItem {
  action_id: string;
  action_type: ExecutionActionType;
  product_id: string;
  product_uid?: string;
  platform?: Platform;
  suggested_by: ExecutionSuggestedBy;
  status: ExecutionStatus;
  created_at: string;
  simulate_result: string;
  expected_profit_change: number;
  expected_risk_change: number;
  requested_by?: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
}

export interface ActionExecutionHistoryItem {
  history_id: string;
  action_id: string;
  action: ExecutionStatus | "created";
  actor_role: ExecutionActorRole;
  actor_name: string;
  previous_status?: ExecutionStatus;
  new_status: ExecutionStatus;
  notes: string;
  created_at: string;
  simulate_result: string;
}

export interface ActionExecutionStats {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  executed_count: number;
  simulated_profit_total: number;
}

export interface ActionExecutionCreateInput {
  action_type: ExecutionActionType;
  product_id: string;
  product_uid?: string;
  platform?: Platform;
  suggested_by: ExecutionSuggestedBy;
  requested_by?: string;
  notes?: string;
}

export interface ActionExecutionDecisionInput {
  action_id: string;
  actor_role: ExecutionActorRole;
  actor_name?: string;
  notes?: string;
}

export interface ActionExecutionQueueApiResponse {
  source: ApiDataSource;
  queue: ActionExecutionQueueItem[];
  stats: ActionExecutionStats;
}

export interface ActionExecutionHistoryApiResponse {
  source: ApiDataSource;
  history: ActionExecutionHistoryItem[];
}

export interface ActionExecutionMutationResponse {
  source: ApiDataSource;
  persisted: boolean;
  action: ActionExecutionQueueItem;
  history: ActionExecutionHistoryItem;
  stats: ActionExecutionStats;
  message: string;
}

export interface BusinessImpactActionItem {
  impact_id: string;
  action_id: string;
  product_id: string;
  product_uid?: string;
  platform?: Platform;
  action_type: string;
  action_status: string;
  expected_impact: number;
  actual_impact: number;
  expected_profit_change: number;
  profit_before: number;
  profit_after: number;
  profit_delta: number;
  stock_before: number;
  stock_after: number;
  stock_turnover_change: number;
  gmv_before: number;
  gmv_after: number;
  gmv_delta: number;
  decision_accuracy: number;
  roi_prediction_error: number;
  attribution_note: string;
  measured_at: string;
  source: "action_queue" | "decision_feedback" | "shopee_cache" | "manual";
}

export interface BusinessImpactStrategyRank {
  strategy_id: string;
  action_type: string;
  action_count: number;
  total_profit_delta: number;
  total_gmv_delta: number;
  avg_decision_accuracy: number;
  roi_prediction_error: number;
  rank_reason: string;
}

export interface BusinessImpactSummary {
  total_profit_impact: number;
  total_gmv_impact: number;
  total_stock_turnover_change: number;
  decision_accuracy: number;
  action_success_rate: number;
  ROI_prediction_error: number;
  analyzed_action_count: number;
  successful_action_count: number;
  best_strategy_rank: BusinessImpactStrategyRank[];
  worst_strategy_rank: BusinessImpactStrategyRank[];
}

export interface BusinessImpactApiResponse {
  source: ApiDataSource;
  generated_at: string;
  summary: BusinessImpactSummary;
  action_impacts: BusinessImpactActionItem[];
  best_strategies: BusinessImpactStrategyRank[];
  worst_strategies: BusinessImpactStrategyRank[];
  data_sources: string[];
}

export type SelfOptimizationRuleGroup =
  | "decisionEngine"
  | "scoring"
  | "risk"
  | "approval"
  | "execution";

export type SelfOptimizationStatus = "healthy" | "watch" | "needs_review";

export type SelfOptimizationFailureType =
  | "high_roi_blocked"
  | "low_roi_recommended"
  | "high_risk_misjudgment";

export interface SelfOptimizationRulePerformance {
  rule_name: string;
  rule_group: SelfOptimizationRuleGroup;
  sample_count: number;
  hit_rate: number;
  bias_rate: number;
  roi_prediction_error: number;
  blocked_false_positive_rate: number;
  status: SelfOptimizationStatus;
  analysis_note: string;
}

export interface SelfOptimizationRecommendation {
  recommendation_id: string;
  rule_name: string;
  current_weight: number;
  suggested_weight: number;
  reason: string;
  expected_impact: string;
  priority: AnalysisPriority;
  approval_required: boolean;
}

export interface SelfOptimizationFailurePattern {
  pattern_id: string;
  pattern_type: SelfOptimizationFailureType;
  severity: RiskLevel;
  affected_rule: string;
  evidence_count: number;
  reason: string;
  suggested_review: string;
}

export interface SelfOptimizationRuleRank {
  rule_name: string;
  score: number;
  sample_count: number;
  reason: string;
}

export interface SelfOptimizationTrendPoint {
  period: string;
  rule_hit_rate: number;
  rule_bias_rate: number;
  recommendation_count: number;
}

export interface SelfOptimizationSummary {
  rule_hit_rate: number;
  rule_bias_rate: number;
  roi_prediction_error: number;
  blocked_misjudgment_rate: number;
  recommendation_count: number;
  top_performing_rules: SelfOptimizationRuleRank[];
  worst_performing_rules: SelfOptimizationRuleRank[];
  learning_trend: SelfOptimizationTrendPoint[];
}

export interface SelfOptimizationApiResponse {
  source: ApiDataSource;
  generated_at: string;
  summary: SelfOptimizationSummary;
  rule_performance: SelfOptimizationRulePerformance[];
  recommendations: SelfOptimizationRecommendation[];
  failure_patterns: SelfOptimizationFailurePattern[];
  top_performing_rules: SelfOptimizationRuleRank[];
  worst_performing_rules: SelfOptimizationRuleRank[];
  data_sources: string[];
  guardrails: string[];
}

export type SystemHealthStatus = "ok" | "fail";

export type SystemHealthCheckName =
  | "inventory_to_tasks"
  | "profit_to_tasks"
  | "approvals_to_tasks";

export type SystemLogType = "task_generated" | "approval_action" | "inventory_update";

export interface ApiHealthCheckItem {
  endpoint: string;
  status: SystemHealthStatus;
  response_time: number;
  data_source: ApiDataSource | "unknown";
  last_updated: string;
  error?: string;
}

export interface ConsistencyMismatchItem {
  check_id: string;
  source: string;
  target: string;
  item_id: string;
  product_uid?: string;
  reason: string;
  expected_task_source: TaskSourceModule;
}

export interface DataConsistencyCheck {
  check_name: SystemHealthCheckName;
  label: string;
  mismatch_count: number;
  mismatch_items: ConsistencyMismatchItem[];
  severity: RiskLevel;
}

export interface DataSourceHealthStatus {
  sqlite_available: boolean;
  mock_fallback_active: boolean;
  last_db_init_time: string | null;
}

export interface SystemHealthScoreBreakdown {
  api_failure_rate: number;
  data_missing_rate: number;
  mock_ratio: number;
  task_anomaly_rate: number;
}

export interface RuntimeSchedulerStatus {
  enabled: boolean;
  running: boolean;
  started_at: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  last_cycle_runtime_ms: number | null;
  last_error: string | null;
  retry_count: number;
  cycle_count: number;
  cron_active: boolean;
  server_instance_id: string;
  production_trace_id: string;
}

export interface RuntimeDatabaseStatus {
  active_mode: "postgres" | "sqlite" | "mock";
  postgres_configured: boolean;
  sqlite_fallback_active: boolean;
  connection_status: "connected" | "fallback" | "failed";
  schema_compatible: boolean;
  missing_tables: string[];
  checked_at: string;
  retry_count: number;
  error?: string | null;
}

export interface RuntimeCacheStatus {
  cache_mode: string;
  enabled: boolean;
  entries: number;
  hits: number;
  misses: number;
  writes: number;
  hit_rate: number;
  last_rebuild_at: string | null;
}

export interface ProductionRuntimeStatus {
  system_mode: "development" | "staging" | "production";
  production_mode_status: "active" | "inactive";
  scheduler_status: "running" | "idle" | "disabled";
  scheduler_running_status: "running" | "idle" | "disabled";
  scheduler: RuntimeSchedulerStatus;
  database_status: "connected" | "fallback" | "failed";
  database: RuntimeDatabaseStatus;
  cache: RuntimeCacheStatus;
  api_latency: number;
  api_latency_ms: number;
  cache_hit_rate: number;
  sync_lag: number | null;
  sync_lag_seconds: number | null;
  last_cycle_time: string | null;
  last_cycle_runtime_ms: number | null;
  server_instance_id: string;
  production_trace_id: string;
  logs_converged: boolean;
}

export interface SystemLogSummaryItem {
  log_id: string;
  log_type: SystemLogType;
  source_module: TaskSourceModule | "system";
  message: string;
  created_at: string;
  status: SystemHealthStatus | ReviewStatus | RiskLevel | TaskPriority;
}

export interface SystemHealthApiResponse {
  source: ApiDataSource;
  generated_at: string;
  api_health: ApiHealthCheckItem[];
  data_consistency: DataConsistencyCheck[];
  data_source_status: DataSourceHealthStatus;
  production_runtime: ProductionRuntimeStatus;
  system_health_score: number;
  score_breakdown: SystemHealthScoreBreakdown;
  logs: SystemLogSummaryItem[];
}

export type VerificationStatus = "正常" | "异常" | "延迟";

export interface VerificationModuleCheck {
  module_id: string;
  module_name: string;
  href: string;
  status: VerificationStatus;
  response_time: number;
  data_source: ApiDataSource | ShopeeDataSource | "unknown";
  notes: string;
}

export interface VerificationApiHealthItem {
  endpoint: string;
  status: VerificationStatus;
  response_time: number;
  data_source: ApiDataSource | ShopeeDataSource | "unknown";
  last_updated: string;
  notes: string;
}

export interface VerificationEntryLink {
  label: string;
  href: string;
  module_id: string;
}

export interface VerificationRuntimeSummary {
  system_available: "YES" | "NO";
  module_completeness: number;
  api_health_score: number;
  data_consistency_status: VerificationStatus;
}

export interface VerificationModeInfo {
  current_version: string;
  newly_added_module: string;
  impact_scope: string;
  existing_system_affected: "YES" | "NO";
}

export interface VerificationStatusApiResponse {
  source: ApiDataSource;
  generated_at: string;
  verification_mode: VerificationModeInfo;
  modules: VerificationModuleCheck[];
  api_health: VerificationApiHealthItem[];
  quick_entries: VerificationEntryLink[];
  runtime_summary: VerificationRuntimeSummary;
}
