import { jsonResponse } from "@/lib/apiHeaders";
import { withCrm } from "@/lib/crm/access";
import { disconnectGoogle } from "@/lib/crm/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  return withCrm(async (ctx) => {
    await disconnectGoogle(ctx.username);
    return jsonResponse({ success: true });
  });
}
