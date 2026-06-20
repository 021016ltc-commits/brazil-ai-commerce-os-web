import { AsyncLocalStorage } from "async_hooks";
import { NextResponse } from "next/server";

export const DEFAULT_TENANT_ID = "demo_tenant";

const tenantStorage = new AsyncLocalStorage<string>();

function normalizeTenantId(value: string | null | undefined) {
  const tenantId = value?.trim();
  return tenantId || DEFAULT_TENANT_ID;
}

export function tenantIdFromRequest(request: Request) {
  const url = new URL(request.url);
  return normalizeTenantId(
    url.searchParams.get("tenant_id") ?? request.headers.get("x-tenant-id"),
  );
}

export function currentTenantId() {
  return tenantStorage.getStore() ?? DEFAULT_TENANT_ID;
}

export function withTenant<T>(tenantId: string | null | undefined, callback: () => T) {
  return tenantStorage.run(normalizeTenantId(tenantId), callback);
}

export async function tenantJson<T extends object>(
  request: Request,
  callback: () => Promise<T>,
  init?: ResponseInit,
) {
  const tenantId = tenantIdFromRequest(request);
  const payload = await withTenant(tenantId, callback);
  return NextResponse.json({ tenant_id: tenantId, ...payload }, init);
}
