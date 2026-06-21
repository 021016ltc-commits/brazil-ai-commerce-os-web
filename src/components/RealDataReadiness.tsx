"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Store,
} from "lucide-react";
import type { ShopeeBindingPublicStatus } from "@/types";

type ReadinessContext = "dashboard" | "tasks" | "profit" | "inventory";

const emptyBindingStatus: ShopeeBindingPublicStatus = {
  configured: false,
  bound: false,
  status: "unbound",
  shop_id: null,
  shop_name: null,
  region: null,
  token_expire_at: null,
  last_sync_at: null,
  auth_url: null,
  message: "等待平台应用审核和店铺授权。",
  shops: [],
};

const contextCopy: Record<ReadinessContext, { title: string; subtitle: string; next: string }> = {
  dashboard: {
    title: "运营总览等待真实店铺数据",
    subtitle: "完成店铺授权并同步后，这里会显示真实销售、利润、库存和待处理事项。",
    next: "授权店铺后，先检查订单、商品、库存是否进入系统。",
  },
  tasks: {
    title: "今日任务等待真实经营数据",
    subtitle: "任务会基于真实库存、利润、审批和风险生成；授权前不会用测试数据伪装结果。",
    next: "同步真实数据后，系统会生成优先级任务。",
  },
  profit: {
    title: "利润中心等待真实销售与成本数据",
    subtitle: "授权店铺后先读取真实订单；成本口径确认后再用于利润判断。",
    next: "先完成店铺授权，再补充采购、物流、佣金等成本口径。",
  },
  inventory: {
    title: "库存中心等待真实库存数据",
    subtitle: "授权店铺后会读取平台库存，用于判断缺货、积压和补货建议。",
    next: "同步库存后，系统会按可售天数和风险等级生成建议。",
  },
};

function formatDateTime(value: string | null) {
  if (!value) return "尚未同步";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getReadinessStage(binding: ShopeeBindingPublicStatus, isEmpty: boolean) {
  const boundShops = binding.shops.filter((shop) => shop.status === "bound" || shop.status === "expired");

  if (!binding.configured) {
    return {
      tone: "waiting",
      label: "等待平台应用审核",
      detail: "Shopee 开放平台审核通过并完成应用配置后，就可以进入店铺授权流程。",
      boundCount: boundShops.length,
    };
  }

  if (boundShops.length === 0) {
    return {
      tone: "waiting",
      label: "等待店铺授权",
      detail: "应用配置已准备，下一步需要按店铺逐个授权，授权后才能读取真实订单、商品和库存。",
      boundCount: 0,
    };
  }

  if (isEmpty) {
    return {
      tone: "sync",
      label: "等待首次同步",
      detail: "已检测到授权店铺，下一步请在店铺授权页同步真实数据，核心运营页面会随之更新。",
      boundCount: boundShops.length,
    };
  }

  return {
    tone: "ready",
    label: "真实数据已接入",
    detail: "系统正在使用已授权店铺的数据支撑运营判断。",
    boundCount: boundShops.length,
  };
}

export function RealDataReadiness({
  context,
  isEmpty,
}: {
  context: ReadinessContext;
  isEmpty: boolean;
}) {
  const [binding, setBinding] = useState<ShopeeBindingPublicStatus>(emptyBindingStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/shopee/binding", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: ShopeeBindingPublicStatus) => {
        if (!active) return;
        setBinding(payload);
        setHasError(false);
      })
      .catch(() => {
        if (!active) return;
        setBinding(emptyBindingStatus);
        setHasError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const copy = contextCopy[context];
  const stage = useMemo(() => getReadinessStage(binding, isEmpty), [binding, isEmpty]);

  if (!isEmpty && stage.boundCount > 0 && stage.tone === "ready") return null;

  const statusTone =
    stage.tone === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : stage.tone === "sync"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-semibold ${statusTone}`}>
              {isLoading ? "正在检查店铺状态" : hasError ? "授权状态待确认" : stage.label}
            </span>
            <span className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-slate-50 px-2 text-xs font-medium text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              只读保护
            </span>
          </div>

          <h2 className="mt-3 text-lg font-semibold text-ink">{copy.title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{copy.subtitle}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{hasError ? "暂时无法确认授权状态，请稍后刷新或进入店铺授权页检查。" : stage.detail}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 xl:w-[460px]">
          <div className="rounded-md border border-line bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Store className="h-4 w-4" aria-hidden="true" />
              已授权店铺
            </div>
            <div className="mt-2 text-xl font-semibold text-ink">{stage.boundCount}</div>
          </div>
          <div className="rounded-md border border-line bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              最近同步
            </div>
            <div className="mt-2 truncate text-sm font-semibold text-ink">
              {formatDateTime(binding.last_sync_at)}
            </div>
          </div>
          <div className="rounded-md border border-line bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              {stage.tone === "ready" ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Clock3 className="h-4 w-4" aria-hidden="true" />
              )}
              下一步
            </div>
            <div className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-ink">{copy.next}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/shopee"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-teal-800"
        >
          去店铺授权
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href="/system-health"
          className="inline-flex h-9 items-center rounded-md border border-line px-3 text-sm font-medium text-ink hover:bg-slate-50"
        >
          查看系统状态
        </Link>
      </div>
    </section>
  );
}
