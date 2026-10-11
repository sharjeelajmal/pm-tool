import { readJson, respond, withCrm } from "@/lib/crm/access";
import { addTask } from "@/lib/crm/contactsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const { id } = await context.params;
  return withCrm(async (ctx) => respond(await addTask(ctx, id, await readJson(request))));
}
