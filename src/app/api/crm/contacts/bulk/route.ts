import { readJson, respond, withCrm } from "@/lib/crm/access";
import { bulkContacts } from "@/lib/crm/contactsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return withCrm(async (ctx) => respond(await bulkContacts(ctx, await readJson(request))));
}
