"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, Database, Gauge, Server } from "lucide-react";
import { emptySystemHealthResponse } from "@/data/emptyResponses";
import { readStoredUser } from "@/lib/permissions";
import type { ApiHealthCheckItem, SystemHealthApiResponse, UserItem } from "@/types";

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
    error: "系统健康服务暂不可用。",
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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ok: "正常",
    fail: "异常",
    high: "高风险",
    medium: "中风险",
    low: "低风险",
  };

  return labels[status] ?? status;
}

function dataSourceLabel(source: ApiHealthCheckItem["data_source"] | SystemHealthApiResponse["source"]) {
  if (source === "sqlite") return "数据正常";
  if (source === "mock") return "测试数据";
  return "待确认";
}

function scoreTone(score: number) {
  if (score >= 85) return "good";
  if (score >= 65) return "warn";
  return "risk";
}

function toneClass(tone: "good" | "warn" | "risk" | "neutral") {
  return {
    good: "border-emerald-200 bg-emerald-50 text-forest",
    warn: "border-amber-200 bg-amber-50 text-amber",
    risk: "border-rose-200 bg-rose-50 text-coral",
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
  }[tone];
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "ok" || status === "low" ? "good" : status === "medium" ? "warn" : "risk";

  return (
    <span className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-medium ${toneClass(tone)}`}>
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
          <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${toneClass(tone)}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{detail}</p>
    </article>
  );
}

function riskSummary(apiFailCount: number, mismatchCount: number, score: number) {
  if (apiFailCount === 0 && mismatchCount === 0 && score >= 85) return "暂无明显风险";
  if (apiFailCount > 0) return "部分服务需要检查";
  if (mismatchCount > 0) return "任务与业务数据需要复核";
  return "系统评分偏低，建议管理员查看诊断";
}

export default function SystemHealthPage() {
  const [data, setData] = useState<SystemHealthApiResponse>(fallbackHealth);
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null);

  useEffect(() => {
    let active = true;
    const syncUser = () => setCurrentUser(readStoredUser());

    syncUser();
    window.addEventListener("storage", syncUser);
    window.addEventListener("baico-auth-change", syncUser);

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
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("baico-auth-change", syncUser);
    };
  }, []);

  const isAdmin = currentUser?.roles.includes("admin") ?? false;
  const serviceOkCount = data.api_health.filter((item) => item.status === "ok").length;
  const serviceFailCount = data.api_health.length - serviceOkCount;
  const mismatchCount = data.data_consistency.reduce((sum, item) => sum + item.mismatch_count, 0);
  const dataNormal = data.data_source_status.sqlite_available || data.source === "sqlite";
  const riskText = riskSummary(serviceFailCount, mismatchCount, data.system_health_score);
  const scoreItems = useMemo(
    () => [
      ["api_failure_rate", data.score_breakdown.api_failure_rate],
      ["data_missing_rate", data.score_breakdown.data_missing_rate],
      ["mock_ratio", data.score_breakdown.mock_ratio],
      ["task_anomaly_rate", data.score_breakdown.task_anomaly_rate],
    ],
    [data.score_breakdown],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="grid gap-5 lg:grid-cols-[1fr_280px] lg:items-center">
          <div>
            <div className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
              系统健康
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">系统是否正常</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              默认只展示运营结论；详细诊断保留给管理员排查使用。
            </p>
          </div>
          <div className="rounded-lg border border-line bg-slate-50 p-4">
            <div className="text-sm text-slate-500">系统评分</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-4xl font-semibold text-ink">{data.system_health_score}</span>
              <div className={`flex h-12 w-12 items-center justify-center rounded-md ${toneClass(scoreTone(data.system_health_score))}`}>
                <Gauge className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="系统状态"
          value={serviceFailCount === 0 ? "正常" : "需检查"}
          detail={`${serviceOkCount}/${data.api_health.length} 个核心服务正常。`}
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
          tone={serviceFailCount === 0 ? "good" : "warn"}
        />
        <KpiCard
          label="数据状态"
          value={dataNormal ? "正常" : "待确认"}
          detail="用于判断页面数据是否可用。"
          icon={<Database className="h-5 w-5" aria-hidden="true" />}
          tone={dataNormal ? "good" : "warn"}
        />
        <KpiCard
          label="最近更新时间"
          value={formatDateTime(data.generated_at)}
          detail="健康状态的生成时间。"
          icon={<Activity className="h-5 w-5" aria-hidden="true" />}
        />
        <KpiCard
          label="风险提示"
          value={riskText}
          detail="用于判断是否需要管理员介入。"
          icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
          tone={riskText === "暂无明显风险" ? "good" : "warn"}
        />
        <KpiCard
          label="一致性"
          value={mismatchCount === 0 ? "正常" : `${mismatchCount} 项`}
          detail="检查任务与库存、利润、审批信号是否一致。"
          icon={<Server className="h-5 w-5" aria-hidden="true" />}
          tone={mismatchCount === 0 ? "good" : "warn"}
        />
      </section>

      {isAdmin ? (
        <details className="group rounded-lg border border-line bg-white shadow-panel">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink">
            高级诊断
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-5 border-t border-line p-4">
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="system_mode"
                value={data.production_runtime.system_mode}
                detail={`server: ${data.production_runtime.server_instance_id}`}
                icon={<Server className="h-5 w-5" aria-hidden="true" />}
              />
              <KpiCard
                label="scheduler"
                value={data.production_runtime.scheduler_running_status}
                detail={`cycles ${data.production_runtime.scheduler.cycle_count}, retries ${data.production_runtime.scheduler.retry_count}`}
                icon={<Activity className="h-5 w-5" aria-hidden="true" />}
              />
              <KpiCard
                label="database detail"
                value={data.production_runtime.database.connection_status}
                detail={`mode ${data.production_runtime.database.active_mode}, schema ${data.production_runtime.database.schema_compatible ? "ok" : "check"}`}
                icon={<Database className="h-5 w-5" aria-hidden="true" />}
              />
              <KpiCard
                label="API latency / cache hit"
                value={`${data.production_runtime.api_latency_ms} ms`}
                detail={`cache hit ${Math.round(data.production_runtime.cache_hit_rate * 100)}%, trace_id ${data.production_runtime.production_trace_id}`}
                icon={<Gauge className="h-5 w-5" aria-hidden="true" />}
              />
            </section>

            <section className="rounded-lg border border-line bg-white shadow-panel">
              <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">核心 API 检查</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">API</th>
                      <th className="px-4 py-3">状态</th>
                      <th className="px-4 py-3">API latency</th>
                      <th className="px-4 py-3">数据来源</th>
                      <th className="px-4 py-3">更新时间</th>
                      <th className="px-4 py-3">说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.api_health.map((item) => (
                      <tr key={item.endpoint} className="border-t border-line">
                        <td className="px-4 py-3 font-medium text-ink">{item.endpoint}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-3">{item.response_time} ms</td>
                        <td className="px-4 py-3">{dataSourceLabel(item.data_source)}</td>
                        <td className="px-4 py-3">{formatDateTime(item.last_updated)}</td>
                        <td className="px-4 py-3 text-slate-500">{item.error ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-line bg-white p-4 shadow-panel">
                <h2 className="text-base font-semibold text-ink">score breakdown</h2>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  {scoreItems.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
                      <span>{label}</span>
                      <span className="font-medium text-ink">{Math.round(Number(value) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-line bg-white p-4 shadow-panel">
                <h2 className="text-base font-semibold text-ink">operation_logs 摘要</h2>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  {data.logs.length === 0 ? (
                    <div className="rounded-md bg-slate-50 px-3 py-2">暂无日志摘要。</div>
                  ) : (
                    data.logs.slice(0, 5).map((item) => (
                      <div key={item.log_id} className="rounded-md bg-slate-50 px-3 py-2">
                        <div className="font-medium text-ink">{item.message}</div>
                        <div className="mt-1 text-xs text-slate-500">{formatDateTime(item.created_at)}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        </details>
      ) : null}
    </div>
  );
}
