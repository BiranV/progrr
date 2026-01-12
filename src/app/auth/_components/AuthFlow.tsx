"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AuthShell from "./AuthShell";
import AuthBanner, { type AuthBannerState } from "./AuthBanner";
import AdminAuthStep from "./AdminAuthStep";
import { useAuth } from "@/context/AuthContext";

function isSafeNextPath(next: string): boolean {
  if (!next.startsWith("/")) return false;
  if (next.startsWith("//")) return false;
  if (next === "/" || next.startsWith("/auth") || next.startsWith("/login")) {
    return false;
  }
  return true;
}

export default function AuthFlow({
  initialBanner,
  initialNext,
}: {
  initialBanner: AuthBannerState;
  initialNext: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoadingAuth } = useAuth();

  const nextPath = React.useMemo(() => {
    const fromQuery = searchParams.get("next") || initialNext || "";
    return fromQuery && isSafeNextPath(fromQuery) ? fromQuery : "";
  }, [initialNext, searchParams]);

  React.useEffect(() => {
    if (isLoadingAuth) return;
    if (isAuthenticated) {
      router.replace(nextPath || "/dashboard");
    }
  }, [isAuthenticated, isLoadingAuth, nextPath, router]);

  const [banner, setBanner] = React.useState<AuthBannerState>(() => {
    const authError = searchParams.get("authError");
    const authMessage = searchParams.get("authMessage");
    if (authError) return { type: "error", text: authError };
    if (authMessage) return { type: "message", text: authMessage };
    return initialBanner;
  });

  React.useEffect(() => {
    const authError = searchParams.get("authError");
    const authMessage = searchParams.get("authMessage");
    if (authError) setBanner({ type: "error", text: authError });
    else if (authMessage) setBanner({ type: "message", text: authMessage });
    else setBanner(initialBanner);
  }, [initialBanner, searchParams]);

  const transition = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.18, ease: "easeOut" },
  } as const;

  if (isLoadingAuth) {
    return (
      <AuthShell>
        <Card className="relative w-full border-0 overflow-hidden shadow-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-600 to-indigo-600" />
          <CardContent className="py-12 text-center text-sm text-gray-600 dark:text-gray-300">
            Loading…
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  // If authenticated, keep the UI from flashing.
  if (isAuthenticated) {
    return (
      <AuthShell>
        <Card className="relative w-full border-0 overflow-hidden shadow-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-600 to-indigo-600" />
          <CardContent className="py-12 text-center text-sm text-gray-600 dark:text-gray-300">
            Redirecting…
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="relative w-full border-0 overflow-hidden shadow-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-600 to-indigo-600" />
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-bold">Sign in</CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Login or create your account.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <AuthBanner banner={banner} />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key="auth" {...transition}>
              <AdminAuthStep nextPath={nextPath} />
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
