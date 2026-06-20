import { NextResponse } from "next/server";
import { dataService } from "@/lib/dataService";
import { logApiError } from "@/lib/errorHandler";
import { tenantIdFromRequest, withTenant } from "@/lib/tenantContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const tenantId = tenantIdFromRequest(request);
  try {
    const result = await withTenant(tenantId, dataService.syncShopeeData);
    return NextResponse.json({ tenant_id: tenantId, ...result });
  } catch (error) {
    logApiError("/api/shopee/sync", error);
    return NextResponse.json(
      { tenant_id: tenantId, source: "mock", readonly: true, error: "Shopee read-only sync failed safely." },
      { status: 500 },
    );
  }
}
