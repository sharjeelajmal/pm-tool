import { readJson, respond, withCrm } from "@/lib/crm/access";
import { bulkOpportunities } from "@/lib/crm/pipelineService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return withCrm(async (ctx) => respond(await bulkOpportunities(ctx, await readJson(request))));
}
