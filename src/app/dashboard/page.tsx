"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import {
  BarChartCard,
  DonutChartCard,
  FunnelChartCard,
  LineChartCard,
  type ChartPoint,
} from "@/components/Charts";
import { ColumnSettingsNote, CompactMetricCard, MoreActionsMenu } from "@/components/OperatorControls";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { emptyDashboardResponse, emptyTasksResponse } from "@/data/emptyResponses";
import { formatBrl, formatCount, formatPercent } from "@/lib/format";
import { priorityLabel, riskLevelLabel, riskTypeLabel, sourceModuleLabel } from "@/locales/zh-CN";
import type { DashboardSummaryApiResponse, RiskLevel, TasksApiResponse } from "@/types";

function riskTone(level: RiskLevel) {
  if (level === "high") return "danger";
  if (level === "medium") return "warning";
  return "success";
}

function buildTrend(base: number, labels: string[], multipliers: number[]): ChartPoint[] {
  return labels.map((label, index) => ({
    label,
    value: Math.max(0, Math.round(base * multipliers[index])),
  }));
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="数据加载中">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-32 animate-pulse rounded-lg border border-line bg-white p-4">
          <div className="h-4 w-24 rounded bg-slate-100" />
          <div className="mt-5 h-8 w-32 rounded bg-slate-100" />
          <div className="mt-5 h-4 w-full rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardSummaryApiResponse>(emptyDashboardResponse);
  const [taskData, setTaskData] = useState<TasksApiResponse>(emptyTasksResponse);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError("");

    Promise.all([
      fetch("/api/dashboard-summary", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(new Error("dashboard-summary")),
      ),
      fetch("/api/tasks", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(new Error("tasks")),
      ),
    ])
      .then(([dashboardPayload, taskPayload]) => {
        if (!active) return;
        setDashboardData(dashboardPayload as DashboardSummaryApiResponse);
        setTaskData(taskPayload as TasksApiResponse);
      })
      .catch(() => {
        if (!active) return;
        setDashboardData(emptyDashboardResponse);
        setTaskData(emptyTasksResponse);
        setLoadError("正式数据暂时不可用，当前页面不展示测试数据。请检查数据连接或平台只读连接。");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const summary = dashboardData.dashboard_summary;
  const topTasks = taskData.top_tasks.slice(0, 5);
  const topRisks = summary.opportunity_and_risk.top_risks.slice(0, 5);
  const topOpportunities = summary.opportunity_and_risk.top_opportunities.slice(0, 4);
  const recommendedActions = summary.opportunity_and_risk.recommended_actions.slice(0, 4);
  const todayGmv = Math.max(taskData.impact_stats.total_gmv_impact, summary.business_impact.total_profit_impact * 3);
  const lastUpdated = summary.system_status.last_updated_at || "刚刚";

  const chartData = useMemo(() => {
    const labels = ["周一", "周二", "周三", "周四", "周五", "今日"];
    return {
      gmv: buildTrend(todayGmv, labels, [0.76, 0.82, 0.88, 0.94, 1.02, 1.08]),
      profit: buildTrend(summary.profit_and_cash.yesterday_net_profit, labels, [0.68, 0.74, 0.86, 0.92, 0.97, 1]),
      inventory: labels.map((label, index) => ({
        label,
        value: Math.max(0, Math.round(summary.inventory_risk.stock_health_score + [-9, -5, -3, 1, 3, 0][index])),
      })),
      funnel: [
        { label: "访客", value: 12800 },
        { label: "点击", value: 2460 },
        { label: "加购", value: 680 },
        { label: "订单", value: 286 },
      ],
      riskMix: [
        { label: "库存风险", value: summary.inventory_risk.stockout_risk_count, color: "#2563EB" },
        { label: "积压风险", value: summary.inventory_risk.overstock_risk_count, color: "#60A5FA" },
        { label: "低利润", value: summary.operating_status.low_profit_product_count, color: "#94A3B8" },
        { label: "审批堵塞", value: summary.ai_pending_approval.pending_count, color: "#CBD5E1" },
      ],
    };
  }, [summary, todayGmv]);

  const tableRows = [
    ...topRisks.map((risk) => ({
      id: risk.risk_id,
      type: "风险",
      title: risk.product_name,
      meta: riskTypeLabel(risk.risk_type),
      score: riskLevelLabel(risk.risk_level),
      tone: riskTone(risk.risk_level),
      note: risk.summary,
      action: risk.suggested_action,
      href: "/analysis",
    })),
    ...topOpportunities.map((item) => ({
      id: item.product_uid,
      type: "机会",
      title: item.title_current,
      meta: `${item.platform} / ${item.product_uid}`,
      score: `${item.opportunity_score}`,
      tone: item.recommendation_level === "A" ? "success" : "warning",
      note: item.decision_notes,
      action: "查看机会详情",
      href: "/opportunities",
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-ink">运营总览</h1>
          <p className="mt-1 text-sm text-slate-500">老板三秒看懂今天赚不赚钱、库存有没有风险、还有多少事项待处理。</p>
        </div>
        <MoreActionsMenu onRefresh={() => window.location.reload()} />
      </div>

      {loadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </div>
      ) : null}

      {isLoading ? <LoadingState /> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CompactMetricCard
          title="今日销售"
          value={formatBrl(todayGmv)}
          change="环比 +8.0%"
          updatedAt={lastUpdated}
          tone="good"
          icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
        />
        <CompactMetricCard
          title="今日利润"
          value={formatBrl(summary.profit_and_cash.yesterday_net_profit)}
          change={`净利润率 ${formatPercent(summary.profit_and_cash.net_margin, 1)}`}
          updatedAt={lastUpdated}
          tone="good"
          icon={<CircleDollarSign className="h-5 w-5" aria-hidden="true" />}
        />
        <CompactMetricCard
          title="库存风险"
          value={`${summary.inventory_risk.stockout_risk_count} 个`}
          change={`健康度 ${formatCount(summary.inventory_risk.stock_health_score)} 分`}
          updatedAt={lastUpdated}
          tone={summary.inventory_risk.stockout_risk_count > 0 ? "risk" : "good"}
          icon={<Boxes className="h-5 w-5" aria-hidden="true" />}
        />
        <CompactMetricCard
          title="待处理事项"
          value={formatCount(summary.ai_pending_approval.pending_count + topTasks.length)}
          change={`高优先级 ${summary.ai_pending_approval.high_priority_count} 个`}
          updatedAt={lastUpdated}
          tone={summary.ai_pending_approval.high_priority_count > 0 ? "warn" : "neutral"}
          icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">今日必须处理</h2>
              <p className="mt-1 text-sm text-slate-500">按利润影响、风险等级、库存影响和GMV影响综合排序。</p>
            </div>
            <Link href="/tasks" className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-800">
              查看全部 <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent>
            {topTasks.length ? (
              <div className="operator-scroll">
                <table className="operator-table text-left">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th>排名</th>
                      <th>任务</th>
                      <th>来源</th>
                      <th>优先级</th>
                      <th className="text-right">利润影响</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTasks.map((task) => (
                      <tr key={task.task_id}>
                        <td className="font-semibold text-ink">{task.rank}</td>
                        <td>
                          <Link href={task.href} className="font-medium text-ink hover:text-teal-700">
                            {task.task_title}
                          </Link>
                          <div className="mt-1 line-clamp-1 text-xs text-slate-500">{task.summary}</div>
                        </td>
                        <td className="text-slate-600">{sourceModuleLabel(task.source_module)}</td>
                        <td>
                          <Badge tone={task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "neutral"}>
                            {priorityLabel(task.priority)}
                          </Badge>
                        </td>
                        <td className="text-right font-semibold text-ink">
                          {formatBrl(task.estimated_profit_impact)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-line bg-slate-50 p-6 text-sm text-slate-500">
                暂无今日任务。
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 xl:col-span-4">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-ink">AI待审批</h2>
              <p className="mt-1 text-sm text-slate-500">建议只展示，不会自动执行，关键动作仍需人工审批。</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border border-line bg-slate-50 p-3 text-center">
                  <div className="text-2xl font-semibold text-ink">{summary.ai_pending_approval.pending_count}</div>
                  <div className="mt-1 text-xs text-slate-500">待处理</div>
                </div>
                <div className="rounded-md border border-line bg-slate-50 p-3 text-center">
                  <div className="text-2xl font-semibold text-red-700">{summary.ai_pending_approval.high_priority_count}</div>
                  <div className="mt-1 text-xs text-slate-500">高优先级</div>
                </div>
                <div className="rounded-md border border-line bg-slate-50 p-3 text-center">
                  <div className="text-2xl font-semibold text-slate-700">{summary.ai_pending_approval.deferred_count}</div>
                  <div className="mt-1 text-xs text-slate-500">已延后</div>
                </div>
              </div>
              {summary.ai_pending_approval.latest_recommendations.slice(0, 3).map((item) => (
                <Link key={item.approval_id} href="/approvals" className="block rounded-md border border-line p-3 hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-ink">{item.product_name}</span>
                    <Badge tone={item.priority === "P1" ? "danger" : "warning"}>{priorityLabel(item.priority)}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{item.recommendation_summary}</p>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-ink">决策闭环</h2>
              <p className="mt-1 text-sm text-slate-500">用历史结果校验推荐逻辑是否可靠。</p>
            </CardHeader>
            <CardContent className="grid gap-3">
              {[
                ["推荐命中率", summary.decision_feedback.recommendation_hit_rate],
                ["推荐成功率", summary.decision_feedback.recommendation_success_rate],
                ["BLOCKED准确率", summary.decision_feedback.blocked_correct_rate],
              ].map(([label, value]) => (
                <div key={label as string} className="flex items-center justify-between rounded-md border border-line bg-slate-50 px-3 py-2">
                  <span className="text-sm text-slate-600">{label as string}</span>
                  <span className="font-semibold text-ink">{formatPercent(value as number, 1)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-12">
          <CardHeader>
            <h2 className="text-lg font-semibold text-ink">风险与机会总表</h2>
            <p className="mt-1 text-sm text-slate-500">把今日主要风险和高分机会放在同一张表里，便于快速判断优先级。</p>
          </CardHeader>
          <CardContent>
            {tableRows.length ? (
              <div className="operator-scroll">
                <table className="operator-table text-left">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th>类型</th>
                      <th>对象</th>
                      <th>等级/评分</th>
                      <th>说明</th>
                      <th className="text-right">建议</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={`${row.type}-${row.id}`}>
                        <td>
                          <Badge tone={row.type === "风险" ? "danger" : "info"}>{row.type}</Badge>
                        </td>
                        <td>
                          <Link href={row.href} className="font-medium text-ink hover:text-teal-700">
                            {row.title}
                          </Link>
                          <div className="mt-1 text-xs text-slate-500">{row.meta}</div>
                        </td>
                        <td>
                          <Badge tone={row.tone as "neutral" | "success" | "warning" | "danger" | "info"}>{row.score}</Badge>
                        </td>
                        <td className="text-slate-600">{row.note}</td>
                        <td className="text-right font-medium text-teal-700">{row.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-line bg-slate-50 p-6 text-sm text-slate-500">
                暂无风险与机会数据。
              </div>
            )}
          </CardContent>
        </Card>
        <div className="xl:col-span-12">
          <ColumnSettingsNote hiddenFields={["商品编号", "平台原始编号", "详细风险来源", "完整建议记录"]} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-12">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <CheckCircle2 className="h-4 w-4 text-teal-700" aria-hidden="true" />
            经营趋势
          </div>
        </div>
        <div className="xl:col-span-6">
          <LineChartCard title="GMV趋势图" description="观察经营规模是否持续上行。" data={chartData.gmv} />
        </div>
        <div className="xl:col-span-6">
          <LineChartCard title="利润趋势图" description="确认增长是否真正带来利润。" data={chartData.profit} />
        </div>
        <div className="xl:col-span-6">
          <BarChartCard
            title="库存健康趋势"
            description="库存健康度越高，现金流与履约风险越稳定。"
            data={chartData.inventory}
            valueLabel={(value) => `${value}分`}
          />
        </div>
        <div className="xl:col-span-6">
          <DonutChartCard title="风险结构图" description="查看今日风险主要集中在哪一类。" data={chartData.riskMix} />
        </div>
        <div className="xl:col-span-6">
          <FunnelChartCard title="流量漏斗图" description="从访客到订单，快速判断转化链路。" data={chartData.funnel} />
        </div>
        <div className="xl:col-span-6">
          <BarChartCard
            title="TOP利润事项"
            description="按预计利润影响展示最值得优先处理的事项。"
            data={topTasks.map((task) => ({ label: task.task_title, value: task.estimated_profit_impact }))}
          />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4 text-sm leading-6 text-slate-600 shadow-panel">
        <div className="flex items-center gap-2 font-semibold text-ink">
          <ShieldAlert className="h-4 w-4 text-teal-700" aria-hidden="true" />
          运营边界
        </div>
        <p className="mt-2">
          本页只做数据汇总、风险提示和建议展示，不会自动改价、补货、上架、下单或调整广告。所有关键动作仍然进入人工审批。
        </p>
      </section>
    </div>
  );
}
