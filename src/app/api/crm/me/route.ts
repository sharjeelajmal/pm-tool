import { jsonResponse } from "@/lib/apiHeaders";
import { listCrmMembers, withCrm } from "@/lib/crm/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return withCrm(async (ctx) => {
    const members = await listCrmMembers();
    return jsonResponse({ success: true, me: ctx, members });
  });
}
