import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      source: "shopee_api",
      readonly: true,
      status: "needs_permission",
      data: [],
      synced_at: null,
      message: "Shopee 联盟数据权限尚未开通；当前系统不会生成测试联盟数据。",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
