import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { getCrmContext } from "@/lib/crm/access";
import { connectGoogleAccount } from "@/lib/crm/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;
  const back = (status: string) => {
    const response = NextResponse.redirect(new URL(`/crm/calendar?google=${status}`, origin));
    response.cookies.set("crm_google_state", "", { path: "/api/crm/google", maxAge: 0 });
    return response;
  };

  const result = await getCrmContext();
  if (!result.ok) return NextResponse.redirect(new URL("/", origin));
  if (params.get("error")) return back("denied");

  const state = params.get("state");
  const expected = request.cookies.get("crm_google_state")?.value;
  const code = params.get("code");
  if (!state || !expected || state !== expected || !code) return back("invalid_state");

  try {
    await connectDB();
    await connectGoogleAccount(result.ctx.username, code, origin);
    return back("connected");
  } catch (error) {
    console.error("Google connect failed:", error);
    return back("failed");
  }
}
