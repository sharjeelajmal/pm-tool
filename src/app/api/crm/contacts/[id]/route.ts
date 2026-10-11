import { readJson, respond, withCrm } from "@/lib/crm/access";
import { deleteContact, getContact, updateContact } from "@/lib/crm/contactsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;
  return withCrm(async (ctx) => respond(await getContact(ctx, id)));
}

export async function PUT(request: Request, context: Ctx) {
  const { id } = await context.params;
  return withCrm(async (ctx) => respond(await updateContact(ctx, id, await readJson(request))));
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id } = await context.params;
  return withCrm(async (ctx) => respond(await deleteContact(ctx, id)));
}
