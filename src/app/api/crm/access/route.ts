import { z } from "zod";
import { jsonResponse } from "@/lib/apiHeaders";
import { listAccessUsers, readJson, respond, setUserAccess, withCrm } from "@/lib/crm/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return withCrm(async () => jsonResponse({ success: true, users: await listAccessUsers() }), { adminOnly: true });
}

const AccessSchema = z.object({
  username: z.string().min(1).max(60),
  hasAccess: z.boolean(),
  scope: z.enum(["all", "assigned"]).default("all"),
});

export async function PUT(request: Request) {
  return withCrm(
    async (ctx) => {
      const parsed = AccessSchema.safeParse(await readJson(request));
      if (!parsed.success) return jsonResponse({ success: false, error: "Invalid access data" }, 400);
      return respond(await setUserAccess(parsed.data.username, parsed.data.hasAccess, parsed.data.scope, ctx.username));
    },
    { adminOnly: true }
  );
}
