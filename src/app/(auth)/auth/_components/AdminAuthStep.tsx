"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
}: {
  nextPath: string;
  initialView?: InitialView;
  initialEmail?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSessionUser } = useAuth();
  const { t } = useI18n();

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

  // Fun: click the logo to "turn on" a glow
  const [logoLit, setLogoLit] = useState(false);

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

  const handleBack = () => {
    resetError();
    if (view === "login" || view === "signup") setView("landing");
    if (view === "login-verify") setView("login");
    if (view === "signup-verify") setView("signup");
    if (view === "existing-account") setView("signup");
  };

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
    return <p className="text-[13px] text-red-200/80 ms-1">{message}</p>;
  };

  // Only show global errors in banner, field errors are inline
  const bannerState: AuthBannerState = globalError
    ? { type: "error", text: globalError }
    : info
      ? { type: "message", text: info }
      : null;

  // For inputs
  const inputErrorClass = "border-red-300/50 ring-1 ring-red-300/20";

  return (
    <div className="w-full flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: -100 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="mb-10 relative flex flex-col items-center"
      >
        <button
          type="button"
          aria-label={t("auth.toggleLogoLight")}
          aria-pressed={logoLit}
          data-lit={logoLit ? "true" : "false"}
          onClick={() => setLogoLit((v) => !v)}
          className="progrr-auth-logo relative z-10 w-24 h-24 rounded-full bg-[#165CF0] flex items-center justify-center mb-4 cursor-pointer transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          <div className="w-22 h-22 rounded-full bg-[#165CF0] flex items-center justify-center overflow-hidden p-1.5">
            <Image
              src="/logo-new2.png"
              alt={t("common.appName")}
              width={92}
              height={92}
              className="object-contain"
            />
          </div>
        </button>

        <h1 className="text-2xl font-bold text-white tracking-tight">
          {t("common.appName")}
        </h1>
        <p className="text-white/70 text-sm mt-1 font-medium">
          {t("auth.landingTitle")}
        </p>
      </motion.div>

      <div className="w-full">
        <AnimatePresence mode="wait">
          {view === "landing" && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4 pt-12"
            >
              <Button
                className="w-full h-14 text-lg font-semibold bg-white text-neutral-900 hover:bg-white/90 rounded-2xl"
                onClick={() => setView("login")}
              >
                {t("auth.login")}
              </Button>
              <Button
                className="w-full h-14 text-lg font-semibold bg-transparent text-white border-2 border-white/20 hover:bg-white/10 rounded-2xl"
                onClick={() => setView("signup")}
              >
                {t("auth.createAccountCta")}
              </Button>
            </motion.div>
          )}

          {(view === "login" || view === "login-verify") && (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-8">
                {/* A11y: icon-only button needs an accessible name */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:text-white hover:bg-white/10 -ms-2"
                  onClick={handleBack}
                  aria-label={t("common.back")}
                >
                  <ChevronLeft className="w-6 h-6 rtl:rotate-180" />
                </Button>
                <h2 className="text-xl font-bold text-white">
                  {view === "login"
                    ? t("auth.welcomeBack")
                    : t("auth.verifyLogin")}
                </h2>
              </div>

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
                    <Label className="text-white/80 ms-1">
                      {t("auth.emailAddress")}
                    </Label>
                    <Input
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className={`h-14 bg-white/10 text-white placeholder:text-white/40 rounded-xl px-4 focus-visible:ring-offset-0 focus-visible:border-white/60 ${
                        loginError ? inputErrorClass : "border-white/20"
                      }`}
                      placeholder={t("auth.emailPlaceholder")}
                      autoFocus
                    />
                    <InlineError message={loginError} />
                  </div>
                  <Button
                    disabled={loading}
                    className="w-full h-14 bg-white text-neutral-900 hover:bg-white/90 rounded-xl text-lg font-medium"
                  >
                    {loading ? t("common.sending") : t("common.continue")}
                  </Button>
                </form>
              ) : (
                <form onSubmit={verifyLoginCode} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-white/80 ms-1">
                      {t("auth.enterCode")}
                    </Label>
                    <OtpInput
                      id="otp-login"
                      name="code"
                      value={loginCode}
                      onChange={setLoginCode}
                      length={6}
                      disabled={loading}
                      inputClassName={`bg-white/10 text-white placeholder:text-white/40 rounded-xl focus-visible:ring-offset-0 focus-visible:border-white/60 ring-offset-transparent ${
                        loginCodeError ? inputErrorClass : "border-white/20"
                      }`}
                    />
                    <InlineError message={loginCodeError} />
                    <p className="text-xs text-white/60 ms-1 pt-1">
                      {t("auth.codeSentToEmail", { email: loginEmail })}
                    </p>
                  </div>
                  <Button
                    disabled={loading}
                    className="w-full h-14 bg-white text-neutral-900 hover:bg-white/90 rounded-xl text-lg font-medium"
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
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:text-white hover:bg-white/10 -ms-2"
                  onClick={handleBack}
                  aria-label={t("common.back")}
                >
                  <ChevronLeft className="w-6 h-6 rtl:rotate-180" />
                </Button>
                <h2 className="text-xl font-bold text-white">
                  {t("auth.createAccount")}
                </h2>
              </div>

              <div className="rounded-3xl border border-white/15 bg-white/5 backdrop-blur-md px-6 py-7 shadow-xl text-center">
                <h3 className="text-xl font-semibold text-white">
                  {t("auth.existingEmailTitle")}
                </h3>
                <p className="text-sm text-white/70 mt-2">
                  {t("auth.existingEmailBody")}
                </p>
                <p className="text-sm text-white/80 mt-3 font-medium break-all">
                  {signupEmail}
                </p>

                <Button
                  type="button"
                  className="mt-6 w-full h-12 bg-white text-neutral-900 hover:bg-white/90 rounded-2xl text-base font-semibold"
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
                  className="mt-2 w-full h-11 rounded-2xl text-white/80 hover:text-white hover:bg-white/10"
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
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-8">
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:text-white hover:bg-white/10 -ms-2"
                  onClick={handleBack}
                  aria-label={t("common.back")}
                >
                  <ChevronLeft className="w-6 h-6 rtl:rotate-180" />
                </Button>
                <h2 className="text-xl font-bold text-white">
                  {view === "signup"
                    ? t("auth.createAccount")
                    : t("auth.verifyEmail")}
                </h2>
              </div>

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
                    <Label className="text-white/80 ms-1">
                      {t("auth.fullName")}
                    </Label>
                    <Input
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className={`h-14 bg-white/10 text-white placeholder:text-white/40 rounded-xl px-4 focus-visible:ring-offset-0 focus-visible:border-white/60 ${
                        signupNameError ? inputErrorClass : "border-white/20"
                      }`}
                      placeholder={t("auth.fullNamePlaceholder")}
                      autoFocus
                    />
                    <InlineError message={signupNameError} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/80 ms-1">
                      {t("auth.emailAddress")}
                    </Label>
                    <Input
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className={`h-14 bg-white/10 text-white placeholder:text-white/40 rounded-xl px-4 focus-visible:ring-offset-0 focus-visible:border-white/60 ${
                        signupEmailError ? inputErrorClass : "border-white/20"
                      }`}
                      placeholder={t("auth.emailPlaceholder")}
                    />
                    <InlineError message={signupEmailError} />
                  </div>
                  <Button
                    disabled={loading}
                    className="w-full h-14 bg-white text-neutral-900 hover:bg-white/90 rounded-xl text-lg font-medium"
                  >
                    {loading ? t("common.sending") : t("common.continue")}
                  </Button>
                </form>
              ) : (
                <form onSubmit={verifySignupCode} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-white/80 ms-1">
                      {t("auth.enterCode")}
                    </Label>
                    <OtpInput
                      id="otp-signup"
                      name="code"
                      value={signupCode}
                      onChange={setSignupCode}
                      length={6}
                      disabled={loading}
                      inputClassName={`bg-white/10 text-white placeholder:text-white/40 rounded-xl focus-visible:ring-offset-0 focus-visible:border-white/60 ring-offset-transparent ${
                        signupCodeError ? inputErrorClass : "border-white/20"
                      }`}
                    />
                    <InlineError message={signupCodeError} />
                    <p className="text-xs text-white/60 ms-1 pt-1">
                      {t("auth.codeSentToEmail", { email: signupEmail })}
                    </p>
                  </div>
                  <Button
                    disabled={loading}
                    className="w-full h-14 bg-white text-neutral-900 hover:bg-white/90 rounded-xl text-lg font-medium"
                  >
                    {loading ? t("common.verifying") : t("auth.createAccount")}
                  </Button>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
