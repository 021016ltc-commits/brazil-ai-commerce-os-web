"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  ListChecks,
  LockKeyhole,
  RefreshCcw,
  ShieldAlert,
  Target,
  TrendingUp,
} from "lucide-react";
import { emptyDailyOpsResponse } from "@/data/emptyResponses";
import { formatBrl, formatCount, formatPercent } from "@/lib/format";
import { actionTypeLabelZh, riskTypeLabel, sourceModuleLabel, statusLabel, suggestedByLabel } from "@/locales/zh-CN";
import type {
  DailyOpsApiResponse,
  DailyOpsCoreGoal,
  DailyOpsOpportunityItem,
  RiskLevel,
} from "@/types";

function sourceLabel(source: DailyOpsApiResponse["source"]) {
  return source === "sqlite" ? "真实数据" : "测试数据已禁用";
}

function riskLabel(level: RiskLevel) {
  return {
    high: "高风险",
    medium: "中风险",
    low: "低风险",
  }[level];
}

function riskTone(level: RiskLevel) {
  return {
    high: "border-rose-200 bg-rose-50 text-coral",
    medium: "border-amber-200 bg-amber-50 text-amber",
    low: "border-emerald-200 bg-emerald-50 text-forest",
  }[level];
}

function priorityTone(priority: string) {
  if (priority === "P1" || priority === "high") return "border-rose-200 bg-rose-50 text-coral";
  if (priority === "P2" || priority === "medium") return "border-amber-200 bg-amber-50 text-amber";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">{eyebrow}</div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-ink sm:text-2xl">{title}</h2>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: "good" | "warn" | "risk" | "neutral";
}) {
  const toneClass = {
    good: "border-emerald-200 bg-emerald-50 text-forest",
    warn: "border-amber-200 bg-amber-50 text-amber",
    risk: "border-rose-200 bg-rose-50 text-coral",
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
  }[tone];

  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-600">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-ink">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-md border ${toneClass}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{detail}</p>
    </article>
  );
}

function GoalCard({ goal }: { goal: DailyOpsCoreGoal }) {
  return (
    <Link
      href={goal.href}
      className="group rounded-lg border border-line bg-white p-5 shadow-panel transition hover:border-forest"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-forest text-lg font-semibold text-white">
            {goal.rank}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-ink">{goal.title}</h3>
              <Badge className={riskTone(goal.risk_level)}>{riskLabel(goal.risk_level)}</Badge>
              <Badge className={priorityTone(goal.priority)}>{goal.priority}</Badge>
            </div>
            <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{sourceModuleLabel(goal.source)}</div>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-forest" aria-hidden="true" />
      </div>

      <div className="mt-4 rounded-md bg-slate-50 px-3 py-2">
        <div className="text-xs uppercase tracking-wide text-slate-400">利润影响</div>
        <div className="mt-1 text-2xl font-semibold text-ink">{formatBrl(goal.profit_impact)}</div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{goal.reason}</p>
    </Link>
  );
}

function OpportunityCard({ item }: { item: DailyOpsOpportunityItem }) {
  return (
    <Link href={item.href} className="group rounded-lg border border-line bg-white p-4 shadow-panel transition hover:border-forest">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-forest">
            {item.opportunity_type}
          </div>
          <h3 className="mt-2 text-sm font-semibold text-ink">{item.title}</h3>
          <div className="mt-1 text-xs text-slate-500">{sourceModuleLabel(item.source)}</div>
        </div>
        <Badge className={priorityTone(item.priority)}>{item.priority}</Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <div className="text-xs text-slate-400">预计ROI</div>
          <div className="mt-1 font-semibold text-ink">{formatPercent(Math.max(0, item.expected_roi), 1)}</div>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <div className="text-xs text-slate-400">预计利润</div>
          <div className="mt-1 font-semibold text-ink">{formatBrl(item.expected_profit)}</div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{item.recommendation}</p>
      <div className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-forest">
        查看来源
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
    </Link>
  );
}

export default function DailyOpsPage() {
  const [data, setData] = useState<DailyOpsApiResponse>(emptyDailyOpsResponse);

  useEffect(() => {
    let active = true;

    fetch("/api/daily-ops", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: DailyOpsApiResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(emptyDailyOpsResponse);
      });

    return () => {
      active = false;
    };
  }, []);

  const riskTotal = useMemo(
    () =>
      data.risk_overview.stockout_risk_count +
      data.risk_overview.profit_decline_risk_count +
      data.risk_overview.high_risk_product_count +
      data.risk_overview.approval_backlog_count,
    [data.risk_overview],
  );

  return (
    <div className="space-y-9">
      <section className="rounded-lg border border-line bg-white p-5 shadow-panel sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                每日运营 V1
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {sourceLabel(data.source)}
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                只汇总排序，不自动执行
              </span>
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                每日运营
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                把决策复盘、今日任务、执行中心、经营结果分析和规则优化汇总成今天可执行的运营视图。系统只告诉你先看什么、先处理什么，所有动作仍然必须人工判断和审批。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">预计GMV</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{formatBrl(data.metrics.expected_gmv)}</div>
              <div className="mt-1 text-sm text-slate-500">任务影响 + 归因GMV影响</div>
            </div>
            <div className="rounded-lg border border-line bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">预计利润</div>
              <div className="mt-2 text-2xl font-semibold text-forest">{formatBrl(data.metrics.expected_profit)}</div>
              <div className="mt-1 text-sm text-slate-500">任务利润 + 历史归因利润</div>
            </div>
            <div className="rounded-lg border border-line bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">库存健康度</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{formatCount(data.metrics.stock_health_score)}</div>
              <div className="mt-1 text-sm text-slate-500">来自库存中心快照</div>
            </div>
            <div className="rounded-lg border border-line bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">决策成功率</div>
              <div className="mt-2 text-2xl font-semibold text-ink">
                {formatPercent(data.metrics.decision_success_rate)}
              </div>
              <div className="mt-1 text-sm text-slate-500">来自决策复盘</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="今日核心事项"
          value={formatCount(data.core_goals.length)}
          detail="系统按利润影响、风险等级和优先级筛出的 Top 3。"
          icon={<Target className="h-5 w-5" aria-hidden="true" />}
          tone="good"
        />
        <MetricCard
          label="风险信号"
          value={formatCount(riskTotal)}
          detail="库存、利润、高风险产品和审批积压的合计压力。"
          icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
          tone={riskTotal > 8 ? "risk" : "warn"}
        />
        <MetricCard
          label="执行队列待审批"
          value={formatCount(data.execution_queue.pending_approval_count)}
          detail="来自执行中心的执行审批池，不会绕过审批。"
          icon={<LockKeyhole className="h-5 w-5" aria-hidden="true" />}
          tone={data.execution_queue.pending_approval_count > 0 ? "warn" : "good"}
        />
        <MetricCard
          label="今日机会"
          value={formatCount(data.opportunities.length)}
          detail="由经营结果分析、决策复盘和规则优化汇总。"
          icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
          tone="good"
        />
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="今日核心目标 Top 3"
          title="今天必须先处理的三件事"
          description="来源包括经营结果分析、今日任务和决策规则，按预计利润影响、风险等级和优先级排序。"
        />
        <div className="grid gap-4 xl:grid-cols-3">
          {data.core_goals.map((goal) => (
            <GoalCard key={goal.goal_id} goal={goal} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <SectionHeader
            eyebrow="今日风险概览"
            title="先把会伤利润和履约的风险拦住"
            description="这里聚合库存断货、利润下滑、高风险产品和审批积压，帮助运营先控风险再追机会。"
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="库存断货风险"
              value={formatCount(data.risk_overview.stockout_risk_count)}
              detail="来自库存中心 stockout risk。"
              icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
              tone="risk"
            />
            <MetricCard
              label="利润下滑风险"
              value={formatCount(data.risk_overview.profit_decline_risk_count)}
              detail="亏损商品和低利润商品合计。"
              icon={<BarChart3 className="h-5 w-5" aria-hidden="true" />}
              tone="warn"
            />
            <MetricCard
              label="高风险产品"
              value={formatCount(data.risk_overview.high_risk_product_count)}
              detail="库存、利润和任务中的高风险信号。"
              icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
              tone="risk"
            />
            <MetricCard
              label="审批积压"
              value={formatCount(data.risk_overview.approval_backlog_count)}
              detail="审批中心和执行队列待处理数量。"
              icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
              tone="warn"
            />
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <SectionHeader
              eyebrow="Top Risk Items"
              title="今日优先处理的风险明细"
              description="每条风险都可以跳转到来源模块，当前页面不做修复、不做执行。"
            />
          </div>
          <div className="mt-5 space-y-3">
            {data.risk_overview.top_risks.map((item) => (
              <Link
                key={item.risk_id}
                href={item.href}
                className="group block rounded-lg border border-line bg-slate-50 p-4 transition hover:border-forest"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-ink">{item.title}</div>
                    <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                      {sourceModuleLabel(item.source)} / {riskTypeLabel(item.risk_type)}
                    </div>
                  </div>
                  <Badge className={riskTone(item.risk_level)}>{riskLabel(item.risk_level)}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.suggested_action}</p>
              </Link>
            ))}
          </div>
        </section>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="今日机会"
          title="高ROI机会、推荐采购和可测试产品"
          description="机会来自决策规则、规则优化和经营结果分析。所有机会只是建议，不会自动采购、改价或上架。"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.opportunities.map((item) => (
            <OpportunityCard key={item.opportunity_id} item={item} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <SectionHeader
            eyebrow="执行队列摘要"
            title="哪些动作卡在执行中心"
            description="这里读取执行审批池。批准、驳回和模拟执行仍然在执行中心处理，本页只做汇总。"
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="待审批"
              value={formatCount(data.execution_queue.pending_approval_count)}
              detail="待审批状态。"
              icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
              tone="warn"
            />
            <MetricCard
              label="已批准未执行"
              value={formatCount(data.execution_queue.approved_unexecuted_count)}
              detail="已批准但未标记执行完成。"
              icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
              tone="good"
            />
            <MetricCard
              label="已拒绝"
              value={formatCount(data.execution_queue.rejected_count)}
              detail="已驳回状态。"
              icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
              tone="neutral"
            />
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <SectionHeader
              eyebrow="队列预览"
              title="执行队列重点项"
              description="按待审批优先、再按预计利润影响排序。点击进入执行中心处理。"
            />
            <Link href="/actions" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-forest px-3 text-sm font-semibold text-white">
              执行中心
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {data.execution_queue.queue_items.map((item) => (
              <Link key={item.action_id} href="/actions" className="block rounded-lg border border-line bg-slate-50 p-4 hover:border-forest">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-ink">{item.action_id}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {actionTypeLabelZh(item.action_type)} / {item.product_id} / {suggestedByLabel(item.suggested_by)}
                    </div>
                  </div>
                  <Badge className={item.status === "pending" ? priorityTone("P1") : priorityTone("P3")}>
                    {statusLabel(item.status)}
                  </Badge>
                </div>
                <div className="mt-3 text-sm text-slate-600">
                  预计利润变化：{formatBrl(item.expected_profit_change)} / 预计风险变化：
                  {formatPercent(item.expected_risk_change, 1)}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="flex items-start gap-3">
          <ListChecks className="mt-1 h-5 w-5 text-forest" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-ink">每日运营边界</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {data.guardrails.map((item) => (
                <div key={item} className="rounded-md bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">生成时间：{formatDateTime(data.generated_at)}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
