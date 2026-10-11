import { readJson, respond, withCrm } from "@/lib/crm/access";
import { deleteOpportunity, updateOpportunity } from "@/lib/crm/pipelineService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Ctx) {
  const { id } = await context.params;
  return withCrm(async (ctx) => respond(await updateOpportunity(ctx, id, await readJson(request))));
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id } = await context.params;
  return withCrm(async (ctx) => respond(await deleteOpportunity(ctx, id)));
}
