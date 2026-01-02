import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  // Canonical host redirect: prevents auth cookie/session loss caused by mixing
  // `*.vercel.app` deployment URLs with the production alias domain.
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured yet, don't block local dev boot.
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // IMPORTANT: DO NOT REMOVE.
  // This refreshes the session if needed and validates the user.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthed = !!user;

  const pathname = request.nextUrl.pathname;

  // Role-Based Routing (Optimization)
  if (isAuthed) {
    const rawRole = (user.user_metadata as any)?.role;
    const userRole =
      typeof rawRole === "string" ? rawRole.toUpperCase() : undefined;

    // Client Protection: Block access to Admin routes
    if (userRole === "CLIENT") {
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

    // Owner Protection: Block access to Client/Admin routes
    // We assume anything NOT /owner and NOT public is an App route
    if (
      userRole === "OWNER" &&
      !pathname.startsWith("/owner") &&
      !isPublicPath(pathname)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/owner/dashboard";
      return NextResponse.redirect(url);
    }

    // Admin/Client Protection: Block access to Owner routes
    if (userRole !== "OWNER" && pathname.startsWith("/owner")) {
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
