"use client";

import { Check, Clock3, Filter, History, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MoreActionsMenu, dataStatusLabel } from "@/components/OperatorControls";
import { StatusPill } from "@/components/StatusPill";
import { emptyApprovalsResponse } from "@/data/emptyResponses";
import { buildApprovalHistoryItem, buildApprovalStats, approvalPriorityRank } from "@/lib/approvals";
import { formatPercent } from "@/lib/format";
import { priorityLabel, riskLevelLabel } from "@/locales/zh-CN";
import type {
  ApprovalsApiResponse,
  ApprovalHistoryItem,
  ApprovalQueueItem,
  ReviewStatus,
} from "@/types";

type StatusFilter = "all" | ReviewStatus;
type PriorityFilter = "all" | "P1" | "P2" | "P3";
type SortKey = "created_at" | "priority" | "status";

const fallbackApprovals: ApprovalsApiResponse = emptyApprovalsResponse;

function sourceLabel(source: ApprovalsApiResponse["source"]) {
  return dataStatusLabel(source);
}

function recommendationTypeLabel(type: ApprovalQueueItem["recommendation_type"]) {
  const labels: Record<ApprovalQueueItem["recommendation_type"], string> = {
    listing_review: "商品复核",
    title_review: "标题复核",
    price_review: "价格复核",
    image_review: "主图复核",
  };

  return labels[type] ?? type;
}

function historyActionLabel(action: ReviewStatus) {
  const labels: Record<ReviewStatus, string> = {
    pending_review: "待审批",
    approved_local: "批准",
    rejected_local: "拒绝",
    deferred_local: "延后处理",
  };

  return labels[action];
}

function sortLabel(sortBy: SortKey) {
  if (sortBy === "priority") return "按优先级排序";
  if (sortBy === "status") return "按状态排序";
  return "按创建时间排序";
}

function statusRank(status: ReviewStatus) {
  return {
    pending_review: 4,
    deferred_local: 3,
    approved_local: 2,
    rejected_local: 1,
  }[status];
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

export default function ApprovalsPage() {
  const [data, setData] = useState<ApprovalsApiResponse>(fallbackApprovals);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<"all" | ApprovalQueueItem["platform"]>("all");
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [busyApprovalId, setBusyApprovalId] = useState<string | null>(null);

  async function refreshApprovals() {
    const response = await fetch("/api/approvals", { cache: "no-store" });
    if (!response.ok) throw new Error("审批数据加载失败。");
    const payload = (await response.json()) as ApprovalsApiResponse;
    setData(payload);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/approvals", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: ApprovalsApiResponse) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setData(fallbackApprovals);
      });

    return () => {
      active = false;
    };
  }, []);

  const platformOptions = Array.from(new Set(data.approval_queue.map((item) => item.platform)));

  const filteredQueue = useMemo(() => {
    return [...data.approval_queue]
      .filter((item) => {
        if (statusFilter !== "all" && item.status !== statusFilter) return false;
        if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
        if (platformFilter !== "all" && item.platform !== platformFilter) return false;
        return true;
      })
      .sort((left, right) => {
        if (sortBy === "priority") {
          const priorityDelta = approvalPriorityRank(right.priority) - approvalPriorityRank(left.priority);
          if (priorityDelta !== 0) return priorityDelta;
        }
        if (sortBy === "status") {
          const statusDelta = statusRank(right.status) - statusRank(left.status);
          if (statusDelta !== 0) return statusDelta;
        }
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      });
  }, [data.approval_queue, platformFilter, priorityFilter, sortBy, statusFilter]);

  const filteredHistory = useMemo(() => {
    return [...data.approval_history]
      .filter((item) => {
        if (statusFilter !== "all" && item.action !== statusFilter) return false;
        const queueItem = data.approval_queue.find((entry) => entry.approval_id === item.approval_id);
        if (priorityFilter !== "all" && queueItem?.priority !== priorityFilter) return false;
        if (platformFilter !== "all" && queueItem?.platform !== platformFilter) return false;
        return true;
      })
      .sort((left, right) => new Date(right.reviewed_at).getTime() - new Date(left.reviewed_at).getTime());
  }, [data.approval_history, data.approval_queue, platformFilter, priorityFilter, statusFilter]);

  function applyOptimisticStatus(approvalId: string, status: ReviewStatus, notes?: string) {
    const reviewedAt = new Date().toISOString();
    const historyEntry: ApprovalHistoryItem = buildApprovalHistoryItem({
      approvalId,
      action: status,
      reviewer: "local_operator",
      reviewedAt,
      notes,
    });

    setData((current) => {
      const nextQueue = current.approval_queue.map((item) =>
        item.approval_id === approvalId
          ? {
              ...item,
              status,
              reviewer: historyEntry.reviewer,
              reviewed_at: historyEntry.reviewed_at,
              notes: historyEntry.notes,
            }
          : item,
      );

      return {
        ...current,
        approval_queue: nextQueue,
        approval_history: [historyEntry, ...current.approval_history],
        approval_stats: buildApprovalStats(nextQueue),
      };
    });
  }

  async function submitStatus(approvalId: string, status: ReviewStatus) {
    const actionText = historyActionLabel(status);
    if (!window.confirm(`确认${actionText}该审批项？`)) return;

    setBusyApprovalId(approvalId);
    const notes = draftNotes[approvalId]?.trim();
    applyOptimisticStatus(approvalId, status, notes);
    setDraftNotes((current) => ({ ...current, [approvalId]: "" }));

    try {
      const response = await fetch("/api/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approval_id: approvalId,
          status,
          notes,
          reviewer: "local_operator",
        }),
      });

      if (!response.ok) throw new Error("Patch failed");
      const payload = (await response.json()) as { source?: "sqlite" | "mock" };
      if (payload.source === "sqlite") {
        await refreshApprovals();
      }
    } catch {
      // Keep optimistic local state so fallback data remains usable.
    } finally {
      setBusyApprovalId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-7 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                审批中心 V1
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {sourceLabel(data.source)}
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                人工审批，不执行真实平台动作
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">审批中心</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                把建议队列转成人工审批事项，批准、驳回或延后都只更新本地状态，不触发真实平台动作。
              </p>
            </div>
            <MoreActionsMenu onRefresh={() => void refreshApprovals().catch(() => undefined)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">待审批数量</div>
              <div className="mt-2 text-2xl font-semibold text-ink">{data.approval_stats.pending_count}</div>
              <div className="mt-1 text-sm text-slate-500">今天还没做决定的审批项。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">已批准数量</div>
              <div className="mt-2 text-2xl font-semibold text-forest">{data.approval_stats.approved_count}</div>
              <div className="mt-1 text-sm text-slate-500">只代表人工批准，不代表真实执行。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">已拒绝数量</div>
              <div className="mt-2 text-2xl font-semibold text-coral">{data.approval_stats.rejected_count}</div>
              <div className="mt-1 text-sm text-slate-500">说明建议已被人工挡回。</div>
            </div>
            <div className="rounded-lg border border-line bg-white/90 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">延后处理数量</div>
              <div className="mt-2 text-2xl font-semibold text-amber">{data.approval_stats.deferred_count}</div>
              <div className="mt-1 text-sm text-slate-500">说明项目前景还在，但今天先不推进。</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">筛选与排序</div>
            <h2 className="text-lg font-semibold text-ink">先缩小范围，再决定先批哪一类建议</h2>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              状态筛选回答“哪些还没决定”，优先级筛选回答“哪些今天必须先看”，平台筛选回答“我现在看哪个渠道”，
              排序则决定你是按创建时间、优先级还是当前状态来排人工处理顺序。
            </p>
          </div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-ink">
            <Filter className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">状态筛选</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="all">全部状态</option>
              <option value="pending_review">待审批</option>
              <option value="approved_local">已批准</option>
              <option value="rejected_local">已拒绝</option>
              <option value="deferred_local">延后处理</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">优先级筛选</span>
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
            <span className="text-sm font-medium text-ink">平台筛选</span>
            <select
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value as "all" | ApprovalQueueItem["platform"])}
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
            <span className="text-sm font-medium text-ink">排序方式</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortKey)}
              className="h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition focus:border-forest"
            >
              <option value="created_at">按创建时间</option>
              <option value="priority">按优先级</option>
              <option value="status">按状态</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="待审批队列"
          title="今天要人工处理的审批项"
          description="这里是完整审批队列。你可以看到建议类型、优先级、摘要、当前状态和备注入口，并决定批准、拒绝或延后处理。"
        />

        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="text-sm text-slate-500">
              当前结果 {filteredQueue.length} 条，{sortLabel(sortBy)}。
            </div>
            <div className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              延后处理不会执行动作，只会把项目留在人工决策链路
            </div>
          </div>

          <div className="grid gap-4 p-4">
            {filteredQueue.map((item) => {
              const product = data.products.find((entry) => entry.product_uid === item.product_uid);
              const actionable = item.status === "pending_review" || item.status === "deferred_local";
              const note = draftNotes[item.approval_id] ?? item.notes ?? "";
              return (
                <article key={item.approval_id} className="rounded-lg border border-line p-4">
                  <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-ink">{item.recommendation_summary}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            审批编号 {item.approval_id} / {product?.title_current ?? product?.title ?? item.product_uid}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusPill status={item.priority} />
                          <StatusPill status={item.status} />
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">建议类型</div>
                          <div className="mt-1 text-sm text-ink">{recommendationTypeLabel(item.recommendation_type)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">商品编号</div>
                          <div className="mt-1 text-sm text-ink">{item.product_uid}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">优先级</div>
                          <div className="mt-1 text-sm text-ink">{priorityLabel(item.priority)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400">创建时间</div>
                          <div className="mt-1 text-sm text-ink">{item.created_at}</div>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border border-line bg-slate-50 p-3">
                          <div className="text-xs uppercase tracking-wide text-slate-400">平台</div>
                          <div className="mt-1 text-sm font-medium text-ink">{item.platform}</div>
                        </div>
                        <div className="rounded-lg border border-line bg-slate-50 p-3">
                          <div className="text-xs uppercase tracking-wide text-slate-400">风险等级</div>
                          <div className="mt-1 text-sm font-medium text-ink">{riskLevelLabel(item.risk_level)}</div>
                        </div>
                        <div className="rounded-lg border border-line bg-slate-50 p-3">
                          <div className="text-xs uppercase tracking-wide text-slate-400">信心分</div>
                          <div className="mt-1 text-sm font-medium text-ink">{formatPercent(item.confidence_score)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border border-line bg-slate-50 p-4">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400">审批备注</div>
                        <textarea
                          value={note}
                          onChange={(event) =>
                            setDraftNotes((current) => ({ ...current, [item.approval_id]: event.target.value }))
                          }
                          className="mt-2 min-h-[96px] w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-forest"
                          placeholder="记录为什么批准、拒绝或延后。"
                        />
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <button
                          type="button"
                          disabled={!actionable || busyApprovalId === item.approval_id}
                          onClick={() => submitStatus(item.approval_id, "approved_local")}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-forest px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                          {busyApprovalId === item.approval_id ? "处理中" : "批准"}
                        </button>
                        <button
                          type="button"
                          disabled={!actionable || busyApprovalId === item.approval_id}
                          onClick={() => submitStatus(item.approval_id, "rejected_local")}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-coral disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                          {busyApprovalId === item.approval_id ? "处理中" : "驳回"}
                        </button>
                        <button
                          type="button"
                          disabled={!actionable || busyApprovalId === item.approval_id}
                          onClick={() => submitStatus(item.approval_id, "deferred_local")}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          <Clock3 className="h-4 w-4" aria-hidden="true" />
                          {busyApprovalId === item.approval_id ? "处理中" : "延后处理"}
                        </button>
                      </div>

                      <div className="text-xs leading-5 text-slate-500">
                        {item.reviewer && item.reviewed_at
                          ? `最近处理人：${item.reviewer} / ${item.reviewed_at}`
                          : "当前还没有人工处理记录。"}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="审批历史"
          title="保留每一次人工判断"
          description="审批历史用于回答：谁做了决定、什么时候做的、为什么这么做。它帮助团队复盘，而不是触发任何自动执行。"
        />

        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="text-sm text-slate-500">审批历史 {filteredHistory.length} 条。</div>
            <div className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <History className="h-4 w-4" aria-hidden="true" />
              所有记录都停留在本地审批层
            </div>
          </div>

          <div className="operator-scroll">
            <table className="operator-table text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th>审批编号</th>
                  <th>动作</th>
                  <th>处理人</th>
                  <th>处理时间</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item) => (
                  <tr key={item.history_id}>
                    <td className="font-medium text-ink">{item.approval_id}</td>
                    <td>
                      <StatusPill status={item.action} />
                      <div className="mt-1 text-xs text-slate-500">{historyActionLabel(item.action)}</div>
                    </td>
                    <td className="text-slate-700">{item.reviewer}</td>
                    <td className="text-slate-600">{item.reviewed_at}</td>
                    <td className="text-slate-600">{item.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}
