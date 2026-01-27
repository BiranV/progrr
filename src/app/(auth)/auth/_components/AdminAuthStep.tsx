"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import AuthBanner, { type AuthBannerState } from "./AuthBanner";
import OtpInput from "@/components/OtpInput";
import { useI18n } from "@/i18n/useI18n";
import { isValidEmail, normalizeEmail } from "@/lib/email";
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
  const [loginEmail, setLoginEmail] = useState(() =>
    normalizeEmail(initialEmail),
  );
  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginEmailTouched, setLoginEmailTouched] = useState(false);
  const [loginCodeTouched, setLoginCodeTouched] = useState(false);
  const [loginSubmitAttempted, setLoginSubmitAttempted] = useState(false);
  const [loginVerifyAttempted, setLoginVerifyAttempted] = useState(false);
  const [loginResendCooldown, setLoginResendCooldown] = useState(0);
  const [signupResendCooldown, setSignupResendCooldown] = useState(0);

  // Signup State
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [signupNameTouched, setSignupNameTouched] = useState(false);
  const [signupEmailTouched, setSignupEmailTouched] = useState(false);
  const [signupCodeTouched, setSignupCodeTouched] = useState(false);
  const [signupSubmitAttempted, setSignupSubmitAttempted] = useState(false);
  const [signupVerifyAttempted, setSignupVerifyAttempted] = useState(false);

  // Field Errors
  const [signupNameError, setSignupNameError] = useState<string | null>(null);
  const [signupEmailError, setSignupEmailError] = useState<string | null>(null);
  const [signupCodeError, setSignupCodeError] = useState<string | null>(null);
  const [loginCodeError, setLoginCodeError] = useState<string | null>(null);

  const loginEmailRef = useRef<HTMLInputElement | null>(null);
  const signupNameRef = useRef<HTMLInputElement | null>(null);
  const signupEmailRef = useRef<HTMLInputElement | null>(null);
  const loginCodeRef = useRef<HTMLInputElement | null>(null);
  const signupCodeRef = useRef<HTMLInputElement | null>(null);

  // UI State
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
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

  useEffect(() => {
    if (loginResendCooldown <= 0 && signupResendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setLoginResendCooldown((current) => (current > 0 ? current - 1 : 0));
      setSignupResendCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [loginResendCooldown, signupResendCooldown]);

  // --- Actions ---

  const requestLoginCode = async (email: string, showVerifyView: boolean) => {
    setSendingCode(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, flow: "login" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorKey = getAuthErrorKey(data?.error);
        setGlobalError(t(errorKey));
        return false;
      }

      setInfo(t("auth.codeSentToEmailShort"));
      if (showVerifyView) setView("login-verify");
      setLoginResendCooldown(30);
      return true;
    } catch (err: any) {
      setGlobalError(t("errors.somethingWentWrong"));
      return false;
    } finally {
      setSendingCode(false);
    }
  };

  const requestSignupCode = async (email: string, showVerifyView: boolean) => {
    setSendingCode(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, flow: "signup" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data?.error === "EMAIL_ALREADY_EXISTS") {
        setGlobalError(null);
        setInfo(null);
        setView("existing-account");
        return false;
      }
      if (!res.ok) {
        const errorKey = getAuthErrorKey(data?.error);
        setGlobalError(t(errorKey));
        return false;
      }

      setInfo(t("auth.codeSentToEmailShort"));
      if (showVerifyView) setView("signup-verify");
      setSignupResendCooldown(30);
      return true;
    } catch (err: any) {
      setGlobalError(t("errors.signupFailed"));
      return false;
    } finally {
      setSendingCode(false);
    }
  };

  const sendLoginCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    setLoginSubmitAttempted(true);
    const email = normalizeEmail(loginEmail);
    setLoginEmail(email);
    if (!isValidEmail(email)) {
      setLoginError(t("errors.invalidEmail"));
      loginEmailRef.current?.focus();
      return;
    }

    await requestLoginCode(email, true);
  };

  const verifyLoginCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    setLoginVerifyAttempted(true);
    if (!loginCode) {
      setLoginCodeError(t("errors.codeRequired"));
      loginCodeRef.current?.focus();
      return;
    }

    setVerifyingCode(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizeEmail(loginEmail),
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
      setVerifyingCode(false);
    }
  };

  const sendSignupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    setSignupSubmitAttempted(true);
    let hasError = false;

    const fullName = signupName.trim();
    setSignupName(fullName);
    if (!isValidFullName(fullName)) {
      setSignupNameError(t("errors.fullNameRequired"));
      hasError = true;
    }

    const email = normalizeEmail(signupEmail);
    setSignupEmail(email);
    if (!isValidEmail(email)) {
      setSignupEmailError(t("errors.invalidEmail"));
      hasError = true;
    }

    if (hasError) {
      if (!isValidFullName(fullName)) {
        signupNameRef.current?.focus();
      } else if (!isValidEmail(email)) {
        signupEmailRef.current?.focus();
      }
      return;
    }

    await requestSignupCode(email, true);
  };

  const verifySignupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    setSignupVerifyAttempted(true);
    if (!signupCode) {
      setSignupCodeError(t("errors.codeRequired"));
      signupCodeRef.current?.focus();
      return;
    }

    setVerifyingCode(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizeEmail(signupEmail),
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
      setVerifyingCode(false);
    }
  };

  // --- Renderers ---

  // Only show global errors in banner, field errors are border-only
  const bannerState: AuthBannerState = globalError
    ? { type: "error", text: globalError }
    : info
      ? { type: "message", text: info }
      : null;

  // For inputs
  const inputErrorClass =
    "border-rose-300 focus-visible:border-rose-300 focus-visible:ring-rose-200/60";

  const slideInY = 50;
  const slideOutY = -50;
  return (
    <div className="w-full flex flex-col h-full min-h-0">
      <AnimatePresence mode="wait">
        {view === "landing" && (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: slideInY }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: slideOutY }}
            className="space-y-8"
          >
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">
                {t("auth.getStartedTitle")}
              </h1>
              <p className="text-slate-500 text-sm md:text-base max-w-sm mx-auto">
                {t("auth.getStartedSubtitle")}
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
                className="w-full py-6 text-base font-semibold border-2 border-[#165CF0] text-[#165CF0] bg-gray-50 hover:text-[#165CF0] hover:bg-blue-50 rounded-xl transition-all duration-300 hover:-translate-y-0.5"
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
            initial={{ opacity: 0, y: slideInY }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: slideOutY }}
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
                    {t("auth.emailAddress")}{" "}
                    <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(normalizeEmail(e.target.value));
                      if (loginError) setLoginError(null);
                      if (globalError) setGlobalError(null);
                    }}
                    onBlur={(e) => {
                      setLoginEmail(normalizeEmail(e.target.value));
                      setLoginEmailTouched(true);
                      if (!isValidEmail(normalizeEmail(e.target.value))) {
                        setLoginError(t("errors.invalidEmail"));
                      }
                    }}
                    ref={loginEmailRef}
                    className={`h-14 bg-gray-50 text-slate-900 placeholder:text-slate-400 rounded-xl px-4 border-2 focus-visible:ring-2 focus-visible:ring-[#165CF0]/30 focus-visible:border-[#165CF0] ${
                      loginError ? inputErrorClass : "border-[#165CF0]"
                    }`}
                    placeholder={t("auth.emailPlaceholder")}
                    autoFocus
                  />
                  {(loginEmailTouched || loginSubmitAttempted) && loginError ? (
                    <p className="text-xs text-rose-500 ms-1">{loginError}</p>
                  ) : null}
                </div>
                <Button
                  disabled={
                    sendingCode || verifyingCode || loginResendCooldown > 0
                  }
                  className="w-full h-14 bg-[#165CF0] text-white hover:bg-[#0E4FDB] rounded-xl text-lg font-medium shadow-md shadow-blue-500/20"
                >
                  {sendingCode
                    ? t("common.sending")
                    : loginResendCooldown > 0
                      ? t("auth.resendCodeIn", {
                          seconds: loginResendCooldown,
                        })
                      : t("common.continue")}
                </Button>
              </form>
            ) : (
              <form onSubmit={verifyLoginCode} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-slate-600 ms-1">
                    {t("auth.enterCode")}{" "}
                    <span className="text-rose-400">*</span>
                  </Label>
                  <OtpInput
                    id="otp-login"
                    name="code"
                    value={loginCode}
                    onChange={(value) => {
                      setLoginCode(value);
                      if (loginCodeError) setLoginCodeError(null);
                      if (globalError) setGlobalError(null);
                      if (!loginCodeTouched) setLoginCodeTouched(true);
                    }}
                    length={6}
                    disabled={verifyingCode}
                    firstInputRef={loginCodeRef}
                    inputClassName={`bg-gray-50 text-slate-900 placeholder:text-slate-400 rounded-xl border-2 focus-visible:ring-2 focus-visible:ring-[#165CF0]/30 focus-visible:border-[#165CF0] ${
                      loginCodeError ? inputErrorClass : "border-[#165CF0]"
                    }`}
                  />
                  <p className="text-xs text-slate-500 ms-1 pt-1">
                    {t("auth.codeSentToEmail", { email: loginEmail })}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <div />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-slate-500 hover:text-slate-800"
                      disabled={
                        sendingCode || verifyingCode || loginResendCooldown > 0
                      }
                      onClick={async () => {
                        resetError();
                        const email = normalizeEmail(loginEmail);
                        setLoginEmail(email);
                        if (!isValidEmail(email)) {
                          setLoginError(t("errors.invalidEmail"));
                          loginEmailRef.current?.focus();
                          return;
                        }
                        await requestLoginCode(email, false);
                      }}
                    >
                      {loginResendCooldown > 0
                        ? t("auth.resendCodeIn", {
                            seconds: loginResendCooldown,
                          })
                        : t("auth.resendCode")}
                    </Button>
                  </div>
                </div>
                <Button
                  disabled={verifyingCode}
                  className="w-full h-14 bg-[#165CF0] text-white hover:bg-[#0E4FDB] rounded-xl text-lg font-medium shadow-md shadow-blue-500/20"
                >
                  {verifyingCode ? t("common.verifying") : t("auth.login")}
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
                      normalizeEmail(signupEmail),
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
            initial={{ opacity: 0, y: slideInY }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: slideOutY }}
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
                    {t("auth.fullName")}{" "}
                    <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    value={signupName}
                    onChange={(e) => {
                      setSignupName(e.target.value);
                      if (signupNameError) setSignupNameError(null);
                      if (globalError) setGlobalError(null);
                    }}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      setSignupName(value);
                      setSignupNameTouched(true);
                      if (!isValidFullName(value)) {
                        setSignupNameError(t("errors.fullNameRequired"));
                      }
                    }}
                    ref={signupNameRef}
                    className={`h-14 bg-gray-50 text-slate-900 placeholder:text-slate-400 rounded-xl px-4 border-2 focus-visible:ring-2 focus-visible:ring-[#165CF0]/30 focus-visible:border-[#165CF0] ${
                      signupNameError ? inputErrorClass : "border-[#165CF0]"
                    }`}
                    placeholder={t("auth.fullNamePlaceholder")}
                    autoFocus
                  />
                  {(signupNameTouched || signupSubmitAttempted) &&
                  signupNameError ? (
                    <p className="text-xs text-rose-500 ms-1">
                      {signupNameError}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-600 ms-1">
                    {t("auth.emailAddress")}{" "}
                    <span className="text-rose-400">*</span>
                  </Label>
                  <Input
                    value={signupEmail}
                    onChange={(e) => {
                      setSignupEmail(normalizeEmail(e.target.value));
                      if (signupEmailError) setSignupEmailError(null);
                      if (globalError) setGlobalError(null);
                    }}
                    onBlur={(e) => {
                      const value = normalizeEmail(e.target.value);
                      setSignupEmail(value);
                      setSignupEmailTouched(true);
                      if (!isValidEmail(value)) {
                        setSignupEmailError(t("errors.invalidEmail"));
                      }
                    }}
                    ref={signupEmailRef}
                    className={`h-14 bg-gray-50 text-slate-900 placeholder:text-slate-400 rounded-xl px-4 border-2 focus-visible:ring-2 focus-visible:ring-[#165CF0]/30 focus-visible:border-[#165CF0] ${
                      signupEmailError ? inputErrorClass : "border-[#165CF0]"
                    }`}
                    placeholder={t("auth.emailPlaceholder")}
                  />
                  {(signupEmailTouched || signupSubmitAttempted) &&
                  signupEmailError ? (
                    <p className="text-xs text-rose-500 ms-1">
                      {signupEmailError}
                    </p>
                  ) : null}
                </div>
                <Button
                  disabled={
                    sendingCode || verifyingCode || signupResendCooldown > 0
                  }
                  className="w-full h-14 bg-[#165CF0] text-white hover:bg-[#0E4FDB] rounded-xl text-lg font-medium shadow-md shadow-blue-500/20"
                >
                  {sendingCode
                    ? t("common.sending")
                    : signupResendCooldown > 0
                      ? t("auth.resendCodeIn", {
                          seconds: signupResendCooldown,
                        })
                      : t("common.continue")}
                </Button>
              </form>
            ) : (
              <form onSubmit={verifySignupCode} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-slate-600 ms-1">
                    {t("auth.enterCode")}{" "}
                    <span className="text-rose-400">*</span>
                  </Label>
                  <OtpInput
                    id="otp-signup"
                    name="code"
                    value={signupCode}
                    onChange={(value) => {
                      setSignupCode(value);
                      if (signupCodeError) setSignupCodeError(null);
                      if (globalError) setGlobalError(null);
                      if (!signupCodeTouched) setSignupCodeTouched(true);
                    }}
                    length={6}
                    disabled={verifyingCode}
                    firstInputRef={signupCodeRef}
                    inputClassName={`bg-gray-50 text-slate-900 placeholder:text-slate-400 rounded-xl border-2 focus-visible:ring-2 focus-visible:ring-[#165CF0]/30 focus-visible:border-[#165CF0] ${
                      signupCodeError ? inputErrorClass : "border-[#165CF0]"
                    }`}
                  />
                  <p className="text-xs text-slate-500 ms-1 pt-1">
                    {t("auth.codeSentToEmail", { email: signupEmail })}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <div />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-slate-500 hover:text-slate-800"
                      disabled={
                        sendingCode || verifyingCode || signupResendCooldown > 0
                      }
                      onClick={async () => {
                        resetError();
                        const email = normalizeEmail(signupEmail);
                        setSignupEmail(email);
                        if (!isValidEmail(email)) {
                          setSignupEmailError(t("errors.invalidEmail"));
                          signupEmailRef.current?.focus();
                          return;
                        }
                        await requestSignupCode(email, false);
                      }}
                    >
                      {signupResendCooldown > 0
                        ? t("auth.resendCodeIn", {
                            seconds: signupResendCooldown,
                          })
                        : t("auth.resendCode")}
                    </Button>
                  </div>
                </div>
                <Button
                  disabled={verifyingCode}
                  className="w-full h-14 bg-[#165CF0] text-white hover:bg-[#0E4FDB] rounded-xl text-lg font-medium shadow-md shadow-blue-500/20"
                >
                  {verifyingCode
                    ? t("common.verifying")
                    : t("auth.createAccount")}
                </Button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
