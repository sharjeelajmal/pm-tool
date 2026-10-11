import { readJson, respond, withCrm } from "@/lib/crm/access";
import { deleteField, updateField } from "@/lib/crm/contactsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Ctx) {
  const { id } = await context.params;
  return withCrm(async () => respond(await updateField(id, await readJson(request))), { adminOnly: true });
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id } = await context.params;
  return withCrm(async () => respond(await deleteField(id)), { adminOnly: true });
}
