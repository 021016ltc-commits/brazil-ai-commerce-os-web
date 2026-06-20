// @ts-nocheck
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawn } = require("node:child_process");

const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.production");
const port = process.env.PORT || "3000";
const host = process.env.HOST || "0.0.0.0";

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    process.env[key] = process.env[key] ?? value;
  }
}

function normalizeProductionEnv() {
  process.env.SYSTEM_MODE = process.env.SYSTEM_MODE || "production";
  process.env.CACHE_MODE = process.env.CACHE_MODE || "memory_or_upstash";
  process.env.CACHE_ENABLED = process.env.CACHE_ENABLED || "true";
  process.env.SCHEDULER_ENABLED = process.env.SCHEDULER_ENABLED || "true";
  process.env.SHOPEE_MODE = process.env.SHOPEE_MODE || process.env.SHOOPE_API_MODE || process.env.SHOPEE_API_MODE || "readonly";
  process.env.SHOOPE_API_MODE = process.env.SHOOPE_API_MODE || process.env.SHOPEE_MODE || "readonly";
  process.env.SHOPEE_API_MODE = process.env.SHOPEE_API_MODE || process.env.SHOPEE_MODE || "readonly";
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || "error";

  if (process.env.SYSTEM_MODE === "production" && process.env.DATA_SOURCE_MODE?.trim().toLowerCase() === "mock") {
    process.env.DATA_SOURCE_MODE = "postgres";
  }
  process.env.DATA_SOURCE_MODE = process.env.DATA_SOURCE_MODE || "postgres";
}

function validateEnvironment() {
  const warnings = [];
  if (!process.env.DATABASE_URL) {
    warnings.push("DATABASE_URL is empty; PostgreSQL will fall back to SQLite if available.");
  }
  if (!existsSync(resolve(projectRoot, ".next"))) {
    warnings.push(".next build output was not found. Run npm run build before starting production.");
  }
  if (!process.env.SQLITE_DB_PATH) {
    warnings.push("SQLITE_DB_PATH is empty; the default local SQLite path will be used by the app.");
  }
  return warnings;
}

async function waitForServer(baseUrl) {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/system-health`, { cache: "no-store" });
      if (response.ok) return true;
    } catch {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
    }
  }
  return false;
}

async function warmRuntime(baseUrl) {
  const endpoints = ["/api/system-health", "/api/dashboard-summary", "/api/tasks", "/api/inventory"];
  const results = [];

  for (const endpoint of endpoints) {
    const startedAt = Date.now();
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, { cache: "no-store" });
      results.push({
        endpoint,
        status: response.ok ? "ok" : "fail",
        response_time: Date.now() - startedAt,
      });
    } catch (error) {
      results.push({
        endpoint,
        status: "fail",
        response_time: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Request failed.",
      });
    }
  }

  return results;
}

async function main() {
  loadEnvFile(envPath);
  normalizeProductionEnv();

  const warnings = validateEnvironment();
  const baseUrl = `http://127.0.0.1:${port}`;
  const nextBin = resolve(projectRoot, "node_modules", "next", "dist", "bin", "next");

  console.log("[Brazil AI Commerce OS] production startup");
  console.log(`- system mode: ${process.env.SYSTEM_MODE}`);
  console.log(`- data source: ${process.env.DATA_SOURCE_MODE}`);
  console.log(`- cache mode: ${process.env.CACHE_MODE}`);
  console.log(`- shopee mode: ${process.env.SHOPEE_MODE}`);
  console.log(`- scheduler enabled: ${process.env.SCHEDULER_ENABLED}`);
  warnings.forEach((warning) => console.warn(`- warning: ${warning}`));

  const server = spawn(process.execPath, [nextBin, "start", "--hostname", host, "--port", port], {
    cwd: projectRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => process.stdout.write(chunk));
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  server.on("exit", (code, signal) => {
    console.log(`[Brazil AI Commerce OS] production server exited code=${code ?? "null"} signal=${signal ?? "null"}`);
    process.exit(code ?? 1);
  });

  const ready = await waitForServer(baseUrl);
  if (!ready) {
    console.error("[Brazil AI Commerce OS] server failed to become ready.");
    server.kill();
    process.exit(1);
  }

  const warmup = await warmRuntime(baseUrl);
  console.log("[Brazil AI Commerce OS] ready");
  console.log(`- access URL: ${baseUrl}/login`);
  console.log(`- health URL: ${baseUrl}/system-health`);
  console.log(`- warmup: ${JSON.stringify(warmup)}`);
}

void main();
