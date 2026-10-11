import { readJson, respond, withCrm } from "@/lib/crm/access";
import { createPipeline, fetchPipelines } from "@/lib/crm/pipelineService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return withCrm(async () => respond(await fetchPipelines()));
}

export async function POST(request: Request) {
  return withCrm(async () => respond(await createPipeline(await readJson(request))), { adminOnly: true });
}
