import { readJson, respond, withCrm } from "@/lib/crm/access";
import { deletePipeline, updatePipeline } from "@/lib/crm/pipelineService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Ctx) {
  const { id } = await context.params;
  return withCrm(async () => respond(await updatePipeline(id, await readJson(request))), { adminOnly: true });
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id } = await context.params;
  return withCrm(async () => respond(await deletePipeline(id)), { adminOnly: true });
}
