import { readJson, respond, withCrm } from "@/lib/crm/access";
import { deleteAppointment, updateAppointment } from "@/lib/crm/calendarService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Ctx) {
  const { id } = await context.params;
  return withCrm(async (ctx) => respond(await updateAppointment(ctx, id, await readJson(request))));
}

export async function DELETE(_request: Request, context: Ctx) {
  const { id } = await context.params;
  return withCrm(async (ctx) => respond(await deleteAppointment(ctx, id)));
}
