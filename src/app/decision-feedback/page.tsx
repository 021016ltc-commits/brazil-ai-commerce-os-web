"use client";

import { useEffect, useState } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Gauge,
  RefreshCcw,
  Send,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { DecisionFeedbackExperienceCharts } from "@/components/ModuleExperienceCharts";
import { dataStatusLabel } from "@/components/OperatorControls";
import { StatusPill } from "@/components/StatusPill";
import {
  emptyDecisionHistoryResponse,
  emptyDecisionLearning,
  emptyDecisionMetrics,
  emptyDecisionMetricsResponse,
} from "@/data/emptyResponses";
import { formatBrl, formatCount, formatPercent } from "@/lib/format";
import { decisionUserActionLabel, feedbackSourceLabel, statusLabel } from "@/locales/zh-CN";
import type {
  DecisionFeedbackInput,
  DecisionFeedbackPostResponse,
  DecisionHistoryApiResponse,
  DecisionMetricsApiResponse,
  DecisionState,
  DecisionUserAction,
  MetricTone,
} from "@/types";

const fallbackHistory: DecisionHistoryApiResponse = emptyDecisionHistoryResponse;
const fallbackMetrics: DecisionMetricsApiResponse = emptyDecisionMetricsResponse;

type FeedbackFormState = {
  product_id: string;
  product_uid: string;
  platform: string;
  decisionState: DecisionState;
  user_action: DecisionUserAction;
  source: "shopee" | "manual";
  actual_sales: string;
  actual_profit: string;
  roi_real: string;
  stock_change: string;
  conversion_rate: string;
};

const initialForm: FeedbackFormState = {
  product_id: "",
  product_uid: "",
  platform: "",
  decisionState: "RECOMMEND",
  user_action: "observe",
  source: "manual",
  actual_sales: "",
  actual_profit: "",
  roi_real: "",
  stock_change: "",
  conversion_rate: "",
};

function sourceLabel(source: DecisionHistoryApiResponse["source"]) {
  return dataStatusLabel(source);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function metricTone(value: number, reverse = false): MetricTone {
  if (reverse) {
    if (value <= 0.12) return "good";
    if (value <= 0.25) return "warn";
    return "risk";
  }

  if (value >= 0.8) return "good";
  if (value >= 0.65) return "warn";
  return "risk";
}

function inputClass() {
  return "h-10 rounded-md border border-line bg-white px-3 text-sm text-ink outline-none focus:border-forest";
}

export default function DecisionFeedbackPage() {
  const [history, setHistory] = useState<DecisionHistoryApiResponse>(fallbackHistory);
  const [metrics, setMetrics] = useState<DecisionMetricsApiResponse>(fallbackMetrics);
  const [form, setForm] = useState<FeedbackFormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<DecisionFeedbackPostResponse | null>(null);

  async function refreshData() {
    const [historyResponse, metricsResponse] = await Promise.all([
      fetch("/api/decision/history", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
      fetch("/api/decision/metrics", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
    ]);

    setHistory(historyResponse as DecisionHistoryApiResponse);
    setMetrics(metricsResponse as DecisionMetricsApiResponse);
  }

  useEffect(() => {
    let active = true;

    refreshData().catch(() => {
      if (!active) return;
      setHistory(fallbackHistory);
      setMetrics(fallbackMetrics);
    });

    return () => {
      active = false;
    };
  }, []);

  async function submitFeedback() {
    setSubmitting(true);
    setSubmitResult(null);

    const payload: DecisionFeedbackInput = {
      product_id: form.product_id,
      product_uid: form.product_uid || undefined,
      platform: form.platform as DecisionFeedbackInput["platform"],
      decisionState: form.decisionState,
      user_action: form.user_action,
      source: form.source,
      actual_sales: Number(form.actual_sales || 0),
      actual_profit: Number(form.actual_profit || 0),
      roi_real: Number(form.roi_real || 0),
      stock_change: Number(form.stock_change || 0),
      conversion_rate: Number(form.conversion_rate || 0),
    };

    try {
      const response = await fetch("/api/decision/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("feedback_failed");
      const result = (await response.json()) as DecisionFeedbackPostResponse;
      setSubmitResult(result);
      await refreshData();
    } catch {
      setSubmitResult({
        source: "sqlite",
        persisted: false,
        feedback: {
          decision_id: "feedback_not_persisted",
          product_id: form.product_id,
          decisionState: form.decisionState,
          user_action: form.user_action,
          timestamp: new Date().toISOString(),
          source: form.source,
          created_at: new Date().toISOString(),
        },
        metrics: emptyDecisionMetrics,
        learning: emptyDecisionLearning,
        message: "反馈提交失败，未写入测试数据。请检查真实数据源连接。",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const metricCards = [
    {
      title: "决策命中率",
      value: formatPercent(metrics.metrics.decision_accuracy_score),
      detail: "历史决策与真实业务结果一致的比例。",
      tone: metricTone(metrics.metrics.decision_accuracy_score),
      icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />,
    },
    {
      title: "推荐成功率",
      value: formatPercent(metrics.metrics.recommendation_success_rate),
      detail: "建议推进或锁定观察后产生正向结果的比例。",
      tone: metricTone(metrics.metrics.recommendation_success_rate),
      icon: <TrendingUp className="h-5 w-5" aria-hidden="true" />,
    },
    {
      title: "拦截准确率",
      value: formatPercent(metrics.metrics.blocked_correct_rate),
      detail: "被拦截机会后续被验证为低收益或低转化的比例。",
      tone: metricTone(metrics.metrics.blocked_correct_rate),
      icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
    },
    {
      title: "收益偏差率",
      value: formatPercent(metrics.metrics.roi_deviation_rate),
      detail: "实际收益表现与决策目标的平均偏差，越低越好。",
      tone: metricTone(metrics.metrics.roi_deviation_rate, true),
      icon: <Gauge className="h-5 w-5" aria-hidden="true" />,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-7 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                决策复盘 V1
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {sourceLabel(metrics.source)}
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                只记录与分析，不自动执行
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">决策复盘</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                复盘人工决策后的实际结果。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((item) => (
          <MetricCard
            key={item.title}
            title={item.title}
            value={item.value}
            detail={item.detail}
            tone={item.tone}
            icon={item.icon}
          />
        ))}
      </section>

      <details className="compact-details rounded-lg border border-line bg-white shadow-panel">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink">
          查看复盘图表
          <span className="text-xs font-medium text-slate-500">命中率、利润、人工动作</span>
        </summary>
        <div className="border-t border-line p-3">
          <DecisionFeedbackExperienceCharts />
        </div>
      </details>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
                决策结果记录
              </div>
              <h2 className="mt-2 text-xl font-semibold text-ink">记录一次人工决策和业务结果</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                这个表单只写入真实本地数据，不会连接平台，不会下单，不会改价。
              </p>
            </div>
            <ClipboardList className="h-5 w-5 text-forest" aria-hidden="true" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-600">
              商品编号
              <input
                className={inputClass()}
                value={form.product_id}
                onChange={(event) => setForm({ ...form, product_id: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              商品唯一ID
              <input
                className={inputClass()}
                value={form.product_uid}
                onChange={(event) => setForm({ ...form, product_uid: event.target.value })}
                placeholder="可选"
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              平台
              <select
                className={inputClass()}
                value={form.platform}
                onChange={(event) => setForm({ ...form, platform: event.target.value })}
              >
                <option>Shopee</option>
                <option>Mercado Livre</option>
                <option>Amazon BR</option>
                <option>TikTok Shop BR</option>
                <option>Temu</option>
                <option>AliExpress</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              来源
              <select
                className={inputClass()}
                value={form.source}
                onChange={(event) => setForm({ ...form, source: event.target.value as FeedbackFormState["source"] })}
              >
                <option value="shopee">{feedbackSourceLabel("shopee")}</option>
                <option value="manual">{feedbackSourceLabel("manual")}</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              决策状态
              <select
                className={inputClass()}
                value={form.decisionState}
                onChange={(event) =>
                  setForm({ ...form, decisionState: event.target.value as DecisionState })
                }
              >
                <option value="LOCKED">{statusLabel("LOCKED")}</option>
                <option value="RECOMMEND">{statusLabel("RECOMMEND")}</option>
                <option value="OBSERVE">{statusLabel("OBSERVE")}</option>
                <option value="BLOCKED">{statusLabel("BLOCKED")}</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              人工动作
              <select
                className={inputClass()}
                value={form.user_action}
                onChange={(event) =>
                  setForm({ ...form, user_action: event.target.value as DecisionUserAction })
                }
              >
                <option value="buy">{decisionUserActionLabel("buy")}</option>
                <option value="ignore">{decisionUserActionLabel("ignore")}</option>
                <option value="observe">{decisionUserActionLabel("observe")}</option>
                <option value="reject">{decisionUserActionLabel("reject")}</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              实际销量
              <input
                className={inputClass()}
                type="number"
                value={form.actual_sales}
                onChange={(event) => setForm({ ...form, actual_sales: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              实际利润
              <input
                className={inputClass()}
                type="number"
                value={form.actual_profit}
                onChange={(event) => setForm({ ...form, actual_profit: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              实际 ROI
              <input
                className={inputClass()}
                type="number"
                step="0.01"
                value={form.roi_real}
                onChange={(event) => setForm({ ...form, roi_real: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              库存变化
              <input
                className={inputClass()}
                type="number"
                value={form.stock_change}
                onChange={(event) => setForm({ ...form, stock_change: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              转化率
              <input
                className={inputClass()}
                type="number"
                step="0.001"
                value={form.conversion_rate}
                onChange={(event) => setForm({ ...form, conversion_rate: event.target.value })}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void submitFeedback()}
            disabled={submitting || !form.product_id}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {submitting ? "提交中" : "提交反馈"}
          </button>

          {submitResult ? (
            <div className="mt-4 rounded-lg border border-line bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              <div className="font-semibold text-ink">{submitResult.message}</div>
              <div className="mt-1">
                数据来源：{sourceLabel(submitResult.source)} / 是否已保存：{submitResult.persisted ? "是" : "否"}
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
                决策效果评估
              </div>
              <h2 className="mt-2 text-xl font-semibold text-ink">系统正在学习哪些判断靠谱</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                所有学习结果只是评分和优先级建议，不会自动修改商品、价格、库存或广告。
              </p>
            </div>
            <BrainCircuit className="h-5 w-5 text-forest" aria-hidden="true" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line p-4">
              <div className="text-sm text-slate-500">总决策数</div>
              <div className="mt-2 text-2xl font-semibold text-ink">
                {formatCount(metrics.metrics.total_decisions)}
              </div>
            </div>
            <div className="rounded-lg border border-line p-4">
              <div className="text-sm text-slate-500">已评估决策</div>
              <div className="mt-2 text-2xl font-semibold text-ink">
                {formatCount(metrics.metrics.evaluated_decisions)}
              </div>
            </div>
            <div className="rounded-lg border border-line p-4">
              <div className="text-sm text-slate-500">利润命中率</div>
              <div className="mt-2 text-2xl font-semibold text-forest">
                {formatPercent(metrics.metrics.profit_accuracy)}
              </div>
            </div>
            <div className="rounded-lg border border-line p-4">
              <div className="text-sm text-slate-500">生成时间</div>
              <div className="mt-2 text-sm font-semibold text-ink">
                {formatDateTime(metrics.generated_at)}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {metrics.learning.scoring_weight_updates.map((item) => (
              <article key={item.weight_key} className="rounded-lg border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-ink">{item.weight_key}</div>
                  <div className="text-xs text-slate-500">
                    {formatPercent(item.current_weight)} → {formatPercent(item.suggested_weight)}
                  </div>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
              决策历史
            </div>
            <h2 className="mt-2 text-xl font-semibold text-ink">历史决策与业务回写</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              运营可以在这里回看每个产品的决策状态、人工动作和真实经营结果。
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="border-b border-line px-3 py-2">商品ID</th>
                  <th className="border-b border-line px-3 py-2">决策状态</th>
                  <th className="border-b border-line px-3 py-2">人工动作</th>
                  <th className="border-b border-line px-3 py-2">实际利润</th>
                  <th className="border-b border-line px-3 py-2">实际 ROI</th>
                  <th className="border-b border-line px-3 py-2">来源</th>
                </tr>
              </thead>
              <tbody>
                {history.history.map((item) => (
                  <tr key={item.decision_id} className="align-top">
                    <td className="border-b border-line px-3 py-3">
                      <div className="font-medium text-ink">{item.product_id}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatDateTime(item.timestamp)}</div>
                    </td>
                    <td className="border-b border-line px-3 py-3">
                      <StatusPill status={item.decisionState} />
                    </td>
                    <td className="border-b border-line px-3 py-3 text-slate-600">{decisionUserActionLabel(item.user_action)}</td>
                    <td className="border-b border-line px-3 py-3 text-slate-600">
                      {item.outcome ? formatBrl(item.outcome.actual_profit) : "-"}
                    </td>
                    <td className="border-b border-line px-3 py-3 text-slate-600">
                      {item.outcome ? item.outcome.roi_real.toFixed(2) : "-"}
                    </td>
                    <td className="border-b border-line px-3 py-3 text-slate-600">{feedbackSourceLabel(item.source)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
              反馈学习机制
            </div>
            <h2 className="mt-2 text-xl font-semibold text-ink">优先级和偏差修正建议</h2>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">推荐优先级</h3>
              <div className="mt-3 space-y-3">
                {metrics.learning.recommendation_priority_updates.map((item) => (
                  <article key={`${item.product_id}_${item.reason}`} className="rounded-lg border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-ink">{item.product_id}</div>
                      <div className="text-xs text-slate-500">
                        {item.current_priority} → {item.suggested_priority}
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-ink">决策规则偏差</h3>
              <div className="mt-3 space-y-3">
                {metrics.learning.decision_engine_bias_corrections.map((item) => (
                  <article key={item.bias_key} className="rounded-lg border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-ink">{item.bias_key}</div>
                      <span className="rounded-md border border-line bg-slate-50 px-2 py-1 text-xs text-slate-600">
                        {item.correction_direction} / {formatPercent(item.confidence)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
