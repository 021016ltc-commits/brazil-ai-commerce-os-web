"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  LineChart,
  ShieldCheck,
  SlidersHorizontal,
  Target,
} from "lucide-react";
import { SelfOptimizationExperienceCharts } from "@/components/ModuleExperienceCharts";
import { emptySelfOptimizationResponse } from "@/data/emptyResponses";
import { formatCount, formatPercent } from "@/lib/format";
import type {
  SelfOptimizationApiResponse,
  SelfOptimizationRecommendation,
  SelfOptimizationRuleGroup,
  SelfOptimizationStatus,
} from "@/types";

type GroupFilter = "all" | SelfOptimizationRuleGroup;
type StatusFilter = "all" | SelfOptimizationStatus;

function sourceLabel(source: SelfOptimizationApiResponse["source"]) {
  return source === "sqlite" ? "真实数据" : "测试数据已禁用";
}

function statusLabel(status: SelfOptimizationStatus) {
  return {
    healthy: "健康",
    watch: "观察",
    needs_review: "需复盘",
  }[status];
}

function statusClass(status: SelfOptimizationStatus) {
  return {
    healthy: "border-emerald-200 bg-emerald-50 text-forest",
    watch: "border-amber-200 bg-amber-50 text-amber",
    needs_review: "border-rose-200 bg-rose-50 text-coral",
  }[status];
}

function priorityClass(priority: SelfOptimizationRecommendation["priority"]) {
  return {
    P1: "border-rose-200 bg-rose-50 text-coral",
    P2: "border-amber-200 bg-amber-50 text-amber",
    P3: "border-slate-200 bg-slate-50 text-slate-600",
  }[priority];
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

function MetricCard({
  title,
  value,
  detail,
  tone = "text-ink",
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  tone?: string;
  icon: ReactNode;
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

export default function SelfOptimizationPage() {
  const [data, setData] = useState<SelfOptimizationApiResponse>(emptySelfOptimizationResponse);
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let active = true;

    fetch("/api/self-optimization", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: SelfOptimizationApiResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(emptySelfOptimizationResponse);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredRules = useMemo(() => {
    return data.rule_performance.filter((item) => {
      if (groupFilter !== "all" && item.rule_group !== groupFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      return true;
    });
  }, [data.rule_performance, groupFilter, statusFilter]);

  const maxTrendRecommendations = Math.max(
    1,
    ...data.summary.learning_trend.map((item) => item.recommendation_count),
  );

  return (
    <div className="space-y-8">
      <SelfOptimizationExperienceCharts />

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                规则优化 V1
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {sourceLabel(data.source)}
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                仅生成建议，不自动改规则
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">规则优化</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                这个页面根据历史业务结果分析规则表现，识别失败模式，并生成评分权重优化建议。
                所有建议都需要人工审批，不会自动修改代码、生产规则或任何外部系统。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">规则命中率</div>
              <div className="mt-2 text-2xl font-semibold text-forest">
                {formatPercent(data.summary.rule_hit_rate)}
              </div>
              <div className="mt-1 text-sm text-slate-500">历史规则判断与业务结果一致的比例。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">规则偏差率</div>
              <div className="mt-2 text-2xl font-semibold text-amber">
                {formatPercent(data.summary.rule_bias_rate, 1)}
              </div>
              <div className="mt-1 text-sm text-slate-500">越低说明误判和权重偏差越少。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">ROI预测误差</div>
              <div className="mt-2 text-2xl font-semibold text-ink">
                {formatPercent(data.summary.roi_prediction_error, 1)}
              </div>
              <div className="mt-1 text-sm text-slate-500">来自业务影响归因结果。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">优化建议</div>
              <div className="mt-2 text-2xl font-semibold text-ink">
                {formatCount(data.summary.recommendation_count)}
              </div>
              <div className="mt-1 text-sm text-slate-500">全部需要人工审批。</div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="规则表现分析"
          title="哪些规则稳定，哪些规则需要复盘"
          description="这里分析决策、评分、风险、审批和执行规则的命中率、偏差率、ROI 误差和暂不推进误判率。"
        />

        <div className="flex flex-wrap gap-3 rounded-lg border border-line bg-white p-4 shadow-panel">
          <label className="grid gap-1 text-sm text-slate-600">
            规则组
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value as GroupFilter)}
              className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink"
            >
              <option value="all">全部规则组</option>
              <option value="decisionEngine">决策规则</option>
              <option value="scoring">评分规则</option>
              <option value="risk">风险规则</option>
              <option value="approval">审批规则</option>
              <option value="execution">执行规则</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            状态
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="h-10 rounded-md border border-line bg-white px-3 text-sm text-ink"
            >
              <option value="all">全部状态</option>
              <option value="healthy">健康</option>
              <option value="watch">观察</option>
              <option value="needs_review">需复盘</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {filteredRules.map((item) => (
            <article key={item.rule_name} className="rounded-lg border border-line bg-white p-5 shadow-panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">{item.rule_name}</div>
                  <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{item.rule_group}</div>
                </div>
                <span className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-semibold ${statusClass(item.status)}`}>
                  {statusLabel(item.status)}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.analysis_note}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-slate-400">样本</div>
                  <div className="mt-1 font-semibold text-ink">{formatCount(item.sample_count)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">命中率</div>
                  <div className="mt-1 font-semibold text-forest">{formatPercent(item.hit_rate)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">偏差率</div>
                  <div className="mt-1 font-semibold text-amber">{formatPercent(item.bias_rate, 1)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">ROI误差</div>
                  <div className="mt-1 font-semibold text-ink">{formatPercent(item.roi_prediction_error, 1)}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="策略优化建议"
          title="只生成建议，不自动修改规则"
          description="每条建议都包含当前权重、建议权重、原因和预期影响。系统不会自动应用这些权重，必须人工审批后才可能进入后续开发。"
        />
        <div className="grid gap-4 xl:grid-cols-2">
          {data.recommendations.map((item) => (
            <article key={item.recommendation_id} className="rounded-lg border border-line bg-white p-5 shadow-panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">{item.rule_name}</div>
              <div className="mt-1 text-xs text-slate-500">{item.recommendation_id}</div>
            </div>
            <span className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-semibold ${priorityClass(item.priority)}`}>
              {item.priority}
            </span>
          </div>
              <div className="mt-4 grid gap-4 border-y border-line py-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                    当前权重
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-ink">{item.current_weight.toFixed(2)}</div>
                  <div className="mt-1 text-sm text-slate-500">当前规则配置中的参考权重。</div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Target className="h-4 w-4" aria-hidden="true" />
                    建议权重
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-forest">{item.suggested_weight.toFixed(2)}</div>
                  <div className="mt-1 text-sm text-slate-500">仅作为人工复核建议，不自动生效。</div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{item.reason}</p>
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-forest">
                {item.expected_impact}
              </div>
              <div className="mt-3 inline-flex h-7 items-center gap-2 rounded-md border border-line bg-slate-50 px-2 text-xs font-medium text-slate-600">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {item.approval_required ? "需要人工审批" : "无需审批"}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <SectionHeader
            eyebrow="失败模式识别"
            title="优先复盘容易伤利润的模式"
            description="系统会标记高 ROI 被误拦截、低 ROI 被建议推进和高风险误判。"
          />
          <div className="mt-5 space-y-3">
            {data.failure_patterns.map((item) => (
              <div key={item.pattern_id} className="rounded-lg border border-line p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-1 h-5 w-5 text-amber" aria-hidden="true" />
                  <div>
                    <div className="font-semibold text-ink">{item.pattern_type}</div>
                    <div className="mt-1 text-sm text-slate-500">{item.affected_rule}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                    <div className="mt-2 text-sm text-slate-500">证据样本：{formatCount(item.evidence_count)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <SectionHeader
            eyebrow="系统学习趋势图"
            title="命中率、偏差率和建议数量趋势"
            description="趋势图用于观察系统学习是否稳定，仍然只做展示，不自动应用任何变更。"
          />
          <div className="mt-5 space-y-4">
            {data.summary.learning_trend.map((item) => (
              <div key={item.period} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">{item.period}</span>
                  <span className="text-slate-500">
                    命中 {formatPercent(item.rule_hit_rate)} / 偏差 {formatPercent(item.rule_bias_rate, 1)}
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-forest"
                      style={{ width: `${Math.round(item.rule_hit_rate * 100)}%` }}
                    />
                  </div>
                  <div className="min-w-20 text-right text-xs text-slate-500">
                    建议 {formatCount(item.recommendation_count)}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber"
                    style={{ width: `${Math.round((item.recommendation_count / maxTrendRecommendations) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <SectionHeader
            eyebrow="最佳策略沉淀"
            title="值得继续保留的规则"
            description="按命中率、偏差率和 ROI 预测误差综合排序。"
          />
          <div className="mt-5 space-y-3">
            {data.top_performing_rules.map((item) => (
              <div key={item.rule_name} className="flex items-start gap-3 rounded-lg border border-line p-4">
                <CheckCircle2 className="mt-1 h-5 w-5 text-forest" aria-hidden="true" />
                <div>
                  <div className="font-semibold text-ink">{item.rule_name}</div>
                  <div className="mt-1 text-sm text-slate-500">score {formatPercent(item.score)} / samples {formatCount(item.sample_count)}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <SectionHeader
            eyebrow="最差策略复盘"
            title="需要优先人工检查的规则"
            description="这些规则不自动修改，只进入复盘和审批讨论。"
          />
          <div className="mt-5 space-y-3">
            {data.worst_performing_rules.map((item) => (
              <div key={item.rule_name} className="flex items-start gap-3 rounded-lg border border-line p-4">
                <BrainCircuit className="mt-1 h-5 w-5 text-coral" aria-hidden="true" />
                <div>
                  <div className="font-semibold text-ink">{item.rule_name}</div>
                  <div className="mt-1 text-sm text-slate-500">score {formatPercent(item.score)} / samples {formatCount(item.sample_count)}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <SectionHeader
          eyebrow="安全边界"
          title="自优化建议不会自动生效"
          description="这些保护规则保证系统只做分析和建议，把真实规则变更留给人工审批和后续开发。"
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {data.guardrails.map((item) => (
            <div key={item} className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
