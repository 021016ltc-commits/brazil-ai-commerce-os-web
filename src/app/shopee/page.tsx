"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BadgePercent,
  Boxes,
  Brain,
  CheckCircle2,
  Clock3,
  CircleDollarSign,
  ExternalLink,
  KeyRound,
  Link2,
  Megaphone,
  PackageSearch,
  RefreshCw,
  Save,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Store,
} from "lucide-react";
import { MoreActionsMenu, dataStatusLabel } from "@/components/OperatorControls";
import {
  emptyShopeeAdsResponse,
  emptyShopeeAffiliateResponse,
  emptyShopeeInventoryResponse,
  emptyShopeeListingDiagnosticsResponse,
  emptyShopeeOrdersResponse,
  emptyShopeeProductsResponse,
  emptyShopeeShopWeightResponse,
} from "@/data/emptyResponses";
import { readStoredUser } from "@/lib/permissions";
import { shopeeOrderStatusLabel } from "@/locales/zh-CN";
import type {
  PlatformShopBindingPublicItem,
  ShopeeAdCampaign,
  ShopeeAffiliatePerformance,
  ShopeeBindingPublicStatus,
  ShopeeBindingReadiness,
  ShopeeInventoryItem,
  ShopeeListingDiagnostic,
  ShopeeOrder,
  ShopeeProduct,
  ShopeeReadOnlyApiResponse,
  ShopeeReadinessStepStatus,
  ShopeeShopWeightMetric,
  ShopeeStrategyInsightsApiResponse,
  ShopeeStrategyRecommendation,
  ShopeeSyncResult,
} from "@/types";

const fallbackOrders: ShopeeReadOnlyApiResponse<ShopeeOrder> = emptyShopeeOrdersResponse;
const fallbackProducts: ShopeeReadOnlyApiResponse<ShopeeProduct> = emptyShopeeProductsResponse;
const fallbackInventory: ShopeeReadOnlyApiResponse<ShopeeInventoryItem> = emptyShopeeInventoryResponse;
const fallbackAds: ShopeeReadOnlyApiResponse<ShopeeAdCampaign> = emptyShopeeAdsResponse;
const fallbackAffiliate: ShopeeReadOnlyApiResponse<ShopeeAffiliatePerformance> = emptyShopeeAffiliateResponse;
const fallbackListingDiagnostics: ShopeeReadOnlyApiResponse<ShopeeListingDiagnostic> = emptyShopeeListingDiagnosticsResponse;
const fallbackShopWeight: ShopeeReadOnlyApiResponse<ShopeeShopWeightMetric> = emptyShopeeShopWeightResponse;
const fallbackStrategyInsights: ShopeeStrategyInsightsApiResponse = {
  source: "sqlite",
  generated_at: new Date(0).toISOString(),
  readonly: true,
  summary: {
    product_count: 0,
    order_count: 0,
    ad_campaign_count: 0,
    affiliate_item_count: 0,
    listing_issue_count: 0,
    high_priority_count: 0,
    approval_required_count: 0,
    ready_recommendation_count: 0,
    waiting_data_count: 0,
  },
  recommendations: [],
  listing_actions: [],
  advertising_actions: [],
  campaign_actions: [],
  feedback_alerts: [],
  guardrails: [],
};
const fallbackReadiness: ShopeeBindingReadiness = {
  go_live_status: "under_review",
  redirect_domain: null,
  fixed_ip: "47.236.75.140",
  proxy_configured: false,
  proxy_reachable: false,
  proxy_url: null,
  live_credentials_configured: false,
  can_authorize: false,
  can_sync: false,
  blockers: ["Shopee Go Live 审核尚未通过。"],
  checked_at: new Date(0).toISOString(),
};
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
  readiness: fallbackReadiness,
};

const platforms = [
  {
    key: "shopee",
    label: "Shopee",
    region: "Brazil",
    status: "enabled",
    description: "当前优先接入，授权后读取订单、商品、库存，并扩展广告、联盟、链接诊断和权重分布。",
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
type ShopeeExportSection =
  | "orders"
  | "products"
  | "inventory"
  | "ads"
  | "affiliate"
  | "listing-diagnostics"
  | "shop-weight";
type BindingStatusFilter = "all" | PlatformShopBindingPublicItem["status"];
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

function readinessStatusLabel(status: ShopeeReadinessStepStatus) {
  if (status === "ready") return "已就绪";
  if (status === "waiting") return "等待中";
  return "需处理";
}

function readinessTone(status: ShopeeReadinessStepStatus) {
  if (status === "ready") return "border-emerald-200 bg-emerald-50 text-forest";
  if (status === "waiting") return "border-amber-200 bg-amber-50 text-amber";
  return "border-rose-200 bg-rose-50 text-coral";
}

function goLiveLabel(status: ShopeeBindingReadiness["go_live_status"]) {
  if (status === "approved") return "审核已通过";
  if (status === "not_started") return "尚未提交";
  if (status === "unknown") return "状态待确认";
  return "审核中";
}

function priorityLabel(priority: ShopeeStrategyRecommendation["priority"]) {
  if (priority === "high") return "高优先级";
  if (priority === "medium") return "中优先级";
  return "低优先级";
}

function priorityTone(priority: ShopeeStrategyRecommendation["priority"]) {
  if (priority === "high") return "border-rose-200 bg-rose-50 text-coral";
  if (priority === "medium") return "border-amber-200 bg-amber-50 text-amber";
  return "border-emerald-200 bg-emerald-50 text-forest";
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
  const [ads, setAds] = useState(fallbackAds);
  const [affiliate, setAffiliate] = useState(fallbackAffiliate);
  const [listingDiagnostics, setListingDiagnostics] = useState(fallbackListingDiagnostics);
  const [shopWeight, setShopWeight] = useState(fallbackShopWeight);
  const [strategyInsights, setStrategyInsights] = useState(fallbackStrategyInsights);
  const [binding, setBinding] = useState<ShopeeBindingPublicStatus>(fallbackBinding);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>("shopee");
  const [drafts, setDrafts] = useState<Record<string, ShopDraft>>({});
  const [syncResult, setSyncResult] = useState<ShopeeSyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [savingShopId, setSavingShopId] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [exportSection, setExportSection] = useState<ShopeeExportSection>("orders");
  const [bindingStatusFilter, setBindingStatusFilter] = useState<BindingStatusFilter>("all");

  const refreshData = useCallback(async () => {
    const [
      ordersPayload,
      productsPayload,
      inventoryPayload,
      adsPayload,
      affiliatePayload,
      listingDiagnosticsPayload,
      shopWeightPayload,
      strategyInsightsPayload,
      bindingPayload,
    ] = await Promise.all([
      fetch("/api/shopee/orders", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
      fetch("/api/shopee/products", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
      fetch("/api/shopee/inventory", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : Promise.reject(),
      ),
      fetch("/api/shopee/ads", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : fallbackAds,
      ),
      fetch("/api/shopee/affiliate", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : fallbackAffiliate,
      ),
      fetch("/api/shopee/listing-diagnostics", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : fallbackListingDiagnostics,
      ),
      fetch("/api/shopee/shop-weight", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : fallbackShopWeight,
      ),
      fetch("/api/shopee/strategy-insights", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : fallbackStrategyInsights,
      ),
      fetch("/api/shopee/binding", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : fallbackBinding,
      ),
    ]);

    setOrders(ordersPayload);
    setProducts(productsPayload);
    setInventory(inventoryPayload);
    setAds(adsPayload);
    setAffiliate(affiliatePayload);
    setListingDiagnostics(listingDiagnosticsPayload);
    setShopWeight(shopWeightPayload);
    setStrategyInsights(strategyInsightsPayload);
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
      setAds(fallbackAds);
      setAffiliate(fallbackAffiliate);
      setListingDiagnostics(fallbackListingDiagnostics);
      setShopWeight(fallbackShopWeight);
      setStrategyInsights(fallbackStrategyInsights);
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
    const code = params.get("code");
    const shopId = params.get("shop_id");
    const state = params.get("state") ?? params.get("random");

    if (code && shopId) {
      const query = new URLSearchParams({ code, shop_id: shopId });
      if (state) query.set("state", state);
      window.location.replace(`/api/shopee/auth/callback?${query.toString()}`);
    }
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
  const totalAdSpend = ads.data.reduce((sum, campaign) => sum + campaign.spend, 0);
  const totalAdSales = ads.data.reduce((sum, campaign) => sum + campaign.sales, 0);
  const avgRoas = totalAdSpend > 0 ? totalAdSales / totalAdSpend : 0;
  const totalAffiliateSales = affiliate.data.reduce((sum, item) => sum + item.affiliate_sales, 0);
  const highListingIssueCount = listingDiagnostics.data.filter((item) => item.severity === "high").length;
  const latestSync =
    orders.synced_at ??
    products.synced_at ??
    inventory.synced_at ??
    ads.synced_at ??
    affiliate.synced_at ??
    listingDiagnostics.synced_at ??
    shopWeight.synced_at ??
    syncResult?.synced_at ??
    binding.last_sync_at ??
    null;
  const readiness = binding.readiness ?? fallbackReadiness;
  const authorizedShopCount = binding.shops.filter((shop) => shop.status === "bound" || shop.status === "expired").length;
  const canAuthorizeShopee = selectedPlatform === "shopee" && isAdmin && readiness.can_authorize;
  const canSyncAuthorizedShops = isAdmin && readiness.can_sync;
  const authorizationNotice = !isAdmin
    ? "当前账号可查看授权状态，新增授权需要管理员操作。"
    : readiness.blockers[0] ?? "当前平台暂不可授权。";
  const readinessSteps: Array<{ label: string; detail: string; status: ShopeeReadinessStepStatus }> = [
    {
      label: "Shopee Go Live 审核",
      detail:
        readiness.go_live_status === "approved"
          ? "已通过，可进入正式店铺授权。"
          : "Shopee 正在审核应用，通常会通过邮件通知结果。",
      status: readiness.go_live_status === "approved" ? "ready" : "waiting",
    },
    {
      label: "授权回调域名",
      detail: readiness.redirect_domain ?? "等待确认线上访问域名。",
      status: readiness.redirect_domain ? "ready" : "blocked",
    },
    {
      label: "固定 IP 白名单",
      detail: readiness.fixed_ip ? `已准备公网 IP：${readiness.fixed_ip}` : "等待填写服务器公网 IP。",
      status: readiness.fixed_ip ? "ready" : "blocked",
    },
    {
      label: "VPS 只读代理",
      detail: readiness.proxy_configured
        ? readiness.proxy_reachable
          ? "代理可访问，Shopee 请求会从固定 IP 发出。"
          : "代理已配置但暂不可访问。"
        : "等待把固定 IP 代理接入线上系统。",
      status: readiness.proxy_configured ? (readiness.proxy_reachable ? "ready" : "blocked") : "waiting",
    },
    {
      label: "Live Key 配置",
      detail: readiness.live_credentials_configured ? "正式 Partner ID / Key 已配置。" : "审核通过后填入 VPS 代理环境变量。",
      status: readiness.live_credentials_configured ? "ready" : "waiting",
    },
    {
      label: "店铺授权",
      detail: authorizedShopCount ? `${authorizedShopCount} 个店铺已进入授权记录。` : "每个店铺需要独立授权一次。",
      status: authorizedShopCount ? "ready" : readiness.go_live_status === "under_review" || readiness.can_authorize ? "waiting" : "blocked",
    },
    {
      label: "真实数据同步",
      detail: readiness.can_sync
        ? "可同步订单、商品、库存，并扩展广告、联盟、链接诊断和权重分布。"
        : "完成授权后启用真实数据同步。",
      status: readiness.can_sync ? "ready" : "waiting",
    },
  ];
  const filteredShops = binding.shops.filter((shop) => {
    if (bindingStatusFilter !== "all" && shop.status !== bindingStatusFilter) return false;
    return true;
  });
  const shopeeExportRows = (() => {
    if (exportSection === "orders") {
      return orders.data.map((order) => ({
          订单编号: order.order_id,
          商品编号: order.product_id,
          SKU: order.sku,
          数量: order.quantity,
          价格: formatBrl(order.price),
          状态: shopeeOrderStatusLabel(order.order_status),
          创建时间: order.created_at,
        }));
    }

    if (exportSection === "products") {
      return products.data.map((product) => ({
            商品编号: product.product_id,
            标题: product.title,
            价格: formatBrl(product.price),
            库存: product.stock,
            销量: product.sales_count,
          }));
    }

    if (exportSection === "inventory") {
      return inventory.data.map((item) => ({
            商品编号: item.product_id,
            可用库存: item.available_stock,
            预留库存: item.reserved_stock,
          }));
    }

    if (exportSection === "ads") {
      return ads.data.map((campaign) => ({
        广告编号: campaign.campaign_id,
        广告名称: campaign.campaign_name,
        类型: campaign.ad_type,
        状态: campaign.status,
        日预算: formatBrl(campaign.daily_budget),
        花费: formatBrl(campaign.spend),
        曝光: campaign.impressions,
        点击: campaign.clicks,
        CTR: `${campaign.ctr}%`,
        CPC: formatBrl(campaign.cpc),
        订单: campaign.orders,
        销售额: formatBrl(campaign.sales),
        ROAS: campaign.roas,
        ACOS: `${campaign.acos}%`,
      }));
    }

    if (exportSection === "affiliate") {
      return affiliate.data.map((item) => ({
        联盟编号: item.affiliate_id,
        商品编号: item.product_id,
        商品: item.product_name,
        状态: item.status,
        佣金率: `${item.commission_rate}%`,
        联盟订单: item.affiliate_orders,
        联盟销售额: formatBrl(item.affiliate_sales),
        佣金成本: formatBrl(item.commission_cost),
        ROI: item.roi,
      }));
    }

    if (exportSection === "listing-diagnostics") {
      return listingDiagnostics.data.map((item) => ({
        问题编号: item.issue_id,
        商品编号: item.product_id,
        商品: item.product_name,
        问题类型: item.issue_type,
        风险等级: item.severity,
        原因: item.reason,
        建议动作: item.suggested_action,
      }));
    }

    return shopWeight.data.map((item) => ({
      指标编号: item.metric_id,
      指标名称: item.metric_name,
      权重占比: `${item.weight_share}%`,
      得分: item.score,
      影响: item.impact,
      建议动作: item.suggested_action,
    }));
  })();
  const shopeeExportName =
    exportSection === "orders"
      ? "店铺授权_订单"
      : exportSection === "products"
        ? "店铺授权_商品"
        : exportSection === "inventory"
          ? "店铺授权_库存"
          : exportSection === "ads"
            ? "店铺授权_广告"
            : exportSection === "affiliate"
              ? "店铺授权_联盟"
              : exportSection === "listing-diagnostics"
                ? "店铺授权_链接诊断"
                : "店铺授权_权重分布";

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
    if (!canSyncAuthorizedShops) {
      setSyncNotice("完成 Shopee 开放平台配置和店铺授权后可同步。");
      return;
    }

    setIsSyncing(true);
    setSyncNotice("正在同步已授权店铺数据...");
    try {
      const result = await fetch("/api/shopee/sync", {
        method: "POST",
        cache: "no-store",
      }).then((response) => (response.ok ? response.json() : Promise.reject(new Error("同步失败"))));
      setSyncResult(result);
      await refreshData();
      setSyncNotice("已完成已授权店铺同步。");
    } catch {
      setSyncNotice("同步失败，请检查店铺授权状态后重试。");
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
                绑定平台店铺，读取真实订单、商品、库存、广告、联盟和链接诊断数据。
              </p>
            </div>
            {authNotice ? (
              <div className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-forest">
                {authNotice}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedPlatform === "shopee" ? (
              <button
                type="button"
                onClick={handleAuthorize}
                disabled={!canAuthorizeShopee}
                title={canAuthorizeShopee ? "打开 Shopee 店铺授权窗口" : authorizationNotice}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                添加/授权店铺
              </button>
            ) : null}
            {selectedPlatform === "shopee" && !canAuthorizeShopee ? (
              <span className="inline-flex h-9 items-center rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-medium text-amber">
                {authorizationNotice}
              </span>
            ) : null}
            <MoreActionsMenu
              onRefresh={() => void refreshData()}
              onOpenFilters={() => document.getElementById("shopee-filters")?.scrollIntoView({ behavior: "smooth" })}
              exportConfig={{
                filenamePrefix: shopeeExportName,
                rows: shopeeExportRows,
                disabledReason: "当前分区没有可导出的店铺数据。",
              }}
              showAdminItems
            >
              {isAdmin ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSync}
                  disabled={isSyncing || !canSyncAuthorizedShops}
                  title={!canSyncAuthorizedShops ? "完成店铺授权后可用" : "同步已授权店铺"}
                  className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} aria-hidden="true" />
                  {isSyncing ? "同步中" : canSyncAuthorizedShops ? "同步已授权店铺" : "完成授权后可同步"}
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

      <section className="rounded-lg border border-line bg-white p-4 shadow-panel">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-ink">上线准备检查</h2>
              <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${readinessTone(
                readiness.go_live_status === "approved" ? "ready" : "waiting",
              )}`}>
                {goLiveLabel(readiness.go_live_status)}
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              这里用于确认 Shopee 正式授权前置条件。审核通过后，配置 Live Key 和固定 IP 代理，再逐个店铺授权即可读取真实数据。
            </p>
          </div>
          <div className="rounded-md border border-line bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
            <div>回调域名：{readiness.redirect_domain ?? "-"}</div>
            <div>白名单 IP：{readiness.fixed_ip ?? "-"}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {readinessSteps.map((step) => (
            <article key={step.label} className="rounded-lg border border-line bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-ink">{step.label}</div>
                <span className={`inline-flex shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${readinessTone(step.status)}`}>
                  {readinessStatusLabel(step.status)}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">{step.detail}</p>
            </article>
          ))}
        </div>

        {readiness.blockers.length ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber">
            下一步：{readiness.blockers.slice(0, 3).join(" ")}
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-6 text-forest">
            Shopee 正式授权条件已就绪，可以绑定店铺并同步只读数据。
          </div>
        )}
      </section>

      <section id="shopee-filters" className="rounded-lg border border-line bg-white p-4 shadow-panel">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm text-slate-600">
            导出数据分区
            <select
              className="h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-forest"
              value={exportSection}
              onChange={(event) => setExportSection(event.target.value as ShopeeExportSection)}
            >
              <option value="orders">订单</option>
              <option value="products">商品</option>
              <option value="inventory">库存</option>
              <option value="ads">广告</option>
              <option value="affiliate">联盟</option>
              <option value="listing-diagnostics">链接诊断</option>
              <option value="shop-weight">权重分布</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            店铺授权状态
            <select
              className="h-10 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-forest"
              value={bindingStatusFilter}
              onChange={(event) => setBindingStatusFilter(event.target.value as BindingStatusFilter)}
            >
              <option value="all">全部状态</option>
              <option value="bound">已授权</option>
              <option value="expired">需重新授权</option>
              <option value="error">授权异常</option>
              <option value="unbound">未授权</option>
            </select>
          </label>
          <div className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-slate-600">
            当前导出：
            {exportSection === "orders"
              ? "订单分区"
              : exportSection === "products"
                ? "商品分区"
                : exportSection === "inventory"
                  ? "库存分区"
                  : exportSection === "ads"
                    ? "广告分区"
                    : exportSection === "affiliate"
                      ? "联盟分区"
                      : exportSection === "listing-diagnostics"
                        ? "链接诊断分区"
                        : "权重分布分区"}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-lg border border-line bg-white p-4 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">添加/授权店铺</h2>
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
                  授权后系统只读取真实数据，不会改价、上架、发货、改库存、改广告预算或操作联盟计划。
                </div>
                <div className="rounded-lg border border-line bg-white p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold text-ink">Shopee 店铺授权</div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        店铺不是手动填写编号添加。点击授权后会跳转 Shopee 官方页面，授权成功后自动出现在下方“已绑定店铺”列表。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAuthorize}
                      disabled={!canAuthorizeShopee}
                      title={canAuthorizeShopee ? "打开 Shopee 店铺授权窗口" : authorizationNotice}
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                    >
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                      {canAuthorizeShopee ? "去 Shopee 授权" : "等待配置完成"}
                    </button>
                  </div>
                </div>
                {!canAuthorizeShopee ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber">
                    {authorizationNotice}
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
                授权店铺同步后，运营总览、任务、利润、库存、广告策略和链接诊断会基于真实平台数据延伸。
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
              <div className="mt-1 font-semibold text-ink">订单 / 商品 / 库存 / 广告 / 联盟 / 链接</div>
            </div>
            <div className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm sm:col-span-3">
              <div className="text-xs text-slate-500">固定 IP 代理</div>
              <div className="mt-1 font-semibold text-ink">
                {readiness.proxy_reachable ? "运行正常" : readiness.proxy_configured ? "暂不可访问" : "等待接入"}
                {readiness.proxy_url ? ` · ${readiness.proxy_url}` : ""}
              </div>
            </div>
          </div>
          {syncResult ? (
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-6 text-forest">
              已完成读取：订单 {syncResult.orders_count}，商品 {syncResult.products_count}，库存 {syncResult.inventory_count}。
              广告、联盟、链接诊断和权重分布会通过专用只读接口继续补齐。
            </div>
          ) : null}
          {syncNotice ? (
            <div className="mt-3 rounded-md border border-line bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
              {syncNotice}
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
            {filteredShops.length} 个授权记录
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
              {filteredShops.length === 0 ? (
                <EmptyTableRow colSpan={8} text="还没有绑定店铺。完成平台授权后，这里会显示店铺信息。" />
              ) : (
                filteredShops.map((shop) => {
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
        <KpiCard
          label="广告花费"
          value={formatBrl(totalAdSpend)}
          detail="来自 Shopee 广告只读数据；未授权时为空。"
          icon={<Megaphone className="h-5 w-5" aria-hidden="true" />}
        />
        <KpiCard
          label="广告 ROAS"
          value={avgRoas ? avgRoas.toFixed(2) : "-"}
          detail="用于判断广告预算是否带来有效销售。"
          icon={<Scale className="h-5 w-5" aria-hidden="true" />}
        />
        <KpiCard
          label="联盟成交"
          value={formatBrl(totalAffiliateSales)}
          detail="来自联盟渠道只读数据；未授权时为空。"
          icon={<BadgePercent className="h-5 w-5" aria-hidden="true" />}
        />
        <KpiCard
          label="链接高风险"
          value={formatCount(highListingIssueCount)}
          detail="标题、价格、库存、无销量库存等链接问题。"
          icon={<Link2 className="h-5 w-5" aria-hidden="true" />}
        />
      </section>

      <section className="rounded-lg border border-line bg-white shadow-panel">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-forest">
              <Brain className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink">运营策略建议</h2>
              <p className="text-sm text-slate-500">
                基于真实店铺数据判断链接、广告、活动、库存和权重问题；当前只生成建议，不自动执行。
              </p>
            </div>
          </div>
          <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-4">
            <span className="rounded-md border border-line bg-slate-50 px-2 py-1">
              建议 {strategyInsights.summary.ready_recommendation_count}
            </span>
            <span className="rounded-md border border-line bg-slate-50 px-2 py-1">
              高优先级 {strategyInsights.summary.high_priority_count}
            </span>
            <span className="rounded-md border border-line bg-slate-50 px-2 py-1">
              需审批 {strategyInsights.summary.approval_required_count}
            </span>
            <span className="rounded-md border border-line bg-slate-50 px-2 py-1">
              等待数据 {strategyInsights.summary.waiting_data_count}
            </span>
          </div>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-lg border border-line">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <div className="text-sm font-semibold text-ink">策略建议列表</div>
              <span className="text-xs text-slate-500">按优先级排序</span>
            </div>
            <div className="operator-scroll max-h-96">
              <table className="operator-table text-left">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th>建议</th>
                    <th>对象</th>
                    <th>优先级</th>
                    <th>动作</th>
                    <th>审批</th>
                  </tr>
                </thead>
                <tbody>
                  {strategyInsights.recommendations.length === 0 ? (
                    <EmptyTableRow colSpan={5} text="等待店铺授权和真实数据。数据进入后会生成链接、广告、活动和库存策略建议。" />
                  ) : (
                    strategyInsights.recommendations.slice(0, 12).map((item) => (
                      <tr key={item.recommendation_id}>
                        <td className="min-w-[260px]">
                          <div className="font-medium text-ink">{item.title}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</div>
                        </td>
                        <td className="max-w-[220px] truncate">{item.target_name}</td>
                        <td>
                          <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${priorityTone(item.priority)}`}>
                            {priorityLabel(item.priority)}
                          </span>
                        </td>
                        <td className="min-w-[240px] text-sm text-slate-600">{item.suggested_action}</td>
                        <td>{item.approval_required ? "需要" : "不需要"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-line">
              <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber" aria-hidden="true" />
                <div className="text-sm font-semibold text-ink">问题反馈提示</div>
              </div>
              <div className="space-y-2 p-3">
                {strategyInsights.feedback_alerts.length === 0 ? (
                  <div className="rounded-md border border-line bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    暂无反馈提示。
                  </div>
                ) : (
                  strategyInsights.feedback_alerts.slice(0, 6).map((item) => (
                    <div key={item.alert_id} className="rounded-md border border-line bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-ink">{item.title}</div>
                        <span className={`rounded-md border px-2 py-0.5 text-xs ${priorityTone(item.severity === "high" ? "high" : item.severity === "medium" ? "medium" : "low")}`}>
                          {item.severity === "high" ? "高" : item.severity === "medium" ? "中" : "低"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{item.message}</p>
                      <p className="mt-1 text-xs leading-5 text-forest">{item.suggested_action}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-slate-50 p-3">
              <div className="text-sm font-semibold text-ink">策略安全边界</div>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                {(strategyInsights.guardrails.length ? strategyInsights.guardrails : fallbackStrategyInsights.guardrails).map((item) => (
                  <li key={item}>• {item}</li>
                ))}
                {!strategyInsights.guardrails.length ? (
                  <>
                    <li>• 当前策略层只读分析，不执行真实店铺操作。</li>
                    <li>• 广告预算、活动报名、改价、换图、改标题必须人工审批。</li>
                  </>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
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
          <div className="grid gap-4 p-4 xl:grid-cols-4">
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

            <div className="rounded-lg border border-line">
              <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">广告</div>
              <div className="operator-scroll max-h-80">
                <table className="operator-table text-left">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th>广告</th>
                      <th>花费</th>
                      <th>ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ads.data.length === 0 ? (
                      <EmptyTableRow colSpan={3} text="暂无广告数据。确认 Shopee 广告权限后可读取。" />
                    ) : (
                      ads.data.slice(0, 10).map((campaign) => (
                        <tr key={campaign.campaign_id}>
                          <td className="max-w-[220px] truncate font-medium text-ink">
                            {campaign.campaign_name || campaign.campaign_id}
                          </td>
                          <td>{formatBrl(campaign.spend)}</td>
                          <td>{campaign.roas ? campaign.roas.toFixed(2) : "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border border-line">
              <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">联盟</div>
              <div className="operator-scroll max-h-80">
                <table className="operator-table text-left">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th>商品</th>
                      <th>销售额</th>
                      <th>佣金</th>
                    </tr>
                  </thead>
                  <tbody>
                    {affiliate.data.length === 0 ? (
                      <EmptyTableRow colSpan={3} text="暂无联盟数据。确认 Shopee 联盟权限后可读取。" />
                    ) : (
                      affiliate.data.slice(0, 10).map((item) => (
                        <tr key={item.affiliate_id}>
                          <td className="max-w-[220px] truncate font-medium text-ink">
                            {item.product_name || item.product_id}
                          </td>
                          <td>{formatBrl(item.affiliate_sales)}</td>
                          <td>{formatBrl(item.commission_cost)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border border-line">
              <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">链接诊断</div>
              <div className="operator-scroll max-h-80">
                <table className="operator-table text-left">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th>商品</th>
                      <th>风险</th>
                      <th>问题</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listingDiagnostics.data.length === 0 ? (
                      <EmptyTableRow colSpan={3} text="暂无链接诊断结果。授权并同步商品后会自动分析。" />
                    ) : (
                      listingDiagnostics.data.slice(0, 10).map((item) => (
                        <tr key={item.issue_id}>
                          <td className="max-w-[220px] truncate font-medium text-ink">
                            {item.product_name || item.product_id}
                          </td>
                          <td>
                            <span
                              className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${
                                item.severity === "high"
                                  ? "border-rose-200 bg-rose-50 text-coral"
                                  : item.severity === "medium"
                                    ? "border-amber-200 bg-amber-50 text-amber"
                                    : "border-emerald-200 bg-emerald-50 text-forest"
                              }`}
                            >
                              {item.severity === "high" ? "高" : item.severity === "medium" ? "中" : "低"}
                            </span>
                          </td>
                          <td className="max-w-[220px] truncate">{item.reason}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg border border-line">
              <div className="border-b border-line px-3 py-2 text-sm font-semibold text-ink">权重分布</div>
              <div className="operator-scroll max-h-80">
                <table className="operator-table text-left">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th>指标</th>
                      <th>占比</th>
                      <th>得分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shopWeight.data.length === 0 ? (
                      <EmptyTableRow colSpan={3} text="暂无权重分布。授权并同步后会基于真实数据计算。" />
                    ) : (
                      shopWeight.data.map((item) => (
                        <tr key={item.metric_id}>
                          <td className="max-w-[220px] truncate font-medium text-ink">{item.metric_name}</td>
                          <td>{item.weight_share}%</td>
                          <td>{item.score}</td>
                        </tr>
                      ))
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
              授权成功后，系统会优先读取平台真实数据；订单、商品、库存、广告、联盟、链接诊断和内部权重分布会共同驱动运营总览、任务中心、利润中心、库存中心、审批与执行建议。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
