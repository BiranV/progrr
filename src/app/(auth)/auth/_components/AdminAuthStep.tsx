"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, Zap } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import AuthBanner, { type AuthBannerState } from "./AuthBanner";
import OtpInput from "@/components/OtpInput";

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidFullName = (fullName: string) =>
  fullName.trim().split(/\s+/).length >= 2;

type ViewState =
  | "landing"
  | "login"
  | "login-verify"
  | "signup"
  | "signup-verify";

export default function AdminAuthStep({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSessionUser } = useAuth();

  // State
  const [view, setView] = useState<ViewState>("landing");

  // Login State
  const [loginEmail, setLoginEmail] = useState("");
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

  const handleBack = () => {
    resetError();
    if (view === "login" || view === "signup") setView("landing");
    if (view === "login-verify") setView("login");
    if (view === "signup-verify") setView("signup");
  };

  // --- Actions ---

  const sendLoginCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    if (!isValidEmail(loginEmail)) {
      setLoginError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, flow: "login" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setInfo("Code sent to email");
      setView("login-verify");
    } catch (err: any) {
      setGlobalError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const verifyLoginCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    if (!loginCode) {
      setLoginCodeError("Code required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, code: loginCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      if (data.user) setSessionUser(data.user);

      const dest =
        typeof data?.redirectTo === "string"
          ? data.redirectTo
          : data?.onboardingCompleted
            ? "/dashboard"
            : "/onboarding";
      router.replace(dest);
    } catch (err: any) {
      // Keep the field highlighted, but also show global banner like onboarding.
      setLoginCodeError(err?.message || "Invalid code");
      setGlobalError(err?.message || "Invalid code");
      setLoading(false);
    }
  };

  const sendSignupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    let hasError = false;

    if (!isValidFullName(signupName)) {
      setSignupNameError("Please enter your full name");
      hasError = true;
    }

    if (!isValidEmail(signupEmail)) {
      setSignupEmailError("Please enter a valid email address");
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setInfo("Code sent to email");
      setView("signup-verify");
    } catch (err: any) {
      setGlobalError(err?.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const verifySignupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    resetError();
    if (!signupCode) {
      setSignupCodeError("Code required");
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      if (data.user) setSessionUser(data.user);

      const dest =
        typeof data?.redirectTo === "string"
          ? data.redirectTo
          : data?.onboardingCompleted
            ? "/dashboard"
            : "/onboarding";
      router.replace(dest);
    } catch (err: any) {
      setSignupCodeError(err?.message || "Verification failed");
      setGlobalError(err?.message || "Verification failed");
      setLoading(false);
    }
  };

  // --- Renderers ---

  // Inline Helper using requested styles
  const InlineError = ({ message }: { message: string | null }) => {
    if (!message) return null;
    return <p className="text-[13px] text-red-200/80 ml-1">{message}</p>;
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
        <div className="relative z-10 w-24 h-24 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl mb-4">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-inner overflow-hidden p-3">
            <Image
              src="/logo.png"
              alt="Progrr"
              width={64}
              height={64}
              className="object-contain"
            />
          </div>
        </div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-white/20 blur-xl rounded-full -z-10" />

        <h1 className="text-2xl font-bold text-white tracking-tight">Progrr</h1>
        <p className="text-white/70 text-sm mt-1 font-medium">
          Simple appointment scheduling for your business
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
                Login
              </Button>
              <Button
                className="w-full h-14 text-lg font-semibold bg-transparent text-white border-2 border-white/20 hover:bg-white/10 rounded-2xl"
                onClick={() => setView("signup")}
              >
                Create Account
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
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:text-white hover:bg-white/10 -ml-2"
                  onClick={handleBack}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <h2 className="text-xl font-bold text-white">
                  {view === "login" ? "Welcome Back" : "Verify Login"}
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
                    <Label className="text-white/80 ml-1">Email Address</Label>
                    <Input
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className={`h-14 bg-white/10 text-white placeholder:text-white/40 rounded-xl px-4 focus-visible:ring-offset-0 focus-visible:border-white/60 ${loginError ? inputErrorClass : "border-white/20"
                        }`}
                      placeholder="name@company.com"
                      autoFocus
                    />
                    <InlineError message={loginError} />
                  </div>
                  <Button
                    disabled={loading}
                    className="w-full h-14 bg-white text-neutral-900 hover:bg-white/90 rounded-xl text-lg font-medium"
                  >
                    {loading ? "Sending..." : "Continue"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={verifyLoginCode} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-white/80 ml-1">Enter Code</Label>
                    <OtpInput
                      id="otp-login"
                      name="code"
                      value={loginCode}
                      onChange={setLoginCode}
                      length={6}
                      disabled={loading}
                      inputClassName={`bg-white/10 text-white placeholder:text-white/40 rounded-xl focus-visible:ring-offset-0 focus-visible:border-white/60 ring-offset-transparent ${loginCodeError ? inputErrorClass : "border-white/20"
                        }`}
                    />
                    <InlineError message={loginCodeError} />
                    <p className="text-xs text-white/60 ml-1 pt-1">
                      Code sent to {loginEmail}
                    </p>
                  </div>
                  <Button
                    disabled={loading}
                    className="w-full h-14 bg-white text-neutral-900 hover:bg-white/90 rounded-xl text-lg font-medium"
                  >
                    {loading ? "Verifying..." : "Login"}
                  </Button>
                </form>
              )}
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
                  className="text-white hover:text-white hover:bg-white/10 -ml-2"
                  onClick={handleBack}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <h2 className="text-xl font-bold text-white">
                  {view === "signup" ? "Create Account" : "Verify Email"}
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
                    <Label className="text-white/80 ml-1">Full Name</Label>
                    <Input
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className={`h-14 bg-white/10 text-white placeholder:text-white/40 rounded-xl px-4 focus-visible:ring-offset-0 focus-visible:border-white/60 ${signupNameError ? inputErrorClass : "border-white/20"
                        }`}
                      placeholder="Jane Doe"
                      autoFocus
                    />
                    <InlineError message={signupNameError} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/80 ml-1">Email Address</Label>
                    <Input
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className={`h-14 bg-white/10 text-white placeholder:text-white/40 rounded-xl px-4 focus-visible:ring-offset-0 focus-visible:border-white/60 ${signupEmailError ? inputErrorClass : "border-white/20"
                        }`}
                      placeholder="name@company.com"
                    />
                    <InlineError message={signupEmailError} />
                  </div>
                  <Button
                    disabled={loading}
                    className="w-full h-14 bg-white text-neutral-900 hover:bg-white/90 rounded-xl text-lg font-medium"
                  >
                    {loading ? "Sending..." : "Continue"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={verifySignupCode} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-white/80 ml-1">Enter Code</Label>
                    <OtpInput
                      id="otp-signup"
                      name="code"
                      value={signupCode}
                      onChange={setSignupCode}
                      length={6}
                      disabled={loading}
                      inputClassName={`bg-white/10 text-white placeholder:text-white/40 rounded-xl focus-visible:ring-offset-0 focus-visible:border-white/60 ring-offset-transparent ${signupCodeError ? inputErrorClass : "border-white/20"
                        }`}
                    />
                    <InlineError message={signupCodeError} />
                    <p className="text-xs text-white/60 ml-1 pt-1">
                      Code sent to {signupEmail}
                    </p>
                  </div>
                  <Button
                    disabled={loading}
                    className="w-full h-14 bg-white text-neutral-900 hover:bg-white/90 rounded-xl text-lg font-medium"
                  >
                    {loading ? "Verifying..." : "Create Account"}
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
