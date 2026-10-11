import { jsonResponse } from "@/lib/apiHeaders";
import { readJson, withCrm } from "@/lib/crm/access";
import { getGoogleStatus, setGoogleSync } from "@/lib/crm/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(request: Request) {
  return withCrm(async (ctx) => {
    const body = (await readJson(request)) as { enabled?: boolean } | null;
    await setGoogleSync(ctx.username, !!body?.enabled);
    return jsonResponse({ success: true, google: await getGoogleStatus(ctx.username) });
  });
}
