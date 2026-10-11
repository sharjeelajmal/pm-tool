import { readJson, respond, withCrm } from "@/lib/crm/access";
import { deleteTask, updateTask } from "@/lib/crm/contactsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; taskId: string }> };

export async function PUT(request: Request, context: Ctx) {
  const { id, taskId } = await context.params;
  return withCrm(async (ctx) => respond(await updateTask(ctx, id, taskId, await readJson(request))));
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id, taskId } = await context.params;
  return withCrm(async (ctx) => respond(await deleteTask(ctx, id, taskId)));
}
