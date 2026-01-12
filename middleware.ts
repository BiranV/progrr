import { NextResponse, type NextRequest } from "next/server";
import { verifyAuthToken } from "@/server/jwt";
import { AUTH_COOKIE_NAME } from "@/server/auth-cookie";

function isSafeNextPath(next: string | null): next is string {
  if (!next) return false;
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  // Prevent looping back to auth entry points
  if (next === "/" || next.startsWith("/auth") || next.startsWith("/login")) {
    return false;
  }
  return true;
}

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname.startsWith("/public")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const canonicalBase = process.env.NEXT_PUBLIC_APP_URL;
  if (canonicalBase) {
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
  let claims: { sub: string } | null = null;
  if (token) {
    try {
      const parsed = await verifyAuthToken(token);
      claims = { sub: parsed.sub };
    } catch {
      claims = null;
    }
  }

  const isAuthed = !!claims;

  // Auth entry routes: if the user is already authenticated, they should never see
  // the login / welcome screens.
  const isAuthEntryPath =
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/login");

  // IMPORTANT: A valid JWT signature is not enough to treat the session as usable.
  // Confirm via /api/me so missing users clear the cookie.
  if (isAuthEntryPath && isAuthed) {
    try {
      const meUrl = new URL("/api/me", request.url);
      const cookie = request.headers.get("cookie") || "";
      const meRes = await fetch(meUrl, {
        method: "GET",
        headers: { cookie },
        cache: "no-store",
      });

      if (meRes.ok) {
        const next = request.nextUrl.searchParams.get("next");
        const dest = isSafeNextPath(next) ? next : "/dashboard";
        return NextResponse.redirect(new URL(dest, request.url));
      }

      // For 401 or other failures, allow the auth route to render.
      if (meRes.status === 401) {
        const res = NextResponse.next();
        res.cookies.set(AUTH_COOKIE_NAME, "", { path: "/", maxAge: 0 });
        return res;
      }
    } catch {
      // If the check fails, do not break auth entry routes.
    }
  }

  if (!isPublicPath(pathname) && !isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search
    );
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
