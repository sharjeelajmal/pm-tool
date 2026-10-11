import type { NextRequest } from "next/server";
import { readJson, respond, withCrm } from "@/lib/crm/access";
import { createOpportunity, fetchOpportunities } from "@/lib/crm/pipelineService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return withCrm(async (ctx) =>
    respond(
      await fetchOpportunities(ctx, {
        pipelineId: params.get("pipelineId") || undefined,
        q: params.get("q") || undefined,
        status: params.get("status") || undefined,
        assignedTo: params.get("assignedTo") || undefined,
        contactId: params.get("contactId") || undefined,
      })
    )
  );
}

export async function POST(request: Request) {
  return withCrm(async (ctx) => respond(await createOpportunity(ctx, await readJson(request))));
}
