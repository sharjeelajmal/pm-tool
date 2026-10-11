import type { NextRequest } from "next/server";
import { jsonResponse } from "@/lib/apiHeaders";
import { withCrm } from "@/lib/crm/access";
import { listGoogleBusy } from "@/lib/crm/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const from = new Date(params.get("from") || "");
  const to = new Date(params.get("to") || "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return jsonResponse({ success: false, error: "Invalid range" }, 400);
  }
  return withCrm(async (ctx) => jsonResponse({ success: true, events: await listGoogleBusy(ctx.username, from, to) }));
}
