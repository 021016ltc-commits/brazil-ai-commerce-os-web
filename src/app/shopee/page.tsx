"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  KeyRound,
  PackageSearch,
  RefreshCw,
  Save,
  ShieldCheck,
  ShoppingBag,
  Store,
} from "lucide-react";
import { MoreActionsMenu, dataStatusLabel } from "@/components/OperatorControls";
import {
  emptyShopeeInventoryResponse,
  emptyShopeeOrdersResponse,
  emptyShopeeProductsResponse,
} from "@/data/emptyResponses";
import { readStoredUser } from "@/lib/permissions";
import { shopeeOrderStatusLabel } from "@/locales/zh-CN";
import type {
  PlatformShopBindingPublicItem,
  ShopeeBindingPublicStatus,
  ShopeeInventoryItem,
  ShopeeOrder,
  ShopeeProduct,
  ShopeeReadOnlyApiResponse,
  ShopeeSyncResult,
} from "@/types";

const fallbackOrders: ShopeeReadOnlyApiResponse<ShopeeOrder> = emptyShopeeOrdersResponse;
const fallbackProducts: ShopeeReadOnlyApiResponse<ShopeeProduct> = emptyShopeeProductsResponse;
const fallbackInventory: ShopeeReadOnlyApiResponse<ShopeeInventoryItem> = emptyShopeeInventoryResponse;
const fallbackBinding: ShopeeBindingPublicStatus = {
  configured: false,
  bound: false,
  status: "unbound",
  shop_id: null,
  shop_name: null,
  region: null,
  token_expire_at: null,
  last_sync_at: null,
  auth_url: null,
  message: "请先配置平台授权信息。",
  shops: [],
};

const platforms = [
  {
    key: "shopee",
    label: "Shopee",
    region: "Brazil",
    status: "enabled",
    description: "当前优先接入，授权后读取真实订单、商品和库存。",
  },
  {
    key: "mercado_livre",
    label: "Mercado Livre",
    region: "Brazil",
    status: "planned",
    description: "预留授权入口，后续接入巴西本地平台数据。",
  },
  {
    key: "amazon_br",
    label: "Amazon BR",
    region: "Brazil",
    status: "planned",
    description: "预留授权入口，后续接入 Amazon 巴西店铺。",
  },
  {
    key: "tiktok_shop_br",
    label: "TikTok Shop BR",
    region: "Brazil",
    status: "planned",
    description: "预留授权入口，后续接入内容电商数据。",
  },
  {
    key: "aliexpress",
    label: "AliExpress",
    region: "LATAM",
    status: "planned",
    description: "预留授权入口，后续扩展跨境渠道。",
  },
] as const;

type PlatformKey = (typeof platforms)[number]["key"];
type ShopDraft = {
  shop_name: string;
  owner_name: string;
  notes: string;
};

function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function sourceLabel(source: ShopeeReadOnlyApiResponse<unknown>["source"]) {
  return dataStatusLabel(source);
}

function bindingStatusLabel(status: PlatformShopBindingPublicItem["status"]) {
  if (status === "bound") return "已授权";
  if (status === "expired") return "需重新授权";
  if (status === "error") return "授权异常";
  return "未授权";
}

function bindingTone(status: PlatformShopBindingPublicItem["status"]) {
  if (status === "bound") return "border-emerald-200 bg-emerald-50 text-forest";
  if (status === "expired") return "border-amber-200 bg-amber-50 text-amber";
  if (status === "error") return "border-rose-200 bg-rose-50 text-coral";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function KpiCard({
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
    <article className="rounded-lg border border-line bg-white p-3 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-600">{label}</div>
          <div className="mt-1 truncate text-2xl font-semibold text-ink">{value}</div>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-forest">
          {icon}
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function EmptyTableRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-slate-500">
        {text}
      </td>
    </tr>
  );
}

export default function ShopeePage() {
  const [orders, setOrders] = useState(fallbackOrders);
  const [products, setProducts] = useState(fallbackProducts);
  const [inventory, setInventory] = useState(fallbackInventory);
  const [binding, setBinding] = useState<ShopeeBindingPublicStatus>(fallbackBinding);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>("shopee");
  const [drafts, setDrafts] = useState<Record<string, ShopDraft>>({});
  const [syncResult, setSyncResult] = useState<ShopeeSyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [savingShopId, setSavingShopId] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const refreshData = useCallback(async () => {
    const [ordersPayload, productsPayload, inventoryPayload, bindingPayload] = await Promise.all([
      fetch("/api/shopee/orders", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
      fetch("/api/shopee/products", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
      fetch("/api/shopee/inventory", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
      fetch("/api/shopee/binding", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : fallbackBinding,
      ),
    ]);

    setOrders(ordersPayload);
    setProducts(productsPayload);
    setInventory(inventoryPayload);
    setBinding({ ...fallbackBinding, ...bindingPayload, shops: bindingPayload.shops ?? [] });
    setDrafts((current) => {
      const next = { ...current };
      (bindingPayload.shops ?? []).forEach((shop: PlatformShopBindingPublicItem) => {
        if (!next[shop.shop_id]) {
          next[shop.shop_id] = {
            shop_name: shop.shop_name ?? "",
            owner_name: shop.owner_name ?? "",
            notes: shop.notes ?? "",
          };
        }
      });
      return next;
    });
  }, []);

  useEffect(() => {
    let active = true;

    refreshData().catch(() => {
      if (!active) return;
      setOrders(fallbackOrders);
      setProducts(fallbackProducts);
      setInventory(fallbackInventory);
      setBinding(fallbackBinding);
    });

    return () => {
      active = false;
    };
  }, [refreshData]);

  useEffect(() => {
    const syncUser = () => setIsAdmin(Boolean(readStoredUser()?.roles.includes("admin")));
    syncUser();
    window.addEventListener("baico-auth-change", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("baico-auth-change", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("binding");
    if (!status) return;

    const message =
      status === "success"
        ? "店铺授权成功，正在刷新授权列表。"
        : status === "not_configured"
          ? "平台授权参数尚未配置完整。"
          : "店铺授权未完成，请稍后重试。";

    setAuthNotice(message);

    if (window.opener) {
      window.opener.postMessage({ type: "baico-shop-authorization-complete", status }, window.location.origin);
      window.setTimeout(() => window.close(), 700);
    } else if (status === "success") {
      void refreshData();
    }
  }, [refreshData]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.type !== "baico-shop-authorization-complete") return;

      setAuthNotice(event.data.status === "success" ? "店铺授权成功。" : "店铺授权未完成。");
      void refreshData();
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [refreshData]);

  const selectedPlatformInfo = platforms.find((platform) => platform.key === selectedPlatform) ?? platforms[0];
  const totalRevenue = orders.data.reduce((sum, order) => sum + order.price * order.quantity, 0);
  const totalAvailableStock = inventory.data.reduce((sum, item) => sum + item.available_stock, 0);
  const latestSync =
    orders.synced_at ?? products.synced_at ?? inventory.synced_at ?? syncResult?.synced_at ?? binding.last_sync_at ?? null;
  const canAuthorizeShopee = selectedPlatform === "shopee" && binding.configured && Boolean(binding.auth_url) && isAdmin;
  const authorizedShopCount = binding.shops.filter((shop) => shop.status === "bound" || shop.status === "expired").length;

  function updateDraft(shopId: string, field: keyof ShopDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [shopId]: {
        shop_name: current[shopId]?.shop_name ?? "",
        owner_name: current[shopId]?.owner_name ?? "",
        notes: current[shopId]?.notes ?? "",
        [field]: value,
      },
    }));
  }

  function handleAuthorize() {
    if (!canAuthorizeShopee || !binding.auth_url) return;

    const authUrl = new URL(binding.auth_url, window.location.origin).toString();
    const popup = window.open(
      authUrl,
      "baico-store-authorization",
      "width=980,height=780",
    );

    if (!popup) {
      window.location.href = authUrl;
    }
  }

  async function handleSaveShop(shopId: string) {
    const draft = drafts[shopId];
    if (!draft) return;

    setSavingShopId(shopId);
    try {
      const response = await fetch("/api/shopee/binding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId,
          shop_name: draft.shop_name,
          owner_name: draft.owner_name,
          notes: draft.notes,
        }),
      });

      if (!response.ok) throw new Error("保存失败");
      const payload = await response.json();
      setBinding({ ...fallbackBinding, ...payload, shops: payload.shops ?? [] });
      setAuthNotice("店铺负责人和备注已保存。");
    } finally {
      setSavingShopId(null);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      const result = await fetch("/api/shopee/sync", {
        method: "POST",
        cache: "no-store",
      }).then((response) => (response.ok ? response.json() : Promise.reject()));
      setSyncResult(result);
      await refreshData();
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-7 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                店铺授权 V1
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                已授权店铺：{authorizedShopCount}
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                只读保护
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">店铺授权</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                绑定平台店铺，读取真实订单、商品和库存数据。
              </p>
            </div>
            {authNotice ? (
              <div className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-forest">
                {authNotice}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAuthorize}
              disabled={!canAuthorizeShopee}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              授权当前平台店铺
            </button>
            <MoreActionsMenu onRefresh={() => void refreshData().catch(() => undefined)} showAdminItems>
              {isAdmin ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSync}
                  disabled={isSyncing || authorizedShopCount === 0}
                  className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} aria-hidden="true" />
                  {isSyncing ? "同步中" : "同步已授权店铺"}
                </button>
              ) : null}
            </MoreActionsMenu>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-5">
        {platforms.map((platform) => {
          const active = platform.key === selectedPlatform;
          return (
            <button
              key={platform.key}
              type="button"
              onClick={() => setSelectedPlatform(platform.key)}
              className={`rounded-lg border bg-white p-3 text-left shadow-panel transition ${
                active ? "border-teal-300 ring-2 ring-teal-100" : "border-line hover:border-teal-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-ink">{platform.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{platform.region}</div>
                </div>
                <span
                  className={`rounded-md border px-2 py-1 text-xs font-medium ${
                    platform.status === "enabled"
                      ? "border-emerald-200 bg-emerald-50 text-forest"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                >
                  {platform.status === "enabled" ? "可授权" : "待接入"}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{platform.description}</p>
            </button>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-lg border border-line bg-white p-4 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">授权操作</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                当前选择：{selectedPlatformInfo.label}
              </p>
            </div>
            <Store className="h-5 w-5 text-forest" aria-hidden="true" />
          </div>

          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            {selectedPlatform === "shopee" ? (
              <>
                <div className="rounded-md border border-line bg-slate-50 px-3 py-2">
                  授权后系统只读取真实数据，不会改价、上架、发货、改库存或操作广告。
                </div>
                {!binding.configured ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber">
                    需要先配置 Shopee Partner ID 和 Partner Key，配置完成后这里会出现可用授权按钮。
                  </div>
                ) : null}
                {!isAdmin ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    当前账号可查看授权状态，新增授权需要管理员操作。
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                {selectedPlatformInfo.label} 授权入口已预留，当前阶段先完成 Shopee 真实数据接入。
              </div>
            )}
          </div>
        </article>

        <article className="rounded-lg border border-line bg-white p-4 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">真实数据状态</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                授权店铺同步后，运营总览、任务、利润、库存会基于真实平台数据延伸。
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 text-forest" aria-hidden="true" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm">
              <div className="text-xs text-slate-500">数据状态</div>
              <div className="mt-1 font-semibold text-ink">{sourceLabel(orders.source)}</div>
            </div>
            <div className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm">
              <div className="text-xs text-slate-500">最近同步</div>
              <div className="mt-1 font-semibold text-ink">{formatDateTime(latestSync)}</div>
            </div>
            <div className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm">
              <div className="text-xs text-slate-500">读取范围</div>
              <div className="mt-1 font-semibold text-ink">订单 / 商品 / 库存</div>
            </div>
          </div>
          {syncResult ? (
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-6 text-forest">
              已完成读取：订单 {syncResult.orders_count}，商品 {syncResult.products_count}，库存 {syncResult.inventory_count}。
            </div>
          ) : null}
        </article>
      </section>

      <section className="rounded-lg border border-line bg-white shadow-panel">
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">已绑定店铺</h2>
            <p className="text-sm text-slate-500">每个店铺需要独立授权一次，授权后会进入真实数据同步范围。</p>
          </div>
          <span className="inline-flex h-7 w-fit items-center rounded-md border border-line bg-slate-50 px-2 text-xs text-slate-600">
            {binding.shops.length} 个授权记录
          </span>
        </div>

        <div className="operator-scroll">
          <table className="operator-table text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th>平台</th>
                <th>店铺</th>
                <th>店铺编号</th>
                <th>负责人</th>
                <th>备注</th>
                <th>授权状态</th>
                <th>最近同步</th>
                <th className="sticky right-0 bg-slate-50">操作</th>
              </tr>
            </thead>
            <tbody>
              {binding.shops.length === 0 ? (
                <EmptyTableRow colSpan={8} text="还没有绑定店铺。完成平台授权后，这里会显示店铺信息。" />
              ) : (
                binding.shops.map((shop) => {
                  const draft = drafts[shop.shop_id] ?? {
                    shop_name: shop.shop_name ?? "",
                    owner_name: shop.owner_name ?? "",
                    notes: shop.notes ?? "",
                  };
                  return (
                    <tr key={shop.binding_id}>
                      <td className="font-medium text-ink">{shop.platform_label}</td>
                      <td>
                        {isAdmin ? (
                          <input
                            value={draft.shop_name}
                            onChange={(event) => updateDraft(shop.shop_id, "shop_name", event.target.value)}
                            placeholder="店铺名称"
                            className="h-9 w-44 rounded-md border border-line px-2 text-sm outline-none focus:border-teal-400"
                          />
                        ) : (
                          shop.shop_name || "-"
                        )}
                      </td>
                      <td>{shop.shop_id}</td>
                      <td>
                        {isAdmin ? (
                          <input
                            value={draft.owner_name}
                            onChange={(event) => updateDraft(shop.shop_id, "owner_name", event.target.value)}
                            placeholder="负责人"
                            className="h-9 w-32 rounded-md border border-line px-2 text-sm outline-none focus:border-teal-400"
                          />
                        ) : (
                          shop.owner_name || "-"
                        )}
                      </td>
                      <td>
                        {isAdmin ? (
                          <input
                            value={draft.notes}
                            onChange={(event) => updateDraft(shop.shop_id, "notes", event.target.value)}
                            placeholder="备注"
                            className="h-9 w-56 rounded-md border border-line px-2 text-sm outline-none focus:border-teal-400"
                          />
                        ) : (
                          shop.notes || "-"
                        )}
                      </td>
                      <td>
                        <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${bindingTone(shop.status)}`}>
                          {bindingStatusLabel(shop.status)}
                        </span>
                      </td>
                      <td>{formatDateTime(shop.last_sync_at)}</td>
                      <td className="sticky right-0 bg-white">
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => void handleSaveShop(shop.shop_id)}
                            disabled={savingShopId === shop.shop_id}
                            className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-2 text-xs font-medium text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                          >
                            <Save className="h-3.5 w-3.5" aria-hidden="true" />
                            {savingShopId === shop.shop_id ? "保存中" : "保存"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">只读</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="订单数量"
          value={formatCount(orders.data.length)}
          detail="来自已授权店铺的只读订单。"
          icon={<ShoppingBag className="h-5 w-5" aria-hidden="true" />}
        />
        <KpiCard
          label="商品数量"
          value={formatCount(products.data.length)}
          detail="来自已授权店铺的商品列表。"
          icon={<PackageSearch className="h-5 w-5" aria-hidden="true" />}
        />
        <KpiCard
          label="可用库存"
          value={formatCount(totalAvailableStock)}
          detail="已授权店铺可售库存汇总。"
          icon={<Boxes className="h-5 w-5" aria-hidden="true" />}
        />
        <KpiCard
          label="订单金额"
          value={formatBrl(totalRevenue)}
          detail="按当前读取订单估算。"
          icon={<CircleDollarSign className="h-5 w-5" aria-hidden="true" />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-lg border border-line bg-white shadow-panel xl:col-span-3">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">店铺数据预览</h2>
              <p className="text-sm text-slate-500">用于确认授权后是否已经读到真实平台数据。</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-forest">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              只读
            </span>
          </div>
          <div className="grid gap-4 p-4 xl:grid-cols-3">
            <div className="rounded-lg border border-line">
              <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">订单</div>
              <div className="operator-scroll max-h-80">
                <table className="operator-table text-left">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th>订单</th>
                      <th>状态</th>
                      <th>金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.data.length === 0 ? (
                      <EmptyTableRow colSpan={3} text="暂无订单数据。" />
                    ) : (
                      orders.data.slice(0, 10).map((order) => (
                        <tr key={order.order_id}>
                          <td className="font-medium text-ink">{order.order_id}</td>
                          <td>{shopeeOrderStatusLabel(order.order_status)}</td>
                          <td>{formatBrl(order.price * order.quantity)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border border-line">
              <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">商品</div>
              <div className="operator-scroll max-h-80">
                <table className="operator-table text-left">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th>商品</th>
                      <th>价格</th>
                      <th>销量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.data.length === 0 ? (
                      <EmptyTableRow colSpan={3} text="暂无商品数据。" />
                    ) : (
                      products.data.slice(0, 10).map((product) => (
                        <tr key={product.product_id}>
                          <td className="max-w-[220px] truncate font-medium text-ink">{product.title || product.product_id}</td>
                          <td>{formatBrl(product.price)}</td>
                          <td>{formatCount(product.sales_count)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border border-line">
              <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">库存</div>
              <div className="operator-scroll max-h-80">
                <table className="operator-table text-left">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th>商品</th>
                      <th>可售</th>
                      <th>预留</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.data.length === 0 ? (
                      <EmptyTableRow colSpan={3} text="暂无库存数据。" />
                    ) : (
                      inventory.data.slice(0, 10).map((item) => {
                        const product = products.data.find((entry) => entry.product_id === item.product_id);
                        return (
                          <tr key={item.product_id}>
                            <td className="max-w-[220px] truncate font-medium text-ink">
                              {product?.title || item.product_id}
                            </td>
                            <td>{formatCount(item.available_stock)}</td>
                            <td>{formatCount(item.reserved_stock)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
        <div className="flex items-start gap-3">
          <ExternalLink className="mt-0.5 h-5 w-5 text-forest" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-ink">真实运营数据流</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              授权成功后，系统会优先读取平台真实数据；运营总览、任务中心、利润中心、库存中心、审批与执行建议都应以这些真实数据为基础展开。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
