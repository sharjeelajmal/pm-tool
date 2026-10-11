import type { NextRequest } from "next/server";
import { readJson, respond, withCrm } from "@/lib/crm/access";
import { createAppointment, fetchAppointments } from "@/lib/crm/calendarService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const users = (params.get("users") || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  return withCrm(async (ctx) =>
    respond(
      await fetchAppointments(ctx, {
        from: params.get("from") || undefined,
        to: params.get("to") || undefined,
        contactId: params.get("contactId") || undefined,
        users,
      })
    )
  );
}

export async function POST(request: Request) {
  return withCrm(async (ctx) => respond(await createAppointment(ctx, await readJson(request))));
}
