import type { NextRequest } from "next/server";
import { readJson, respond, withCrm } from "@/lib/crm/access";
import { contactQueryFromSearch, createContact, queryContacts } from "@/lib/crm/contactsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withCrm(async (ctx) => respond(await queryContacts(ctx, contactQueryFromSearch(request.nextUrl.searchParams))));
}

export async function POST(request: Request) {
  return withCrm(async (ctx) => respond(await createContact(ctx, await readJson(request))));
}
