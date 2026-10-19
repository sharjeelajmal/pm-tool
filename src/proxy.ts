import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never intercept or redirect non-GET requests (such as Server Actions or API POSTs)
  if (request.method !== "GET" || request.headers.get("next-action")) {
    return NextResponse.next();
  }

  // Allow the static files, manifest, sw, and api
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico" ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".json")
  ) {
    return NextResponse.next();
  }

  const authToken = request.cookies.get("auth_token")?.value;

  // Protect all routes except /login and static Next.js assets
  const isLoginPage = pathname.startsWith("/login");

  if (!authToken && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (authToken && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}


export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt, manifest.json, sw.js (metadata files)
     * - static file extensions (png, jpg, svg, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico|json)).*)",
  ],
};

