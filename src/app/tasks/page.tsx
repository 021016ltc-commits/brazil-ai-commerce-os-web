"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Filter,
  LineChart,
  ShieldAlert,
  Target,
} from "lucide-react";
import { ColumnSettingsNote, dataStatusLabel } from "@/components/OperatorControls";
import { RealDataReadiness } from "@/components/RealDataReadiness";
import { emptyTasksResponse } from "@/data/emptyResponses";
import type {
  TaskPriority,
  TaskSourceModule,
  TasksApiResponse,
  TodayTaskItem,
} from "@/types";

type PriorityFilter = "all" | TaskPriority;
type SourceFilter = "all" | TaskSourceModule;
type SortKey = "default" | "profit" | "risk" | "inventory" | "gmv";

const fallbackTasks: TasksApiResponse = emptyTasksResponse;

function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(value));
}

function sourceLabel(source: TasksApiResponse["source"]) {
  return dataStatusLabel(source);
}

function priorityLabel(priority: TaskPriority) {
  return {
    high: "高优先级",
    medium: "中优先级",
    low: "低优先级",
  }[priority];
}

function priorityBadge(priority: TaskPriority) {
  return {
    high: "border-rose-200 bg-rose-50 text-coral",
    medium: "border-amber-200 bg-amber-50 text-amber",
    low: "border-slate-200 bg-slate-50 text-slate-700",
  }[priority];
}

function sourceModuleLabel(source: TaskSourceModule) {
  return {
    inventory: "库存中心",
    profit: "利润中心",
    approval: "审批中心",
    analysis: "数据分析",
    opportunity: "机会中心",
  }[source];
}

function taskTypeLabel(type: TodayTaskItem["task_type"]) {
  return {
    inventory_alert: "库存预警",
    profit_alert: "利润异常",
    approval_review: "待审批",
    opportunity_follow_up: "机会跟进",
    risk_handling: "高风险处理",
    analysis_review: "分析复核",
  }[type];
}

function impactTypeLabel(type: TodayTaskItem["impact_type"]) {
  return {
    profit: "利润影响",
    gmv: "GMV影响",
    inventory: "库存影响",
    risk: "风险影响",
    approval: "审批影响",
  }[type];
}

function riskRank(level: TodayTaskItem["risk_level"]) {
  return { high: 3, medium: 2, low: 1 }[level];
}

function priorityRank(priority: TaskPriority) {
  return { high: 3, medium: 2, low: 1 }[priority];
}

function taskStatusLabel(task: TodayTaskItem) {
  if (task.priority === "high") return "待处理";
  if (task.priority === "medium") return "处理中";
  if (task.estimated_profit_impact <= 0 && task.risk_level === "low") return "已忽略";
  return "已完成";
}

function taskStatusBadge(task: TodayTaskItem) {
  const status = taskStatusLabel(task);
  return ({
    待处理: "border-amber-200 bg-amber-50 text-amber",
    处理中: "border-blue-200 bg-blue-50 text-blue-700",
    已完成: "border-emerald-200 bg-emerald-50 text-forest",
    已忽略: "border-slate-200 bg-slate-50 text-slate-600",
  } as Record<string, string>)[status];
}

function sortTasks(items: TodayTaskItem[], sortBy: SortKey) {
  return [...items].sort((left, right) => {
    if (sortBy === "profit") return right.estimated_profit_impact - left.estimated_profit_impact;
    if (sortBy === "risk") return riskRank(right.risk_level) - riskRank(left.risk_level);
    if (sortBy === "inventory") return right.estimated_inventory_impact - left.estimated_inventory_impact;
    if (sortBy === "gmv") return right.estimated_gmv_impact - left.estimated_gmv_impact;

    const profitDelta = right.estimated_profit_impact - left.estimated_profit_impact;
    if (profitDelta !== 0) return profitDelta;
    const riskDelta = riskRank(right.risk_level) - riskRank(left.risk_level);
    if (riskDelta !== 0) return riskDelta;
    const inventoryDelta = right.estimated_inventory_impact - left.estimated_inventory_impact;
    if (inventoryDelta !== 0) return inventoryDelta;
    const gmvDelta = right.estimated_gmv_impact - left.estimated_gmv_impact;
    if (gmvDelta !== 0) return gmvDelta;
    return priorityRank(right.priority) - priorityRank(left.priority);
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

function KpiCard({
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
  tone?: "neutral" | "good" | "warn" | "risk";
}) {
  const toneClass = {
    neutral: "bg-slate-50 text-ink",
    good: "bg-emerald-50 text-forest",
    warn: "bg-amber-50 text-amber",
    risk: "bg-rose-50 text-coral",
  }[tone];

  return (
    <article className="min-h-[104px] rounded-lg border border-line bg-white p-3 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-600">{label}</div>
          <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${toneClass}`}>
          {icon}
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function BarList({
  items,
  valueFormatter = formatCount,
}: {
  items: Array<{ label: string; value: number; color: string }>;
  valueFormatter?: (value: number) => string;
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label} className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-ink">{item.label}</span>
            <span className="text-slate-500">{valueFormatter(item.value)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-md bg-slate-100">
            <div
              className={`h-full rounded-md ${item.color}`}
              style={{ width: `${Math.max(7, (item.value / maxValue) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskCard({ task }: { task: TodayTaskItem }) {
  return (
    <article className="rounded-lg border border-line bg-white p-3 shadow-panel transition hover:border-forest/40 hover:shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium ${priorityBadge(task.priority)}`}>
              {priorityLabel(task.priority)}
            </span>
            <span className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium ${taskStatusBadge(task)}`}>
              {taskStatusLabel(task)}
            </span>
            <span className="inline-flex h-7 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-700">
              {sourceModuleLabel(task.source_module)}
            </span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-ink">{task.title}</h3>
          <div className="mt-1 text-sm font-medium text-ink">{task.task_title}</div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{task.summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={task.href} className="inline-flex h-8 items-center rounded-md border border-line px-3 text-xs font-medium text-ink hover:bg-slate-50">
            查看
          </Link>
          <Link href={task.href} className="inline-flex h-8 items-center rounded-md bg-forest px-3 text-xs font-semibold text-white hover:bg-teal-800">
            处理
          </Link>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-md bg-slate-50 px-2 py-1">利润影响 {formatBrl(task.estimated_profit_impact)}</span>
        <span className="rounded-md bg-slate-50 px-2 py-1">销售影响 {formatBrl(task.estimated_gmv_impact)}</span>
        <span className="rounded-md bg-slate-50 px-2 py-1">库存影响 {formatCount(task.estimated_inventory_impact)}</span>
      </div>

      <div className="mt-3 rounded-md border border-line bg-white px-3 py-2 text-sm leading-6 text-slate-600">
        建议动作：{task.suggested_action}
      </div>
    </article>
  );
}

function TaskGroup({
  title,
  description,
  tasks,
}: {
  title: string;
  description: string;
  tasks: TodayTaskItem[];
}) {
  return (
    <section className="space-y-4">
      <SectionHeader eyebrow="任务队列" title={title} description={description} />
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.task_id} task={task} />
        ))}
        {tasks.length === 0 ? (
          <div className="rounded-lg border border-line bg-white p-5 text-sm text-slate-500 shadow-panel">
            当前筛选条件下没有任务。
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function TasksPage() {
  const [data, setData] = useState<TasksApiResponse>(fallbackTasks);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("default");

  useEffect(() => {
    let active = true;

    fetch("/api/tasks", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: TasksApiResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(fallbackTasks);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredTasks = useMemo(() => {
    return sortTasks(
      data.all_tasks.filter((task) => {
        if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
        if (sourceFilter !== "all" && task.source_module !== sourceFilter) return false;
        return true;
      }),
      sortBy,
    );
  }, [data.all_tasks, priorityFilter, sortBy, sourceFilter]);

  const topTasks = filteredTasks.slice(0, 5);
  const highTasks = filteredTasks.filter((task) => task.priority === "high");
  const mediumTasks = filteredTasks.filter((task) => task.priority === "medium");
  const lowTasks = filteredTasks.filter((task) => task.priority === "low");
  const hasTaskData = data.overview.total_tasks > 0 || data.all_tasks.length > 0;

  const sourceChartItems = [
    { label: "库存中心", value: data.source_stats.inventory_tasks, color: "bg-forest" },
    { label: "利润中心", value: data.source_stats.profit_tasks, color: "bg-amber" },
    { label: "审批中心", value: data.source_stats.approval_tasks, color: "bg-coral" },
    { label: "数据分析", value: data.source_stats.analysis_tasks, color: "bg-slate-600" },
    { label: "机会中心", value: data.source_stats.opportunity_tasks, color: "bg-emerald-500" },
  ];

  const impactChartItems = [
    { label: "利润影响", value: data.impact_stats.total_profit_impact, color: "bg-forest" },
    { label: "GMV影响", value: data.impact_stats.total_gmv_impact, color: "bg-amber" },
    { label: "库存影响", value: data.impact_stats.total_inventory_impact, color: "bg-coral" },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-7 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                今日任务 V1.5
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {sourceLabel(data.source)}
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">今日任务</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                按优先级处理今天最重要的运营事项。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <KpiCard
              label="今日总任务"
              value={formatCount(data.overview.total_tasks)}
              detail="来自库存、利润、审批、分析和机会中心。"
              icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
            />
            <KpiCard
              label="高优先任务"
              value={formatCount(data.overview.high_priority_tasks)}
              detail="今天应该最先处理的任务。"
              icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
              tone="risk"
            />
          </div>
        </div>
      </section>

      <RealDataReadiness context="tasks" isEmpty={!hasTaskData} />

      <section className="space-y-5">
        <SectionHeader
          eyebrow="今日任务总览"
          title="先看今天任务压力和经营影响"
          description="总览用于快速判断今天任务量、优先级结构，以及这些任务对利润、GMV 和库存的预计影响。"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="总任务" value={formatCount(data.overview.total_tasks)} detail="今日生成的全部任务。" icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />} />
          <KpiCard label="高优先级" value={formatCount(data.overview.high_priority_tasks)} detail="需要最先处理。" icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />} tone="risk" />
          <KpiCard label="预计利润影响" value={formatBrl(data.overview.estimated_profit_impact)} detail="预计可保护或提升的利润。" icon={<DollarSign className="h-5 w-5" aria-hidden="true" />} tone="good" />
          <KpiCard label="库存影响" value={formatCount(data.overview.estimated_inventory_impact)} detail="预计受影响的库存项。" icon={<Boxes className="h-5 w-5" aria-hidden="true" />} tone="warn" />
        </div>
        <ColumnSettingsNote hiddenFields={["中优先级任务数", "低优先级任务数", "销售影响明细", "完整库存影响"]} />
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
              筛选与排序
            </div>
            <h2 className="mt-2 text-lg font-semibold text-ink">把今天任务缩小到能立刻处理的范围</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              可以按优先级和来源模块过滤，也可以按利润、风险、库存或 GMV 影响排序。
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-ink">
            <Filter className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">按优先级过滤</span>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="all">全部优先级</option>
              <option value="high">高优先级</option>
              <option value="medium">中优先级</option>
              <option value="low">低优先级</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">按来源模块过滤</span>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="all">全部来源</option>
              <option value="inventory">库存中心</option>
              <option value="profit">利润中心</option>
              <option value="approval">审批中心</option>
              <option value="analysis">数据分析</option>
              <option value="opportunity">机会中心</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">排序方式</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortKey)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="default">默认：利润、风险、库存、GMV</option>
              <option value="profit">按预计利润影响</option>
              <option value="risk">按风险等级</option>
              <option value="inventory">按库存影响</option>
              <option value="gmv">按GMV影响</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="今日TOP5任务"
          title="老板今天先看的 5 件事"
          description="TOP5 按预计利润影响、风险等级、库存影响和 GMV 影响排序。每条任务都可以点击跳转到对应中心人工处理。"
        />

        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="operator-scroll hidden lg:block">
            <table className="operator-table text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th>排名</th>
                  <th>任务</th>
                  <th>状态</th>
                  <th>优先级</th>
                  <th>利润影响</th>
                  <th>处理入口</th>
                </tr>
              </thead>
              <tbody>
                {topTasks.map((task, index) => (
                  <tr key={task.task_id}>
                    <td className="text-lg font-semibold text-ink">#{index + 1}</td>
                    <td>
                      <Link href={task.href} className="font-semibold text-ink hover:text-forest">
                        {task.task_title}
                      </Link>
                      <div className="mt-1 text-xs text-slate-500">{taskTypeLabel(task.task_type)} · {sourceModuleLabel(task.source_module)}</div>
                    </td>
                    <td>
                      <span className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium ${taskStatusBadge(task)}`}>
                        {taskStatusLabel(task)}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium ${priorityBadge(task.priority)}`}>
                        {priorityLabel(task.priority)}
                      </span>
                    </td>
                    <td className="font-semibold text-ink">{formatBrl(task.estimated_profit_impact)}</td>
                    <td>
                      <Link href={task.href} className="inline-flex h-8 items-center rounded-md bg-forest px-3 text-xs font-semibold text-white">
                        处理
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 lg:hidden">
            {topTasks.map((task, index) => (
              <div key={task.task_id} className="relative">
                <div className="absolute left-3 top-3 z-[1] rounded-md bg-forest px-2 py-1 text-xs font-semibold text-white">
                  #{index + 1}
                </div>
                <div className="pt-8">
                  <TaskCard task={task} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <TaskGroup
        title="高优先级任务"
        description="来自库存、利润、审批、分析和机会中心的高风险、高利润影响或高经营影响任务。"
        tasks={highTasks}
      />

      <TaskGroup
        title="中优先级任务"
        description="需要今天进入处理队列，但可以排在高优先级任务之后。"
        tasks={mediumTasks}
      />

      <TaskGroup
        title="低优先级任务"
        description="适合观察、记录或作为下一轮运营复核的任务。"
        tasks={lowTasks}
      />

      <section className="space-y-5">
        <SectionHeader
          eyebrow="AI建议"
          title="AI建议不等于自动执行"
          description="这里的建议来自本地规则引擎和真实业务数据。所有建议必须人工审核，不能自动上传、调价、补货或投广告。"
        />

        <div className="grid gap-4 xl:grid-cols-2">
          {data.ai_recommendations.map((item) => (
            <Link
              key={item.recommendation_id}
              href={item.href}
              className="rounded-lg border border-line bg-white p-5 shadow-panel transition hover:border-forest/40 hover:shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
                    {item.recommendation_type}
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-ink">{item.recommendation_summary}</h3>
                </div>
                <span className="inline-flex h-7 items-center rounded-md border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber">
                  需要人工审核
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.recommendation_reason}</p>
              <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                预期收益：{item.expected_benefit}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
                任务来源统计
              </div>
              <h2 className="mt-2 text-xl font-semibold text-ink">任务从哪里来</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                用于判断今天是库存压力、利润压力、审批堵点，还是机会跟进更多。
              </p>
            </div>
            <BarChart3 className="h-5 w-5 text-slate-500" aria-hidden="true" />
          </div>
          <div className="mt-5">
            <BarList items={sourceChartItems} />
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
                任务影响统计
              </div>
              <h2 className="mt-2 text-xl font-semibold text-ink">任务会影响什么</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                用于判断今天处理任务主要是在保护利润、拉动GMV，还是降低库存风险。
              </p>
            </div>
            <Target className="h-5 w-5 text-slate-500" aria-hidden="true" />
          </div>
          <div className="mt-5">
            <BarList
              items={impactChartItems}
              valueFormatter={(value) => (value > 1000 ? formatBrl(value) : formatCount(value))}
            />
          </div>
        </section>
      </section>

    </div>
  );
}
