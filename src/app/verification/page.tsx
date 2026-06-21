"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Gauge,
  Server,
} from "lucide-react";
import { emptyVerificationResponse } from "@/data/emptyResponses";
import { readStoredUser } from "@/lib/permissions";
import type {
  UserItem,
  VerificationApiHealthItem,
  VerificationModuleCheck,
  VerificationStatus,
  VerificationStatusApiResponse,
} from "@/types";

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function sourceLabel(source: VerificationModuleCheck["data_source"]) {
  if (source === "sqlite") return "数据正常";
  if (source === "mock") return "测试数据";
  if (source === "shopee_api") return "平台只读数据";
  return "待确认";
}

function verificationStatusLabel(status: VerificationStatus | "YES" | "NO") {
  if (status === "YES") return "可用";
  if (status === "NO") return "不可用";
  return status;
}

function toneClass(status: VerificationStatus | "YES" | "NO" | "good" | "warn" | "risk") {
  if (status === "正常" || status === "YES" || status === "good") return "border-emerald-200 bg-emerald-50 text-forest";
  if (status === "延迟" || status === "warn") return "border-amber-200 bg-amber-50 text-amber";
  return "border-rose-200 bg-rose-50 text-coral";
}

function StatusBadge({ status }: { status: VerificationStatus | "YES" | "NO" }) {
  return (
    <span className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-semibold ${toneClass(status)}`}>
      {verificationStatusLabel(status)}
    </span>
  );
}

function statusIcon(status: VerificationStatus) {
  if (status === "正常") return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
  if (status === "延迟") return <Clock3 className="h-4 w-4" aria-hidden="true" />;
  return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
}

function KpiCard({
  title,
  value,
  detail,
  icon,
  tone = "neutral",
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: "good" | "warn" | "risk" | "neutral";
}) {
  const iconTone = tone === "neutral" ? "border-slate-200 bg-slate-50 text-slate-600" : toneClass(tone);

  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-600">{title}</div>
          <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-md border ${iconTone}`}>
          {icon}
        </div>
      </div>
    </article>
  );
}

function ModuleRow({ item }: { item: VerificationModuleCheck }) {
  return (
    <Link
      href={item.href}
      className="flex items-center justify-between gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm transition hover:border-forest"
    >
      <div className="min-w-0">
        <div className="truncate font-medium text-ink">{item.module_name}</div>
        <div className="mt-0.5 text-xs text-slate-500">{sourceLabel(item.data_source)}</div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={item.status} />
        <ArrowRight className="h-4 w-4 text-forest" aria-hidden="true" />
      </div>
    </Link>
  );
}

function ApiRow({ item }: { item: VerificationApiHealthItem }) {
  return (
    <tr className="border-t border-line align-top">
      <td className="px-4 py-3 font-medium text-ink">{item.endpoint}</td>
      <td className="px-4 py-3">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-4 py-3 text-slate-700">{item.response_time} ms</td>
      <td className="px-4 py-3 text-slate-700">{sourceLabel(item.data_source)}</td>
      <td className="px-4 py-3 text-slate-700">{formatDateTime(item.last_updated)}</td>
      <td className="px-4 py-3 text-slate-500">{item.notes}</td>
    </tr>
  );
}

export default function VerificationPage() {
  const [data, setData] = useState<VerificationStatusApiResponse>(emptyVerificationResponse);
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null);

  useEffect(() => {
    let active = true;
    const syncUser = () => setCurrentUser(readStoredUser());

    syncUser();
    window.addEventListener("storage", syncUser);
    window.addEventListener("baico-auth-change", syncUser);

    fetch("/api/verification/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: VerificationStatusApiResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(emptyVerificationResponse);
      });

    return () => {
      active = false;
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("baico-auth-change", syncUser);
    };
  }, []);

  const isAdmin = currentUser?.roles.includes("admin") ?? false;
  const statusCounts = useMemo(() => {
    return data.modules.reduce(
      (acc, item) => {
        acc[item.status] += 1;
        return acc;
      },
      { 正常: 0, 延迟: 0, 异常: 0 } as Record<VerificationStatus, number>,
    );
  }, [data.modules]);

  const apiNormalCount = data.api_health.filter((item) => item.status === "正常").length;
  const coreModules = data.modules.slice(0, 8);
  const coreApis = data.api_health.slice(0, 7);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="grid gap-5 lg:grid-cols-[1fr_280px] lg:items-center">
          <div>
            <div className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
              系统验收
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">系统验收</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              检查核心页面和服务是否可用。
            </p>
          </div>
          <div className="rounded-lg border border-line bg-slate-50 p-4">
            <div className="text-sm text-slate-500">当前系统是否可用</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-4xl font-semibold text-ink">
                {verificationStatusLabel(data.runtime_summary.system_available)}
              </span>
              <StatusBadge status={data.runtime_summary.system_available} />
            </div>
            <p className="mt-2 text-xs text-slate-500">最近更新时间：{formatDateTime(data.generated_at)}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="核心页面检查"
          value={`${statusCounts.正常}/${data.modules.length}`}
          detail={`延迟 ${statusCounts.延迟} 个，异常 ${statusCounts.异常} 个。`}
          icon={<Server className="h-5 w-5" aria-hidden="true" />}
          tone={statusCounts.异常 === 0 ? "good" : "risk"}
        />
        <KpiCard
          title="核心服务检查"
          value={`${apiNormalCount}/${data.api_health.length}`}
          detail="检查运营总览、任务、执行、店铺、系统健康等关键服务。"
          icon={<Gauge className="h-5 w-5" aria-hidden="true" />}
          tone={apiNormalCount === data.api_health.length ? "good" : "warn"}
        />
        <KpiCard
          title="数据一致性"
          value={data.runtime_summary.data_consistency_status}
          detail="复用系统健康中的任务一致性检查。"
          icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
          tone={data.runtime_summary.data_consistency_status === "正常" ? "good" : "warn"}
        />
        <KpiCard
          title="上线结论"
          value={data.verification_mode.existing_system_affected === "NO" ? "可上线" : "需复核"}
          detail={data.verification_mode.impact_scope}
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
          tone={data.verification_mode.existing_system_affected === "NO" ? "good" : "risk"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-4 shadow-panel">
          <h2 className="text-base font-semibold text-ink">核心页面</h2>
          <div className="mt-3 grid gap-2">
            {coreModules.map((item) => (
              <ModuleRow key={item.module_id} item={item} />
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-panel">
          <h2 className="text-base font-semibold text-ink">核心服务</h2>
          <div className="mt-3 grid gap-2">
            {coreApis.map((item) => (
              <div key={item.endpoint} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink">{item.endpoint}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{sourceLabel(item.data_source)}</div>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {isAdmin ? (
        <details className="group rounded-lg border border-line bg-white shadow-panel">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink">
            验收明细
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-5 border-t border-line p-4">
            <section>
              <h2 className="text-base font-semibold text-ink">全部模块检查</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.modules.map((item) => (
                  <Link
                    key={item.module_id}
                    href={item.href}
                    className="group rounded-lg border border-line bg-white p-4 shadow-panel transition hover:border-forest"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {item.module_id}
                        </div>
                        <h3 className="mt-2 truncate text-base font-semibold text-ink">{item.module_name}</h3>
                      </div>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${toneClass(item.status)}`}>
                        {statusIcon(item.status)}
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{item.notes}</p>
                    <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-forest">
                      进入模块
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-white shadow-panel">
              <div className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">详细 API 检查</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">API</th>
                      <th className="px-4 py-3">状态</th>
                      <th className="px-4 py-3">响应时间</th>
                      <th className="px-4 py-3">数据来源</th>
                      <th className="px-4 py-3">最近更新时间</th>
                      <th className="px-4 py-3">说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.api_health.map((item) => (
                      <ApiRow key={item.endpoint} item={item} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
              <h2 className="text-base font-semibold text-ink">验收模式</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">当前版本</div>
                  <div className="mt-2 text-sm font-semibold text-ink">{data.verification_mode.current_version}</div>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">本次模块</div>
                  <div className="mt-2 text-sm leading-6 text-ink">{data.verification_mode.newly_added_module}</div>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">是否影响已有系统</div>
                  <div className="mt-2">
                    <StatusBadge status={data.verification_mode.existing_system_affected} />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </details>
      ) : null}
    </div>
  );
}
