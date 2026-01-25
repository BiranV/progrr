"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { User } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import BottomNav from "./BottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { CenteredSpinner } from "@/components/CenteredSpinner";
import { isPublicPagePathname } from "@/lib/public-routes";
import { useI18n } from "@/i18n/useI18n";

function isPublicPath(pathname: string) {
  return isPublicPagePathname(pathname);
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoadingAuth: loading, updateUser, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const mainRef = React.useRef<HTMLElement | null>(null);
  const { t } = useI18n();

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
      <CenteredSpinner className="min-h-[120px] items-center" />
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
  const bannerUrl = String(
    (user as any)?.onboarding?.branding?.banner?.url ??
    (user as any)?.onboarding?.branding?.bannerUrl ??
    "",
  ).trim();
  const hasBanner = Boolean(bannerUrl);
  const headerName = businessName || user?.full_name || "Progrr";
  const getSectionTitle = () => {
    if (pathname.startsWith("/dashboard")) return t("nav.dashboard");
    if (pathname.startsWith("/calendar")) return t("nav.calendar");
    if (pathname.startsWith("/customers")) return t("nav.customers");
    if (pathname.startsWith("/settings")) return t("nav.settings");
    if (pathname.startsWith("/support")) return t("support.title");
    if (pathname.startsWith("/legal/privacy")) return t("privacy.title");
    if (pathname.startsWith("/legal/terms")) return t("terms.title");
    if (pathname.startsWith("/legal")) return "Legal";
    return "Progrr";
  };
  const sectionTitle = getSectionTitle();

  return (
    <div className="app-shell flex flex-col min-h-screen bg-gray-50 dark:bg-black pb-safe">
      <header
        className={
          "relative w-full z-10 h-[10vh] rounded-b-[40px] overflow-hidden " +
          (hasBanner
            ? "bg-black"
            : "bg-gradient-to-br from-[#165CF0] via-[#1E6CF2] to-[#2B79F5]")
        }
        style={
          hasBanner
            ? {
              backgroundImage: `url(${bannerUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
            : undefined
        }
      >
        {hasBanner ? (
          <div className="absolute inset-0 bg-black/35" />
        ) : (
          <div className="absolute inset-0 opacity-20 mix-blend-overlay" />
        )}
        <div className="absolute top-4 inset-x-0 z-20 flex justify-center">
          {showLanguageSwitcher ? (
            <LanguageSwitcher variant="light" />
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-3 z-20 px-6">
          <div className="mx-auto max-w-[480px] text-white flex justify-center">
            <div className="flex items-center gap-2 text-sm font-semibold max-w-full">
              <User className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate text-center">{headerName}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center">
        <main
          ref={mainRef}
          tabIndex={-1}
          className="flex-1 px-6 pt-5 pb-[calc(88px+env(safe-area-inset-bottom))] w-full max-w-md mx-auto focus:outline-none"
        >
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
