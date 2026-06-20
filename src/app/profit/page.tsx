"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  Boxes,
  CircleDollarSign,
  PackageX,
  Wallet,
} from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { ProfitExperienceCharts } from "@/components/ProfitExperienceCharts";
import { emptyProfitResponse } from "@/data/emptyResponses";
import { formatBrl, formatPercent } from "@/lib/format";
import type { Platform, ProductProfitItem, ProfitApiResponse } from "@/types";

type PlatformFilter = "all" | Platform;
type ProfitRiskFilter = "all" | "loss" | "low_profit" | "high_risk";
type SortKey = "net_profit" | "net_margin" | "revenue";

const fallbackProfit: ProfitApiResponse = emptyProfitResponse;

function sourceLabel(source: ProfitApiResponse["source"]) {
  return source === "sqlite" ? "真实数据" : "测试数据已禁用";
}

function sortLabel(sortBy: SortKey) {
  if (sortBy === "revenue") return "按营收排序";
  if (sortBy === "net_margin") return "按净利润率排序";
  return "按净利润排序";
}

function riskFilterLabel(filter: ProfitRiskFilter) {
  return {
    all: "全部商品",
    loss: "亏损商品",
    low_profit: "低利润商品",
    high_risk: "高风险商品",
  }[filter];
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

function passesRiskFilter(item: ProductProfitItem, filter: ProfitRiskFilter) {
  if (filter === "loss") return item.net_profit < 0;
  if (filter === "low_profit") return item.net_profit >= 0 && item.net_margin < 0.12;
  if (filter === "high_risk") return item.risk_level === "high";
  return true;
}

export default function ProfitPage() {
  const [data, setData] = useState<ProfitApiResponse>(fallbackProfit);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [profitRiskFilter, setProfitRiskFilter] = useState<ProfitRiskFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("net_profit");

  useEffect(() => {
    let active = true;
    fetch("/api/profit", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: ProfitApiResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(fallbackProfit);
      });

    return () => {
      active = false;
    };
  }, []);

  const platformOptions = Array.from(new Set(data.product_profit.map((item) => item.platform)));

  const filteredProfitItems = useMemo(() => {
    return [...data.product_profit]
      .filter((item) => {
        if (platformFilter !== "all" && item.platform !== platformFilter) return false;
        if (!passesRiskFilter(item, profitRiskFilter)) return false;
        return true;
      })
      .sort((left, right) => {
        if (sortBy === "revenue") return right.revenue - left.revenue;
        if (sortBy === "net_margin") return right.net_margin - left.net_margin;
        return right.net_profit - left.net_profit;
      });
  }, [data.product_profit, platformFilter, profitRiskFilter, sortBy]);

  const snapshot = data.snapshot;
  const risk = data.profit_risk;

  return (
    <div className="space-y-8">
      <ProfitExperienceCharts />

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                利润中心 V1
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {sourceLabel(data.source)}
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                本地利润模型，不连接真实财务系统
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">利润中心</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                这个页面把利润结果、成本结构、利润风险和商品利润排行放到一个面板里，帮助你快速判断今天是先守利润、
                先控成本，还是先盯亏损与低利润商品。它只展示真实业务数据，真实数据源不可用时显示空状态与连接提示。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">昨日净利润</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{formatBrl(snapshot.yesterday_net_profit)}</div>
              <div className="mt-1 text-sm text-slate-500">按本地利润快照计算。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">本月净利润</div>
              <div className="mt-2 text-2xl font-semibold text-forest">{formatBrl(snapshot.month_net_profit)}</div>
              <div className="mt-1 text-sm text-slate-500">用于看本月利润空间是否健康。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">净利润率</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{formatPercent(snapshot.net_margin, 1)}</div>
              <div className="mt-1 text-sm text-slate-500">越能说明放量后承压能力越强。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">现金流</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{formatBrl(snapshot.cash_flow)}</div>
              <div className="mt-1 text-sm text-slate-500">配合库存周转天数一起看安全性。</div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="利润总览"
          title="先看利润体质，再决定今天盯哪一块"
          description="利润总览回答的是：当前利润是否够厚、现金流是否紧、库存周转是否拖慢利润释放。"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3 text-ink">
              <CircleDollarSign className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-sm font-semibold">昨日净利润</h3>
            </div>
            <div className="mt-4 text-2xl font-semibold text-ink">{formatBrl(snapshot.yesterday_net_profit)}</div>
          </article>
          <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3 text-ink">
              <Wallet className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-sm font-semibold">本月净利润</h3>
            </div>
            <div className="mt-4 text-2xl font-semibold text-ink">{formatBrl(snapshot.month_net_profit)}</div>
          </article>
          <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3 text-ink">
              <CircleDollarSign className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-sm font-semibold">净利润率</h3>
            </div>
            <div className="mt-4 text-2xl font-semibold text-ink">{formatPercent(snapshot.net_margin, 1)}</div>
          </article>
          <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3 text-ink">
              <Wallet className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-sm font-semibold">现金流</h3>
            </div>
            <div className="mt-4 text-2xl font-semibold text-ink">{formatBrl(snapshot.cash_flow)}</div>
          </article>
          <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3 text-ink">
              <Boxes className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-sm font-semibold">库存周转天数</h3>
            </div>
            <div className="mt-4 text-2xl font-semibold text-ink">{snapshot.inventory_turnover_days} 天</div>
          </article>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="成本结构"
          title="看利润被哪些成本吃掉"
          description="成本结构回答的是：采购、广告、物流、平台佣金和税费里，哪一块正在更明显地挤压净利润。"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {data.cost_structure.map((item) => (
            <article key={item.cost_key} className="rounded-lg border border-line bg-white p-5 shadow-panel">
              <div className="text-sm font-semibold text-ink">{item.label}</div>
              <div className="mt-3 text-2xl font-semibold text-ink">{formatBrl(item.value)}</div>
              <div className="mt-2 text-sm text-slate-500">成本占比 {formatPercent(item.share, 1)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="利润风险"
          title="先挡住最伤利润的品"
          description="利润风险回答的是：哪些商品已经亏损、哪些利润薄得不稳、哪些品虽然还赚钱但风险已经偏高。"
        />

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3 text-ink">
              <PackageX className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-base font-semibold">亏损商品</h3>
            </div>
            <div className="mt-4 text-3xl font-semibold text-coral">{risk.loss_products}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">这类商品会直接拉低净利润，需要优先人工排查。</p>
          </article>
          <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3 text-ink">
              <CircleDollarSign className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-base font-semibold">低利润商品</h3>
            </div>
            <div className="mt-4 text-3xl font-semibold text-amber">{risk.low_profit_products}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">这类商品不一定亏，但利润垫子很薄，稍有波动就会失守。</p>
          </article>
          <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3 text-ink">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-base font-semibold">高风险商品</h3>
            </div>
            <div className="mt-4 text-3xl font-semibold text-coral">{risk.high_risk_products}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">这类商品通常是利润薄、库存慢或成本波动大，更需要人工盯防。</p>
          </article>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">筛选与排序</div>
            <h2 className="text-lg font-semibold text-ink">先缩小范围，再看利润排行</h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              平台筛选帮助你看具体渠道，风险筛选帮助你快速切到亏损、低利润或高风险商品，排序则决定今天按营收、净利润还是利润率来看清单。
            </p>
          </div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-ink">
            <ArrowDownWideNarrow className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">平台筛选</span>
            <select
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value as PlatformFilter)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="all">全部平台</option>
              {platformOptions.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">利润风险筛选</span>
            <select
              value={profitRiskFilter}
              onChange={(event) => setProfitRiskFilter(event.target.value as ProfitRiskFilter)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="all">全部商品</option>
              <option value="loss">亏损商品</option>
              <option value="low_profit">低利润商品</option>
              <option value="high_risk">高风险商品</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">排序方式</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortKey)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="net_profit">按净利润</option>
              <option value="net_margin">按净利润率</option>
              <option value="revenue">按营收</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="商品利润排行"
          title="把今天要先看的利润商品排出来"
          description="商品利润排行回答的是：哪些商品贡献利润最多，哪些已经开始吃利润，哪些应该先进入人工复核。"
        />

        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="text-sm text-slate-500">
              当前结果 {filteredProfitItems.length} 条，{sortLabel(sortBy)}，筛选范围：{riskFilterLabel(profitRiskFilter)}。
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">商品ID</th>
                  <th className="px-4 py-3">商品名称</th>
                  <th className="px-4 py-3">营收</th>
                  <th className="px-4 py-3">成本</th>
                  <th className="px-4 py-3">毛利润</th>
                  <th className="px-4 py-3">净利润</th>
                  <th className="px-4 py-3">净利润率</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfitItems.map((item) => (
                  <tr key={item.profit_item_id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-medium text-ink">{item.product_uid}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{item.product_name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.platform} / 库存 {item.inventory_days} 天
                      </div>
                    </td>
                    <td className="px-4 py-3">{formatBrl(item.revenue)}</td>
                    <td className="px-4 py-3">{formatBrl(item.cost)}</td>
                    <td className="px-4 py-3">{formatBrl(item.gross_profit)}</td>
                    <td className={`px-4 py-3 font-semibold ${item.net_profit < 0 ? "text-coral" : "text-forest"}`}>
                      {formatBrl(item.net_profit)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <div className="font-semibold text-ink">{formatPercent(item.net_margin, 1)}</div>
                        <StatusPill status={item.risk_level} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 md:hidden">
            {filteredProfitItems.map((item) => (
              <article key={item.profit_item_id} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">{item.product_name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.platform} / {item.product_uid}
                    </div>
                  </div>
                  <StatusPill status={item.risk_level} />
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600">
                  <div>营收 {formatBrl(item.revenue)}</div>
                  <div>成本 {formatBrl(item.cost)}</div>
                  <div>毛利润 {formatBrl(item.gross_profit)}</div>
                  <div>净利润 {formatBrl(item.net_profit)}</div>
                  <div>净利润率 {formatPercent(item.net_margin, 1)}</div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
