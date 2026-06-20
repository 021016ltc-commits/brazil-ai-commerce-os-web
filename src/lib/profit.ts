import type { ProductProfitItem, ProfitCostStructureItem, ProfitRiskSummary, ProfitSnapshot } from "@/types";

export function buildCostStructure(snapshot: ProfitSnapshot): ProfitCostStructureItem[] {
  const items = [
    { cost_key: "procurement_cost", label: "采购成本", value: snapshot.procurement_cost },
    { cost_key: "advertising_cost", label: "广告成本", value: snapshot.advertising_cost },
    { cost_key: "logistics_cost", label: "物流成本", value: snapshot.logistics_cost },
    { cost_key: "platform_commission", label: "平台佣金", value: snapshot.platform_commission },
    { cost_key: "tax_cost", label: "税费", value: snapshot.tax_cost },
  ] as const;

  const total = items.reduce((sum, item) => sum + item.value, 0);

  return items.map((item) => ({
    ...item,
    share: total === 0 ? 0 : item.value / total,
  }));
}

export function buildProfitRisk(productProfit: ProductProfitItem[]): ProfitRiskSummary {
  return {
    loss_products: productProfit.filter((item) => item.net_profit < 0).length,
    low_profit_products: productProfit.filter((item) => item.net_profit >= 0 && item.net_margin < 0.12).length,
    high_risk_products: productProfit.filter((item) => item.risk_level === "high").length,
  };
}
