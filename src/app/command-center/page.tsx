"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Command,
  Gauge,
  HeartPulse,
  LineChart,
  ListTodo,
  PackageCheck,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { dataStatusLabel } from "@/components/OperatorControls";
import {
  emptyDailyOpsResponse,
  emptyDashboardResponse,
  emptySystemHealthResponse,
  emptyTasksResponse,
  emptyVerificationResponse,
} from "@/data/emptyResponses";
import { riskLevelLabel, sourceModuleLabel, zhCN } from "@/locales/zh-CN";
import type {
  ApiDataSource,
  DailyOpsApiResponse,
  DailyOpsCoreGoal,
  DailyOpsOpportunityItem,
  DashboardSummaryApiResponse,
  RiskLevel,
  SystemHealthApiResponse,
  TasksApiResponse,
  TodayTaskItem,
  VerificationStatusApiResponse,
} from "@/types";

type CommandItem = {
  id: string;
  title: string;
  summary: string;
  href: string;
  source: string;
  impact: number;
  risk_level: RiskLevel;
  opportunity_score: number;
  suggested_action: string;
};

type CommandState = {
  dashboard: DashboardSummaryApiResponse;
  tasks: TasksApiResponse;
  dailyOps: DailyOpsApiResponse;
  systemHealth: SystemHealthApiResponse;
  verification: VerificationStatusApiResponse;
};

const fallbackState: CommandState = {
  dashboard: emptyDashboardResponse,
  tasks: emptyTasksResponse,
  dailyOps: emptyDailyOpsResponse,
  systemHealth: emptySystemHealthResponse,
  verification: emptyVerificationResponse,
};

const quickLinks = [
  { href: "/dashboard", label: zhCN.nav.dashboard, icon: BarChart3 },
  { href: "/tasks", label: zhCN.nav.tasks, icon: ListTodo },
  { href: "/actions", label: zhCN.nav.actions, icon: ShieldCheck },
  { href: "/inventory", label: zhCN.nav.inventory, icon: PackageCheck },
  { href: "/profit", label: zhCN.nav.profit, icon: Wallet },
  { href: "/business-impact", label: zhCN.nav.businessImpact, icon: LineChart },
  { href: "/self-optimization", label: zhCN.nav.selfOptimization, icon: SlidersHorizontal },
];

function riskScore(level: RiskLevel) {
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

function riskLabel(level: RiskLevel) {
  return riskLevelLabel(level);
}

function riskTone(level: RiskLevel) {
  if (level === "high") return "border-rose-200 bg-rose-50 text-coral";
  if (level === "medium") return "border-amber-200 bg-amber-50 text-amber";
  return "border-emerald-200 bg-emerald-50 text-forest";
}

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function sourceLabel(source: ApiDataSource | "unknown") {
  return dataStatusLabel(source);
}

async function readApi<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url} failed`);
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

function taskToCommand(task: TodayTaskItem): CommandItem {
  return {
    id: task.task_id,
    title: task.task_title || task.title,
    summary: task.summary,
    href: task.href,
    source: task.source_module,
    impact: Math.max(task.estimated_profit_impact, task.estimated_gmv_impact * 0.08),
    risk_level: task.risk_level,
    opportunity_score: task.priority === "high" ? 90 : task.priority === "medium" ? 70 : 50,
    suggested_action: task.suggested_action,
  };
}

function goalToCommand(goal: DailyOpsCoreGoal): CommandItem {
  return {
    id: goal.goal_id,
    title: goal.title,
    summary: goal.reason,
    href: goal.href,
    source: goal.source,
    impact: goal.profit_impact,
    risk_level: goal.risk_level,
    opportunity_score: goal.priority === "high" ? 90 : 72,
    suggested_action: "进入对应模块人工处理",
  };
}

function opportunityToCommand(item: DailyOpsOpportunityItem): CommandItem {
  return {
    id: item.opportunity_id,
    title: item.title,
    summary: item.recommendation,
    href: item.href,
    source: item.source,
    impact: item.expected_profit,
    risk_level: "medium",
    opportunity_score: item.expected_roi,
    suggested_action: "人工评估后进入审批或任务跟进",
  };
}

function sortCommandItems(items: CommandItem[]) {
  return [...items].sort((left, right) => {
    const profitDelta = right.impact - left.impact;
    if (profitDelta !== 0) return profitDelta;
    const riskDelta = riskScore(right.risk_level) - riskScore(left.risk_level);
    if (riskDelta !== 0) return riskDelta;
    return right.opportunity_score - left.opportunity_score;
  });
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
        {eyebrow}
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-ink">{title}</h2>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-600">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-ink">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-forest">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{detail}</p>
    </article>
  );
}

function CommandList({ items }: { items: CommandItem[] }) {
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-lg border border-line bg-white px-4 py-6 text-sm text-slate-500">
          当前没有需要展示的事项。
        </div>
      ) : null}
      {items.map((item, index) => (
        <Link
          key={item.id}
          href={item.href}
          className="block rounded-lg border border-line bg-white p-4 shadow-panel transition hover:border-forest hover:shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-7 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-700">
                  #{index + 1}
                </span>
                <span className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-semibold ${riskTone(item.risk_level)}`}>
                  {riskLabel(item.risk_level)}
                </span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
              <p className="mt-2 text-sm font-medium text-forest">{item.suggested_action}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">利润影响</div>
              <div className="mt-1 text-lg font-semibold text-ink">{currency(item.impact)}</div>
              <div className="mt-2 text-xs text-slate-500">处理入口</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function CommandCenterPage() {
  const [state, setState] = useState<CommandState>(fallbackState);
  const [loadedAt, setLoadedAt] = useState(new Date().toISOString());

  useEffect(() => {
    let active = true;

    Promise.all([
      readApi<DashboardSummaryApiResponse>("/api/dashboard-summary", emptyDashboardResponse),
      readApi<TasksApiResponse>("/api/tasks", emptyTasksResponse),
      readApi<DailyOpsApiResponse>("/api/daily-ops", emptyDailyOpsResponse),
      readApi<SystemHealthApiResponse>("/api/system-health", emptySystemHealthResponse),
      readApi<VerificationStatusApiResponse>("/api/verification/status", emptyVerificationResponse),
    ]).then(([dashboard, tasks, dailyOps, systemHealth, verification]) => {
      if (!active) return;
      setState({ dashboard, tasks, dailyOps, systemHealth, verification });
      setLoadedAt(new Date().toISOString());
    });

    return () => {
      active = false;
    };
  }, []);

  const commandData = useMemo(() => {
    const highProfitTasks = state.tasks.all_tasks
      .filter((task) => task.estimated_profit_impact > 0)
      .map(taskToCommand);
    const coreGoals = state.dailyOps.core_goals.map(goalToCommand);
    const mustDo = sortCommandItems([...coreGoals, ...highProfitTasks]).slice(0, 5);

    const riskTasks = state.tasks.all_tasks
      .filter(
        (task) =>
          task.risk_level === "high" ||
          task.source_module === "inventory" ||
          task.source_module === "approval",
      )
      .map(taskToCommand);
    const dailyRisks = state.dailyOps.risk_overview.top_risks.map((risk) => ({
      id: risk.risk_id,
      title: risk.title,
      summary: risk.suggested_action,
      href: risk.href,
      source: risk.source,
      impact: 0,
      risk_level: risk.risk_level,
      opportunity_score: 0,
      suggested_action: "进入对应页面排查",
    }));
    const systemRisks = state.systemHealth.api_health
      .filter((item) => item.status === "fail")
      .map((item) => ({
        id: item.endpoint,
        title: "服务异常",
        summary: item.error ?? "某项服务返回异常，需要进入系统健康查看问题编号。",
        href: "/system-health",
        source: "system_health",
        impact: 0,
        risk_level: "high" as const,
        opportunity_score: 0,
        suggested_action: "查看系统健康中心",
      }));
    const risks = sortCommandItems([...riskTasks, ...dailyRisks, ...systemRisks]).slice(0, 5);

    const ops = state.dailyOps.opportunities.map(opportunityToCommand);
    const dashboardOps = state.dashboard.dashboard_summary.opportunity_and_risk.top_opportunities.map(
      (item) => ({
        id: item.product_uid,
        title: item.title_current,
        summary: item.decision_notes,
        href: "/opportunities",
        source: "opportunities",
        impact: item.opportunity_score * 100,
        risk_level: "medium" as const,
        opportunity_score: item.opportunity_score,
        suggested_action: "进入机会中心人工评估",
      }),
    );
    const recommendations = state.dashboard.dashboard_summary.opportunity_and_risk.recommended_actions.map(
      (item) => ({
        id: item.action_id,
        title: item.action_suggestion,
        summary: item.expected_impact,
        href: "/analysis",
        source: item.recommendation_type,
        impact: 0,
        risk_level: item.priority === "P1" ? ("high" as const) : ("medium" as const),
        opportunity_score: item.priority === "P1" ? 90 : item.priority === "P2" ? 70 : 50,
        suggested_action: "建议只展示，不自动执行",
      }),
    );
    const opportunities = sortCommandItems([...ops, ...dashboardOps, ...recommendations]).slice(0, 5);

    return { mustDo, risks, opportunities };
  }, [state]);

  const summary = state.dashboard.dashboard_summary;
  const core = summary.core_metrics;
  const operating = summary.operating_status;
  const system = summary.system_status;
  const apiOkCount = state.systemHealth.api_health.filter((item) => item.status === "ok").length;
  const apiTotal = Math.max(state.systemHealth.api_health.length, 1);
  const apiHealthRate = apiOkCount / apiTotal;
  const sqliteAvailable = state.systemHealth.data_source_status.sqlite_available;
  const mockRatio = state.systemHealth.score_breakdown.mock_ratio;
  const verificationAvailable = state.verification.runtime_summary.system_available;
  const verificationAvailableLabel = verificationAvailable === "YES" ? "是" : "否";

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-7 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                今日运营工作台
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                只做优先级汇总
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">运营指挥中心</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                处理今天最重要的运营事项。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile
              label="今日净利润"
              value={currency(core.yesterday_net_profit)}
              detail={`本月净利润 ${currency(core.month_net_profit)}，净利率 ${percent(core.net_margin)}。`}
              icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
            />
            <MetricTile
              label="待审批"
              value={`${core.pending_approval_count}`}
              detail={`高优先级 ${summary.ai_pending_approval.high_priority_count}，延后 ${summary.ai_pending_approval.deferred_count}。`}
              icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="必须处理" value={`${commandData.mustDo.length}`} detail="按利润、风险、机会排序。" icon={<Command className="h-5 w-5" aria-hidden="true" />} />
        <MetricTile label="高风险提醒" value={`${operating.high_risk_alert_count}`} detail={`断货风险 ${operating.stockout_risk_count}，低利润商品 ${operating.low_profit_product_count}。`} icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />} />
        <MetricTile label="今日机会" value={`${operating.today_opportunity_count}`} detail={`高优先级建议 ${operating.high_priority_recommendation_count}。`} icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />} />
        <MetricTile label="系统状态" value={`${state.systemHealth.system_health_score}`} detail={`服务健康 ${percent(apiHealthRate)}，验收状态 ${verificationAvailableLabel}。`} icon={<HeartPulse className="h-5 w-5" aria-hidden="true" />} />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <section className="space-y-4">
          <SectionHeader
            eyebrow="今日必办"
            title="今日必须处理"
            description="优先看利润影响最大的任务，再看高风险库存和审批阻塞。"
          />
          <CommandList items={commandData.mustDo} />
        </section>

        <section className="space-y-4">
          <SectionHeader
            eyebrow="今日风险"
            title="今日风险"
            description="聚合断货、利润下滑、审批积压和系统异常，只展示风险，不自动处理。"
          />
          <CommandList items={commandData.risks} />
        </section>

        <section className="space-y-4">
          <SectionHeader
            eyebrow="今日机会"
            title="今日机会"
            description="聚合高 ROI 产品、推荐采购方向和建议动作，所有动作仍需人工审批。"
          />
          <CommandList items={commandData.opportunities} />
        </section>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <SectionHeader
            eyebrow="系统健康"
            title="系统运行状态总览"
            description="用于判断今天是否可以信任系统数据，以及是否存在服务或数据异常。"
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">服务健康</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{apiOkCount}/{apiTotal}</div>
              <div className="mt-1 text-xs text-slate-500">来自系统健康</div>
            </div>
            <div className="rounded-lg border border-line bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">数据连接</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{sqliteAvailable ? "正常" : "未连接"}</div>
              <div className="mt-1 text-xs text-slate-500">最近检查 {formatDateTime(state.systemHealth.data_source_status.last_db_init_time)}</div>
            </div>
            <div className="rounded-lg border border-line bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">备用数据状态</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{mockRatio > 0 ? "需检查" : "未启用"}</div>
              <div className="mt-1 text-xs text-slate-500">运营视图优先展示正式数据</div>
            </div>
            <div className="rounded-lg border border-line bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-600">数据更新时间</div>
              <div className="mt-2 text-base font-semibold text-ink">{formatDateTime(system.last_updated_at || loadedAt)}</div>
              <div className="mt-1 text-xs text-slate-500">页面加载 {formatDateTime(loadedAt)}</div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <SectionHeader
            eyebrow="快速入口"
            title="快速跳转入口"
            description="从指挥中心直接进入对应模块处理问题。"
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-14 items-center justify-between rounded-lg border border-line bg-white px-4 py-3 text-sm font-medium text-ink shadow-panel transition hover:border-forest hover:bg-slate-50"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-forest" aria-hidden="true" />
                    {item.label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </section>
      </section>

      <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <CheckCircle2 className="h-4 w-4 text-forest" aria-hidden="true" />
            今日排序已按利润、风险和机会整理
          </div>
          <div className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-slate-50 px-3 text-xs font-medium text-slate-600">
            <Gauge className="h-4 w-4" aria-hidden="true" />
            模块完整度 {state.verification.runtime_summary.module_completeness}%
          </div>
        </div>
      </section>
    </div>
  );
}
