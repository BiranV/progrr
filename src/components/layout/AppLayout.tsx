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
  const { user, isLoadingAuth: loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isOnboardingPath =
    pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const onboardingCompleted = Boolean((user as any)?.onboardingCompleted);

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
  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-black/90 flex justify-center">
      <div className="mobile-layout w-full bg-background flex flex-col relative shadow-xl overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
