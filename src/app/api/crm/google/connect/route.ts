import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCrmContext } from "@/lib/crm/access";
import { buildGoogleAuthUrl, googleConfigured } from "@/lib/crm/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const result = await getCrmContext();
  if (!result.ok) return NextResponse.redirect(new URL("/", origin));
  if (!googleConfigured()) return NextResponse.redirect(new URL("/crm/calendar?google=not_configured", origin));

  // CSRF protection for the OAuth round trip.
  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(buildGoogleAuthUrl(origin, state));
  response.cookies.set("crm_google_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/api/crm/google",
  });
  return response;
}
