import type { NextRequest } from "next/server";
import { respond, withCrm } from "@/lib/crm/access";
import { fetchDashboard } from "@/lib/crm/dashboardService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return withCrm(async (ctx) =>
    respond(
      await fetchDashboard(ctx, {
        from: params.get("from"),
        to: params.get("to"),
        pipelineId: params.get("pipelineId"),
        tz: params.get("tz"),
      })
    )
  );
}
