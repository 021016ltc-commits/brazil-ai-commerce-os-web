"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  Bot,
  BrainCircuit,
  LineChart,
  ShieldCheck,
} from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { emptyAnalysisResponse } from "@/data/emptyResponses";
import {
  analysisPriorityRank,
  riskLevelRank,
} from "@/lib/analysis";
import type {
  AnalysisApiResponse,
  AnalysisPriority,
  Platform,
  RiskLevel,
} from "@/types";

type PlatformFilter = "all" | Platform;
type RiskFilter = "all" | RiskLevel;
type PriorityFilter = "all" | AnalysisPriority;
type SortKey = "opportunity_score" | "risk_level" | "demand_score" | "priority";

const fallbackAnalysis: AnalysisApiResponse = emptyAnalysisResponse;

function sourceLabel(source: AnalysisApiResponse["source"]) {
  return source === "sqlite" ? "真实数据" : "测试数据已禁用";
}

function priorityTone(priority: AnalysisPriority) {
  if (priority === "P1") return "risk";
  if (priority === "P2") return "warn";
  return "neutral";
}

function sortLabel(sortBy: SortKey) {
  if (sortBy === "risk_level") return "按风险等级";
  if (sortBy === "demand_score") return "按需求评分";
  if (sortBy === "priority") return "按建议优先级";
  return "按机会评分";
}

function trendLabel(direction: "up" | "flat" | "down") {
  return {
    up: "上行",
    flat: "平稳",
    down: "回落",
  }[direction];
}

function recommendationTypeLabel(type: string) {
  const labels: Record<string, string> = {
    manual_risk_gate: "人工风控闸门",
    supply_validation: "供给确认",
    content_validation: "内容补强",
    listing_optimization: "商品优化",
    listing_watch: "继续观察",
    approval_queue_cleanup: "审批队列整理",
  };

  return labels[type] ?? type;
}

function riskTypeLabel(type: string) {
  const labels: Record<string, string> = {
    policy_compliance: "合规风险",
    inventory_tension: "库存风险",
    logistics_latency: "物流风险",
    review_sample_gap: "样本风险",
    competition_pressure: "竞争风险",
  };

  return labels[type] ?? type;
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

export default function AnalysisPage() {
  const [data, setData] = useState<AnalysisApiResponse>(fallbackAnalysis);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("opportunity_score");

  useEffect(() => {
    let active = true;
    fetch("/api/analysis", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: AnalysisApiResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(fallbackAnalysis);
      });

    return () => {
      active = false;
    };
  }, []);

  const platformOptions = Array.from(
    new Set([
      ...data.opportunity_analysis.map((item) => item.platform),
      ...data.market_analysis.map((item) => item.platform),
      ...data.ai_recommendations.map((item) => item.platform),
    ]),
  );

  const filteredOpportunityAnalysis = [...data.opportunity_analysis]
    .filter((item) => {
      if (platformFilter !== "all" && item.platform !== platformFilter) return false;
      if (riskFilter !== "all" && item.risk_level !== riskFilter) return false;
      return true;
    })
    .sort((left, right) => {
      if (sortBy === "risk_level") {
        return riskLevelRank(right.risk_level) - riskLevelRank(left.risk_level);
      }
      return right.opportunity_score - left.opportunity_score;
    });

  const filteredRiskAnalysis = [...data.risk_analysis]
    .filter((item) => {
      if (platformFilter !== "all" && item.platform !== platformFilter) return false;
      if (riskFilter !== "all" && item.risk_level !== riskFilter) return false;
      return true;
    })
    .sort((left, right) => {
      if (sortBy === "opportunity_score") return riskLevelRank(right.risk_level) - riskLevelRank(left.risk_level);
      return riskLevelRank(right.risk_level) - riskLevelRank(left.risk_level);
    });

  const filteredMarketAnalysis = [...data.market_analysis]
    .filter((item) => {
      if (platformFilter !== "all" && item.platform !== platformFilter) return false;
      return true;
    })
    .sort((left, right) => {
      if (sortBy === "priority" || sortBy === "risk_level") {
        return right.demand_score - left.demand_score;
      }
      if (sortBy === "demand_score") return right.demand_score - left.demand_score;
      return right.demand_score - left.demand_score;
    });

  const filteredAiRecommendations = [...data.ai_recommendations]
    .filter((item) => {
      if (platformFilter !== "all" && item.platform !== platformFilter) return false;
      if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
      return true;
    })
    .sort((left, right) => {
      if (sortBy === "priority") {
        return analysisPriorityRank(right.priority) - analysisPriorityRank(left.priority);
      }
      return analysisPriorityRank(right.priority) - analysisPriorityRank(left.priority);
    });

  const p1Count = data.ai_recommendations.filter((item) => item.priority === "P1").length;
  const highRiskCount = data.risk_analysis.filter((item) => item.risk_level === "high").length;

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-line bg-white p-5 shadow-panel sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                数据分析 V0.1
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {sourceLabel(data.source)}
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                规则分析 + 真实数据
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">数据分析</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                这个页面把“哪些机会值得今天优先看、哪些风险会拖慢执行、哪些类目趋势还在走强、哪些建议该先进入人工判断”
                放到同一个分析面板里。它不连接真实 AI 模型，而是用规则引擎把真实业务数据整理成可执行的分析结论。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">机会分析</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{data.opportunity_analysis.length}</div>
              <div className="mt-1 text-sm text-slate-500">今天可进入人工复核的分析项。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">高风险分析</div>
              <div className="mt-2 text-2xl font-semibold text-coral">{highRiskCount}</div>
              <div className="mt-1 text-sm text-slate-500">先防守，再决定是否推进后续动作。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">市场分析</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{data.market_analysis.length}</div>
              <div className="mt-1 text-sm text-slate-500">按类目看需求、竞争和趋势方向。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">P1建议</div>
              <div className="mt-2 text-2xl font-semibold text-forest">{p1Count}</div>
              <div className="mt-1 text-sm text-slate-500">最值得今天先处理的建议项。</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">筛选与排序</div>
            <h2 className="text-lg font-semibold text-ink">先缩小范围，再安排今天的分析顺序</h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              平台筛选回答“我先看哪个渠道”，风险筛选回答“哪些问题必须先处理”，建议优先级筛选回答“哪些动作更值得今天先做人审”，
              排序则决定你是按机会、风险、需求还是建议优先级来排处理顺序。
            </p>
          </div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-ink">
            <ArrowDownWideNarrow className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            <span className="text-sm font-medium text-ink">风险等级筛选</span>
            <select
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="all">全部风险</option>
              <option value="high">高风险</option>
              <option value="medium">中风险</option>
              <option value="low">低风险</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">建议优先级</span>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="all">全部优先级</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">排序方式</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortKey)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="opportunity_score">按机会评分</option>
              <option value="risk_level">按风险等级</option>
              <option value="demand_score">按需求评分</option>
              <option value="priority">按优先级</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="机会分析"
          title="今天优先做人工判断的机会项"
          description="机会分析回答的是：今天先看哪些商品、它们为什么值得先看、以及看完之后应该把它们推进到哪一步。"
        />

        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="text-sm text-slate-500">
              当前结果 {filteredOpportunityAnalysis.length} 条，{sortLabel(sortBy)}。
            </div>
            <div className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <BrainCircuit className="h-4 w-4" aria-hidden="true" />
              先看高分机会，再决定哪些要进入人工审批
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">分析ID</th>
                  <th className="px-4 py-3">商品ID</th>
                  <th className="px-4 py-3">机会评分</th>
                  <th className="px-4 py-3">分析摘要</th>
                  <th className="px-4 py-3">分析原因</th>
                  <th className="px-4 py-3">建议</th>
                </tr>
              </thead>
              <tbody>
                {filteredOpportunityAnalysis.map((item) => (
                  <tr key={item.analysis_id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-medium text-ink">{item.analysis_id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{item.product_uid}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.platform}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-forest">{item.opportunity_score}</td>
                    <td className="px-4 py-3 text-slate-700">{item.analysis_summary}</td>
                    <td className="px-4 py-3 text-slate-600">{item.analysis_reason}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <StatusPill status={item.risk_level} />
                        <div className="text-sm text-slate-600">{item.recommendation}</div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 md:hidden">
            {filteredOpportunityAnalysis.map((item) => (
              <article key={item.analysis_id} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">{item.analysis_id}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.platform} / {item.product_uid}
                    </div>
                  </div>
                  <StatusPill status={item.risk_level} />
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div>机会评分 {item.opportunity_score}</div>
                  <div>{item.analysis_summary}</div>
                  <div>{item.analysis_reason}</div>
                  <div>{item.recommendation}</div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="风险分析"
          title="先找出会拖慢执行的风险点"
          description="风险分析回答的是：哪些问题会让高分机会无法安全推进，以及每类风险最稳妥的人工缓解动作是什么。"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRiskAnalysis.map((item) => (
            <article key={item.risk_id} className="rounded-lg border border-line bg-white p-5 shadow-panel">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
                    {riskTypeLabel(item.risk_type)}
                  </div>
                  <h3 className="text-base font-semibold text-ink">{item.product_uid}</h3>
                </div>
                <StatusPill status={item.risk_level} />
              </div>

              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <div className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  {item.platform}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">风险原因</div>
                  <div className="mt-1">{item.risk_reason}</div>
                </div>
                <div className="rounded-lg border border-line bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">缓解动作</div>
                  <div className="mt-1 text-sm font-medium text-ink">{item.mitigation_action}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="市场分析"
          title="从类目角度看需求、竞争和趋势"
          description="市场分析回答的是：哪些类目需求还在，竞争是否可控，趋势方向是否仍然支持继续投入人工精力。"
        />

        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="text-sm text-slate-500">市场分析 {filteredMarketAnalysis.length} 条。</div>
            <div className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <LineChart className="h-4 w-4" aria-hidden="true" />
              需求高但竞争仍可控的类目，更值得继续盯
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">类目</th>
                  <th className="px-4 py-3">需求评分</th>
                  <th className="px-4 py-3">竞争评分</th>
                  <th className="px-4 py-3">趋势方向</th>
                </tr>
              </thead>
              <tbody>
                {filteredMarketAnalysis.map((item) => (
                  <tr key={item.market_score_id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{item.category}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.platform}</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink">{item.demand_score}</td>
                    <td className="px-4 py-3">{item.competition_score}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={trendLabel(item.trend_direction)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="AI建议"
          title="把分析结果收敛成今天可执行的建议"
          description="AI建议不直接触发动作，而是把分析结果收敛成人工可审的下一步建议，帮助团队决定先看什么、先批什么、先防什么。"
        />

        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="text-sm text-slate-500">
              当前建议 {filteredAiRecommendations.length} 条，{sortLabel(sortBy)}。
            </div>
            <div className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <Bot className="h-4 w-4" aria-hidden="true" />
              所有建议仍停留在人工判断层，不自动执行
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">建议类型</th>
                  <th className="px-4 py-3">优先级</th>
                  <th className="px-4 py-3">建议动作</th>
                  <th className="px-4 py-3">预期影响</th>
                </tr>
              </thead>
              <tbody>
                {filteredAiRecommendations.map((item) => (
                  <tr key={item.recommendation_id} className="border-t border-line align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{recommendationTypeLabel(item.recommendation_type)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.platform} / {item.product_uid}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={item.priority} tone={priorityTone(item.priority)} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.action_suggestion}</td>
                    <td className="px-4 py-3 text-slate-600">{item.expected_impact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-center gap-3 text-ink">
            <BrainCircuit className="h-5 w-5" aria-hidden="true" />
            <h3 className="text-base font-semibold">机会分析怎么用</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            机会分析更像今天的人工复核清单。先看高分、再看风险、最后看建议，能快速知道哪些品该先进入判断流程。
          </p>
        </article>
        <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-center gap-3 text-ink">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <h3 className="text-base font-semibold">风险分析怎么用</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            风险分析的目标不是否掉机会，而是提前识别会误伤执行的地方，让团队先把人工防守动作做完。
          </p>
        </article>
        <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-center gap-3 text-ink">
            <Bot className="h-5 w-5" aria-hidden="true" />
            <h3 className="text-base font-semibold">AI建议怎么用</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            AI建议只是本地规则引擎生成的建议清单，用来辅助运营排序和人工审批，不会自动触发任何平台动作。
          </p>
        </article>
      </section>
    </div>
  );
}
