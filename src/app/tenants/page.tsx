"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, Database, Layers3, Plus, ShieldCheck, Users } from "lucide-react";
import { emptyTenantsResponse } from "@/data/emptyResponses";
import type { PlanType, TenantItem, TenantsApiResponse, WorkspaceItem } from "@/types";

const fallbackData: TenantsApiResponse = emptyTenantsResponse;

const planLabels: Record<PlanType, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

function sourceLabel(source: "sqlite" | "mock") {
  return source === "sqlite" ? "真实数据" : "测试数据已禁用";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function planTone(plan: PlanType) {
  if (plan === "enterprise") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (plan === "pro") return "border-emerald-200 bg-emerald-50 text-forest";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function StatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-600">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-ink">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-forest">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{detail}</p>
    </article>
  );
}

export default function TenantsPage() {
  const [data, setData] = useState<TenantsApiResponse>(fallbackData);
  const [selectedTenantId, setSelectedTenantId] = useState("demo_tenant");
  const [newTenantName, setNewTenantName] = useState("新工作空间");
  const [newTenantPlan, setNewTenantPlan] = useState<PlanType>("free");
  const [newWorkspaceName, setNewWorkspaceName] = useState("巴西运营空间");
  const [newWorkspaceShopCount, setNewWorkspaceShopCount] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  async function loadTenants(tenantId = selectedTenantId) {
    try {
      const response = await fetch(`/api/tenants?tenant_id=${encodeURIComponent(tenantId)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Tenant API failed.");
      const payload = (await response.json()) as TenantsApiResponse;
      setData(payload);
      setSelectedTenantId(payload.tenant_id || tenantId);
    } catch {
      setData(fallbackData);
    }
  }

  useEffect(() => {
    void loadTenants("demo_tenant");
  }, []);

  const selectedTenant = useMemo(
    () => data.tenants.find((tenant) => tenant.tenant_id === selectedTenantId) ?? data.tenants[0],
    [data.tenants, selectedTenantId],
  );

  const selectedWorkspaces = data.workspaces.filter(
    (workspace) => workspace.tenant_id === selectedTenantId,
  );
  const selectedUsage =
    data.usage.find((usage) => usage.tenant_id === selectedTenantId) ??
    {
      tenant_id: selectedTenantId,
      workspace_count: 0,
      user_count: 0,
      product_count: 0,
      action_count: 0,
      shop_count: 0,
    };

  async function createTenant() {
    setIsSaving(true);
    try {
      await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTenantName, plan_type: newTenantPlan }),
      });
      await loadTenants(selectedTenantId);
    } finally {
      setIsSaving(false);
    }
  }

  async function createWorkspace() {
    setIsSaving(true);
    try {
      await fetch(`/api/workspaces?tenant_id=${encodeURIComponent(selectedTenantId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: selectedTenantId,
          name: newWorkspaceName,
          shop_count: newWorkspaceShopCount,
        }),
      });
      await loadTenants(selectedTenantId);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="rounded-lg border border-line bg-white p-5 shadow-panel sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                工作空间 V1
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {sourceLabel(data.source)}
              </span>
              <span className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                默认工作空间：demo_tenant
              </span>
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                工作空间
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                这里展示本地工作空间基础：客户空间负责数据隔离，运营空间负责店铺与运营范围，
                plan_type 只展示订阅层状态。当前版本不接 Stripe、不收费、不接外部认证，也不会改变 Shopee 只读逻辑。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              label="工作空间数量"
              value={`${data.tenants.length}`}
              detail="本地系统中的租户数量。"
              icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
            />
            <StatCard
              label="当前工作空间"
              value={selectedTenantId}
              detail="系统默认使用 demo_tenant，也可通过本地参数切换。"
              icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="工作空间数量" value={`${selectedUsage.workspace_count}`} detail="当前客户空间下的运营空间。" icon={<Layers3 className="h-5 w-5" aria-hidden="true" />} />
        <StatCard label="成员数量" value={`${selectedUsage.user_count}`} detail="当前租户成员数量。" icon={<Users className="h-5 w-5" aria-hidden="true" />} />
        <StatCard label="商品数量" value={`${selectedUsage.product_count}`} detail="归属当前租户的商品数据。" icon={<Database className="h-5 w-5" aria-hidden="true" />} />
        <StatCard label="执行申请" value={`${selectedUsage.action_count}`} detail="归属当前租户的本地执行审批池。" icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />} />
        <StatCard label="店铺数量" value={`${selectedUsage.shop_count}`} detail="工作空间声明的店铺数量。" icon={<Building2 className="h-5 w-5" aria-hidden="true" />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">工作空间列表</h2>
              <p className="mt-1 text-xs text-slate-500">切换工作空间可验证数据隔离。</p>
            </div>
            <select
              value={selectedTenantId}
              onChange={(event) => {
                setSelectedTenantId(event.target.value);
                void loadTenants(event.target.value);
              }}
              className="h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-forest"
            >
              {data.tenants.map((tenant) => (
                <option key={tenant.tenant_id} value={tenant.tenant_id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">工作空间ID</th>
                  <th className="px-4 py-3">名称</th>
                  <th className="px-4 py-3">方案</th>
                  <th className="px-4 py-3">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {data.tenants.map((tenant: TenantItem) => (
                  <tr key={tenant.tenant_id} className="border-t border-line">
                    <td className="px-4 py-3 font-medium text-ink">{tenant.tenant_id}</td>
                    <td className="px-4 py-3">{tenant.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex h-7 items-center rounded-md border px-2 text-xs font-semibold ${planTone(tenant.plan_type)}`}>
                        {planLabels[tenant.plan_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(tenant.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
            <h2 className="text-sm font-semibold text-ink">新增工作空间</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              仅写入本地数据，不创建真实账单，不开通真实订阅。
            </p>
            <div className="mt-4 space-y-3">
              <input
                value={newTenantName}
                onChange={(event) => setNewTenantName(event.target.value)}
                className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-forest"
                placeholder="工作空间名称"
              />
              <select
                value={newTenantPlan}
                onChange={(event) => setNewTenantPlan(event.target.value as PlanType)}
                className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-forest"
              >
                <option value="free">free</option>
                <option value="pro">pro</option>
                <option value="enterprise">enterprise</option>
              </select>
              <button
                type="button"
                disabled={isSaving}
                onClick={createTenant}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-forest px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                新增本地工作空间
              </button>
            </div>
          </section>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">运营空间列表</h2>
            <p className="mt-1 text-xs text-slate-500">
              当前显示 {selectedTenant?.name ?? selectedTenantId} 下的工作空间。
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">运营空间ID</th>
                  <th className="px-4 py-3">所属工作空间</th>
                  <th className="px-4 py-3">名称</th>
                  <th className="px-4 py-3">店铺数</th>
                  <th className="px-4 py-3">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {selectedWorkspaces.map((workspace: WorkspaceItem) => (
                  <tr key={workspace.workspace_id} className="border-t border-line">
                    <td className="px-4 py-3 font-medium text-ink">{workspace.workspace_id}</td>
                    <td className="px-4 py-3">{workspace.tenant_id}</td>
                    <td className="px-4 py-3">{workspace.name}</td>
                    <td className="px-4 py-3">{workspace.shop_count}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(workspace.created_at)}</td>
                  </tr>
                ))}
                {selectedWorkspaces.length === 0 ? (
                  <tr className="border-t border-line">
                    <td className="px-4 py-6 text-slate-500" colSpan={5}>
                      当前工作空间暂无运营空间。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <h2 className="text-sm font-semibold text-ink">新增运营空间</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            运营空间归属于当前工作空间，用于未来隔离店铺、成员和业务数据。
          </p>
          <div className="mt-4 space-y-3">
            <input
              value={newWorkspaceName}
              onChange={(event) => setNewWorkspaceName(event.target.value)}
              className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-forest"
              placeholder="运营空间名称"
            />
            <input
              type="number"
              min={0}
              value={newWorkspaceShopCount}
              onChange={(event) => setNewWorkspaceShopCount(Number(event.target.value))}
              className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-forest"
              placeholder="shop_count"
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={createWorkspace}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-forest px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              新增本地运营空间
            </button>
          </div>
        </section>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
        <h2 className="text-sm font-semibold text-ink">隔离说明</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          当前所有新增本地业务表通过内部空间标识归属到工作空间。接口可使用
          <span className="mx-1 font-mono text-ink">内部空间参数</span>
          或
          <span className="mx-1 font-mono text-ink">内部空间标识</span>
          选择工作空间；未传时默认 demo_tenant。非 demo 工作空间没有业务数据时会返回空业务集合，不会执行任何外部动作。
        </p>
      </section>
    </div>
  );
}
