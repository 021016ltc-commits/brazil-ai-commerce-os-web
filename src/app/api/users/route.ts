import { NextResponse } from "next/server";
import { dataService } from "@/lib/dataService";
import { logApiError, tenantServiceJson } from "@/lib/errorHandler";
import { tenantIdFromRequest, withTenant } from "@/lib/tenantContext";
import type { UserRoleName, UserStatus } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedRoles = new Set(["admin", "operator", "buyer", "finance", "viewer"]);
const allowedStatuses = new Set(["active", "disabled"]);

function normalizeRoles(value: unknown): UserRoleName[] {
  if (!Array.isArray(value)) return ["viewer"];
  const roles = value.filter((item): item is UserRoleName => typeof item === "string" && allowedRoles.has(item));
  return roles.length > 0 ? roles : ["viewer"];
}

function normalizeStatus(value: unknown): UserStatus | undefined {
  return typeof value === "string" && allowedStatuses.has(value) ? (value as UserStatus) : undefined;
}

export async function GET(request: Request) {
  return tenantServiceJson(request, "/api/users", dataService.getUsers);
}

export async function POST(request: Request) {
  const tenantId = tenantIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as
    | {
        email?: string;
        display_name?: string;
        roles?: unknown;
        status?: unknown;
        actor_user_id?: string;
        actor_email?: string;
      }
    | null;

  if (!body?.email) {
    return NextResponse.json({ error: "email is required." }, { status: 400 });
  }

  try {
    const result = await withTenant(tenantId, () => dataService.createUser({
      email: body.email,
      display_name: body.display_name,
      roles: normalizeRoles(body.roles),
      status: normalizeStatus(body.status) ?? "active",
      actor_user_id: body.actor_user_id,
      actor_email: body.actor_email,
    }));
    return NextResponse.json({ tenant_id: tenantId, ...result }, { status: 201 });
  } catch (error) {
    logApiError("/api/users", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "本地用户创建失败。" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const tenantId = tenantIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as
    | {
        user_id?: string;
        display_name?: string;
        roles?: unknown;
        status?: unknown;
        last_login_at?: string | null;
        actor_user_id?: string;
        actor_email?: string;
      }
    | null;

  if (!body?.user_id) {
    return NextResponse.json({ error: "user_id is required." }, { status: 400 });
  }

  try {
    const result = await withTenant(tenantId, () => dataService.updateUser({
      user_id: body.user_id,
      display_name: body.display_name,
      roles: Array.isArray(body.roles) ? normalizeRoles(body.roles) : undefined,
      status: normalizeStatus(body.status),
      last_login_at: body.last_login_at,
      actor_user_id: body.actor_user_id,
      actor_email: body.actor_email,
    }));
    return NextResponse.json({ tenant_id: tenantId, ...result });
  } catch (error) {
    logApiError("/api/users", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "本地用户更新失败。" },
      { status: 400 },
    );
  }
}
