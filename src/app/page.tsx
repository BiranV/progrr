"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sun, Moon, XCircle, CheckCircle2 } from "lucide-react";
import { signInWithPassword, signUpWithPassword } from "@/app/actions/auth";
import { useFormStatus } from "react-dom";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoadingAuth, user } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();

  const authErrorFromUrl = searchParams.get("authError");
  const authMessageFromUrl = searchParams.get("authMessage");

  const nextPath = searchParams.get("next");
  const tabFromUrl = searchParams.get("tab");
  const [tab, setTab] = useState<"login" | "signup">(
    tabFromUrl === "signup" ? "signup" : "login"
  );
  const [banner, setBanner] = useState<
    { type: "error"; text: string } | { type: "message"; text: string } | null
  >(null);

  const urlHasBanner = useMemo(
    () => Boolean(authErrorFromUrl || authMessageFromUrl),
    [authErrorFromUrl, authMessageFromUrl]
  );

  const clearAuthBannersFromUrl = useCallback(() => {
    // Only replace if we actually have these params
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("authError") || params.has("authMessage")) {
      params.delete("authError");
      params.delete("authMessage");
      const qs = params.toString();
      // Use window.history.replaceState to avoid triggering a Next.js router refresh/RSC call
      const newPath = qs ? `/?${qs}` : "/";
      window.history.replaceState(null, "", newPath);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!urlHasBanner) return;

    // If the server redirected us with a specific tab (e.g. signup error),
    // make sure the UI is on that tab before showing the banner.
    if (tabFromUrl === "signup") {
      setTab("signup");
    } else if (tabFromUrl === "login") {
      setTab("login");
    }

    if (authErrorFromUrl) {
      setBanner({ type: "error", text: authErrorFromUrl });
    } else if (authMessageFromUrl) {
      setBanner({ type: "message", text: authMessageFromUrl });
    }
  }, [
    authErrorFromUrl,
    authMessageFromUrl,
    clearAuthBannersFromUrl,
    tabFromUrl,
    urlHasBanner,
  ]);

  useEffect(() => {
    // ❗️לא לגעת ב־invite flow
    if (typeof window !== "undefined") {
      if (window.location.pathname.startsWith("/invite")) {
        return;
      }
    }

    if (isLoadingAuth) return;

    if (isAuthenticated) {
      // כולם (Admin / Client / Owner) אחרי התחברות → Dashboard
      router.replace(nextPath || "/dashboard");
    }
  }, [isAuthenticated, isLoadingAuth, nextPath, router]);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/logo.png"
            alt="Loading..."
            className="h-20 w-20 animate-zoom-in-out object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Animated Background Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 dark:bg-pink-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Dark Mode Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={toggleDarkMode}
          className="p-3 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg hover:bg-white dark:hover:bg-gray-700 transition-all border border-gray-200 dark:border-gray-700"
          aria-label="Toggle dark mode"
        >
          {darkMode ? (
            <Sun className="w-5 h-5 text-gray-300" />
          ) : (
            <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          )}
        </button>
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Branding */}
          <div className="hidden lg:flex flex-col items-center justify-center text-center space-y-0">
            <div className="relative">
              <img
                src="/logo.png"
                alt="Progrr Logo"
                className="relative w-64 h-64 object-contain drop-shadow-2xl"
              />
            </div>
            <div className="space-y-4 -mt-8">
              <h1 className="text-6xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent pb-2">
                progrr
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-md">
                Transform your coaching business with intelligent client
                management
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-4">
                <div className="px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-md">
                  <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                    📊 Track Progress
                  </span>
                </div>
                <div className="px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-md">
                  <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                    💪 Build Plans
                  </span>
                </div>
                <div className="px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-md">
                  <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                    🎯 Achieve Goals
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Auth Form */}
          <div className="w-full max-w-md mx-auto">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69538c86530afecdd4f04cee/9d28c112f_ChatGPTImageDec30202506_28_18PM-Photoroom.png"
                alt="Progrr Logo"
                className="w-32 h-32 mx-auto object-contain mb-4"
              />
              <h1 className="text-4xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                Progrr
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Your coaching companion
              </p>
            </div>

            <Card className="backdrop-blur-lg bg-white/80 dark:bg-gray-800/80 shadow-2xl border-0 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600"></div>
              <CardContent className="pt-8 pb-6 px-8 min-h-[500px] flex flex-col">
                <Tabs
                  value={tab}
                  onValueChange={(value) => {
                    const nextTab = value === "signup" ? "signup" : "login";
                    setTab(nextTab);
                    setBanner(null);
                    if (urlHasBanner) {
                      clearAuthBannersFromUrl();
                    }
                  }}
                  className="w-full flex-1 flex flex-col"
                >
                  <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-6 h-12">
                    <TabsTrigger
                      value="login"
                      className="rounded-lg h-10 cursor-pointer data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all dark:text-gray-300 dark:data-[state=active]:text-white"
                    >
                      Login
                    </TabsTrigger>
                    <TabsTrigger
                      value="signup"
                      className="rounded-lg h-10 cursor-pointer data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all dark:text-gray-300 dark:data-[state=active]:text-white"
                    >
                      Sign up
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="flex-1 flex flex-col">
                    <LoginForm
                      key={`login-${tab}`}
                      banner={banner}
                      clearBanner={() => setBanner(null)}
                    />
                  </TabsContent>

                  <TabsContent value="signup" className="flex-1 flex flex-col">
                    <RegisterForm
                      key={`signup-${tab}`}
                      banner={banner}
                      clearBanner={() => setBanner(null)}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
              By continuing, you agree to our Terms & Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm({
  banner,
  clearBanner,
}: {
  banner:
    | { type: "error"; text: string }
    | { type: "message"; text: string }
    | null;
  clearBanner: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = searchParams.get("next");
  const [loginAs, setLoginAs] = useState<"admin" | "client">("admin");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [clientStep, setClientStep] = useState<"phone" | "code">("phone");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [clientInfo, setClientInfo] = useState<string | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  const [adminValidationError, setAdminValidationError] = useState<
    string | null
  >(null);

  useEffect(() => {
    // Clear the form completely when switching roles.
    clearBanner();
    setAdminEmail("");
    setAdminPassword("");

    setClientError(null);
    setClientInfo(null);
    setClientPhone("");
    setClientCode("");
    setClientStep("phone");
    setClientLoading(false);

    setAdminValidationError(null);
  }, [loginAs]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    clearBanner();
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const newErrors: { email?: string; password?: string } = {};

    // Email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password || !password.trim()) {
      newErrors.password = "Password is required";
    }

    if (Object.keys(newErrors).length > 0) {
      e.preventDefault();
      // Show a top-level banner message for consistency with client OTP flow
      const firstError = newErrors.email || newErrors.password;
      setAdminValidationError(firstError || "Please check your details");
    } else {
      setAdminValidationError(null);
    }
  };

  const handleClientSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanner();
    setClientError(null);
    setClientInfo(null);

    const phone = clientPhone.trim();
    if (!phone) {
      setClientError("Phone number is required");
      return;
    }

    setClientLoading(true);
    try {
      const res = await fetch("/api/auth/client/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setClientError(data?.error || `Failed to send code (${res.status})`);
        return;
      }

      const data = await res.json().catch(() => ({} as { delivery?: string }));
      if (data?.delivery === "dev_log") {
        setClientInfo(
          "Verification code generated (check server logs in your dev terminal)."
        );
      } else {
        setClientInfo("Verification code sent.");
      }
      setClientStep("code");
    } catch (err: any) {
      setClientError(err?.message || "Failed to send verification code");
    } finally {
      setClientLoading(false);
    }
  };

  const handleClientVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanner();
    setClientError(null);
    setClientInfo(null);

    const phone = clientPhone.trim();
    const token = clientCode.trim();

    if (!phone) {
      setClientError("Phone number is required");
      return;
    }

    if (!token) {
      setClientError("Verification code is required");
      return;
    }

    setClientLoading(true);
    try {
      const res = await fetch("/api/auth/client/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: token }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setClientError(data?.error || `Failed to verify code (${res.status})`);
        return;
      }

      router.replace(nextPath || "/dashboard");
      router.refresh();
    } catch (err: any) {
      setClientError(err?.message || "Failed to verify code");
    } finally {
      setClientLoading(false);
    }
  };

  return (
    <div className="space-y-5 flex-1 flex flex-col">
      {banner ? (
        banner.type === "error" ? (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-4 h-12">
            <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
              <XCircle className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm text-slate-700 dark:text-slate-200 break-words">
                {banner.text}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-slate-900/60 px-4 h-12">
            <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm text-slate-700 dark:text-slate-200 break-words">
                {banner.text}
              </div>
            </div>
          </div>
        )
      ) : null}

      {adminValidationError ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-4 h-12">
          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
            <XCircle className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-slate-700 dark:text-slate-200 break-words">
              {adminValidationError}
            </div>
          </div>
        </div>
      ) : null}

      {clientError ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-4 h-12">
          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
            <XCircle className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-slate-700 dark:text-slate-200 break-words">
              {clientError}
            </div>
          </div>
        </div>
      ) : null}

      {clientInfo ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-slate-900/60 px-4 h-12">
          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-slate-700 dark:text-slate-200 break-words">
              {clientInfo}
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label className="text-gray-700 dark:text-gray-200">Login as</Label>
        <Tabs
          value={loginAs}
          onValueChange={(v) => setLoginAs(v === "client" ? "client" : "admin")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-0 rounded-md h-9">
            <TabsTrigger
              value="admin"
              className="rounded-md h-9 text-sm cursor-pointer text-gray-600 dark:text-gray-300 data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white transition-all"
            >
              Admin
            </TabsTrigger>
            <TabsTrigger
              value="client"
              className="rounded-md h-9 text-sm cursor-pointer text-gray-600 dark:text-gray-300 data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white transition-all"
            >
              Client
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loginAs === "admin" ? (
        <form
          action={signInWithPassword}
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 flex-1 flex flex-col"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="login_email"
                className="text-gray-700 dark:text-gray-200"
              >
                Email Address
              </Label>
              <Input
                id="login_email"
                name="email"
                type="email"
                placeholder="coach@example.com"
                autoComplete="email"
                value={adminEmail}
                onChange={(e) => {
                  clearBanner();
                  if (adminValidationError) setAdminValidationError(null);
                  setAdminEmail(e.target.value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="login_password"
                className="text-gray-700 dark:text-gray-200"
              >
                Password
              </Label>
              <Input
                id="login_password"
                name="password"
                type="password"
                placeholder=""
                autoComplete="current-password"
                value={adminPassword}
                onChange={(e) => {
                  clearBanner();
                  if (adminValidationError) setAdminValidationError(null);
                  setAdminPassword(e.target.value);
                }}
              />
            </div>
          </div>

          <SubmitButton
            pendingText="Signing in..."
            text="Login to your account"
          />
        </form>
      ) : clientStep === "phone" ? (
        <form
          onSubmit={handleClientSendCode}
          className="space-y-4 flex-1 flex flex-col"
        >
          <div className="space-y-2">
            <Label
              htmlFor="client_phone"
              className="text-gray-700 dark:text-gray-200"
            >
              Phone Number
            </Label>
            <Input
              id="client_phone"
              name="phone"
              type="tel"
              placeholder="+1 555 555 5555"
              autoComplete="tel"
              value={clientPhone}
              onChange={(e) => {
                clearBanner();
                if (clientError) setClientError(null);
                setClientPhone(e.target.value);
              }}
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] mt-auto disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={clientLoading}
          >
            {clientLoading ? "Sending..." : "Send verification code"}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={handleClientVerifyCode}
          className="space-y-4 flex-1 flex flex-col"
        >
          <div className="space-y-2">
            <Label
              htmlFor="client_phone_confirm"
              className="text-gray-700 dark:text-gray-200"
            >
              Phone Number
            </Label>
            <Input
              id="client_phone_confirm"
              name="phone"
              type="tel"
              value={clientPhone}
              onChange={(e) => {
                clearBanner();
                if (clientError) setClientError(null);
                setClientPhone(e.target.value);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="client_code"
              className="text-gray-700 dark:text-gray-200"
            >
              Verification Code
            </Label>
            <OtpInput
              id="client_code"
              name="code"
              value={clientCode}
              onChange={(next) => {
                clearBanner();
                if (clientError) setClientError(null);
                setClientCode(next);
              }}
              length={6}
              disabled={clientLoading}
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] mt-auto disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={clientLoading}
          >
            {clientLoading ? "Verifying..." : "Verify & login"}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full h-12 rounded-xl dark:bg-transparent dark:text-white dark:border-gray-600 dark:hover:bg-gray-800"
            onClick={() => {
              setClientStep("phone");
              setClientCode("");
              setClientError(null);
              setClientInfo(null);
            }}
            disabled={clientLoading}
          >
            Back
          </Button>
        </form>
      )}
    </div>
  );
}

function SubmitButton({
  pendingText,
  text,
}: {
  pendingText: string;
  text: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] mt-auto disabled:opacity-70 disabled:cursor-not-allowed"
      disabled={pending}
    >
      {pending ? (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>{pendingText}</span>
        </div>
      ) : (
        text
      )}
    </Button>
  );
}

function OtpInput({
  id,
  name,
  value,
  onChange,
  length,
  disabled,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (nextValue: string) => void;
  length: number;
  disabled?: boolean;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const digits = useMemo(() => {
    const sanitized = (value || "").replace(/\D/g, "").slice(0, length);
    return Array.from({ length }, (_, i) => sanitized[i] ?? "");
  }, [value, length]);

  const setAtIndex = useCallback(
    (index: number, digit: string) => {
      const sanitized = (value || "").replace(/\D/g, "").slice(0, length);
      const next = sanitized.padEnd(length, " ").split("");
      next[index] = digit;
      const joined = next.join("").replace(/\s/g, "").slice(0, length);
      onChange(joined);
    },
    [length, onChange, value]
  );

  return (
    <div className="flex gap-2">
      {/* Hidden input so FormData('code') works normally */}
      <input type="hidden" id={id} name={name} value={digits.join("")} />

      {digits.map((digit, index) => (
        <Input
          key={index}
          aria-label={`Digit ${index + 1}`}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          disabled={disabled}
          value={digit}
          onChange={(e) => {
            const nextDigit = (e.target.value || "").replace(/\D/g, "");
            if (!nextDigit) {
              setAtIndex(index, "");
              return;
            }
            const single = nextDigit.slice(-1);
            setAtIndex(index, single);
            const nextEl = inputsRef.current[index + 1];
            if (nextEl) nextEl.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              if (digit) {
                setAtIndex(index, "");
                return;
              }
              const prevEl = inputsRef.current[index - 1];
              if (prevEl) {
                prevEl.focus();
                // Clear previous digit too
                setAtIndex(index - 1, "");
              }
            }

            if (e.key === "ArrowLeft") {
              const prevEl = inputsRef.current[index - 1];
              if (prevEl) prevEl.focus();
            }

            if (e.key === "ArrowRight") {
              const nextEl = inputsRef.current[index + 1];
              if (nextEl) nextEl.focus();
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            const pasted = (text || "").replace(/\D/g, "");
            if (!pasted) return;

            e.preventDefault();
            const chars = pasted.slice(0, length - index).split("");

            const sanitized = (value || "").replace(/\D/g, "").slice(0, length);
            const next = sanitized.padEnd(length, " ").split("");
            chars.forEach((ch, i) => {
              next[index + i] = ch;
            });
            const joined = next.join("").replace(/\s/g, "").slice(0, length);
            onChange(joined);

            const focusIndex = Math.min(index + chars.length, length - 1);
            const focusEl = inputsRef.current[focusIndex];
            if (focusEl) focusEl.focus();
          }}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          className="h-12 w-12 p-0 text-center text-base font-medium"
        />
      ))}
    </div>
  );
}

function RegisterForm({
  banner,
  clearBanner,
}: {
  banner:
    | { type: "error"; text: string }
    | { type: "message"; text: string }
    | null;
  clearBanner: () => void;
}) {
  const [registerFullName, setRegisterFullName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerValidationError, setRegisterValidationError] = useState<
    string | null
  >(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    clearBanner();
    const fullName = registerFullName;
    const email = registerEmail;
    const password = registerPassword;
    const newErrors: {
      full_name?: string;
      email?: string;
      password?: string;
    } = {};

    // Email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // Password regex: At least 8 chars, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,20}$/;

    if (!fullName || !fullName.trim()) {
      newErrors.full_name = "Full name is required";
    }

    if (!email || !email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password || !password.trim()) {
      newErrors.password = "Password is required";
    } else if (!passwordRegex.test(password)) {
      newErrors.password =
        "Password must be 8-20 characters and include uppercase, lowercase, and a number";
    }

    if (Object.keys(newErrors).length > 0) {
      e.preventDefault();
      const firstError =
        newErrors.full_name || newErrors.email || newErrors.password;
      setRegisterValidationError(firstError || "Please check your details");
    } else {
      setRegisterValidationError(null);
    }
  };

  return (
    <div className="space-y-5 flex-1 flex flex-col">
      {banner ? (
        banner.type === "error" ? (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-4 h-12">
            <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
              <XCircle className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm text-slate-700 dark:text-slate-200 break-words">
                {banner.text}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-slate-900/60 px-4 h-12">
            <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm text-slate-700 dark:text-slate-200 break-words">
                {banner.text}
              </div>
            </div>
          </div>
        )
      ) : null}

      {registerValidationError ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-4 h-12">
          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
            <XCircle className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-slate-700 dark:text-slate-200 break-words">
              {registerValidationError}
            </div>
          </div>
        </div>
      ) : null}

      <form
        action={signUpWithPassword}
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4 flex-1 flex flex-col"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="register_full_name"
              className="text-gray-700 dark:text-gray-200"
            >
              Full Name
            </Label>
            <Input
              id="register_full_name"
              name="full_name"
              type="text"
              placeholder="John Doe"
              autoComplete="name"
              value={registerFullName}
              onChange={(e) => {
                clearBanner();
                setRegisterFullName(e.target.value);
                if (registerValidationError) setRegisterValidationError(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="register_email"
              className="text-gray-700 dark:text-gray-200"
            >
              Email Address
            </Label>
            <Input
              id="register_email"
              name="email"
              type="email"
              placeholder="coach@example.com"
              autoComplete="email"
              value={registerEmail}
              onChange={(e) => {
                clearBanner();
                setRegisterEmail(e.target.value);
                if (registerValidationError) setRegisterValidationError(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="register_password"
              className="text-gray-700 dark:text-gray-200"
            >
              Password
            </Label>
            <Input
              id="register_password"
              name="password"
              type="password"
              placeholder=""
              autoComplete="new-password"
              value={registerPassword}
              onChange={(e) => {
                clearBanner();
                setRegisterPassword(e.target.value);
                if (registerValidationError) setRegisterValidationError(null);
              }}
            />
          </div>
        </div>

        <SubmitButton pendingText="Creating..." text="Continue" />
      </form>
    </div>
  );
}

// Google login removed
