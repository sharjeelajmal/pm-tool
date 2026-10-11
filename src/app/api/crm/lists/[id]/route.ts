import { readJson, respond, withCrm } from "@/lib/crm/access";
import { deleteList, updateList } from "@/lib/crm/contactsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Ctx) {
  const { id } = await context.params;
  return withCrm(async () => respond(await updateList(id, await readJson(request))));
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id } = await context.params;
  return withCrm(async () => respond(await deleteList(id)), { adminOnly: true });
}
