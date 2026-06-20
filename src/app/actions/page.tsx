"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  History,
  LockKeyhole,
  Plus,
  RefreshCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { ActionsExperienceCharts } from "@/components/ModuleExperienceCharts";
import { StatusPill } from "@/components/StatusPill";
import {
  actionExecutionHistoryMock,
  actionExecutionQueueMock,
} from "@/data/actionsMock";
import { buildExecutionStats } from "@/action_execution_layer/guard";
import { formatBrl, formatCount, formatPercent } from "@/lib/format";
import { readStoredUser } from "@/lib/permissions";
import { actionTypeLabelZh, statusLabel, suggestedByLabel, zhCN } from "@/locales/zh-CN";
import type {
  ActionExecutionCreateInput,
  ActionExecutionHistoryApiResponse,
  ActionExecutionMutationResponse,
  ActionExecutionQueueApiResponse,
  ActionExecutionQueueItem,
  ExecutionActionType,
  ExecutionActorRole,
  ExecutionSuggestedBy,
} from "@/types";

const fallbackQueue: ActionExecutionQueueApiResponse = {
  source: "mock",
  queue: actionExecutionQueueMock,
  stats: buildExecutionStats(actionExecutionQueueMock),
};

const fallbackHistory: ActionExecutionHistoryApiResponse = {
  source: "mock",
  history: actionExecutionHistoryMock,
};

type CreateFormState = {
  action_type: ExecutionActionType;
  product_id: string;
  product_uid: string;
  platform: string;
  suggested_by: ExecutionSuggestedBy;
  notes: string;
};

const initialForm: CreateFormState = {
  action_type: "purchase",
  product_id: "ITEM-NEW",
  product_uid: "",
  platform: "Shopee",
  suggested_by: "taskSystem",
  notes: "来自今日任务的本地模拟执行申请。",
};

function sourceLabel(source: ActionExecutionQueueApiResponse["source"]) {
  return source === "sqlite" ? "本地数据" : "备用数据";
}

function inputClass() {
  return "h-10 rounded-md border border-line bg-white px-3 text-sm text-ink outline-none focus:border-forest";
}

function actionTypeLabel(type: ExecutionActionType) {
  return actionTypeLabelZh(type);
}

function statusTone(status: ActionExecutionQueueItem["status"]) {
  if (status === "approved" || status === "executed") return "good";
  if (status === "rejected") return "risk";
  return "warn";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function ActionsPage() {
  const [queueData, setQueueData] = useState<ActionExecutionQueueApiResponse>(fallbackQueue);
  const [historyData, setHistoryData] = useState<ActionExecutionHistoryApiResponse>(fallbackHistory);
  const [actorRole, setActorRole] = useState<ExecutionActorRole>("admin");
  const [actorName, setActorName] = useState("admin@local.br");
  const [form, setForm] = useState<CreateFormState>(initialForm);
  const [message, setMessage] = useState<string | null>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  async function refreshData() {
    const [queueResponse, historyResponse] = await Promise.all([
      fetch("/api/actions/queue", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
      fetch("/api/actions/history", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
    ]);

    setQueueData(queueResponse as ActionExecutionQueueApiResponse);
    setHistoryData(historyResponse as ActionExecutionHistoryApiResponse);
  }

  useEffect(() => {
    const user = readStoredUser();
    if (user?.roles[0]) {
      setActorRole(user.roles[0] as ExecutionActorRole);
      setActorName(user.email);
    }

    refreshData().catch(() => {
      setQueueData(fallbackQueue);
      setHistoryData(fallbackHistory);
    });
  }, []);

  const pendingActions = useMemo(
    () => queueData.queue.filter((item) => item.status === "pending"),
    [queueData.queue],
  );

  async function createAction() {
    setMessage(null);
    const payload: ActionExecutionCreateInput = {
      action_type: form.action_type,
      product_id: form.product_id,
      product_uid: form.product_uid || undefined,
      platform: form.platform as ActionExecutionCreateInput["platform"],
      suggested_by: form.suggested_by,
      requested_by: actorName,
      notes: form.notes,
    };

    try {
      const response = await fetch("/api/actions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ActionExecutionMutationResponse;
      if (!response.ok) throw new Error("创建失败");
      setMessage(result.message);
      await refreshData();
    } catch {
      setMessage("创建失败，页面保持备用数据可用。");
    }
  }

  async function decideAction(actionId: string, decision: "approve" | "reject") {
    setBusyActionId(actionId);
    setMessage(null);

    try {
      const response = await fetch(`/api/actions/${decision}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_id: actionId,
          actor_role: actorRole,
          actor_name: actorName,
          notes:
            decision === "approve"
              ? "页面审批通过。仍然不会自动执行任何平台动作。"
              : "页面审批拒绝。不会执行任何平台动作。",
        }),
      });
      const result = (await response.json()) as ActionExecutionMutationResponse & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "审批失败");
      setMessage(result.message);
      await refreshData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审批失败。");
    } finally {
      setBusyActionId(null);
    }
  }

  const metricCards = [
    {
      title: "待执行数量",
      value: formatCount(queueData.stats.pending_count),
      detail: "所有待执行动作必须先审批，不允许绕过队列。",
      tone: "warn" as const,
      icon: <LockKeyhole className="h-5 w-5" aria-hidden="true" />,
    },
    {
      title: "已批准数量",
      value: formatCount(queueData.stats.approved_count),
      detail: "批准只代表允许后续人工模拟推进，不代表平台已执行。",
      tone: "good" as const,
      icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />,
    },
    {
      title: "已拒绝数量",
      value: formatCount(queueData.stats.rejected_count),
      detail: "被拒绝的动作不会进入任何执行流程。",
      tone: "risk" as const,
      icon: <XCircle className="h-5 w-5" aria-hidden="true" />,
    },
    {
      title: "模拟收益汇总",
      value: formatBrl(queueData.stats.simulated_profit_total),
      detail: "仅为本地模拟收益，不代表真实执行结果。",
      tone: "neutral" as const,
      icon: <ShieldCheck className="h-5 w-5" aria-hidden="true" />,
    },
  ];

  return (
    <div className="space-y-8">
      <ActionsExperienceCharts />

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                {zhCN.pageBadges.actions}
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {sourceLabel(queueData.source)}
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                模拟执行，不连接平台写 API
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-ink">执行中心</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                所有 purchase、stock、price、ad、listing 动作必须先进入执行队列。
                operator 可以发起，admin 可以审批，finance 只能审核成本类动作。
                当前页面只做审批和模拟，不会自动下单、改价、上架或投放广告。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refreshData().catch(() => undefined)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            刷新
          </button>
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

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
                执行申请
              </div>
              <h2 className="mt-2 text-xl font-semibold text-ink">创建一个受控执行申请</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                申请只进入本地执行审批池，不会连接 Shopee 或任何平台写接口。
              </p>
            </div>
            <Plus className="h-5 w-5 text-forest" aria-hidden="true" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-600">
              操作人角色
              <select
                className={inputClass()}
                value={actorRole}
                onChange={(event) => setActorRole(event.target.value as ExecutionActorRole)}
              >
                <option value="admin">{zhCN.roles.admin}</option>
                <option value="operator">{zhCN.roles.operator}</option>
                <option value="finance">{zhCN.roles.finance}</option>
                <option value="buyer">{zhCN.roles.buyer}</option>
                <option value="viewer">{zhCN.roles.viewer}</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              操作人
              <input
                className={inputClass()}
                value={actorName}
                onChange={(event) => setActorName(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              动作类型
              <select
                className={inputClass()}
                value={form.action_type}
                onChange={(event) =>
                  setForm({ ...form, action_type: event.target.value as ExecutionActionType })
                }
              >
                <option value="purchase">{zhCN.actionTypes.purchase}</option>
                <option value="stock">{zhCN.actionTypes.stock}</option>
                <option value="price">{zhCN.actionTypes.price}</option>
                <option value="ad">{zhCN.actionTypes.ad}</option>
                <option value="listing">{zhCN.actionTypes.listing}</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              建议来源
              <select
                className={inputClass()}
                value={form.suggested_by}
                onChange={(event) =>
                  setForm({ ...form, suggested_by: event.target.value as ExecutionSuggestedBy })
                }
              >
                <option value="decisionEngine">{zhCN.suggestedBy.decisionEngine}</option>
                <option value="taskSystem">{zhCN.suggestedBy.taskSystem}</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm text-slate-600">
              平台商品ID
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
            <label className="grid gap-1 text-sm text-slate-600 sm:col-span-2">
              备注
              <input
                className={inputClass()}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => void createAction()}
            disabled={!form.product_id}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-forest px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            创建执行申请
          </button>

          {message ? (
            <div className="mt-4 rounded-lg border border-line bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
              {message}
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
                待执行任务列表
              </div>
              <h2 className="mt-2 text-xl font-semibold text-ink">所有关键动作先审批再推进</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                按钮只改变本地审批状态，不会执行真实采购、库存、价格、广告或上架动作。
              </p>
            </div>
            <ClipboardCheck className="h-5 w-5 text-forest" aria-hidden="true" />
          </div>

          <div className="mt-5 space-y-3">
            {pendingActions.map((item) => (
              <article key={item.action_id} className="rounded-lg border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-ink">
                        {actionTypeLabel(item.action_type)} / {item.product_id}
                      </div>
                      <StatusPill status={item.status} tone={statusTone(item.status)} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                        {item.platform ?? "-"} / {suggestedByLabel(item.suggested_by)} / {formatDateTime(item.created_at)}
                    </div>
                  </div>
                  <div className="text-right text-sm text-slate-600">
                    <div>{formatBrl(item.expected_profit_change)}</div>
                    <div className="text-xs text-slate-400">
                      风险变化 {formatPercent(item.expected_risk_change)}
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.simulate_result}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void decideAction(item.action_id, "approve")}
                    disabled={busyActionId === item.action_id}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    批准
                  </button>
                  <button
                    type="button"
                    onClick={() => void decideAction(item.action_id, "reject")}
                    disabled={busyActionId === item.action_id}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-coral hover:bg-rose-100 disabled:opacity-60"
                  >
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    拒绝
                  </button>
                </div>
              </article>
            ))}
            {pendingActions.length === 0 ? (
              <div className="rounded-lg border border-line bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                当前没有待审批执行申请。
              </div>
            ) : null}
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
              执行模拟器
            </div>
            <h2 className="mt-2 text-xl font-semibold text-ink">模拟结果与风险变化</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              所有模拟结果只用于人工判断，不代表系统已经执行，也不会写入外部平台。
            </p>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="border-b border-line px-3 py-2">动作</th>
                  <th className="border-b border-line px-3 py-2">状态</th>
                  <th className="border-b border-line px-3 py-2">预计利润变化</th>
                  <th className="border-b border-line px-3 py-2">预计风险变化</th>
                </tr>
              </thead>
              <tbody>
                {queueData.queue.map((item) => (
                  <tr key={item.action_id} className="align-top">
                    <td className="border-b border-line px-3 py-3">
                      <div className="font-medium text-ink">{item.action_id}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {actionTypeLabel(item.action_type)} / {item.product_id}
                      </div>
                    </td>
                    <td className="border-b border-line px-3 py-3">
                      <StatusPill status={item.status} tone={statusTone(item.status)} />
                    </td>
                    <td className="border-b border-line px-3 py-3 text-slate-600">
                      {formatBrl(item.expected_profit_change)}
                    </td>
                    <td className="border-b border-line px-3 py-3 text-slate-600">
                      {formatPercent(item.expected_risk_change)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
                历史记录
              </div>
              <h2 className="mt-2 text-xl font-semibold text-ink">所有审批动作必须留痕</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                历史记录用于确认没有绕过审批直接执行，也方便后续审计。
              </p>
            </div>
            <History className="h-5 w-5 text-forest" aria-hidden="true" />
          </div>
          <div className="mt-5 space-y-3">
            {historyData.history.map((item) => (
              <article key={item.history_id} className="rounded-lg border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-ink">{item.action_id}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {zhCN.roles[item.actor_role]} / {item.actor_name} / {formatDateTime(item.created_at)}
                    </div>
                  </div>
                  <StatusPill status={item.action} />
                </div>
                <div className="mt-3 text-sm text-slate-600">
                  {item.previous_status ? statusLabel(item.previous_status) : "-"} → {statusLabel(item.new_status)}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.notes}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
