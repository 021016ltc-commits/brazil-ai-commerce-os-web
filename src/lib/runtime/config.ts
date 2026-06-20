import { randomUUID } from "node:crypto";

export type SystemMode = "development" | "staging" | "production";
export type CacheMode = "memory" | "memory_or_upstash" | "upstash" | "disabled";
export type ShopeeApiMode = "mock" | "sqlite" | "readonly" | "real";
export type LogLevel = "debug" | "info" | "warn" | "error";

const instanceId = `baios_${Date.now()}_${randomUUID().slice(0, 8)}`;

function normalized(value: string | undefined) {
  return value?.trim().toLowerCase();
}

export function getSystemMode(): SystemMode {
  const mode = normalized(process.env.SYSTEM_MODE);
  if (mode === "production" || mode === "staging" || mode === "development") return mode;
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

export function isProductionMode() {
  return getSystemMode() === "production";
}

export function getCacheMode(): CacheMode {
  const mode = normalized(process.env.CACHE_MODE);
  if (mode === "memory_or_upstash" || mode === "upstash") return mode;
  if (mode === "disabled" || mode === "off" || process.env.CACHE_ENABLED?.trim().toLowerCase() === "false") {
    return "disabled";
  }
  return "memory";
}

export function getShopeeApiMode(): ShopeeApiMode {
  const value = normalized(process.env.SHOPEE_MODE || process.env.SHOOPE_API_MODE || process.env.SHOPEE_API_MODE);
  if (value === "real" || value === "readonly" || value === "sqlite" || value === "mock") return value;
  return isProductionMode() ? "readonly" : "sqlite";
}

export function getLogLevel(): LogLevel {
  const value = normalized(process.env.LOG_LEVEL);
  if (value === "debug" || value === "info" || value === "warn" || value === "error") return value;
  return isProductionMode() ? "error" : "debug";
}

export function isDebugOutputAllowed() {
  return !isProductionMode() && getLogLevel() === "debug" && normalized(process.env.DEBUG) !== "false";
}

export function isMockDataAllowed() {
  return false;
}

export function getRequestedDataSourceMode() {
  return normalized(process.env.DATA_SOURCE_MODE);
}

export function shouldStartScheduler() {
  if (process.env.SCHEDULER_ENABLED?.trim().toLowerCase() === "false") return false;
  return isProductionMode();
}

export function getServerInstanceId() {
  return process.env.SERVER_INSTANCE_ID?.trim() || instanceId;
}

export function createProductionTraceId(prefix = "prod") {
  return `${prefix}_${Date.now()}_${randomUUID().slice(0, 10)}`;
}

export function getRuntimeEnvironmentTag() {
  return {
    system_mode: getSystemMode(),
    environment: getSystemMode(),
    shoope_api_mode: getShopeeApiMode(),
    shopee_mode: getShopeeApiMode(),
    cache_mode: getCacheMode(),
    log_level: getLogLevel(),
    server_instance_id: getServerInstanceId(),
    debug_output_allowed: isDebugOutputAllowed(),
  };
}
