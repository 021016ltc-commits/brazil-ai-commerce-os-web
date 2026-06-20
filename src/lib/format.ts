import { statusLabel as zhStatusLabel } from "@/locales/zh-CN";
import type { DashboardValueUnit } from "@/types";

export function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCount(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function formatPercent(value: number, digits = value < 0.1 ? 1 : 0) {
  return `${(value * 100).toFixed(digits).replace(/\.0$/, "")}%`;
}

export function formatRatio(value: number) {
  return `${value.toFixed(1).replace(/\.0$/, "")}x`;
}

export function formatMetricValue(value: number, unit: DashboardValueUnit) {
  if (unit === "currency") return formatBrl(value);
  if (unit === "percent") return formatPercent(value);
  if (unit === "days") return `${formatCount(value)} 天`;
  if (unit === "ratio") return formatRatio(value);
  return formatCount(value);
}

export function statusLabel(status: string) {
  return zhStatusLabel(status);
}
