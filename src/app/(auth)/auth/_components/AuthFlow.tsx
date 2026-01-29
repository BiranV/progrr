"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import AdminAuthStepImpl from "./AdminAuthStepImpl";
import { useAuth } from "@/context/AuthContext";
import { type AuthBannerState } from "./AuthBanner";
import { useI18n } from "@/i18n/useI18n";

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
  initialView,
  initialEmail,
}: {
  initialBanner: AuthBannerState;
  initialNext: string;
  initialView?: "landing" | "login" | "signup";
  initialEmail?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const { t } = useI18n();
  const [currentView, setCurrentView] = React.useState<
    | "landing"
    | "login"
    | "login-verify"
    | "signup"
    | "signup-verify"
    | "existing-account"
  >(initialView && initialView !== "landing" ? initialView : "login");
  const [headerBack, setHeaderBack] = React.useState<(() => void) | null>(null);
  const handleRegisterBack = React.useCallback(
    (handler: () => void) => {
      setHeaderBack(() => handler);
    },
    [],
  );

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

  if (isLoadingAuth || isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-teal-50 to-white flex flex-col">
      <section className="flex-1 w-full flex flex-col items-center min-h-0">
        <div className="w-full max-w-md flex-1 min-h-0 overflow-y-auto">
          {currentView === "login-verify" ||
            currentView === "signup-verify" ||
            currentView === "existing-account" ? (
            <div className="flex items-center justify-start px-6 pt-6">
              <button
                type="button"
                onClick={() => headerBack?.()}
                className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-white text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label={t("common.back")}
              >
                <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
              </button>
            </div>
          ) : null}
          <AdminAuthStepImpl
            nextPath={nextPath}
            initialView={initialView}
            initialEmail={initialEmail}
            onViewChange={setCurrentView}
            registerBackHandler={handleRegisterBack}
          />
        </div>
      </section>
    </div>
  );
}
