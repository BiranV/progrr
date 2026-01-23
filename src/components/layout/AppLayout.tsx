"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import BottomNav from "./BottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";

function isPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/public")
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoadingAuth: loading, updateUser, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const mainRef = React.useRef<HTMLElement | null>(null);
  const [isMounted, setIsMounted] = React.useState(false);

  const isOnboardingPath =
    pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const onboardingCompleted = Boolean((user as any)?.onboardingCompleted);
  const showLanguageSwitcher = !isOnboardingPath;

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

  // Public paths (no layout/nav)
  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  const shouldRedirectToAuth = !loading && !user;
  const shouldRedirectToOnboarding =
    !loading && user && !onboardingCompleted && !isOnboardingPath;
  const shouldRedirectToDashboard =
    !loading && user && onboardingCompleted && isOnboardingPath;

  const shouldBlockChildren =
    shouldRedirectToAuth ||
    shouldRedirectToOnboarding ||
    shouldRedirectToDashboard;

  const subscriptionStatus = String(
    (user as any)?.business?.subscriptionStatus ?? ""
  ).trim();
  const isSubscriptionExpired = subscriptionStatus === "expired";
  const isAllowedWhenExpired =
    pathname === "/settings" ||
    pathname === "/settings/subscription" ||
    pathname === "/support" ||
    pathname.startsWith("/legal");

  const shouldShowExpiredGate =
    !shouldBlockChildren && isSubscriptionExpired && !isAllowedWhenExpired;

  const blockingFallback = (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">Redirecting…</div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );

  const expiredFallback = (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Your free trial has ended
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          To continue using Progrr, please choose a plan.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button className="w-full" onClick={() => router.push("/settings/subscription")}>
          View plans
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => logout()}
        >
          Log out
        </Button>
      </div>
    </div>
  );

  React.useEffect(() => {
    if (shouldBlockChildren) return;
    if (!mainRef.current) return;
    requestAnimationFrame(() => {
      mainRef.current?.focus({ preventScroll: true });
    });
  }, [pathname, shouldBlockChildren]);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Onboarding Layout (Minimal, no nav)
  if (isOnboardingPath) {
    return (
      <div className="min-h-screen bg-neutral-100 dark:bg-black/90 flex justify-center">
        <div className="mobile-layout w-full bg-background flex flex-col">
          <main className="flex-1 p-4">
            {shouldBlockChildren ? blockingFallback : children}
          </main>
        </div>
      </div>
    );
  }

  // Main App Layout (Dashboard, Settings, etc.)
  const businessName = String(
    (user as any)?.onboarding?.business?.name ?? "",
  ).trim();
  const logoUrl = String(
    (user as any)?.onboarding?.branding?.logo?.url ??
    (user as any)?.onboarding?.branding?.logoUrl ??
    "",
  ).trim();
  const bannerUrl = String(
    (user as any)?.onboarding?.branding?.banner?.url ?? "",
  ).trim();
  const headerName = businessName || user?.full_name || "Progrr";

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black pb-safe">
      <header className="relative w-full z-0 h-[140px] bg-gradient-to-br from-neutral-950 via-zinc-900 to-zinc-800 shrink-0 overflow-hidden">
        {isMounted && bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerUrl}
            alt="Business banner"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        {showLanguageSwitcher ? (
          <div className="absolute top-4 inset-x-0 z-20 flex justify-center">
            <LanguageSwitcher variant="dark" />
          </div>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-transparent" />
        <div className="absolute inset-0 opacity-20 mix-blend-overlay"></div>
      </header>

      <div className="flex-1 -mt-16 bg-gray-50 dark:bg-zinc-900 rounded-t-[40px] relative z-10 flex flex-col items-center shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
        <main
          ref={mainRef}
          tabIndex={-1}
          className="flex-1 px-6 pt-4 pb-24 w-full max-w-md mx-auto focus:outline-none"
        >
          {/* <div className="text-center space-y-1 mb-4 mb-6">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              {businessName ? "Your business" : "Welcome"}
            </div>
            <div className="text-base font-bold text-gray-900 dark:text-white truncate">
              Hi, {headerName}
            </div>
          </div> */}
          {shouldBlockChildren
            ? blockingFallback
            : shouldShowExpiredGate
              ? expiredFallback
              : children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
