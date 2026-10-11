import { readJson, respond, withCrm } from "@/lib/crm/access";
import { createField, fetchFields } from "@/lib/crm/contactsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return withCrm(async () => respond(await fetchFields()));
}

export async function POST(request: Request) {
  return withCrm(async () => respond(await createField(await readJson(request))), { adminOnly: true });
}
