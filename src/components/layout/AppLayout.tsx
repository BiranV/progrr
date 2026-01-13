"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import BottomNav from "./BottomNav";

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/public")
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoadingAuth: loading, updateUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isOnboardingPath =
    pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const onboardingCompleted = Boolean((user as any)?.onboardingCompleted);

  const didHydrateOnboardingRef = React.useRef(false);

  React.useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!onboardingCompleted) return;
    if (didHydrateOnboardingRef.current) return;

    // Load onboarding data once so admin UI can use business branding.
    didHydrateOnboardingRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/onboarding", { method: "GET" });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data || typeof data !== "object") return;
        updateUser({
          onboardingCompleted: Boolean((data as any).onboardingCompleted),
          onboarding: (data as any).onboarding ?? {},
        });
      } catch {
        // Ignore.
      }
    })();
  }, [loading, onboardingCompleted, updateUser, user]);

  React.useEffect(() => {
    if (loading) return;

    // No user -> login
    if (!user) {
      if (!isPublicPath(pathname)) {
        router.replace("/auth");
      }
      return;
    }

    // User but onboarding incomplete -> onboarding
    if (!onboardingCompleted && !isOnboardingPath) {
      router.replace("/onboarding");
      return;
    }

    // User and onboarding complete -> keep onboarding inaccessible
    if (onboardingCompleted && isOnboardingPath) {
      router.replace("/dashboard");
    }
  }, [isOnboardingPath, loading, onboardingCompleted, pathname, router, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Public paths (no layout/nav)
  if (!user) {
    if (isPublicPath(pathname)) {
      return <>{children}</>;
    }
    return null;
  }

  // Redirecting...
  if (!onboardingCompleted && !isOnboardingPath) return null;
  if (onboardingCompleted && isOnboardingPath) return null;

  // Onboarding Layout (Minimal, no nav)
  if (isOnboardingPath) {
    return (
      <div className="min-h-screen bg-neutral-100 dark:bg-black/90 flex justify-center">
        <div className="mobile-layout w-full bg-background flex flex-col">
          <main className="flex-1 p-4">{children}</main>
        </div>
      </div>
    );
  }

  // Main App Layout (Dashboard, Settings, etc.)
  const businessName = String(
    (user as any)?.onboarding?.business?.name ?? ""
  ).trim();
  const logoUrl = String(
    (user as any)?.onboarding?.branding?.logo?.url ??
    (user as any)?.onboarding?.branding?.logoUrl ??
    ""
  ).trim();
  const headerName = businessName || user?.full_name || "Progrr";

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black pb-safe">
      <div className="relative w-full z-0 h-[140px] bg-purple-600 shrink-0">
        <div className="absolute inset-0 opacity-20 bg-[url('/grid.svg')] mix-blend-overlay"></div>
      </div>

      <div className="flex-1 -mt-16 bg-gray-50 dark:bg-zinc-900 rounded-t-[40px] relative z-10 flex flex-col items-center shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
        <main className="flex-1 px-6 pt-4 pb-24 w-full max-w-md mx-auto">
          {/* <div className="text-center space-y-1 mb-4 mb-6">
            <div className="text-xs font-semibold text-purple-600 dark:text-purple-400">
              {businessName ? "Your business" : "Welcome"}
            </div>
            <div className="text-base font-bold text-gray-900 dark:text-white truncate">
              Hi, {headerName}
            </div>
          </div> */}
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
