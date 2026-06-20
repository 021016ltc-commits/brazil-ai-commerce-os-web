"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Gauge,
  Server,
} from "lucide-react";
import { emptyVerificationResponse } from "@/data/emptyResponses";
import type {
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
  if (source === "sqlite") return "真实数据";
  if (source === "mock") return "测试数据已禁用";
  if (source === "shopee_api") return "Shopee只读接口";
  return "未知";
}

function verificationStatusLabel(status: VerificationStatus | "YES" | "NO") {
  if (status === "YES") return "是";
  if (status === "NO") return "否";
  return status;
}

function toneClass(status: VerificationStatus | "YES" | "NO") {
  if (status === "正常" || status === "YES") return "border-emerald-200 bg-emerald-50 text-forest";
  if (status === "延迟") return "border-amber-200 bg-amber-50 text-amber";
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
  const iconTone = {
    good: "border-emerald-200 bg-emerald-50 text-forest",
    warn: "border-amber-200 bg-amber-50 text-amber",
    risk: "border-rose-200 bg-rose-50 text-coral",
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
  }[tone];

  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-600">{title}</div>
          <div className="mt-2 text-3xl font-semibold text-ink">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-md border ${iconTone}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{detail}</p>
    </article>
  );
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

function ModuleCard({ item }: { item: VerificationModuleCheck }) {
  return (
    <Link
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
      <div className="mt-4 grid gap-2 text-sm text-slate-600">
        <div className="flex items-center justify-between gap-3">
          <span>状态</span>
          <StatusBadge status={item.status} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>响应时间</span>
          <span className="font-medium text-ink">{item.response_time} ms</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>数据源</span>
          <span className="font-medium text-ink">{sourceLabel(item.data_source)}</span>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{item.notes}</p>
      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-forest">
        进入模块
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
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

  useEffect(() => {
    let active = true;

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
    };
  }, []);

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

  return (
    <div className="space-y-9">
      <section className="rounded-lg border border-line bg-white p-5 shadow-panel sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                验收检查
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {data.verification_mode.current_version}
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                只检测，不执行
              </span>
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                系统验收
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                这里是每次更新后的统一验收入口，用来确认核心页面、关键 API、数据来源和任务一致性是否正常。所有按钮只负责打开模块或读取状态，不会触发任何自动执行。
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  系统是否可用
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-5xl font-semibold text-ink">
                    {verificationStatusLabel(data.runtime_summary.system_available)}
                  </span>
                  <StatusBadge status={data.runtime_summary.system_available} />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  生成时间：{formatDateTime(data.generated_at)} / 数据源：{data.source === "sqlite" ? "真实数据" : "测试数据已禁用"}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-forest">
                <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="模块完整度"
          value={`${data.runtime_summary.module_completeness}%`}
          detail={`${data.modules.length} 个模块纳入验收清单，正常 ${statusCounts.正常} 个，延迟 ${statusCounts.延迟} 个，异常 ${statusCounts.异常} 个。`}
          icon={<Server className="h-5 w-5" aria-hidden="true" />}
          tone={data.runtime_summary.module_completeness >= 90 ? "good" : "warn"}
        />
        <KpiCard
          title="接口健康评分"
          value={`${data.runtime_summary.api_health_score}`}
          detail={`${apiNormalCount}/${data.api_health.length} 个重点接口当前正常返回。`}
          icon={<Gauge className="h-5 w-5" aria-hidden="true" />}
          tone={data.runtime_summary.api_health_score >= 85 ? "good" : "warn"}
        />
        <KpiCard
          title="数据一致性"
          value={data.runtime_summary.data_consistency_status}
          detail="复用系统健康的任务一致性检查结果，确认库存、利润、审批信号是否进入任务中心。"
          icon={<Activity className="h-5 w-5" aria-hidden="true" />}
          tone={data.runtime_summary.data_consistency_status === "正常" ? "good" : "warn"}
        />
        <KpiCard
          title="现有系统影响"
          value={data.verification_mode.existing_system_affected}
          detail={data.verification_mode.impact_scope}
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
          tone={data.verification_mode.existing_system_affected === "NO" ? "good" : "risk"}
        />
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="一键测试入口"
          title="快速打开关键模块"
          description="验收时可以从这里直接进入核心页面，确认路由、菜单、页面渲染和接口数据展示都没有丢失。"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.quick_entries.map((entry) => (
            <Link
              key={entry.module_id}
              href={entry.href}
              className="group flex min-h-16 items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-panel transition hover:border-forest"
            >
              {entry.label}
              <ArrowRight className="h-4 w-4 text-forest transition group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="系统模块检查列表"
          title="页面与模块是否可进入"
          description="状态分为正常、延迟和异常。正常表示模块读取成功；延迟表示响应较慢但可用；异常表示模块状态读取失败，需要优先检查。"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.modules.map((item) => (
            <ModuleCard key={item.module_id} item={item} />
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="接口健康汇总"
          title="重点接口是否正常返回"
          description="这里集中检查运营总览、今日任务、执行中心、Shopee店铺、系统健康、经营结果分析、规则优化七个关键接口。"
        />
        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">接口</th>
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
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <SectionHeader
          eyebrow="验收模式"
          title={data.verification_mode.newly_added_module}
          description="本次新增模块只读取现有系统状态，不新增自动执行，不接外部接口，不改变已有业务页面逻辑。"
        />
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">当前版本</div>
            <div className="mt-2 text-sm font-semibold text-ink">{data.verification_mode.current_version}</div>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">影响范围</div>
            <div className="mt-2 text-sm leading-6 text-ink">{data.verification_mode.impact_scope}</div>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-400">是否影响现有系统</div>
            <div className="mt-2">
              <StatusBadge status={data.verification_mode.existing_system_affected} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
