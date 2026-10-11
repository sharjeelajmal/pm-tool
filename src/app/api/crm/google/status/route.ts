import { jsonResponse } from "@/lib/apiHeaders";
import { withCrm } from "@/lib/crm/access";
import { getGoogleStatus } from "@/lib/crm/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return withCrm(async (ctx) => jsonResponse({ success: true, google: await getGoogleStatus(ctx.username) }));
}
