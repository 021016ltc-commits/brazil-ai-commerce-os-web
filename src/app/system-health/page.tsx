"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Gauge,
  ListChecks,
  Server,
  ShieldCheck,
} from "lucide-react";
import { emptySystemHealthResponse } from "@/data/emptyResponses";
import type {
  ApiHealthCheckItem,
  DataConsistencyCheck,
  SystemHealthApiResponse,
  SystemLogSummaryItem,
} from "@/types";
import { sourceModuleLabel } from "@/locales/zh-CN";

const observedEndpoints = [
  "/api/dashboard-summary",
  "/api/tasks",
  "/api/opportunities",
  "/api/analysis",
  "/api/profit",
  "/api/inventory",
  "/api/approvals",
];

const fallbackHealth: SystemHealthApiResponse = {
  ...emptySystemHealthResponse,
  api_health: observedEndpoints.map((endpoint) => ({
    endpoint,
    status: "fail",
    response_time: 0,
    data_source: "unknown",
    last_updated: "",
    error: "系统健康接口暂不可用，未加载测试数据。",
  })),
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatRate(value: number) {
  return `${Math.round(value * 100)}%`;
}

function sourceLabel(source: SystemHealthApiResponse["source"] | ApiHealthCheckItem["data_source"]) {
  if (source === "sqlite") return "真实数据";
  if (source === "mock") return "测试数据已禁用";
  return "未知";
}

function consistencyCheckLabel(checkName: string) {
  const labels: Record<string, string> = {
    inventory_to_tasks: "库存任务一致性",
    profit_to_tasks: "利润任务一致性",
    approvals_to_tasks: "审批任务一致性",
  };
  return labels[checkName] ?? checkName;
}

function logTypeLabel(logType: string) {
  const labels: Record<string, string> = {
    task_generated: "任务生成",
    approval_action: "审批操作",
    inventory_update: "库存更新",
  };
  return labels[logType] ?? logType;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ok: "正常",
    fail: "失败",
    high: "高",
    medium: "中",
    low: "低",
    pending_review: "待审批",
    approved_local: "已批准",
    rejected_local: "已拒绝",
    deferred_local: "已延后",
  };

  return labels[status] ?? status;
}

function toneClass(tone: "good" | "warn" | "risk" | "neutral") {
  return {
    good: "border-emerald-200 bg-emerald-50 text-forest",
    warn: "border-amber-200 bg-amber-50 text-amber",
    risk: "border-rose-200 bg-rose-50 text-coral",
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
  }[tone];
}

function statusTone(status: string) {
  if (["ok", "low", "approved_local"].includes(status)) return "good";
  if (["medium", "pending_review", "deferred_local"].includes(status)) return "warn";
  if (["fail", "high", "rejected_local"].includes(status)) return "risk";
  return "neutral";
}

function scoreTone(score: number) {
  if (score >= 85) return "good";
  if (score >= 65) return "warn";
  return "risk";
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
        <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium ${toneClass(statusTone(status))}`}>
      {statusLabel(status)}
    </span>
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
  tone?: "good" | "warn" | "risk" | "neutral";
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-600">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-ink">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${toneClass(tone)}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{detail}</p>
    </article>
  );
}

function BarList({
  items,
}: {
  items: Array<{ label: string; value: number; description: string }>;
}) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label} className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-ink">{item.label}</span>
            <span className="text-slate-500">{formatRate(item.value)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-md bg-slate-100">
            <div
              className="h-full rounded-md bg-forest"
              style={{ width: `${Math.max(4, Math.min(100, item.value * 100))}%` }}
            />
          </div>
          <p className="text-xs leading-5 text-slate-500">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

function ConsistencyCard({ check }: { check: DataConsistencyCheck }) {
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
            {consistencyCheckLabel(check.check_name)}
          </div>
          <h3 className="mt-2 text-lg font-semibold text-ink">{check.label}</h3>
        </div>
        <Badge status={check.severity} />
      </div>

      <div className="mt-4 rounded-md bg-slate-50 px-3 py-2">
        <div className="text-xs uppercase tracking-wide text-slate-400">不一致数量</div>
        <div className="mt-1 text-2xl font-semibold text-ink">{check.mismatch_count}</div>
      </div>

      <div className="mt-4 space-y-3">
        {check.mismatch_items.length === 0 ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-forest">
            未发现不一致，当前模块与任务中心保持一致。
          </div>
        ) : (
          check.mismatch_items.map((item) => (
            <div key={item.check_id} className="rounded-md border border-line px-3 py-2 text-sm">
              <div className="font-medium text-ink">{item.item_id}</div>
              <div className="mt-1 text-slate-500">{item.reason}</div>
              <div className="mt-1 text-xs text-slate-400">
                {sourceModuleLabel(item.source)} → {sourceModuleLabel(item.target)} / 期望来源：{sourceModuleLabel(item.expected_task_source)}
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function LogItem({ item }: { item: SystemLogSummaryItem }) {
  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
            {logTypeLabel(item.log_type)}
          </div>
          <h3 className="mt-2 text-sm font-semibold text-ink">{item.message}</h3>
          <div className="mt-1 text-xs text-slate-500">
            {sourceModuleLabel(item.source_module)} / {formatDateTime(item.created_at)}
          </div>
        </div>
        <Badge status={item.status} />
      </div>
    </article>
  );
}

export default function SystemHealthPage() {
  const [data, setData] = useState<SystemHealthApiResponse>(fallbackHealth);

  useEffect(() => {
    let active = true;

    fetch("/api/system-health", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: SystemHealthApiResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(fallbackHealth);
      });

    return () => {
      active = false;
    };
  }, []);

  const apiOkCount = data.api_health.filter((item) => item.status === "ok").length;
  const apiFailCount = data.api_health.filter((item) => item.status === "fail").length;
  const mismatchCount = data.data_consistency.reduce((sum, item) => sum + item.mismatch_count, 0);
  const scoreItems = useMemo(
    () => [
      {
        label: "接口失败率",
        value: data.score_breakdown.api_failure_rate,
        description: "接口调用失败越多，健康分扣分越多。",
      },
      {
        label: "数据缺失率",
        value: data.score_breakdown.data_missing_rate,
        description: "核心接口返回空数据会增加缺失率。",
      },
      {
        label: "测试数据比例",
        value: data.score_breakdown.mock_ratio,
        description: "生产口径下测试数据禁用；若出现比例升高，说明环境配置需要检查。",
      },
      {
        label: "任务异常率",
        value: data.score_breakdown.task_anomaly_rate,
        description: "库存、利润、审批到任务中心的映射不一致会提高异常率。",
      },
    ],
    [data.score_breakdown],
  );

  return (
    <div className="space-y-10">
      <section className="rounded-lg border border-line bg-white p-5 shadow-panel sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                系统健康 V1
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {sourceLabel(data.source)}
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                只读监控，不自动执行
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                系统健康
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                这个页面用于检查接口是否正常、数据源是否回退、任务生成是否和库存/利润/审批保持一致。
                它只做观测和报警，不连接外部平台，不执行任何真实业务动作。
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  系统健康评分
                </div>
                <div className="mt-2 text-5xl font-semibold text-ink">{data.system_health_score}</div>
                <p className="mt-2 text-sm text-slate-500">
                  生成时间：{formatDateTime(data.generated_at)}
                </p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-md ${toneClass(scoreTone(data.system_health_score))}`}>
                <Gauge className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-md bg-slate-100">
              <div
                className={`h-full rounded-md ${
                  data.system_health_score >= 85
                    ? "bg-forest"
                    : data.system_health_score >= 65
                      ? "bg-amber"
                      : "bg-coral"
                }`}
                style={{ width: `${data.system_health_score}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="接口正常数量"
          value={`${apiOkCount}/${data.api_health.length}`}
          detail="被监控接口中当前可正常返回的数量。"
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
          tone="good"
        />
        <KpiCard
          label="接口失败数量"
          value={`${apiFailCount}`}
          detail="接口失败会直接拉低系统健康评分。"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
          tone={apiFailCount > 0 ? "risk" : "neutral"}
        />
        <KpiCard
          label="一致性异常"
          value={`${mismatchCount}`}
          detail="检查库存、利润、审批是否正确生成任务。"
          icon={<ListChecks className="h-5 w-5" aria-hidden="true" />}
          tone={mismatchCount > 0 ? "warn" : "good"}
        />
        <KpiCard
          label="测试数据"
          value={data.data_source_status.mock_fallback_active ? "启用" : "未启用"}
          detail="生产口径下应保持禁用，只展示真实数据或空状态。"
          icon={<Database className="h-5 w-5" aria-hidden="true" />}
          tone={data.data_source_status.mock_fallback_active ? "warn" : "good"}
        />
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="生产运行状态"
          title="部署环境、调度器、数据库和缓存"
          description="用于确认系统是否以 production 模式运行、调度器是否恢复、数据库是否连接、缓存是否命中，以及最近一个周期是否正常完成。"
        />
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="生产模式"
            value={data.production_runtime.production_mode_status === "active" ? "已启用" : "未启用"}
            detail={`SYSTEM_MODE=${data.production_runtime.system_mode}，当前实例 ${data.production_runtime.server_instance_id}`}
            icon={<Server className="h-5 w-5" aria-hidden="true" />}
            tone={data.production_runtime.production_mode_status === "active" ? "good" : "neutral"}
          />
          <KpiCard
            label="Scheduler"
            value={data.production_runtime.scheduler_running_status === "disabled" ? "未启用" : data.production_runtime.scheduler.cron_active ? "运行中" : "待恢复"}
            detail={`周期 ${data.production_runtime.scheduler.cycle_count} 次，重试 ${data.production_runtime.scheduler.retry_count} 次。`}
            icon={<Activity className="h-5 w-5" aria-hidden="true" />}
            tone={data.production_runtime.scheduler.cron_active ? "good" : "warn"}
          />
          <KpiCard
            label="数据库连接"
            value={data.production_runtime.database.connection_status === "connected" ? "已连接" : data.production_runtime.database.connection_status === "fallback" ? "Fallback" : "失败"}
            detail={`当前 ${data.production_runtime.database.active_mode}，兼容检查 ${data.production_runtime.database.schema_compatible ? "通过" : "待处理"}。`}
            icon={<Database className="h-5 w-5" aria-hidden="true" />}
            tone={data.production_runtime.database.connection_status === "failed" ? "risk" : data.production_runtime.database.connection_status === "fallback" ? "warn" : "good"}
          />
          <KpiCard
            label="缓存命中率"
            value={formatRate(data.production_runtime.cache_hit_rate)}
            detail={`API延迟 ${data.production_runtime.api_latency_ms} ms，最近周期 ${data.production_runtime.last_cycle_runtime_ms ?? 0} ms。`}
            icon={<Gauge className="h-5 w-5" aria-hidden="true" />}
            tone={data.production_runtime.cache_hit_rate >= 0.5 ? "good" : "neutral"}
          />
        </section>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="接口健康检查"
          title="接口是否正常返回"
          description="检查核心业务接口的返回状态、响应时间、数据来源和最近更新时间。这里不调用外部接口，只检查本地系统接口。"
        />
        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">接口</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">响应时间</th>
                  <th className="px-4 py-3">数据来源</th>
                  <th className="px-4 py-3">最近更新时间</th>
                  <th className="px-4 py-3">错误信息</th>
                </tr>
              </thead>
              <tbody>
                {data.api_health.map((item) => (
                  <tr key={item.endpoint} className="border-t border-line">
                    <td className="px-4 py-3 font-medium text-ink">{item.endpoint}</td>
                    <td className="px-4 py-3">
                      <Badge status={item.status} />
                    </td>
                    <td className="px-4 py-3">{item.response_time} ms</td>
                    <td className="px-4 py-3">{sourceLabel(item.data_source)}</td>
                    <td className="px-4 py-3">{formatDateTime(item.last_updated)}</td>
                    <td className="px-4 py-3 text-slate-500">{item.error ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="数据一致性检查"
          title="模块信号是否正确进入任务中心"
          description="检查 inventory、profit、approvals 中应生成任务的信号，是否已经出现在 /tasks。异常只提示，不自动修复。"
        />
        <div className="grid gap-4 xl:grid-cols-3">
          {data.data_consistency.map((check) => (
            <ConsistencyCard key={check.check_name} check={check} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
                数据源状态
              </div>
              <h2 className="mt-2 text-xl font-semibold text-ink">真实数据源状态</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                用于判断当前真实数据源是否可用；测试数据已默认禁用。
              </p>
            </div>
            <Server className="h-5 w-5 text-slate-500" aria-hidden="true" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">本地数据库可用</div>
              <div className="mt-2">
                <Badge status={data.data_source_status.sqlite_available ? "ok" : "fail"} />
              </div>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">测试数据启用</div>
              <div className="mt-2">
                <Badge status={data.data_source_status.mock_fallback_active ? "medium" : "low"} />
              </div>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-400">最近初始化时间</div>
              <div className="mt-2 text-sm font-semibold text-ink">
                {formatDateTime(data.data_source_status.last_db_init_time)}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
                健康评分拆解
              </div>
              <h2 className="mt-2 text-xl font-semibold text-ink">为什么是这个分数</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                评分依据接口失败率、数据缺失率、测试数据比例和任务异常率综合计算。
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 text-slate-500" aria-hidden="true" />
          </div>
          <div className="mt-5">
            <BarList items={scoreItems} />
          </div>
        </section>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="日志摘要"
          title="最近任务、审批和库存事件"
          description="展示最近的任务生成、审批操作和库存风险更新，帮助判断系统是否在持续产生日常运营信号。"
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {data.logs.length === 0 ? (
            <div className="rounded-lg border border-line bg-white p-5 text-sm text-slate-500 shadow-panel">
              暂无日志摘要。
            </div>
          ) : (
            data.logs.map((item) => <LogItem key={item.log_id} item={item} />)
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="flex items-start gap-3">
          <Activity className="mt-1 h-5 w-5 text-forest" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-ink">监控层边界</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              系统健康只读取现有接口和本地数据结构，不接外部平台，不接真实 AI，不开发爬虫，
              不修改商品、不改价、不补货、不执行审批后的平台动作。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
