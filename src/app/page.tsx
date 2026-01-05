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
// OTP-only auth (no passwords)

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
  }, [isAuthenticated, isLoadingAuth, nextPath, router, user]);

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

      <div className="relative min-h-screen flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-12 items-center">
          {/* Left Side - Branding */}
          <div className="flex flex-col items-center justify-center text-center space-y-0">
            <div className="relative">
              <img
                src="/logo.png"
                alt="Progrr Logo"
                className="relative w-24 h-24 sm:w-44 sm:h-44 lg:w-64 lg:h-64 object-contain drop-shadow-2xl"
              />
            </div>
            <div className="space-y-3 -mt-2 sm:space-y-4 sm:-mt-5 lg:-mt-8">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent pb-1 lg:pb-2">
                progrr
              </h1>
              <p className="text-sm sm:text-lg lg:text-xl text-gray-600 dark:text-gray-300 max-w-md">
                Transform your coaching business with intelligent client
                management
              </p>
              <div className="flex flex-nowrap sm:flex-wrap justify-center gap-1 sm:gap-3 lg:gap-4 pt-2 sm:pt-3 lg:pt-4">
                <div className="px-2 py-0.5 sm:px-4 sm:py-2 bg-white dark:bg-gray-800 rounded-full shadow-md">
                  <span className="text-[11px] sm:text-sm font-semibold leading-none text-purple-600 dark:text-purple-400 whitespace-nowrap">
                    📊 Track Progress
                  </span>
                </div>
                <div className="px-2 py-0.5 sm:px-4 sm:py-2 bg-white dark:bg-gray-800 rounded-full shadow-md">
                  <span className="text-[11px] sm:text-sm font-semibold leading-none text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                    💪 Build Plans
                  </span>
                </div>
                <div className="px-2 py-0.5 sm:px-4 sm:py-2 bg-white dark:bg-gray-800 rounded-full shadow-md">
                  <span className="text-[11px] sm:text-sm font-semibold leading-none text-purple-600 dark:text-purple-400 whitespace-nowrap">
                    🎯 Achieve Goals
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Auth Form */}
          <div className="w-full max-w-[360px] sm:max-w-md mx-auto">
            <Card className="backdrop-blur-lg bg-white/80 dark:bg-gray-800/80 shadow-2xl border-0 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600"></div>
              <CardContent className="pt-6 pb-5 px-5 sm:px-6 lg:pt-8 lg:pb-6 lg:px-8 h-[394px] overflow-y-auto sm:h-auto sm:min-h-[460px] sm:overflow-visible lg:min-h-[500px] flex flex-col">
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
                  <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl mb-4 lg:mb-6 h-10 lg:h-12">
                    <TabsTrigger
                      value="login"
                      className="rounded-lg h-8 lg:h-10 text-sm cursor-pointer data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all dark:text-gray-300 dark:data-[state=active]:text-white"
                    >
                      Login
                    </TabsTrigger>
                    <TabsTrigger
                      value="signup"
                      className="rounded-lg h-8 lg:h-10 text-sm cursor-pointer data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all dark:text-gray-300 dark:data-[state=active]:text-white"
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

            <p className="text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-4 sm:mt-6">
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
  const [adminStep, setAdminStep] = useState<"email" | "code">("email");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminInfo, setAdminInfo] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  const [clientStep, setClientStep] = useState<"email" | "code">("email");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [clientInfo, setClientInfo] = useState<string | null>(null);
  const [clientLoading, setClientLoading] = useState(false);

  useEffect(() => {
    // Clear the form completely when switching roles.
    clearBanner();
    setAdminStep("email");
    setAdminEmail("");
    setAdminCode("");
    setAdminError(null);
    setAdminInfo(null);
    setAdminLoading(false);

    setClientError(null);
    setClientInfo(null);
    setClientEmail("");
    setClientCode("");
    setClientStep("email");
    setClientLoading(false);
  }, [loginAs]);

  const handleAdminSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanner();
    setAdminError(null);
    setAdminInfo(null);

    const email = adminEmail.trim();
    if (!email) {
      setAdminError("Email is required");
      return;
    }

    setAdminLoading(true);
    try {
      const res = await fetch("/api/auth/admin/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, flow: "login" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAdminError(data?.error || `Failed to send code (${res.status})`);
        return;
      }

      setAdminInfo("Verification code sent to your email.");
      setAdminStep("code");
    } catch (err: any) {
      setAdminError(err?.message || "Failed to send code");
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanner();
    setAdminError(null);
    setAdminInfo(null);

    const email = adminEmail.trim();
    const code = adminCode.trim();
    if (!email) {
      setAdminError("Email is required");
      return;
    }
    if (!code) {
      setAdminError("Verification code is required");
      return;
    }

    setAdminLoading(true);
    try {
      const res = await fetch("/api/auth/admin/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAdminError(data?.error || `Failed to verify code (${res.status})`);
        return;
      }

      router.replace(nextPath || "/dashboard");
      router.refresh();
    } catch (err: any) {
      setAdminError(err?.message || "Failed to verify code");
    } finally {
      setAdminLoading(false);
    }
  };

  const handleClientSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanner();
    setClientError(null);
    setClientInfo(null);

    const email = clientEmail.trim();
    if (!email) {
      setClientError("Email is required");
      return;
    }

    setClientLoading(true);
    try {
      const res = await fetch("/api/auth/client/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.code === "CLIENT_BLOCKED") {
          setClientError(
            data?.error ||
              "Your account has been temporarily restricted. Please contact support or your administrator."
          );
          setClientStep("email");
          return;
        }
        setClientError(data?.error || `Failed to send code (${res.status})`);
        return;
      }

      await res.json().catch(() => ({}));
      setClientInfo("Verification code sent to your email.");
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

    const email = clientEmail.trim();
    const token = clientCode.trim();

    if (!email) {
      setClientError("Email is required");
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
        body: JSON.stringify({
          email,
          code: token,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.code === "CLIENT_BLOCKED") {
          setClientError(
            data?.error ||
              "Your account has been temporarily restricted. Please contact support or your administrator."
          );
          setClientStep("email");
          setClientCode("");
          return;
        }
        setClientError(data?.error || `Failed to verify code (${res.status})`);
        return;
      }

      const data = await res.json().catch(() => ({}));
      router.replace(nextPath || "/dashboard");
      router.refresh();
    } catch (err: any) {
      setClientError(err?.message || "Failed to verify code");
    } finally {
      setClientLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 flex-1 flex flex-col">
      {banner ? (
        banner.type === "error" ? (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12">
            <div className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
              <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
                {banner.text}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12">
            <div className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
                {banner.text}
              </div>
            </div>
          </div>
        )
      ) : null}

      {adminError ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12">
          <div className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
            <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
              {adminError}
            </div>
          </div>
        </div>
      ) : null}

      {adminInfo ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12">
          <div className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
              {adminInfo}
            </div>
          </div>
        </div>
      ) : null}

      {clientError ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12">
          <div className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
            <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
              {clientError}
            </div>
          </div>
        </div>
      ) : null}

      {clientInfo ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12">
          <div className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
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
          <TabsList className="grid w-full grid-cols-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-0 rounded-md h-7 sm:h-9">
            <TabsTrigger
              value="admin"
              className="rounded-md h-7 sm:h-9 text-xs sm:text-sm cursor-pointer text-gray-600 dark:text-gray-300 data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white transition-all"
            >
              Admin
            </TabsTrigger>
            <TabsTrigger
              value="client"
              className="rounded-md h-7 sm:h-9 text-xs sm:text-sm cursor-pointer text-gray-600 dark:text-gray-300 data-[state=active]:bg-gray-200 data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white transition-all"
            >
              Client
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loginAs === "admin" ? (
        adminStep === "email" ? (
          <form
            onSubmit={handleAdminSendCode}
            className="space-y-3 sm:space-y-4 flex-1 flex flex-col"
          >
            <div className="space-y-2">
              <Label
                htmlFor="admin_email"
                className="text-gray-700 dark:text-gray-200"
              >
                Email Address
              </Label>
              <Input
                id="admin_email"
                type="email"
                autoComplete="email"
                value={adminEmail}
                onChange={(e) => {
                  clearBanner();
                  if (adminError) setAdminError(null);
                  setAdminEmail(e.target.value);
                }}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 sm:h-11 lg:h-12 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] mt-auto disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={adminLoading}
            >
              {adminLoading ? "Sending..." : "Send email code"}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={handleAdminVerifyCode}
            className="space-y-3 sm:space-y-4 flex-1 flex flex-col"
          >
            <div className="space-y-2">
              <Label
                htmlFor="admin_email_confirm"
                className="text-gray-700 dark:text-gray-200"
              >
                Email Address
              </Label>
              <Input
                id="admin_email_confirm"
                type="email"
                autoComplete="email"
                value={adminEmail}
                onChange={(e) => {
                  clearBanner();
                  if (adminError) setAdminError(null);
                  setAdminEmail(e.target.value);
                }}
                disabled={adminLoading}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="admin_code"
                className="text-gray-700 dark:text-gray-200"
              >
                Verification Code
              </Label>
              <OtpInput
                id="admin_code"
                name="code"
                value={adminCode}
                onChange={(next) => {
                  clearBanner();
                  if (adminError) setAdminError(null);
                  setAdminCode(next);
                }}
                length={6}
                disabled={adminLoading}
              />
            </div>

            <div className="mt-auto space-y-2">
              <Button
                type="submit"
                className="w-full h-10 sm:h-11 lg:h-12 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={adminLoading}
              >
                {adminLoading ? "Verifying..." : "Verify & login"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 sm:h-11 lg:h-12 text-sm rounded-xl dark:bg-transparent dark:text-white dark:border-gray-600 dark:hover:bg-gray-800"
                onClick={handleAdminSendCode as any}
                disabled={adminLoading}
              >
                Resend code
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 sm:h-11 lg:h-12 text-sm rounded-xl dark:bg-transparent dark:text-white dark:border-gray-600 dark:hover:bg-gray-800"
                onClick={() => {
                  setAdminStep("email");
                  setAdminCode("");
                  setAdminError(null);
                  setAdminInfo(null);
                }}
                disabled={adminLoading}
              >
                Back
              </Button>
            </div>
          </form>
        )
      ) : clientStep === "email" ? (
        <form
          onSubmit={handleClientSendCode}
          className="space-y-3 sm:space-y-4 flex-1 flex flex-col"
        >
          <div className="space-y-2">
            <Label
              htmlFor="client_email"
              className="text-gray-700 dark:text-gray-200"
            >
              Email Address
            </Label>
            <Input
              id="client_email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={clientEmail}
              onChange={(e) => {
                clearBanner();
                if (clientError) setClientError(null);
                setClientEmail(e.target.value);
              }}
            />
          </div>

          <Button
            type="submit"
            className="w-full h-10 sm:h-11 lg:h-12 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] mt-auto disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={clientLoading}
          >
            {clientLoading ? "Sending..." : "Send email code"}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={handleClientVerifyCode}
          className="space-y-3 sm:space-y-4 flex-1 flex flex-col"
        >
          <div className="space-y-2">
            <Label
              htmlFor="client_email_confirm"
              className="text-gray-700 dark:text-gray-200"
            >
              Email Address
            </Label>
            <Input
              id="client_email_confirm"
              name="email"
              type="email"
              value={clientEmail}
              onChange={(e) => {
                clearBanner();
                if (clientError) setClientError(null);
                setClientEmail(e.target.value);
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

          <div className="mt-auto space-y-2">
            <Button
              type="submit"
              className="w-full h-10 sm:h-11 lg:h-12 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={clientLoading}
            >
              {clientLoading ? "Verifying..." : "Verify & login"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full h-10 sm:h-11 lg:h-12 text-sm rounded-xl dark:bg-transparent dark:text-white dark:border-gray-600 dark:hover:bg-gray-800"
              onClick={handleClientSendCode as any}
              disabled={clientLoading}
            >
              Resend code
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full h-10 sm:h-11 lg:h-12 text-sm rounded-xl dark:bg-transparent dark:text-white dark:border-gray-600 dark:hover:bg-gray-800"
              onClick={() => {
                setClientStep("email");
                setClientCode("");
                setClientError(null);
                setClientInfo(null);
              }}
              disabled={clientLoading}
            >
              Back
            </Button>
          </div>
        </form>
      )}
    </div>
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
  const didAutoFocusRef = useRef(false);

  const digits = useMemo(() => {
    const sanitized = (value || "").replace(/\D/g, "").slice(0, length);
    return Array.from({ length }, (_, i) => sanitized[i] ?? "");
  }, [value, length]);

  useEffect(() => {
    if (didAutoFocusRef.current) return;
    if (disabled) return;

    const sanitized = (value || "").replace(/\D/g, "").slice(0, length);
    if (sanitized.length > 0) return;

    const first = inputsRef.current[0];
    if (!first) return;

    didAutoFocusRef.current = true;
    requestAnimationFrame(() => {
      try {
        first.focus();
      } catch {
        // ignore
      }
    });
  }, [disabled, length, value]);

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
          className="h-10 w-10 sm:h-12 sm:w-12 p-0 text-center text-sm sm:text-base font-medium"
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
  const [registerStep, setRegisterStep] = useState<"details" | "code">(
    "details"
  );
  const [registerCode, setRegisterCode] = useState("");
  const [registerInfo, setRegisterInfo] = useState<string | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerValidationError, setRegisterValidationError] = useState<
    string | null
  >(null);

  const validateDetails = () => {
    clearBanner();
    const fullName = registerFullName;
    const email = registerEmail;
    const newErrors: {
      full_name?: string;
      email?: string;
    } = {};

    // Email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!fullName || !fullName.trim()) {
      newErrors.full_name = "Full name is required";
    }

    if (!email || !email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (Object.keys(newErrors).length > 0) {
      const firstError = newErrors.full_name || newErrors.email;
      setRegisterValidationError(firstError || "Please check your details");
      return false;
    }

    setRegisterValidationError(null);
    return true;
  };

  const handleSendSignupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterInfo(null);

    // Validate full name + email before sending code.
    const ok = validateDetails();
    if (!ok) return;

    setRegisterLoading(true);
    try {
      const res = await fetch("/api/auth/admin/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registerEmail, flow: "signup" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRegisterValidationError(
          data?.error || `Failed to send code (${res.status})`
        );
        return;
      }

      setRegisterInfo("Verification code sent to your email.");
      setRegisterStep("code");
    } catch (err: any) {
      setRegisterValidationError(err?.message || "Failed to send code");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleVerifySignupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanner();
    setRegisterValidationError(null);
    setRegisterInfo(null);

    const email = registerEmail.trim();
    const code = registerCode.trim();

    if (!email) {
      setRegisterValidationError("Email is required");
      return;
    }
    if (!code) {
      setRegisterValidationError("Verification code is required");
      return;
    }

    setRegisterLoading(true);
    try {
      const res = await fetch("/api/auth/admin/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          full_name: registerFullName,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setRegisterValidationError(
          data?.error || `Failed to verify code (${res.status})`
        );
        return;
      }

      window.location.href = "/dashboard";
    } catch (err: any) {
      setRegisterValidationError(err?.message || "Failed to verify code");
    } finally {
      setRegisterLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 flex-1 flex flex-col">
      {banner ? (
        banner.type === "error" ? (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12">
            <div className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
              <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
                {banner.text}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12">
            <div className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
                {banner.text}
              </div>
            </div>
          </div>
        )
      ) : null}

      {registerValidationError ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12">
          <div className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
            <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
              {registerValidationError}
            </div>
          </div>
        </div>
      ) : null}

      {registerInfo ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12">
          <div className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
              {registerInfo}
            </div>
          </div>
        </div>
      ) : null}

      <form
        onSubmit={
          registerStep === "details"
            ? handleSendSignupCode
            : handleVerifySignupCode
        }
        noValidate
        className="space-y-3 sm:space-y-4 flex-1 flex flex-col"
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

          {registerStep === "code" ? (
            <div className="space-y-2">
              <Label
                htmlFor="register_code"
                className="text-gray-700 dark:text-gray-200"
              >
                Verification Code
              </Label>
              <OtpInput
                id="register_code"
                name="code"
                value={registerCode}
                onChange={(next) => {
                  clearBanner();
                  if (registerValidationError) setRegisterValidationError(null);
                  setRegisterCode(next);
                }}
                length={6}
                disabled={registerLoading}
              />
            </div>
          ) : null}
        </div>

        {registerStep === "details" ? (
          <Button
            type="submit"
            className="w-full h-10 sm:h-11 lg:h-12 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] mt-auto disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={registerLoading}
          >
            {registerLoading ? "Sending..." : "Send email code"}
          </Button>
        ) : (
          <div className="mt-auto space-y-2">
            <Button
              type="submit"
              className="w-full h-10 sm:h-11 lg:h-12 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={registerLoading}
            >
              {registerLoading ? "Verifying..." : "Verify & create account"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full h-10 sm:h-11 lg:h-12 text-sm rounded-xl dark:bg-transparent dark:text-white dark:border-gray-600 dark:hover:bg-gray-800"
              onClick={handleSendSignupCode as any}
              disabled={registerLoading}
            >
              Resend code
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full h-10 sm:h-11 lg:h-12 text-sm rounded-xl dark:bg-transparent dark:text-white dark:border-gray-600 dark:hover:bg-gray-800"
              onClick={() => {
                setRegisterStep("details");
                setRegisterCode("");
                setRegisterInfo(null);
                setRegisterValidationError(null);
              }}
              disabled={registerLoading}
            >
              Back
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

// Google login removed
