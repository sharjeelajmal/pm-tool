import { readJson, respond, withCrm } from "@/lib/crm/access";
import { createList, fetchLists } from "@/lib/crm/contactsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return withCrm(async (ctx) => respond(await fetchLists(ctx)));
}

export async function POST(request: Request) {
  return withCrm(async (ctx) => respond(await createList(await readJson(request), ctx)));
}
