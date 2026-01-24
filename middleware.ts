import { NextResponse, type NextRequest } from "next/server";
import { verifyAuthToken } from "@/server/jwt";
import { AUTH_COOKIE_NAME } from "@/server/auth-cookie";
import { isPublicPagePathname } from "@/lib/public-routes";
import {
  DEV_ONBOARDING_COOKIE,
  isDevOnboardingEnabled,
  isDevOnboardingRequest,
  isDevOnboardingPath,
  isDevOnboardingStepPath,
  readDevOnboardingCookieFromRequest,
} from "@/server/dev-onboarding";

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
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/manifest.webmanifest") return true;
  if (pathname === "/sw.js") return true;
  if (pathname.startsWith("/icons")) return true;
  if (pathname.startsWith("/uploads")) return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  if (isPublicPagePathname(pathname)) return true;
  return false;
}

function isBypassPath(pathname: string) {
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/manifest.webmanifest") return true;
  if (pathname === "/sw.js") return true;
  if (pathname.startsWith("/icons")) return true;
  if (pathname.startsWith("/uploads")) return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  return false;
}

function isOnboardingPath(pathname: string) {
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isDev = isDevOnboardingEnabled();
  const isDevOnboardingQuery = isDev && isDevOnboardingRequest(request);
  const hasDevCookie = isDev && readDevOnboardingCookieFromRequest(request);

  if (isDev && isDevOnboardingStepPath(pathname)) {
    const match = pathname.match(/^\/onboarding\/step-(\d+)\/?$/);
    const step = match?.[1] ?? "0";
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    url.searchParams.set("devOnboarding", "true");
    url.searchParams.set("step", step);
    const res = NextResponse.rewrite(url);
    res.cookies.set({
      name: DEV_ONBOARDING_COOKIE,
      value: "1",
      path: "/",
      sameSite: "lax",
      secure: false,
    });
    return res;
  }

  if (isDev && isDevOnboardingPath(pathname) && (isDevOnboardingQuery || hasDevCookie)) {
    const res = NextResponse.next();
    res.cookies.set({
      name: DEV_ONBOARDING_COOKIE,
      value: "1",
      path: "/",
      sameSite: "lax",
      secure: false,
    });
    return res;
  }

  if (isBypassPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  let claims: { sub: string; onboardingCompleted?: boolean } | null = null;
  if (token) {
    try {
      const parsed = await verifyAuthToken(token);
      claims = { sub: parsed.sub, onboardingCompleted: parsed.onboardingCompleted };
    } catch {
      claims = null;
    }
  }

  const isAuthed = !!claims;
  const onboardingCompleted = Boolean(claims?.onboardingCompleted);

  // Auth entry routes: if the user is already authenticated, they should never see
  // the login / welcome screens.
  const isAuthEntryPath = pathname.startsWith("/auth") || pathname.startsWith("/login");

  if (isAuthed && isAuthEntryPath) {
    const dest = onboardingCompleted ? "/dashboard" : "/onboarding";
    if (dest !== pathname) {
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  if (isAuthed && !onboardingCompleted && !isOnboardingPath(pathname)) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  if (isAuthed && onboardingCompleted && isOnboardingPath(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Onboarding gate: if the user is authenticated but has not completed onboarding,
  // they must stay on /onboarding (no dashboard/sidebar areas).
  if (isAuthed && !onboardingCompleted && !isPublicPath(pathname) && !isOnboardingPath(pathname)) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // If onboarding is complete, keep /onboarding inaccessible.
  if (isAuthed && onboardingCompleted && isOnboardingPath(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
