"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Stepper from "@/components/onboarding/Stepper";

import AuthBanner, { type AuthBannerState } from "./AuthBanner";
import OtpInput from "@/components/OtpInput";
import { useI18n } from "@/i18n/useI18n";

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidFullName = (fullName: string) =>
  fullName.trim().split(/\s+/).length >= 2;

const AUTH_ERROR_KEY_MAP = {
  "Account not found": "auth.accountNotFound",
  "Invalid code": "auth.invalidCode",
  "Too many requests": "auth.tooManyAttempts",
} as const;

type AuthErrorKey =
  (typeof AUTH_ERROR_KEY_MAP)[keyof typeof AUTH_ERROR_KEY_MAP];

const getAuthErrorKey = (
  error: unknown,
): AuthErrorKey | "errors.somethingWentWrong" => {
  if (typeof error === "string" && error in AUTH_ERROR_KEY_MAP) {
    return AUTH_ERROR_KEY_MAP[error as keyof typeof AUTH_ERROR_KEY_MAP];
  }
  return "errors.somethingWentWrong";
};

type ViewState =
  | "landing"
  | "login"
  | "login-verify"
  | "signup"
  | "signup-verify"
  | "existing-account";

type InitialView = "landing" | "login" | "signup";

export default function AdminAuthStep({
  nextPath,
  initialView,
  initialEmail,
  onViewChange,
  registerBackHandler,
}: {
  nextPath: string;
  initialView?: InitialView;
  initialEmail?: string;
  onViewChange?: (view: ViewState) => void;
  registerBackHandler?: (handler: () => void) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSessionUser } = useAuth();
  const { t, language } = useI18n();
  const isRtl = language === "he";

  // State
  const [view, setView] = useState<ViewState>(() => {
    if (initialView === "login") return "login";
    if (initialView === "signup") return "signup";
    return "landing";
  });

  // Login State
  const [loginEmail, setLoginEmail] = useState(() => initialEmail ?? "");
  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Signup State
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupCode, setSignupCode] = useState("");

  // Field Errors
  const [signupNameError, setSignupNameError] = useState<string | null>(null);
  const [signupEmailError, setSignupEmailError] = useState<string | null>(null);
  const [signupCodeError, setSignupCodeError] = useState<string | null>(null);
  const [loginCodeError, setLoginCodeError] = useState<string | null>(null);

  // UI State
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Initial Error/Message handling
  useEffect(() => {
    const authError = searchParams.get("authError");
    const authMessage = searchParams.get("authMessage");
    if (authError) setGlobalError(authError);
    if (authMessage) setInfo(authMessage);
  }, [searchParams]);

  const resetError = () => {
    setLoginError(null);
    setSignupNameError(null);
    setSignupEmailError(null);
    setSignupCodeError(null);
    setLoginCodeError(null);
    setGlobalError(null);
    setInfo(null);
  };

  const useDifferentEmail = () => {
    resetError();
    setSignupEmail("");
    setSignupCode("");
    setView("signup");
  };

  const handleBack = useCallback(() => {
    resetError();
    if (view === "login" || view === "signup") setView("landing");
    if (view === "login-verify") setView("login");
    if (view === "signup-verify") setView("signup");
    if (view === "existing-account") setView("signup");
  }, [view]);

  useEffect(() => {
    registerBackHandler?.(handleBack);
  }, [handleBack, registerBackHandler]);

  useEffect(() => {
    onViewChange?.(view);
  }, [onViewChange, view]);

  // --- Actions ---

  const sendLoginCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    if (!isValidEmail(loginEmail)) {
      setLoginError(t("errors.invalidEmail"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, flow: "login" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorKey = getAuthErrorKey(data?.error);
        setGlobalError(t(errorKey));
        return;
      }

      setInfo(t("auth.codeSentToEmailShort"));
      setView("login-verify");
    } catch (err: any) {
      setGlobalError(t("errors.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  const verifyLoginCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    if (!loginCode) {
      setLoginCodeError(t("errors.codeRequired"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail,
          code: loginCode,
          flow: "login",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorKey = getAuthErrorKey(data?.error);
        const message = t(errorKey);
        if (errorKey === "auth.invalidCode") {
          setLoginCodeError(message);
        }
        setGlobalError(message);
        return;
      }

      if (data.user) setSessionUser(data.user);

      const dest =
        typeof data?.redirectTo === "string"
          ? data.redirectTo
          : data?.onboardingCompleted
            ? "/dashboard"
            : "/onboarding";
      router.replace(dest);
    } catch (err: any) {
      setGlobalError(t("errors.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  const sendSignupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    let hasError = false;

    if (!isValidFullName(signupName)) {
      setSignupNameError(t("errors.fullNameRequired"));
      hasError = true;
    }

    if (!isValidEmail(signupEmail)) {
      setSignupEmailError(t("errors.invalidEmail"));
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signupEmail, flow: "signup" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data?.error === "EMAIL_ALREADY_EXISTS") {
        setGlobalError(null);
        setInfo(null);
        setView("existing-account");
        return;
      }
      if (!res.ok) {
        const errorKey = getAuthErrorKey(data?.error);
        setGlobalError(t(errorKey));
        return;
      }

      setInfo(t("auth.codeSentToEmailShort"));
      setView("signup-verify");
    } catch (err: any) {
      setGlobalError(t("errors.signupFailed"));
    } finally {
      setLoading(false);
    }
  };

  const verifySignupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    if (!signupCode) {
      setSignupCodeError(t("errors.codeRequired"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signupEmail,
          code: signupCode,
          full_name: signupName,
          flow: "signup",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data?.error === "EMAIL_ALREADY_EXISTS") {
        setGlobalError(null);
        setInfo(null);
        setView("existing-account");
        return;
      }
      if (!res.ok) {
        const errorKey = getAuthErrorKey(data?.error);
        const message = t(errorKey);
        if (errorKey === "auth.invalidCode") {
          setSignupCodeError(message);
        }
        setGlobalError(message);
        return;
      }

      if (data.user) setSessionUser(data.user);

      const dest =
        typeof data?.redirectTo === "string"
          ? data.redirectTo
          : data?.onboardingCompleted
            ? "/dashboard"
            : "/onboarding";
      router.replace(dest);
    } catch (err: any) {
      setGlobalError(t("errors.verificationFailed"));
    } finally {
      setLoading(false);
    }
  };

  // --- Renderers ---

  // Inline Helper using requested styles
  const InlineError = ({ message }: { message: string | null }) => {
    if (!message) return null;
    return <p className="text-[13px] text-red-500 ms-1">{message}</p>;
  };

  // Only show global errors in banner, field errors are inline
  const bannerState: AuthBannerState = globalError
    ? { type: "error", text: globalError }
    : info
      ? { type: "message", text: info }
      : null;

  // For inputs
  const inputErrorClass = "border-red-300 ring-1 ring-red-200";

  const slideInX = isRtl ? -50 : 50;
  const slideOutX = isRtl ? 50 : -50;
  const authStepIndex = view === "landing" ? 0 : 1;

  return (
    <div className="w-full flex flex-col h-full min-h-[480px]">
      <AnimatePresence mode="wait">
        {view === "landing" && (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">
                Let’s get started
              </h1>
              <p className="text-slate-500 text-sm md:text-base max-w-sm mx-auto">
                Log in or create your account to continue
              </p>
            </div>
            <div className="flex flex-col gap-3 max-w-xs mx-auto w-full">
              <Button
                className="w-full h-14 bg-[#165CF0] text-white hover:bg-[#0E4FDB] rounded-xl text-lg font-medium shadow-md shadow-blue-500/20"
                onClick={() => setView("login")}
              >
                {t("auth.login")}
              </Button>
              <Button
                variant="outline"
                className="w-full py-6 text-base font-semibold border-2 border-[#165CF0] text-[#165CF0] hover:text-[#165CF0] hover:bg-blue-50 rounded-xl transition-all duration-300 hover:-translate-y-0.5"
                onClick={() => setView("signup")}
              >
                {t("auth.createAccountCta")}
              </Button>
            </div>
          </motion.div>
        )}

        {(view === "login" || view === "login-verify") && (
          <motion.div
            key="login"
            initial={{ opacity: 0, x: slideInX }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideOutX }}
            className="space-y-6 max-w-xs mx-auto w-full"
          >
            <h2 className="text-xl font-bold text-slate-800 mb-6">
              {view === "login" ? t("auth.welcomeBack") : t("auth.verifyLogin")}
            </h2>

            <AuthBanner
              banner={bannerState}
              onClose={() => {
                setGlobalError(null);
                setInfo(null);
              }}
            />

            {view === "login" ? (
              <form onSubmit={sendLoginCode} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-slate-600 ms-1">
                    {t("auth.emailAddress")}
                  </Label>
                  <Input
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className={`h-14 bg-white text-slate-900 placeholder:text-slate-400 rounded-xl px-4 border-2 focus-visible:ring-2 focus-visible:ring-[#165CF0]/30 focus-visible:border-[#165CF0] ${
                      loginError ? inputErrorClass : "border-[#165CF0]"
                    }`}
                    placeholder={t("auth.emailPlaceholder")}
                    autoFocus
                  />
                  <InlineError message={loginError} />
                </div>
                <Button
                  disabled={loading}
                  className="w-full h-14 bg-[#165CF0] text-white hover:bg-[#0E4FDB] rounded-xl text-lg font-medium shadow-md shadow-blue-500/20"
                >
                  {loading ? t("common.sending") : t("common.continue")}
                </Button>
              </form>
            ) : (
              <form onSubmit={verifyLoginCode} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-slate-600 ms-1">
                    {t("auth.enterCode")}
                  </Label>
                  <OtpInput
                    id="otp-login"
                    name="code"
                    value={loginCode}
                    onChange={setLoginCode}
                    length={6}
                    disabled={loading}
                    inputClassName={`bg-white text-slate-900 placeholder:text-slate-400 rounded-xl border-2 focus-visible:ring-2 focus-visible:ring-[#165CF0]/30 focus-visible:border-[#165CF0] ${
                      loginCodeError ? inputErrorClass : "border-[#165CF0]"
                    }`}
                  />
                  <InlineError message={loginCodeError} />
                  <p className="text-xs text-slate-500 ms-1 pt-1">
                    {t("auth.codeSentToEmail", { email: loginEmail })}
                  </p>
                </div>
                <Button
                  disabled={loading}
                  className="w-full h-14 bg-[#165CF0] text-white hover:bg-[#0E4FDB] rounded-xl text-lg font-medium shadow-md shadow-blue-500/20"
                >
                  {loading ? t("common.verifying") : t("auth.login")}
                </Button>
              </form>
            )}
          </motion.div>
        )}

        {view === "existing-account" && (
          <motion.div
            key="existing-account"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 max-w-xs mx-auto w-full"
          >
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              {t("auth.createAccount")}
            </h2>

            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-lg text-center">
              <h3 className="text-xl font-semibold text-slate-800">
                {t("auth.existingEmailTitle")}
              </h3>
              <p className="text-sm text-slate-500 mt-2">
                {t("auth.existingEmailBody")}
              </p>
              <p className="text-sm text-slate-600 mt-3 font-medium break-all">
                {signupEmail}
              </p>

              <Button
                type="button"
                className="mt-6 w-full h-12 bg-[#165CF0] text-white hover:bg-[#0E4FDB] rounded-2xl text-base font-semibold shadow-md shadow-blue-500/20"
                onClick={() =>
                  router.push(
                    `/login?email=${encodeURIComponent(
                      String(signupEmail || "").trim(),
                    )}`,
                  )
                }
              >
                {t("auth.continueToLogin")}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="mt-2 w-full h-11 rounded-2xl text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                onClick={useDifferentEmail}
              >
                {t("auth.useDifferentEmail")}
              </Button>
            </div>
          </motion.div>
        )}

        {(view === "signup" || view === "signup-verify") && (
          <motion.div
            key="signup"
            initial={{ opacity: 0, x: slideInX }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: slideOutX }}
            className="space-y-6 max-w-xs mx-auto w-full"
          >
            <h2 className="text-xl font-bold text-slate-800 mb-8">
              {view === "signup"
                ? t("auth.createAccount")
                : t("auth.verifyEmail")}
            </h2>

            <AuthBanner
              banner={bannerState}
              onClose={() => {
                setGlobalError(null);
                setInfo(null);
              }}
            />

            {view === "signup" ? (
              <form onSubmit={sendSignupCode} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-slate-600 ms-1">
                    {t("auth.fullName")}
                  </Label>
                  <Input
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className={`h-14 bg-white text-slate-900 placeholder:text-slate-400 rounded-xl px-4 border-2 focus-visible:ring-2 focus-visible:ring-[#165CF0]/30 focus-visible:border-[#165CF0] ${
                      signupNameError ? inputErrorClass : "border-[#165CF0]"
                    }`}
                    placeholder={t("auth.fullNamePlaceholder")}
                    autoFocus
                  />
                  <InlineError message={signupNameError} />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-600 ms-1">
                    {t("auth.emailAddress")}
                  </Label>
                  <Input
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className={`h-14 bg-white text-slate-900 placeholder:text-slate-400 rounded-xl px-4 border-2 focus-visible:ring-2 focus-visible:ring-[#165CF0]/30 focus-visible:border-[#165CF0] ${
                      signupEmailError ? inputErrorClass : "border-[#165CF0]"
                    }`}
                    placeholder={t("auth.emailPlaceholder")}
                  />
                  <InlineError message={signupEmailError} />
                </div>
                <Button
                  disabled={loading}
                  className="w-full h-14 bg-[#165CF0] text-white hover:bg-[#0E4FDB] rounded-xl text-lg font-medium shadow-md shadow-blue-500/20"
                >
                  {loading ? t("common.sending") : t("common.continue")}
                </Button>
              </form>
            ) : (
              <form onSubmit={verifySignupCode} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-slate-600 ms-1">
                    {t("auth.enterCode")}
                  </Label>
                  <OtpInput
                    id="otp-signup"
                    name="code"
                    value={signupCode}
                    onChange={setSignupCode}
                    length={6}
                    disabled={loading}
                    inputClassName={`bg-white text-slate-900 placeholder:text-slate-400 rounded-xl border-2 focus-visible:ring-2 focus-visible:ring-[#165CF0]/30 focus-visible:border-[#165CF0] ${
                      signupCodeError ? inputErrorClass : "border-[#165CF0]"
                    }`}
                  />
                  <InlineError message={signupCodeError} />
                  <p className="text-xs text-slate-500 ms-1 pt-1">
                    {t("auth.codeSentToEmail", { email: signupEmail })}
                  </p>
                </div>
                <Button
                  disabled={loading}
                  className="w-full h-14 bg-[#165CF0] text-white hover:bg-[#0E4FDB] rounded-xl text-lg font-medium shadow-md shadow-blue-500/20"
                >
                  {loading ? t("common.verifying") : t("auth.createAccount")}
                </Button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <Stepper totalSteps={2} currentStep={authStepIndex} />
    </div>
  );
}
