"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Award, BookOpen, ChevronLeft, GraduationCap } from "lucide-react";
import AdminAuthStep from "./AdminAuthStep";
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
  >(initialView ?? "landing");
  const [headerBack, setHeaderBack] = React.useState<(() => void) | null>(null);

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
    return (
      <div className="flex-1 w-full h-full min-h-screen flex items-center justify-center bg-white">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-14 h-14 rounded-full border-4 border-[#165CF0]/20 border-t-[#165CF0]"
        />
      </div>
    );
  }

  // AdminAuthStep handles its own banner logic via searchParams,
  // so we don't need to render AuthBanner here unless we want to force initialBanner.
  // However, AdminAuthStep reads params too.
  // We'll let AdminAuthStep handle it completely for the "Modern" feel.

  return (
    <div className="min-h-screen w-full bg-white flex flex-col">
      <header className="relative w-full h-[50vh] md:h-[33vh] bg-gradient-to-br from-[#165CF0] via-[#1E6CF2] to-[#2B79F5] rounded-b-[40px] px-6 pt-6 pb-10 overflow-hidden">
        <div className="absolute top-10 right-10 w-32 h-32 bg-white/15 rounded-full blur-2xl" />
        <div className="absolute bottom-8 left-6 w-24 h-24 bg-white/15 rounded-full blur-xl" />

        <div className="flex items-center justify-center h-full">
          <div className="relative flex flex-col items-center">
            <div className="w-56 h-56 sm:w-64 sm:h-64 relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="w-32 h-24 bg-gradient-to-br from-amber-300 to-amber-400 rounded-lg -rotate-6 shadow-lg">
                    <div className="absolute inset-2 bg-gradient-to-br from-blue-100 to-blue-200 rounded" />
                  </div>

                  <div className="absolute -top-20 left-8">
                    <div className="w-14 h-14 bg-gradient-to-br from-amber-200 to-amber-300 rounded-full" />
                    <div className="absolute top-0 left-2 w-12 h-16 bg-gradient-to-b from-slate-800 to-slate-700 rounded-full -z-10" />
                    <div className="absolute top-12 -left-2 w-20 h-16 bg-gradient-to-br from-teal-400 to-teal-500 rounded-t-3xl" />
                  </div>

                  <div className="absolute -bottom-8 -left-6 flex flex-col gap-1">
                    <div className="w-16 h-4 bg-gradient-to-r from-rose-400 to-rose-500 rounded-sm -rotate-3" />
                    <div className="w-[72px] h-4 bg-gradient-to-r from-amber-400 to-amber-500 rounded-sm rotate-1" />
                    <div className="w-14 h-4 bg-gradient-to-r from-teal-400 to-teal-500 rounded-sm -rotate-2" />
                  </div>

                  <div className="absolute -bottom-6 -left-16">
                    <div className="w-8 h-12 bg-gradient-to-t from-green-600 to-green-500 rounded-t-full" />
                    <div className="absolute top-2 -left-2 w-6 h-8 bg-gradient-to-t from-green-500 to-green-400 rounded-full -rotate-45" />
                  </div>
                </div>
              </div>

              <div className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm animate-bounce">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div className="absolute bottom-8 right-8 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm animate-pulse">
                <Award className="w-4 h-4 text-white" />
              </div>
              <div className="absolute top-20 left-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="mt-6 text-center text-white">
              <h1 className="text-2xl md:text-3xl font-bold">
                {t("common.appName")}
              </h1>
              <p className="text-white/80 text-sm md:text-base mt-2 max-w-sm">
                {t("auth.landingTitle")}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="flex-1 w-full px-6 sm:px-8 py-10 flex flex-col items-center">
        <div className="w-full max-w-md">
          {currentView !== "landing" ? (
            <div className="flex items-center justify-start mb-6">
              <button
                type="button"
                onClick={() => headerBack?.()}
                className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                aria-label={t("common.back")}
              >
                <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
              </button>
            </div>
          ) : null}
          <AdminAuthStep
            nextPath={nextPath}
            initialView={initialView}
            initialEmail={initialEmail}
            onViewChange={setCurrentView}
            registerBackHandler={(handler) => setHeaderBack(() => handler)}
          />
        </div>
      </section>
    </div>
  );
}
