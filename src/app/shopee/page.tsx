"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Boxes, CircleDollarSign, PackageSearch, RefreshCw, ShieldCheck, ShoppingBag } from "lucide-react";
import { ShopeeExperienceCharts } from "@/components/ModuleExperienceCharts";
import { MoreActionsMenu, dataStatusLabel } from "@/components/OperatorControls";
import {
  emptyShopeeInventoryResponse,
  emptyShopeeOrdersResponse,
  emptyShopeeProductsResponse,
} from "@/data/emptyResponses";
import { readStoredUser } from "@/lib/permissions";
import { shopeeOrderStatusLabel } from "@/locales/zh-CN";
import type {
  ShopeeInventoryItem,
  ShopeeOrder,
  ShopeeProduct,
  ShopeeReadOnlyApiResponse,
  ShopeeSyncResult,
} from "@/types";

const fallbackOrders: ShopeeReadOnlyApiResponse<ShopeeOrder> = emptyShopeeOrdersResponse;
const fallbackProducts: ShopeeReadOnlyApiResponse<ShopeeProduct> = emptyShopeeProductsResponse;
const fallbackInventory: ShopeeReadOnlyApiResponse<ShopeeInventoryItem> = emptyShopeeInventoryResponse;

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

function SectionStatus({
  source,
  syncedAt,
}: {
  source: ShopeeReadOnlyApiResponse<unknown>["source"];
  syncedAt: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-slate-600">
      <span className="rounded-md border border-line bg-slate-50 px-2 py-1">数据状态：{sourceLabel(source)}</span>
      <span className="rounded-md border border-line bg-slate-50 px-2 py-1">最近同步：{formatDateTime(syncedAt)}</span>
      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-forest">状态正常</span>
    </div>
  );
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
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-forest">
        {eyebrow}
      </div>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-ink">{title}</h2>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
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

export default function ShopeePage() {
  const [orders, setOrders] = useState(fallbackOrders);
  const [products, setProducts] = useState(fallbackProducts);
  const [inventory, setInventory] = useState(fallbackInventory);
  const [syncResult, setSyncResult] = useState<ShopeeSyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  async function refreshData() {
    const [ordersPayload, productsPayload, inventoryPayload] = await Promise.all([
      fetch("/api/shopee/orders", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
      fetch("/api/shopee/products", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
      fetch("/api/shopee/inventory", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
    ]);

    setOrders(ordersPayload);
    setProducts(productsPayload);
    setInventory(inventoryPayload);
  }

  useEffect(() => {
    let active = true;

    refreshData().catch(() => {
      if (!active) return;
      setOrders(fallbackOrders);
      setProducts(fallbackProducts);
      setInventory(fallbackInventory);
    });

    return () => {
      active = false;
    };
  }, []);

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

  const inventoryByProduct = useMemo(
    () => new Map(inventory.data.map((item) => [item.product_id, item])),
    [inventory.data],
  );
  const totalRevenue = orders.data.reduce((sum, order) => sum + order.price * order.quantity, 0);
  const totalAvailableStock = inventory.data.reduce((sum, item) => sum + item.available_stock, 0);
  const latestSync = orders.synced_at ?? products.synced_at ?? inventory.synced_at ?? syncResult?.synced_at ?? null;

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
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex h-7 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-forest">
                Shopee店铺只读同步 V1
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                {sourceLabel(orders.source)}
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-line bg-white px-3 text-xs font-medium text-slate-600">
                只读同步，不写入 Shopee
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink">Shopee店铺</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                只读查看订单、商品和库存状态，不下单、不改价、不上架、不回写库存。
              </p>
            </div>
            <MoreActionsMenu onRefresh={() => void refreshData().catch(() => undefined)} showAdminItems>
              {isAdmin ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} aria-hidden="true" />
                  {isSyncing ? "同步中" : "手动同步"}
                </button>
              ) : null}
            </MoreActionsMenu>
          </div>

          <div className="rounded-lg border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-slate-500">同步状态</div>
                <div className="mt-2 text-lg font-semibold text-ink">
                  最近同步：{formatDateTime(latestSync)}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">管理员可在更多操作中手动读取最新只读数据。</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-forest" aria-hidden="true" />
            </div>
            {syncResult ? (
              <div className="mt-3 rounded-md border border-line bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                已完成读取：订单 {syncResult.orders_count}，商品 {syncResult.products_count}，库存 {syncResult.inventory_count}。
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="订单数量"
          value={formatCount(orders.data.length)}
          detail="只读订单数据数量。"
          icon={<ShoppingBag className="h-5 w-5" aria-hidden="true" />}
        />
        <KpiCard
          label="商品数量"
          value={formatCount(products.data.length)}
          detail="只读商品数据数量。"
          icon={<PackageSearch className="h-5 w-5" aria-hidden="true" />}
        />
        <KpiCard
          label="可用库存"
          value={formatCount(totalAvailableStock)}
          detail="Shopee 库存中的可售数量汇总。"
          icon={<Boxes className="h-5 w-5" aria-hidden="true" />}
        />
        <KpiCard
          label="订单金额"
          value={formatBrl(totalRevenue)}
          detail="基于只读订单数据的展示统计。"
          icon={<CircleDollarSign className="h-5 w-5" aria-hidden="true" />}
        />
      </section>

      <details className="compact-details rounded-lg border border-line bg-white shadow-panel">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink">
          查看店铺图表
          <span className="text-xs font-medium text-slate-500">销量、库存结构、订单状态</span>
        </summary>
        <div className="border-t border-line p-3">
          <ShopeeExperienceCharts />
        </div>
      </details>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="订单同步"
          title="订单列表"
          description="订单数据只读展示，不支持发货、取消、退款或任何订单操作。"
        />
        <SectionStatus source={orders.source} syncedAt={orders.synced_at} />
        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="operator-scroll">
            <table className="operator-table text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th>订单</th>
                  <th>商品</th>
                  <th>SKU</th>
                  <th>数量</th>
                  <th>价格</th>
                  <th>订单状态</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {orders.data.map((order) => (
                  <tr key={order.order_id}>
                    <td className="font-medium text-ink">{order.order_id}</td>
                    <td>{order.product_id}</td>
                    <td>{order.sku}</td>
                    <td>{formatCount(order.quantity)}</td>
                    <td>{formatBrl(order.price)}</td>
                    <td>{shopeeOrderStatusLabel(order.order_status)}</td>
                    <td>{formatDateTime(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="商品同步"
          title="商品列表"
          description="商品数据只读展示，不支持改标题、改价、改库存或上架动作。"
        />
        <SectionStatus source={products.source} syncedAt={products.synced_at} />
        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="operator-scroll">
            <table className="operator-table text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th>商品</th>
                  <th>标题</th>
                  <th>价格</th>
                  <th>库存</th>
                  <th>销量</th>
                  <th>可售库存</th>
                  <th>预留库存</th>
                </tr>
              </thead>
              <tbody>
                {products.data.map((product) => {
                  const itemInventory = inventoryByProduct.get(product.product_id);
                  return (
                    <tr key={product.product_id}>
                      <td className="font-medium text-ink">{product.product_id}</td>
                      <td>{product.title}</td>
                      <td>{formatBrl(product.price)}</td>
                      <td>{formatCount(product.stock)}</td>
                      <td>{formatCount(product.sales_count)}</td>
                      <td>{formatCount(itemInventory?.available_stock ?? 0)}</td>
                      <td>{formatCount(itemInventory?.reserved_stock ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="space-y-5">
        <SectionHeader
          eyebrow="库存同步"
          title="库存列表"
          description="库存数据只读展示，不会向 Shopee 回写库存，也不会自动补货。"
        />
        <SectionStatus source={inventory.source} syncedAt={inventory.synced_at} />
        <section className="rounded-lg border border-line bg-white shadow-panel">
          <div className="operator-scroll">
            <table className="operator-table text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th>商品</th>
                  <th>可售库存</th>
                  <th>预留库存</th>
                </tr>
              </thead>
              <tbody>
                {inventory.data.map((item) => (
                  <tr key={item.product_id}>
                    <td className="font-medium text-ink">{item.product_id}</td>
                    <td>{formatCount(item.available_stock)}</td>
                    <td>{formatCount(item.reserved_stock)}</td>
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
