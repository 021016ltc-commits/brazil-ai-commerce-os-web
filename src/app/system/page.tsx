"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Building2,
  ChevronDown,
  Database,
  Globe2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { StandardPageHeader } from "@/components/PageHeader";
import { activeDataSource, futureDataSourceNotes } from "@/lib/dataSource";
import { readStoredUser } from "@/lib/permissions";
import type { UserItem } from "@/types";

function dataStatusLabel(source: string) {
  if (["postgresql", "supabase", "sqlite"].includes(source)) return "数据正常";
  return "数据待配置";
}

function runtimeLabel() {
  return process.env.SYSTEM_MODE === "production" ? "生产运行" : "本地运行";
}

function SummaryCard({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "good" | "neutral";
}) {
  const toneClass =
    tone === "good" ? "border-emerald-200 bg-emerald-50 text-forest" : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="mt-2 text-lg font-semibold text-ink">{value}</div>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-md border ${toneClass}`}>{icon}</div>
      </div>
    </article>
  );
}

export default function SystemPage() {
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null);
  const [lastUpdated, setLastUpdated] = useState("-");

  useEffect(() => {
    const syncUser = () => setCurrentUser(readStoredUser());
    syncUser();
    setLastUpdated(
      new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date()),
    );

    window.addEventListener("storage", syncUser);
    window.addEventListener("baico-auth-change", syncUser);

    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("baico-auth-change", syncUser);
    };
  }, []);

  const isAdmin = currentUser?.roles.includes("admin") ?? false;

  return (
    <div className="space-y-4">
      <StandardPageHeader
        title="系统设置"
        description="管理语言、账号和系统入口。"
        meta={[
          { label: "数据状态", value: dataStatusLabel(activeDataSource) },
          { label: "运行模式", value: runtimeLabel() },
          { label: "只读保护", value: "已开启" },
        ]}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="数据状态"
          value={dataStatusLabel(activeDataSource)}
          icon={<Database className="h-4 w-4" aria-hidden="true" />}
          tone="good"
        />
        <SummaryCard
          label="运行模式"
          value={runtimeLabel()}
          icon={<Activity className="h-4 w-4" aria-hidden="true" />}
        />
        <SummaryCard
          label="只读保护"
          value="已开启"
          icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
          tone="good"
        />
        <SummaryCard
          label="最近更新时间"
          value={lastUpdated}
          icon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
        />
      </section>

      <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-forest">
              <Globe2 className="h-4 w-4" aria-hidden="true" />
              语言与界面
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              切换运营界面语言，设置会保存在当前浏览器中。
            </p>
          </div>
          <LanguageSwitcher />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <Link
          href="/users"
          className="rounded-lg border border-line bg-white p-4 shadow-panel transition hover:border-forest"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-slate-50 text-forest">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">用户管理</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">维护内部账号、角色与操作记录。</p>
            </div>
          </div>
        </Link>
        <Link
          href="/tenants"
          className="rounded-lg border border-line bg-white p-4 shadow-panel transition hover:border-forest"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-slate-50 text-forest">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">工作空间</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">查看内部空间、店铺范围与使用状态。</p>
            </div>
          </div>
        </Link>
      </section>

      {isAdmin ? (
        <section className="space-y-3">
          <details className="group rounded-lg border border-line bg-white shadow-panel">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink">
              高级设置
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="border-t border-line p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-line bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                  真实数据优先；无法读取时展示连接提示，不伪装业务数据。
                </div>
                <div className="rounded-md border border-line bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                  平台连接保持只读保护，不执行改价、上架、广告或补货动作。
                </div>
                <div className="rounded-md border border-line bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                  后续平台与外部信号入口保留在数据接入清单中。
                </div>
              </div>
            </div>
          </details>

          <details className="group rounded-lg border border-line bg-white shadow-panel">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink">
              技术诊断
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="space-y-3 border-t border-line p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-line bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                  activeDataSource：{activeDataSource}
                </div>
                <div className="rounded-md border border-line bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                  SYSTEM_MODE：{process.env.SYSTEM_MODE ?? "development"}
                </div>
                <div className="rounded-md border border-line bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                  低频诊断入口已迁移到右上角设置菜单。
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {futureDataSourceNotes.map((note) => (
                  <div
                    key={note}
                    className="rounded-md border border-line bg-white px-4 py-3 text-sm leading-6 text-slate-600"
                  >
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </details>
        </section>
      ) : null}
    </div>
  );
}
