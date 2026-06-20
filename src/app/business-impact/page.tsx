"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDownWideNarrow,
  BarChart3,
  Database,
  LineChart,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { BusinessImpactExperienceCharts } from "@/components/ModuleExperienceCharts";
import { MoreActionsMenu, dataStatusLabel } from "@/components/OperatorControls";
import { emptyBusinessImpactResponse } from "@/data/emptyResponses";
import { formatBrl, formatCount, formatPercent } from "@/lib/format";
import { actionTypeLabelZh, statusLabel } from "@/locales/zh-CN";
import type { BusinessImpactActionItem, BusinessImpactApiResponse, Platform } from "@/types";

type PlatformFilter = "all" | Platform;
type SourceFilter = "all" | BusinessImpactActionItem["source"];
type SortKey = "profit_delta" | "gmv_delta" | "decision_accuracy" | "roi_prediction_error";

const sortLabels: Record<SortKey, string> = {
  profit_delta: "按利润影响排序",
  gmv_delta: "按 GMV 影响排序",
  decision_accuracy: "按决策准确率排序",
  roi_prediction_error: "按收益预测偏差排序",
};

function sourceLabel(source: BusinessImpactApiResponse["source"]) {
  return dataStatusLabel(source);
}

function impactSourceLabel(source: BusinessImpactActionItem["source"]) {
  return {
    action_queue: "执行审批事项",
    decision_feedback: "决策复盘",
    shopee_cache: "Shopee店铺数据",
    manual: "人工录入",
  }[source];
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function metricTone(value: number) {
  if (value > 0) return "text-forest";
  if (value < 0) return "text-coral";
  return "text-ink";
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

function SummaryCard({
  title,
  value,
  detail,
  icon,
  tone = "text-ink",
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
      <div className="flex items-center gap-3 text-slate-600">
        {icon}
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      <div className={`mt-4 text-2xl font-semibold ${tone}`}>{value}</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
    </article>
  );
}

export default function BusinessImpactPage() {
  const [data, setData] = useState<BusinessImpactApiResponse>(emptyBusinessImpactResponse);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [actionTypeFilter, setActionTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("profit_delta");

  useEffect(() => {
    let active = true;

    fetch("/api/business-impact", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: BusinessImpactApiResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(emptyBusinessImpactResponse);
      });

    return () => {
      active = false;
    };
  }, []);

  const platformOptions = Array.from(
    new Set(data.action_impacts.map((item) => item.platform).filter((item): item is Platform => Boolean(item))),
  );
  const actionTypeOptions = Array.from(new Set(data.action_impacts.map((item) => item.action_type)));
  const sourceOptions = Array.from(new Set(data.action_impacts.map((item) => item.source)));

  const filteredActions = useMemo(() => {
    return [...data.action_impacts]
      .filter((item) => {
        if (platformFilter !== "all" && item.platform !== platformFilter) return false;
        if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
        if (actionTypeFilter !== "all" && item.action_type !== actionTypeFilter) return false;
        return true;
      })
      .sort((left, right) => {
        if (sortBy === "roi_prediction_error") return left.roi_prediction_error - right.roi_prediction_error;
        return right[sortBy] - left[sortBy];
      });
  }, [actionTypeFilter, data.action_impacts, platformFilter, sortBy, sourceFilter]);

  const summary = data.summary;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-7 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                经营结果分析 V1
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {sourceLabel(data.source)}
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                只做归因分析，不自动执行
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">经营结果分析</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                衡量历史决策和受控执行建议对利润、库存和销售额的影响，只分析不执行。
              </p>
            </div>
            <MoreActionsMenu onRefresh={() => window.location.reload()} showAdminItems />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">总利润影响</div>
              <div className={`mt-2 text-2xl font-semibold ${metricTone(summary.total_profit_impact)}`}>
                {formatBrl(summary.total_profit_impact)}
              </div>
              <div className="mt-1 text-sm text-slate-500">按本地归因结果累计。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">决策成功率</div>
              <div className="mt-2 text-2xl font-semibold text-forest">
                {formatPercent(summary.action_success_rate)}
              </div>
              <div className="mt-1 text-sm text-slate-500">利润与综合影响为正的动作占比。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs text-slate-400">收益预测偏差</div>
              <div className="mt-2 text-2xl font-semibold text-ink">
                {formatPercent(summary.ROI_prediction_error, 1)}
              </div>
              <div className="mt-1 text-sm text-slate-500">越低说明预估越接近实际。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">分析动作数</div>
              <div className="mt-2 text-2xl font-semibold text-ink">
                {formatCount(summary.analyzed_action_count)}
              </div>
              <div className="mt-1 text-sm text-slate-500">已纳入归因样本的动作。</div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="影响总览"
          title="利润、库存和 GMV 的真实变化"
          description="这里回答：历史建议到底带来了多少利润，是否推动 GMV，库存周转有没有变好。所有指标都来自本地归因数据。"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            title="总利润影响"
            value={formatBrl(summary.total_profit_impact)}
            detail="所有归因动作的 profit_delta 合计。"
            icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
            tone={metricTone(summary.total_profit_impact)}
          />
          <SummaryCard
            title="总 GMV 影响"
            value={formatBrl(summary.total_gmv_impact)}
            detail="所有归因动作的 gmv_delta 合计。"
            icon={<LineChart className="h-5 w-5" aria-hidden="true" />}
            tone={metricTone(summary.total_gmv_impact)}
          />
          <SummaryCard
            title="库存周转变化"
            value={`${summary.total_stock_turnover_change.toFixed(1)} 天`}
            detail="负数代表周转改善，正数代表库存压力增加。"
            icon={<BarChart3 className="h-5 w-5" aria-hidden="true" />}
            tone={summary.total_stock_turnover_change <= 0 ? "text-forest" : "text-amber"}
          />
          <SummaryCard
            title="决策准确率"
            value={formatPercent(summary.decision_accuracy)}
            detail="实际影响接近期望影响的程度。"
            icon={<Target className="h-5 w-5" aria-hidden="true" />}
            tone={summary.decision_accuracy >= 0.75 ? "text-forest" : "text-amber"}
          />
          <SummaryCard
            title="成功动作数"
            value={`${formatCount(summary.successful_action_count)} / ${formatCount(summary.analyzed_action_count)}`}
            detail="利润和综合影响为正的动作数量。"
            icon={<Database className="h-5 w-5" aria-hidden="true" />}
            tone="text-ink"
          />
        </div>
      </section>

      <details className="compact-details rounded-lg border border-line bg-white shadow-panel">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink">
          查看经营图表
          <span className="text-xs font-medium text-slate-500">利润趋势、策略排行、动作占比</span>
        </summary>
        <div className="border-t border-line p-3">
          <BusinessImpactExperienceCharts />
        </div>
      </details>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="执行结果归因"
          title="每个动作的预期和实际表现"
          description="这里把 action_id 与真实结果关联，展示利润、库存和 GMV 的前后变化。批准或拒绝仍只是本地记录，不代表系统执行了平台动作。"
        />

        <div className="flex flex-wrap gap-3 rounded-lg border border-line bg-white p-4 shadow-panel">
          <label className="grid gap-1 text-sm text-slate-600">
            平台
            <select
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value as PlatformFilter)}
              className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink"
            >
              <option value="all">全部平台</option>
              {platformOptions.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            动作类型
            <select
              value={actionTypeFilter}
              onChange={(event) => setActionTypeFilter(event.target.value)}
              className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink"
            >
              <option value="all">全部动作</option>
              {actionTypeOptions.map((actionType) => (
                <option key={actionType} value={actionType}>
                  {actionTypeLabelZh(actionType)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            数据来源
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
              className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink"
            >
              <option value="all">全部来源</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {impactSourceLabel(source)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            排序
            <span className="relative">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortKey)}
                className="h-10 rounded-md border border-line bg-white px-3 pr-9 text-sm text-ink"
              >
                {Object.entries(sortLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <ArrowDownWideNarrow className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            </span>
          </label>
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-panel">
          <div className="operator-scroll">
            <table className="operator-table text-left">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th>动作</th>
                  <th>平台</th>
                  <th>利润变化</th>
                  <th>库存变化</th>
                  <th>销售额变化</th>
                  <th>准确率</th>
                  <th>收益偏差</th>
                  <th>归因说明</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredActions.map((item) => (
                  <tr key={item.impact_id} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-ink">{item.action_id}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {actionTypeLabelZh(item.action_type)} / {statusLabel(item.action_status)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{item.product_id}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {item.platform ?? "-"}
                      <div className="mt-1 text-xs text-slate-500">{impactSourceLabel(item.source)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className={`font-semibold ${metricTone(item.profit_delta)}`}>{formatBrl(item.profit_delta)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatBrl(item.profit_before)} → {formatBrl(item.profit_after)}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className={item.stock_turnover_change <= 0 ? "font-semibold text-forest" : "font-semibold text-amber"}>
                        {item.stock_turnover_change.toFixed(1)} 天
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatCount(item.stock_before)} → {formatCount(item.stock_after)}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className={`font-semibold ${metricTone(item.gmv_delta)}`}>{formatBrl(item.gmv_delta)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatBrl(item.gmv_before)} → {formatBrl(item.gmv_after)}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-ink">{formatPercent(item.decision_accuracy)}</td>
                    <td className="px-4 py-4 font-semibold text-ink">{formatPercent(item.roi_prediction_error, 1)}</td>
                    <td className="px-4 py-4 text-sm leading-6 text-slate-600">{item.attribution_note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <SectionHeader
            eyebrow="最佳策略排行"
            title="哪些动作正在带来更好结果"
            description="按利润影响和准确率综合排序，用于判断哪些策略值得继续观察扩大样本。"
          />
          <div className="mt-5 space-y-3">
            {data.best_strategies.map((item) => (
              <div key={item.strategy_id} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-ink">{actionTypeLabelZh(item.action_type)}</div>
                    <div className="mt-1 text-sm text-slate-500">{item.rank_reason}</div>
                  </div>
                  <TrendingUp className="h-5 w-5 text-forest" aria-hidden="true" />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="text-sm text-slate-600">利润 {formatBrl(item.total_profit_delta)}</div>
                  <div className="text-sm text-slate-600">GMV {formatBrl(item.total_gmv_delta)}</div>
                  <div className="text-sm text-slate-600">准确率 {formatPercent(item.avg_decision_accuracy)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <SectionHeader
            eyebrow="最差策略排行"
            title="哪些动作需要复盘"
            description="按利润压力和预测偏差排序，帮助团队先复盘伤利润或偏差大的策略。"
          />
          <div className="mt-5 space-y-3">
            {data.worst_strategies.map((item) => (
              <div key={item.strategy_id} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-ink">{actionTypeLabelZh(item.action_type)}</div>
                    <div className="mt-1 text-sm text-slate-500">{item.rank_reason}</div>
                  </div>
                  <TrendingDown className="h-5 w-5 text-coral" aria-hidden="true" />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="text-sm text-slate-600">利润 {formatBrl(item.total_profit_delta)}</div>
                  <div className="text-sm text-slate-600">GMV {formatBrl(item.total_gmv_delta)}</div>
                  <div className="text-sm text-slate-600">收益偏差 {formatPercent(item.roi_prediction_error, 1)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
