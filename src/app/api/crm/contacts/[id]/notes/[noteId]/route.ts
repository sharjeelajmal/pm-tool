import { readJson, respond, withCrm } from "@/lib/crm/access";
import { deleteNote, updateNote } from "@/lib/crm/contactsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; noteId: string }> };

export async function PUT(request: Request, context: Ctx) {
  const { id, noteId } = await context.params;
  return withCrm(async (ctx) => respond(await updateNote(ctx, id, noteId, await readJson(request))));
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id, noteId } = await context.params;
  return withCrm(async (ctx) => respond(await deleteNote(ctx, id, noteId)));
}
