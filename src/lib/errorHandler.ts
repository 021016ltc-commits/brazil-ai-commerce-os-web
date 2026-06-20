import { NextResponse } from "next/server";
import { getLogLevel, isProductionMode } from "@/lib/runtime/config";
import { tenantIdFromRequest, withTenant } from "@/lib/tenantContext";

type ApiPayload = Record<string, unknown>;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown API error.";
}

export function logApiError(route: string, error: unknown) {
  const message = errorMessage(error);
  if (getLogLevel() === "debug" || getLogLevel() === "info" || getLogLevel() === "warn" || getLogLevel() === "error") {
    console.error(`[api:${route}] ${message}`);
  }
}

export async function tenantServiceJson<T extends object>(
  request: Request,
  route: string,
  load: () => Promise<T>,
  init?: ResponseInit,
) {
  const tenantId = tenantIdFromRequest(request);

  try {
    const payload = await withTenant(tenantId, load);
    return NextResponse.json({ tenant_id: tenantId, ...payload }, init);
  } catch (error) {
    logApiError(route, error);
    return NextResponse.json(
      {
        tenant_id: tenantId,
        source: "sqlite",
        fallback: true,
        production_safe_fallback: isProductionMode(),
        error: isProductionMode() ? "Real data source unavailable." : "API fallback response.",
        detail: errorMessage(error),
      } satisfies ApiPayload,
      { status: isProductionMode() ? 503 : 200 },
    );
  }
}

export async function mutationServiceJson<T extends object>(
  request: Request,
  route: string,
  load: () => Promise<T>,
  init?: ResponseInit,
) {
  const tenantId = tenantIdFromRequest(request);

  try {
    const payload = await withTenant(tenantId, load);
    return NextResponse.json({ tenant_id: tenantId, ...payload }, init);
  } catch (error) {
    logApiError(route, error);
    return NextResponse.json(
      {
        tenant_id: tenantId,
        source: "sqlite",
        fallback: true,
        production_safe_fallback: isProductionMode(),
        error: errorMessage(error),
      } satisfies ApiPayload,
      { status: init?.status && init.status >= 400 ? init.status : 500 },
    );
  }
}
