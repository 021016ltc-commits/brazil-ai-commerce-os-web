"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  BadgeAlert,
  Boxes,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import {
  opportunityKeywordsMock,
  opportunityMarketScoreMock,
  opportunityProductsMock,
  opportunityScoreMock,
} from "@/data/opportunitiesMock";
import { formatBrl } from "@/lib/format";
import {
  buildKeywordOpportunities,
  buildRiskAlerts,
  buildTodayOpportunities,
  riskLevelRank,
} from "@/lib/opportunities";
import type {
  OpportunitiesApiResponse,
  OpportunityProductItem,
  OpportunityRiskAlert,
  Platform,
  RiskLevel,
} from "@/types";

type PlatformFilter = "all" | Platform;
type RecommendationFilter = "all" | "A" | "B" | "C";
type RiskFilter = "all" | RiskLevel;
type SortKey = "opportunity_score" | "market_score" | "risk_level";

const fallbackOpportunities: OpportunitiesApiResponse = {
  source: "mock",
  products: opportunityProductsMock,
  keywords: opportunityKeywordsMock,
  market_score: opportunityMarketScoreMock,
  opportunity_score: opportunityScoreMock,
  today_opportunities: buildTodayOpportunities(opportunityProductsMock, opportunityScoreMock),
  keyword_opportunities: buildKeywordOpportunities(
    opportunityKeywordsMock,
    opportunityMarketScoreMock,
    opportunityScoreMock,
  ),
  risk_alerts: buildRiskAlerts(opportunityProductsMock, opportunityScoreMock),
};

function sourceLabel(source: OpportunitiesApiResponse["source"]) {
  return source === "sqlite" ? "本地数据" : "备用数据";
}

function recommendationTone(level: "A" | "B" | "C") {
  if (level === "A") return "good";
  if (level === "B") return "warn";
  return "neutral";
}

function recommendationLabel(level: "A" | "B" | "C") {
  return `${level}级机会`;
}

function sortLabel(sortBy: SortKey) {
  if (sortBy === "market_score") return "按市场评分";
  if (sortBy === "risk_level") return "按风险等级";
  return "按机会评分";
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

function sortTodayOpportunities(items: OpportunityProductItem[], sortBy: SortKey) {
  return [...items].sort((left, right) => {
    if (sortBy === "market_score") return right.market_score - left.market_score;
    if (sortBy === "risk_level") {
      const levelDelta = riskLevelRank(right.risk_level) - riskLevelRank(left.risk_level);
      return levelDelta !== 0 ? levelDelta : right.opportunity_score - left.opportunity_score;
    }
    return right.opportunity_score - left.opportunity_score;
  });
}

function sortRiskAlerts(items: OpportunityRiskAlert[], sortBy: SortKey, scoreMap: Map<string, OpportunityProductItem>) {
  return [...items].sort((left, right) => {
    if (sortBy === "risk_level") return riskLevelRank(right.risk_level) - riskLevelRank(left.risk_level);

    const leftScore = scoreMap.get(left.product_uid);
    const rightScore = scoreMap.get(right.product_uid);
    if (sortBy === "market_score") return (rightScore?.market_score ?? 0) - (leftScore?.market_score ?? 0);
    return (rightScore?.opportunity_score ?? 0) - (leftScore?.opportunity_score ?? 0);
  });
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

export default function OpportunitiesPage() {
  const [data, setData] = useState<OpportunitiesApiResponse>(fallbackOpportunities);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [recommendationFilter, setRecommendationFilter] = useState<RecommendationFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("opportunity_score");

  useEffect(() => {
    let active = true;
    fetch("/api/opportunities", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: OpportunitiesApiResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(fallbackOpportunities);
      });

    return () => {
      active = false;
    };
  }, []);

  const platformOptions = Array.from(new Set(data.today_opportunities.map((item) => item.platform)));
  const productScoreMap = new Map(data.today_opportunities.map((item) => [item.product_uid, item]));
  const keywordRecommendationMap = new Map(data.opportunity_score.map((item) => [item.keyword_uid, item.recommendation_level ?? item.suggestion_level]));
  const keywordRiskMap = new Map(data.opportunity_score.map((item) => [item.keyword_uid, item.risk_level]));
  const productRecommendationMap = new Map(
    data.today_opportunities.map((item) => [item.product_uid, item.recommendation_level]),
  );

  const filteredTodayOpportunities = sortTodayOpportunities(
    data.today_opportunities.filter((item) => {
      if (platformFilter !== "all" && item.platform !== platformFilter) return false;
      if (recommendationFilter !== "all" && item.recommendation_level !== recommendationFilter) return false;
      if (riskFilter !== "all" && item.risk_level !== riskFilter) return false;
      return true;
    }),
    sortBy,
  );

  const filteredKeywordOpportunities = [...data.keyword_opportunities]
    .filter((item) => {
      if (platformFilter !== "all" && item.platform !== platformFilter) return false;
      if (recommendationFilter !== "all" && keywordRecommendationMap.get(item.keyword_uid) !== recommendationFilter) {
        return false;
      }
      if (riskFilter !== "all" && keywordRiskMap.get(item.keyword_uid) !== riskFilter) return false;
      return true;
    })
    .sort((left, right) => {
      if (sortBy === "market_score") return right.total_score - left.total_score;
      if (sortBy === "risk_level") {
        return riskLevelRank(keywordRiskMap.get(right.keyword_uid) ?? "low") - riskLevelRank(keywordRiskMap.get(left.keyword_uid) ?? "low");
      }

      const leftOpportunity = data.opportunity_score.find((item) => item.keyword_uid === left.keyword_uid)?.opportunity_score ?? 0;
      const rightOpportunity = data.opportunity_score.find((item) => item.keyword_uid === right.keyword_uid)?.opportunity_score ?? 0;
      return rightOpportunity - leftOpportunity;
    });

  const filteredRiskAlerts = sortRiskAlerts(
    data.risk_alerts.filter((item) => {
      if (platformFilter !== "all" && item.platform !== platformFilter) return false;
      if (recommendationFilter !== "all" && productRecommendationMap.get(item.product_uid) !== recommendationFilter) {
        return false;
      }
      if (riskFilter !== "all" && item.risk_level !== riskFilter) return false;
      return true;
    }),
    sortBy,
    productScoreMap,
  );

  const aLevelCount = data.today_opportunities.filter((item) => item.recommendation_level === "A").length;
  const highRiskCount = data.risk_alerts.filter((item) => item.risk_level === "high").length;

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-line bg-white p-5 shadow-panel sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                机会中心 V0.1
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {sourceLabel(data.source)}
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                接口数据 + 备用数据
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">机会中心</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                这个页面把“今天先看哪些品、哪些关键词值得盯、哪些风险不能忽略”放在一个操作面里。
                运营不需要先翻多页，只要先筛一遍平台、机会等级和风险等级，就能决定今天的人工优先级。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">今日机会品</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{data.today_opportunities.length}</div>
              <div className="mt-1 text-sm text-slate-500">今天应该先看一轮的商品候选。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">A级机会</div>
              <div className="mt-2 text-2xl font-semibold text-forest">{aLevelCount}</div>
              <div className="mt-1 text-sm text-slate-500">值得优先进入人工判断的高分机会。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">关键词机会</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{data.keyword_opportunities.length}</div>
              <div className="mt-1 text-sm text-slate-500">更适合看市场需求和竞争强弱。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">高风险提醒</div>
              <div className="mt-2 text-2xl font-semibold text-coral">{highRiskCount}</div>
              <div className="mt-1 text-sm text-slate-500">先挡住风险，再谈放量和动作。</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">筛选与排序</div>
            <h2 className="text-lg font-semibold text-ink">先缩小范围，再决定优先顺序</h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              平台筛选用来回答“我现在看哪个渠道”，机会等级用来回答“哪些值得先看”，风险等级用来回答“哪些必须先防守”。
              排序则决定你是按机会分、市场分，还是按风险强度来排今天的处理顺序。
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
            <span className="text-sm font-medium text-ink">机会等级筛选</span>
            <select
              value={recommendationFilter}
              onChange={(event) => setRecommendationFilter(event.target.value as RecommendationFilter)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="all">全部等级</option>
              <option value="A">A级机会</option>
              <option value="B">B级机会</option>
              <option value="C">C级机会</option>
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
            <span className="text-sm font-medium text-ink">排序方式</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortKey)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="opportunity_score">按机会评分</option>
              <option value="market_score">按市场评分</option>
              <option value="risk_level">按风险等级</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="今日机会品"
          title="今天优先看的商品"
          description="这里把商品信息、市场分、机会分和人工判断备注放在一起。业务上它回答的是：今天先复核哪些品，为什么先看它们。"
        />

        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="text-sm text-slate-500">
              当前结果 {filteredTodayOpportunities.length} 条，{sortLabel(sortBy)}。
            </div>
            <div className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              优先把 A 级且高风险的品先做人工判断
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">商品ID</th>
                  <th className="px-4 py-3">平台</th>
                  <th className="px-4 py-3">当前标题</th>
                  <th className="px-4 py-3">价格</th>
                  <th className="px-4 py-3">评分</th>
                  <th className="px-4 py-3">销量</th>
                  <th className="px-4 py-3">市场评分</th>
                  <th className="px-4 py-3">机会评分</th>
                  <th className="px-4 py-3">机会等级</th>
                  <th className="px-4 py-3">风险等级</th>
                  <th className="px-4 py-3">判断备注</th>
                </tr>
              </thead>
              <tbody>
                {filteredTodayOpportunities.map((item) => (
                  <tr key={item.product_uid} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-medium text-ink">{item.product_uid}</td>
                    <td className="px-4 py-3 text-slate-700">{item.platform}</td>
                    <td className="px-4 py-3">
                      <div className="max-w-[240px] text-sm font-medium text-ink">{item.title_current}</div>
                    </td>
                    <td className="px-4 py-3">{formatBrl(item.price_amount)}</td>
                    <td className="px-4 py-3">{item.rating.toFixed(1)}</td>
                    <td className="px-4 py-3 text-slate-600">{item.sold_count_text}</td>
                    <td className="px-4 py-3 font-semibold text-ink">{item.market_score}</td>
                    <td className="px-4 py-3 font-semibold text-forest">{item.opportunity_score}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={recommendationLabel(item.recommendation_level)} tone={recommendationTone(item.recommendation_level)} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={item.risk_level} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.decision_notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 md:hidden">
            {filteredTodayOpportunities.map((item) => (
              <article key={item.product_uid} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">{item.title_current}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.product_uid}</div>
                  </div>
                  <StatusPill status={item.risk_level} />
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600">
                  <div>{item.platform}</div>
                  <div>{formatBrl(item.price_amount)}</div>
                  <div>评分 {item.rating.toFixed(1)} / 销量 {item.sold_count_text}</div>
                  <div>市场分 {item.market_score} / 机会分 {item.opportunity_score}</div>
                  <div>{recommendationLabel(item.recommendation_level)}</div>
                  <div>{item.decision_notes}</div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="关键词机会"
          title="先看需求和竞争，再决定要不要深挖"
          description="这个模块更偏市场层。业务上它回答的是：今天哪些关键词值得继续看，哪些词虽然热，但竞争和趋势并不支持立刻投入。"
        />

        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="text-sm text-slate-500">关键词机会 {filteredKeywordOpportunities.length} 条。</div>
            <div className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <Search className="h-4 w-4" aria-hidden="true" />
              适合先决定“值得不值得继续追”
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">关键词ID</th>
                  <th className="px-4 py-3">关键词</th>
                  <th className="px-4 py-3">类目提示</th>
                  <th className="px-4 py-3">需求评分</th>
                  <th className="px-4 py-3">竞争评分</th>
                  <th className="px-4 py-3">趋势评分</th>
                  <th className="px-4 py-3">综合评分</th>
                </tr>
              </thead>
              <tbody>
                {filteredKeywordOpportunities.map((item) => (
                  <tr key={item.keyword_uid} className="border-t border-line">
                    <td className="px-4 py-3 font-medium text-ink">{item.keyword_uid}</td>
                    <td className="px-4 py-3 text-slate-700">{item.keyword}</td>
                    <td className="px-4 py-3 text-slate-600">{item.category_hint}</td>
                    <td className="px-4 py-3">{item.market_demand_score}</td>
                    <td className="px-4 py-3">{item.competition_score}</td>
                    <td className="px-4 py-3">{item.trend_score}</td>
                    <td className="px-4 py-3 font-semibold text-forest">{item.total_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="风险提示"
          title="先把会拖慢执行的点挑出来"
          description="风险提示不是让系统自动动作，而是提醒运营先处理履约、合规、库存和样本不足这些会误伤判断的地方。"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRiskAlerts.map((item) => (
            <article key={item.risk_id} className="rounded-lg border border-line bg-white p-5 shadow-panel">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">{riskTypeLabel(item.risk_type)}</div>
                  <h3 className="text-base font-semibold text-ink">{item.affected_product}</h3>
                </div>
                <StatusPill status={item.risk_level} />
              </div>

              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <div className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                  <BadgeAlert className="h-4 w-4" aria-hidden="true" />
                  {item.platform} / {item.product_uid}
                </div>
                <p>{item.reason}</p>
                <div className="rounded-lg border border-line bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-400">建议动作</div>
                  <div className="mt-1 text-sm font-medium text-ink">{item.suggested_action}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-center gap-3 text-ink">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
            <h3 className="text-base font-semibold">机会分怎么看</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            机会分更像今天的执行优先级。它把市场分、利润空间、内容缺口和风险一起考虑，帮助你决定先审哪一批商品。
          </p>
        </article>
        <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-center gap-3 text-ink">
            <Boxes className="h-5 w-5" aria-hidden="true" />
            <h3 className="text-base font-semibold">关键词表在看什么</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            关键词表更偏市场判断。需求高、竞争可控、趋势向上的词，才值得你继续让团队往下做素材、详情和复核。
          </p>
        </article>
        <article className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-center gap-3 text-ink">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <h3 className="text-base font-semibold">风险提示怎么用</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            风险提示是为了把错误执行挡在前面。先确认库存、物流、合规和评论样本，再决定要不要把机会真正推进到下一步。
          </p>
        </article>
      </section>
    </div>
  );
}
