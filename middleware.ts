import { NextResponse, type NextRequest } from "next/server";
import { verifyAuthToken } from "@/server/jwt";
import { AUTH_COOKIE_NAME } from "@/server/auth-cookie";

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/pricing")) return true;
  if (pathname.startsWith("/public")) return true;
  if (pathname.startsWith("/invite")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Canonical host redirect: prevents auth cookie/session loss caused by mixing
  // `*.vercel.app` deployment URLs with the production alias domain.
  // IMPORTANT: Do NOT redirect /invite here. Supabase returns tokens in the URL hash
  // (e.g. /invite#access_token=...), and hash fragments are NOT sent to the server.
  // Any redirect would drop the hash and make the link look "expired".
  const isInvitePath = pathname.startsWith("/invite");
  const canonicalBase = process.env.NEXT_PUBLIC_APP_URL;
  if (canonicalBase && !isInvitePath) {
    const canonical = new URL(canonicalBase);
    const host = request.headers.get("host");
    if (host && host !== canonical.host) {
      const dest = new URL(
        request.nextUrl.pathname + request.nextUrl.search,
        canonical.origin
      );
      return NextResponse.redirect(dest, 308);
    }
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  let claims: { role: "admin" | "client"; adminId?: string } | null = null;
  if (token) {
    try {
      const parsed = await verifyAuthToken(token);
      claims = { role: parsed.role, adminId: parsed.adminId };
    } catch {
      claims = null;
    }
  }

  const isAuthed = !!claims;

  // Role-Based Routing
  if (isAuthed && claims) {
    // Blocked-client enforcement (server-side). Middleware runs on Edge and cannot
    // query Mongo directly, so we validate via a nodejs API route.
    if (claims.role === "client" && !isPublicPath(pathname)) {
      try {
        const statusUrl = new URL("/api/auth/client/status", request.url);
        const cookie = request.headers.get("cookie") || "";
        const statusRes = await fetch(statusUrl, {
          method: "GET",
          headers: { cookie },
          cache: "no-store",
        });

        if (statusRes.status === 403) {
          const data = await statusRes.json().catch(() => ({}));
          const msg =
            typeof data?.error === "string" && data.error.trim()
              ? data.error
              : "Your account has been temporarily restricted. Please contact support or your administrator.";

          const url = request.nextUrl.clone();
          url.pathname = "/";
          url.searchParams.set("tab", "login");
          url.searchParams.set("authError", msg);

          const res = NextResponse.redirect(url);
          // Clear auth cookie so the client doesn't keep bouncing.
          res.cookies.set(AUTH_COOKIE_NAME, "", { path: "/", maxAge: 0 });
          return res;
        }
      } catch {
        // If status check fails, fall back to normal auth behavior.
      }
    }

    // Client Protection: Block access to Admin routes
    if (claims.role === "client") {
      const adminOnlyPrefixes = [
        "/clients",
        "/plans",
        "/meals",
        "/meetings",
        "/settings",
        "/boards",
        "/board",
        "/analytics",
      ];

      if (adminOnlyPrefixes.some((p) => pathname.startsWith(p))) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }

    // Admin/Client Protection: Block access to Owner routes (Owner routes are no longer used)
    if (pathname.startsWith("/owner")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard"; // Redirect to main dashboard
      return NextResponse.redirect(url);
    }
  }

  if (!isPublicPath(pathname) && !isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
