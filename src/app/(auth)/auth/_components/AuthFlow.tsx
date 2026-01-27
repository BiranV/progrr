"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, easeInOut, motion } from "framer-motion";
import { BookOpen, ChevronLeft, GraduationCap, Scissors } from "lucide-react";
import AdminAuthStep from "./AdminAuthStep";
import { useAuth } from "@/context/AuthContext";
import { type AuthBannerState } from "./AuthBanner";
import { useI18n } from "@/i18n/useI18n";
import Stepper from "@/components/onboarding/Stepper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const supportEmail = "support@progrr.io";
  const [currentView, setCurrentView] = React.useState<
    | "landing"
    | "login"
    | "login-verify"
    | "signup"
    | "signup-verify"
    | "existing-account"
  >(initialView ?? "landing");
  const [headerBack, setHeaderBack] = React.useState<(() => void) | null>(null);
  const [privacyOpen, setPrivacyOpen] = React.useState(false);
  const [termsOpen, setTermsOpen] = React.useState(false);

  const headerHeightVh = React.useMemo(() => {
    if (currentView === "landing") return 50;
    if (currentView === "login" || currentView === "login-verify") return 30;
    if (currentView === "signup" || currentView === "signup-verify") return 30;
    return 32;
  }, [currentView]);

  const authStepIndex = React.useMemo(() => {
    if (currentView === "landing") return 0;
    if (currentView === "login-verify" || currentView === "signup-verify") {
      return 2;
    }
    return 1;
  }, [currentView]);

  const nextPath = React.useMemo(() => {
    const fromQuery = searchParams.get("next") || initialNext || "";
    return fromQuery && isSafeNextPath(fromQuery) ? fromQuery : "";
  }, [initialNext, searchParams]);

  const isLanding = currentView === "landing";
  const showBranding = isLanding;
  const brandingTransition = { duration: 0.35, ease: easeInOut };

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
    <div className="min-h-screen w-full bg-gray-50 dark:bg-black flex flex-col">
      <motion.header
        className={`relative w-full bg-gradient-to-br from-[#165CF0] via-[#1E6CF2] to-[#2B79F5] rounded-b-[40px] px-6 overflow-hidden ${
          isLanding ? "pt-6 pb-10" : "pt-3 pb-8"
        }`}
        animate={{ height: `${headerHeightVh}vh` }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      >
        <div className="absolute top-10 right-10 w-32 h-32 bg-white/15 rounded-full blur-2xl" />
        <div className="absolute bottom-8 left-6 w-24 h-24 bg-white/15 rounded-full blur-xl" />

        <div
          className={`flex justify-center h-full ${
            isLanding ? "items-start" : "items-center"
          }`}
        >
          <div className="relative flex flex-col items-center">
            <div
              className={`relative ${
                isLanding
                  ? "w-56 h-56 sm:w-64 sm:h-64"
                  : "w-20 h-20 sm:w-20 sm:h-20"
              }`}
            >
              <div
                className={`absolute inset-0 flex items-center justify-center ${
                  isLanding ? "" : "pointer-events-none"
                }`}
              >
                <div className="relative">
                  <motion.div
                    initial={false}
                    animate={
                      isLanding
                        ? { opacity: 1, x: 0, y: 0 }
                        : { opacity: 0, x: 90, y: 0 }
                    }
                    transition={{ ...brandingTransition, delay: 0.02 }}
                    className="w-32 h-24 bg-gradient-to-br from-amber-300 to-amber-400 rounded-lg -rotate-6 shadow-lg"
                  >
                    <div className="absolute inset-2 bg-gradient-to-br from-blue-100 to-blue-200 rounded" />
                  </motion.div>

                  <motion.div
                    initial={false}
                    animate={
                      isLanding
                        ? { opacity: 1, x: 0, y: 0 }
                        : { opacity: 0, x: 0, y: -90 }
                    }
                    transition={{ ...brandingTransition, delay: 0.04 }}
                    className="absolute -top-20 left-8"
                  >
                    <div className="w-14 h-14 bg-gradient-to-br from-amber-200 to-amber-300 rounded-full" />
                    <div className="absolute top-0 left-2 w-12 h-16 bg-gradient-to-b from-slate-800 to-slate-700 rounded-full -z-10" />
                    <div className="absolute top-12 -left-2 w-20 h-16 bg-gradient-to-br from-teal-400 to-teal-500 rounded-t-3xl" />
                  </motion.div>

                  <motion.div
                    initial={false}
                    animate={
                      isLanding
                        ? { opacity: 1, x: 0, y: 0 }
                        : { opacity: 0, x: 0, y: 90 }
                    }
                    transition={{ ...brandingTransition, delay: 0.06 }}
                    className="absolute -bottom-8 -left-6 flex flex-col gap-1"
                  >
                    <div className="w-16 h-4 bg-gradient-to-r from-rose-400 to-rose-500 rounded-sm -rotate-3" />
                    <div className="w-[72px] h-4 bg-gradient-to-r from-amber-400 to-amber-500 rounded-sm rotate-1" />
                    <div className="w-14 h-4 bg-gradient-to-r from-teal-400 to-teal-500 rounded-sm -rotate-2" />
                  </motion.div>

                  <motion.div
                    initial={false}
                    animate={
                      isLanding
                        ? { opacity: 1, x: 0, y: 0 }
                        : { opacity: 0, x: -90, y: 0 }
                    }
                    transition={{ ...brandingTransition, delay: 0.08 }}
                    className="absolute -bottom-6 -left-16"
                  >
                    <div className="w-8 h-12 bg-gradient-to-t from-green-600 to-green-500 rounded-t-full" />
                    <div className="absolute top-2 -left-2 w-6 h-8 bg-gradient-to-t from-green-500 to-green-400 rounded-full -rotate-45" />
                  </motion.div>
                </div>
              </div>

              {showBranding ? (
                <div className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
              ) : null}
              {showBranding ? (
                <div className="absolute bottom-8 right-8 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                  <Scissors className="w-4 h-4 text-white" />
                </div>
              ) : null}
              {showBranding ? (
                <div className="absolute top-20 left-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
              ) : null}
            </div>
            <motion.div
              className={`text-center text-white ${
                isLanding ? "mt-2" : "-mt-0"
              }`}
              initial={false}
              animate={{ y: isLanding ? 0 : -10 }}
              transition={{ duration: 0.35, ease: easeInOut }}
            >
              <h1 className="text-2xl md:text-3xl font-bold">
                {t("common.appName")}
              </h1>
              <p className="text-white/80 text-sm md:text-base mt-2 max-w-sm">
                {t("auth.landingTitle")}
              </p>
            </motion.div>
          </div>
        </div>
      </motion.header>

      <section className="flex-1 w-full px-6 sm:px-8 pt-6 pb-4 flex flex-col items-center min-h-0">
        <div className="w-full max-w-md flex-1 min-h-0 overflow-y-auto pb-6">
          {currentView !== "landing" ? (
            <div className="flex items-center justify-start mb-6">
              <button
                type="button"
                onClick={() => headerBack?.()}
                className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-white text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
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
        <div className="w-full max-w-md pt-4 pb-3 mt-auto">
          <Stepper totalSteps={3} currentStep={authStepIndex} />
        </div>
        <div className="w-full max-w-md pb-6 text-center text-xs text-slate-500">
          <button
            type="button"
            className="underline underline-offset-4 hover:text-slate-700"
            onClick={() => setPrivacyOpen(true)}
          >
            {t("settings.privacy")}
          </button>
          <span className="px-2">•</span>
          <button
            type="button"
            className="underline underline-offset-4 hover:text-slate-700"
            onClick={() => setTermsOpen(true)}
          >
            {t("settings.terms")}
          </button>
        </div>
      </section>

      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent showCloseButton className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("privacy.title")}</DialogTitle>
            <DialogDescription>{t("privacy.subtitle")}</DialogDescription>
            <div className="text-xs text-muted-foreground">
              {t("privacy.lastUpdated", { date: t("privacy.lastUpdatedDate") })}
            </div>
          </DialogHeader>
          <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("privacy.sections.introduction.title")}
              </h2>
              <p>{t("privacy.sections.introduction.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("privacy.sections.information.title")}
              </h2>
              <p>{t("privacy.sections.information.body")}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t("privacy.sections.information.items.account")}</li>
                <li>{t("privacy.sections.information.items.business")}</li>
                <li>{t("privacy.sections.information.items.technical")}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("privacy.sections.usage.title")}
              </h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t("privacy.sections.usage.items.provide")}</li>
                <li>{t("privacy.sections.usage.items.improve")}</li>
                <li>{t("privacy.sections.usage.items.updates")}</li>
                <li>{t("privacy.sections.usage.items.support")}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("privacy.sections.sharing.title")}
              </h2>
              <p>{t("privacy.sections.sharing.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("privacy.sections.security.title")}
              </h2>
              <p>{t("privacy.sections.security.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("privacy.sections.retention.title")}
              </h2>
              <p>{t("privacy.sections.retention.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("privacy.sections.rights.title")}
              </h2>
              <p>{t("privacy.sections.rights.body")}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t("privacy.sections.rights.items.access")}</li>
                <li>{t("privacy.sections.rights.items.correct")}</li>
                <li>{t("privacy.sections.rights.items.delete")}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("privacy.sections.thirdParty.title")}
              </h2>
              <p>{t("privacy.sections.thirdParty.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("privacy.sections.changes.title")}
              </h2>
              <p>{t("privacy.sections.changes.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("privacy.sections.contact.title")}
              </h2>
              <p>
                {t("privacy.sections.contact.body")}{" "}
                <a
                  href={`mailto:${supportEmail}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {supportEmail}
                </a>
                .
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent showCloseButton className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("terms.title")}</DialogTitle>
            <DialogDescription>{t("terms.subtitle")}</DialogDescription>
            <div className="text-xs text-muted-foreground">
              {t("terms.lastUpdated", { date: t("terms.lastUpdatedDate") })}
            </div>
          </DialogHeader>
          <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("terms.sections.acceptance.title")}
              </h2>
              <p>{t("terms.sections.acceptance.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("terms.sections.description.title")}
              </h2>
              <p>{t("terms.sections.description.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("terms.sections.eligibility.title")}
              </h2>
              <p>{t("terms.sections.eligibility.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("terms.sections.accounts.title")}
              </h2>
              <p>{t("terms.sections.accounts.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("terms.sections.acceptableUse.title")}
              </h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t("terms.sections.acceptableUse.items.illegal")}</li>
                <li>{t("terms.sections.acceptableUse.items.abuse")}</li>
                <li>{t("terms.sections.acceptableUse.items.unauthorized")}</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("terms.sections.payments.title")}
              </h2>
              <p>{t("terms.sections.payments.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("terms.sections.ip.title")}
              </h2>
              <p>{t("terms.sections.ip.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("terms.sections.privacy.title")}
              </h2>
              <p>{t("terms.sections.privacy.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("terms.sections.availability.title")}
              </h2>
              <p>{t("terms.sections.availability.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("terms.sections.liability.title")}
              </h2>
              <p>{t("terms.sections.liability.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("terms.sections.termination.title")}
              </h2>
              <p>{t("terms.sections.termination.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("terms.sections.changes.title")}
              </h2>
              <p>{t("terms.sections.changes.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("terms.sections.law.title")}
              </h2>
              <p>{t("terms.sections.law.body")}</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("terms.sections.contact.title")}
              </h2>
              <p>
                {t("terms.sections.contact.body")}{" "}
                <a
                  href={`mailto:${supportEmail}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {supportEmail}
                </a>
                .
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
