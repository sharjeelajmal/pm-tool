import type { NextRequest } from "next/server";
import { withCrm } from "@/lib/crm/access";
import { contactQueryFromSearch, exportContactsCsv } from "@/lib/crm/contactsService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return withCrm(async (ctx) => {
    const { csv } = await exportContactsCsv(ctx, contactQueryFromSearch(request.nextUrl.searchParams));
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
