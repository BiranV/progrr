"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AuthShell from "./AuthShell";
import AuthBanner, { type AuthBannerState } from "./AuthBanner";
import AdminAuthStep from "./AdminAuthStep";
import ClientAuthStep from "./ClientAuthStep";
import InviteAcceptStep from "./InviteAcceptStep";
import { useAuth } from "@/context/AuthContext";

export type AuthStep =
  | "choose"
  | "admin-login"
  | "client-login"
  | "invite-accept";

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
  initialInviteToken,
}: {
  initialBanner: AuthBannerState;
  initialNext: string;
  initialInviteToken: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoadingAuth } = useAuth();

  const nextPath = React.useMemo(() => {
    const fromQuery = searchParams.get("next") || initialNext || "";
    return fromQuery && isSafeNextPath(fromQuery) ? fromQuery : "";
  }, [initialNext, searchParams]);

  const inviteToken = React.useMemo(() => {
    return (
      searchParams.get("inviteToken") ||
      searchParams.get("token") ||
      initialInviteToken ||
      ""
    ).trim();
  }, [initialInviteToken, searchParams]);

  const initialStep: AuthStep = React.useMemo(() => {
    if (inviteToken) return "invite-accept";
    const mode = (searchParams.get("mode") || "").toLowerCase();
    if (mode === "admin") return "admin-login";
    if (mode === "client") return "client-login";
    return "choose";
  }, [inviteToken, searchParams]);

  const [step, setStep] = React.useState<AuthStep>(initialStep);

  React.useEffect(() => {
    // Invite token overrides everything.
    if (inviteToken) {
      setStep("invite-accept");
      return;
    }

    const mode = (searchParams.get("mode") || "").toLowerCase();
    if (mode === "admin") setStep("admin-login");
    else if (mode === "client") setStep("client-login");
    else setStep("choose");
  }, [inviteToken, searchParams]);

  React.useEffect(() => {
    if (isLoadingAuth) return;
    if (inviteToken) return;

    if (isAuthenticated) {
      router.replace(nextPath || "/dashboard");
    }
  }, [inviteToken, isAuthenticated, isLoadingAuth, nextPath, router]);

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

  const goChoose = React.useCallback(() => {
    setBanner(null);
    setStep("choose");
  }, []);

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

  // If authenticated and no invite flow, keep the UI from flashing.
  if (isAuthenticated && !inviteToken) {
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
          <CardTitle className="text-xl font-bold">
            {step === "choose"
              ? "Welcome to Progrr"
              : step === "admin-login"
              ? "Admin Access"
              : step === "client-login"
              ? "Client Login"
              : "Accept invitation"}
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {step === "choose"
              ? "Choose how you’d like to continue"
              : step === "admin-login"
              ? "Login or create an admin account"
              : step === "client-login"
              ? "Invite-only access"
              : "Set your password to complete your account"}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <AuthBanner banner={banner} />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} {...transition}>
              {step === "choose" ? (
                <div className="space-y-3">
                  <Button
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
                    onClick={() => setStep("admin-login")}
                  >
                    Continue as Admin
                  </Button>

                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full bg-white/70 dark:bg-gray-900/40"
                      onClick={() => setStep("client-login")}
                    >
                      I’m a Client
                    </Button>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Clients can access Progrr only after being invited by a
                      coach.
                    </p>
                  </div>
                </div>
              ) : step === "admin-login" ? (
                <AdminAuthStep nextPath={nextPath} onBack={goChoose} />
              ) : step === "client-login" ? (
                <ClientAuthStep nextPath={nextPath} onBack={goChoose} />
              ) : (
                <InviteAcceptStep
                  token={inviteToken}
                  nextPath={nextPath}
                  onGoToLogin={() => {
                    // Keep the UX single-page; clear the token step.
                    router.replace(
                      nextPath
                        ? `/auth?next=${encodeURIComponent(nextPath)}`
                        : "/auth"
                    );
                    goChoose();
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
