import { dataService } from "@/lib/dataService";
import { tenantServiceJson } from "@/lib/errorHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return tenantServiceJson(request, "/api/self-optimization", dataService.getSelfOptimization);
}
