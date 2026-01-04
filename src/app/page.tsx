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
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFlow, setAdminFlow] = useState<
    "login" | "reset_request" | "reset_verify"
  >("login");
  const [adminResetCode, setAdminResetCode] = useState("");
  const [adminResetNewPassword, setAdminResetNewPassword] = useState("");
  const [adminResetInfo, setAdminResetInfo] = useState<string | null>(null);
  const [adminResetError, setAdminResetError] = useState<string | null>(null);
  const [adminResetLoading, setAdminResetLoading] = useState(false);

  const [clientMethod, setClientMethod] = useState<"code" | "password">("code");
  const [clientStep, setClientStep] = useState<"email" | "code">("email");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [clientNeedsPassword, setClientNeedsPassword] = useState(false);
  const [clientPasswordLogin, setClientPasswordLogin] = useState("");

  const [clientResetFlow, setClientResetFlow] = useState<
    "none" | "reset_request" | "reset_verify"
  >("none");
  const [clientResetCode, setClientResetCode] = useState("");
  const [clientResetNewPassword, setClientResetNewPassword] = useState("");
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
    setAdminFlow("login");
    setAdminResetCode("");
    setAdminResetNewPassword("");
    setAdminResetInfo(null);
    setAdminResetError(null);
    setAdminResetLoading(false);

    setClientError(null);
    setClientInfo(null);
    setClientEmail("");
    setClientCode("");
    setClientPassword("");
    setClientNeedsPassword(false);
    setClientPasswordLogin("");
    setClientMethod("code");
    setClientStep("email");
    setClientLoading(false);
    setClientResetFlow("none");
    setClientResetCode("");
    setClientResetNewPassword("");

    setAdminValidationError(null);
  }, [loginAs]);

  const handleAdminSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanner();
    setAdminResetError(null);
    setAdminResetInfo(null);

    const email = adminEmail.trim();
    if (!email) {
      setAdminResetError("Email is required");
      return;
    }

    setAdminResetLoading(true);
    try {
      const res = await fetch("/api/auth/password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: "admin" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAdminResetError(
          data?.error || `Failed to send code (${res.status})`
        );
        return;
      }

      setAdminResetInfo("Password reset code sent to your email.");
      setAdminFlow("reset_verify");
    } catch (err: any) {
      setAdminResetError(err?.message || "Failed to send code");
    } finally {
      setAdminResetLoading(false);
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanner();
    setAdminResetError(null);
    setAdminResetInfo(null);

    const email = adminEmail.trim();
    const code = adminResetCode.trim();
    const password = adminResetNewPassword;

    if (!email) {
      setAdminResetError("Email is required");
      return;
    }
    if (!code) {
      setAdminResetError("Verification code is required");
      return;
    }
    if (!password) {
      setAdminResetError("New password is required");
      return;
    }

    setAdminResetLoading(true);
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: "admin", code, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAdminResetError(
          data?.error || `Failed to reset password (${res.status})`
        );
        return;
      }

      setAdminResetInfo("Password updated. You can log in now.");
      setAdminFlow("login");
      setAdminPassword("");
      setAdminResetCode("");
      setAdminResetNewPassword("");
    } catch (err: any) {
      setAdminResetError(err?.message || "Failed to reset password");
    } finally {
      setAdminResetLoading(false);
    }
  };

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
          ...(clientPassword ? { password: clientPassword } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409 && data?.requiresPassword) {
          setClientNeedsPassword(true);
        }
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

  const handleClientPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanner();
    setClientError(null);
    setClientInfo(null);

    const email = clientEmail.trim();
    const password = clientPasswordLogin;
    if (!email) {
      setClientError("Email is required");
      return;
    }
    if (!password) {
      setClientError("Password is required");
      return;
    }

    setClientLoading(true);
    try {
      const res = await fetch("/api/auth/client/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setClientError(data?.error || `Login failed (${res.status})`);
        return;
      }

      router.replace(nextPath || "/dashboard");
      router.refresh();
    } catch (err: any) {
      setClientError(err?.message || "Login failed");
    } finally {
      setClientLoading(false);
    }
  };

  const handleClientSendResetCode = async (e: React.FormEvent) => {
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
      const res = await fetch("/api/auth/password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: "client" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setClientError(data?.error || `Failed to send code (${res.status})`);
        return;
      }

      setClientInfo("Password reset code sent to your email.");
      setClientResetFlow("reset_verify");
    } catch (err: any) {
      setClientError(err?.message || "Failed to send code");
    } finally {
      setClientLoading(false);
    }
  };

  const handleClientResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearBanner();
    setClientError(null);
    setClientInfo(null);

    const email = clientEmail.trim();
    const code = clientResetCode.trim();
    const password = clientResetNewPassword;
    if (!email) {
      setClientError("Email is required");
      return;
    }
    if (!code) {
      setClientError("Verification code is required");
      return;
    }
    if (!password) {
      setClientError("New password is required");
      return;
    }

    setClientLoading(true);
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: "client", code, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setClientError(
          data?.error || `Failed to reset password (${res.status})`
        );
        return;
      }

      setClientInfo("Password updated. You can log in now.");
      setClientResetFlow("none");
      setClientMethod("password");
      setClientPasswordLogin("");
      setClientResetCode("");
      setClientResetNewPassword("");
    } catch (err: any) {
      setClientError(err?.message || "Failed to reset password");
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

      {adminValidationError ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12">
          <div className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
            <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
              {adminValidationError}
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
        adminFlow === "login" ? (
          <form
            action={signInWithPassword}
            onSubmit={handleSubmit}
            noValidate
            className="space-y-3 sm:space-y-4 flex-1 flex flex-col"
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

            <div className="flex justify-end">
              <Button
                type="button"
                variant="link"
                className="px-0 h-auto text-xs"
                onClick={() => {
                  setAdminFlow("reset_request");
                  setAdminResetError(null);
                  setAdminResetInfo(null);
                }}
              >
                Forgot password?
              </Button>
            </div>

            <SubmitButton
              pendingText="Signing in..."
              text="Login to your account"
            />
          </form>
        ) : adminFlow === "reset_request" ? (
          <form
            onSubmit={handleAdminSendResetCode}
            className="space-y-3 sm:space-y-4 flex-1 flex flex-col"
          >
            {adminResetError ? (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12">
                <div className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
                  <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
                    {adminResetError}
                  </div>
                </div>
              </div>
            ) : null}

            {adminResetInfo ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12">
                <div className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
                    {adminResetInfo}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label
                htmlFor="admin_reset_email"
                className="text-gray-700 dark:text-gray-200"
              >
                Email Address
              </Label>
              <Input
                id="admin_reset_email"
                type="email"
                autoComplete="email"
                value={adminEmail}
                onChange={(e) => {
                  clearBanner();
                  setAdminResetError(null);
                  setAdminEmail(e.target.value);
                }}
              />
            </div>

            <div className="mt-auto space-y-2">
              <Button
                type="submit"
                className="w-full h-10 sm:h-11 lg:h-12 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={adminResetLoading}
              >
                {adminResetLoading ? "Sending..." : "Send reset code"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 sm:h-11 lg:h-12 text-sm rounded-xl dark:bg-transparent dark:text-white dark:border-gray-600 dark:hover:bg-gray-800"
                onClick={() => {
                  setAdminFlow("login");
                  setAdminResetCode("");
                  setAdminResetNewPassword("");
                  setAdminResetInfo(null);
                  setAdminResetError(null);
                }}
                disabled={adminResetLoading}
              >
                Back
              </Button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleAdminResetPassword}
            className="space-y-3 sm:space-y-4 flex-1 flex flex-col"
          >
            {adminResetError ? (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12">
                <div className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-300">
                  <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
                    {adminResetError}
                  </div>
                </div>
              </div>
            ) : null}

            {adminResetInfo ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-slate-900/60 px-3 sm:px-4 h-10 sm:h-12">
                <div className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 break-words">
                    {adminResetInfo}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label
                htmlFor="admin_reset_email_confirm"
                className="text-gray-700 dark:text-gray-200"
              >
                Email Address
              </Label>
              <Input
                id="admin_reset_email_confirm"
                type="email"
                autoComplete="email"
                value={adminEmail}
                onChange={(e) => {
                  clearBanner();
                  setAdminResetError(null);
                  setAdminEmail(e.target.value);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="admin_reset_code"
                className="text-gray-700 dark:text-gray-200"
              >
                Verification Code
              </Label>
              <OtpInput
                id="admin_reset_code"
                name="code"
                value={adminResetCode}
                onChange={(next) => {
                  clearBanner();
                  setAdminResetError(null);
                  setAdminResetCode(next);
                }}
                length={6}
                disabled={adminResetLoading}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="admin_reset_new_password"
                className="text-gray-700 dark:text-gray-200"
              >
                New Password
              </Label>
              <Input
                id="admin_reset_new_password"
                type="password"
                autoComplete="new-password"
                value={adminResetNewPassword}
                onChange={(e) => {
                  clearBanner();
                  setAdminResetError(null);
                  setAdminResetNewPassword(e.target.value);
                }}
              />
            </div>

            <div className="mt-auto space-y-2">
              <Button
                type="submit"
                className="w-full h-10 sm:h-11 lg:h-12 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={adminResetLoading}
              >
                {adminResetLoading ? "Resetting..." : "Reset password"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 sm:h-11 lg:h-12 text-sm rounded-xl dark:bg-transparent dark:text-white dark:border-gray-600 dark:hover:bg-gray-800"
                onClick={handleAdminSendResetCode as any}
                disabled={adminResetLoading}
              >
                Resend code
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 sm:h-11 lg:h-12 text-sm rounded-xl dark:bg-transparent dark:text-white dark:border-gray-600 dark:hover:bg-gray-800"
                onClick={() => {
                  setAdminFlow("login");
                  setAdminResetCode("");
                  setAdminResetNewPassword("");
                  setAdminResetInfo(null);
                  setAdminResetError(null);
                }}
                disabled={adminResetLoading}
              >
                Back
              </Button>
            </div>
          </form>
        )
      ) : clientResetFlow !== "none" ? (
        clientResetFlow === "reset_request" ? (
          <form
            onSubmit={handleClientSendResetCode}
            className="space-y-3 sm:space-y-4 flex-1 flex flex-col"
          >
            <div className="space-y-2">
              <Label
                htmlFor="client_reset_email"
                className="text-gray-700 dark:text-gray-200"
              >
                Email Address
              </Label>
              <Input
                id="client_reset_email"
                type="email"
                autoComplete="email"
                value={clientEmail}
                onChange={(e) => {
                  clearBanner();
                  if (clientError) setClientError(null);
                  setClientEmail(e.target.value);
                }}
              />
            </div>

            <div className="mt-auto space-y-2">
              <Button
                type="submit"
                className="w-full h-10 sm:h-11 lg:h-12 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={clientLoading}
              >
                {clientLoading ? "Sending..." : "Send reset code"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 sm:h-11 lg:h-12 text-sm rounded-xl dark:bg-transparent dark:text-white dark:border-gray-600 dark:hover:bg-gray-800"
                onClick={() => setClientResetFlow("none")}
                disabled={clientLoading}
              >
                Back
              </Button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleClientResetPassword}
            className="space-y-3 sm:space-y-4 flex-1 flex flex-col"
          >
            <div className="space-y-2">
              <Label
                htmlFor="client_reset_code"
                className="text-gray-700 dark:text-gray-200"
              >
                Verification Code
              </Label>
              <OtpInput
                id="client_reset_code"
                name="code"
                value={clientResetCode}
                onChange={(next) => {
                  clearBanner();
                  if (clientError) setClientError(null);
                  setClientResetCode(next);
                }}
                length={6}
                disabled={clientLoading}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="client_reset_new_password"
                className="text-gray-700 dark:text-gray-200"
              >
                New Password
              </Label>
              <Input
                id="client_reset_new_password"
                type="password"
                autoComplete="new-password"
                value={clientResetNewPassword}
                onChange={(e) => {
                  clearBanner();
                  if (clientError) setClientError(null);
                  setClientResetNewPassword(e.target.value);
                }}
              />
            </div>

            <div className="mt-auto space-y-2">
              <Button
                type="submit"
                className="w-full h-10 sm:h-11 lg:h-12 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={clientLoading}
              >
                {clientLoading ? "Resetting..." : "Reset password"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 sm:h-11 lg:h-12 text-sm rounded-xl dark:bg-transparent dark:text-white dark:border-gray-600 dark:hover:bg-gray-800"
                onClick={handleClientSendResetCode as any}
                disabled={clientLoading}
              >
                Resend code
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full h-10 sm:h-11 lg:h-12 text-sm rounded-xl dark:bg-transparent dark:text-white dark:border-gray-600 dark:hover:bg-gray-800"
                onClick={() => setClientResetFlow("none")}
                disabled={clientLoading}
              >
                Back
              </Button>
            </div>
          </form>
        )
      ) : clientMethod === "password" ? (
        <form
          onSubmit={handleClientPasswordLogin}
          className="space-y-3 sm:space-y-4 flex-1 flex flex-col"
        >
          <div className="space-y-2">
            <Label
              htmlFor="client_password_email"
              className="text-gray-700 dark:text-gray-200"
            >
              Email Address
            </Label>
            <Input
              id="client_password_email"
              type="email"
              autoComplete="email"
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
              htmlFor="client_password"
              className="text-gray-700 dark:text-gray-200"
            >
              Password
            </Label>
            <Input
              id="client_password"
              type="password"
              autoComplete="current-password"
              value={clientPasswordLogin}
              onChange={(e) => {
                clearBanner();
                if (clientError) setClientError(null);
                setClientPasswordLogin(e.target.value);
              }}
            />
          </div>

          <div className="flex justify-between">
            <Button
              type="button"
              variant="link"
              className="px-0 h-auto text-xs"
              onClick={() => {
                setClientMethod("code");
                setClientStep("email");
                setClientPasswordLogin("");
                setClientError(null);
                setClientInfo(null);
              }}
            >
              Use email code
            </Button>

            <Button
              type="button"
              variant="link"
              className="px-0 h-auto text-xs"
              onClick={() => {
                setClientResetFlow("reset_request");
                setClientError(null);
                setClientInfo(null);
              }}
            >
              Forgot password?
            </Button>
          </div>

          <Button
            type="submit"
            className="w-full h-10 sm:h-11 lg:h-12 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] mt-auto disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={clientLoading}
          >
            {clientLoading ? "Signing in..." : "Login"}
          </Button>
        </form>
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

          <div className="flex justify-end">
            <Button
              type="button"
              variant="link"
              className="px-0 h-auto text-xs"
              onClick={() => {
                setClientMethod("password");
                setClientError(null);
                setClientInfo(null);
              }}
            >
              Use password instead
            </Button>
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

          {clientNeedsPassword ? (
            <div className="space-y-2">
              <Label
                htmlFor="client_set_password"
                className="text-gray-700 dark:text-gray-200"
              >
                Set Password
              </Label>
              <Input
                id="client_set_password"
                type="password"
                autoComplete="new-password"
                value={clientPassword}
                onChange={(e) => {
                  clearBanner();
                  if (clientError) setClientError(null);
                  setClientPassword(e.target.value);
                }}
                disabled={clientLoading}
              />
            </div>
          ) : null}

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
      className="w-full h-10 sm:h-11 lg:h-12 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] mt-auto disabled:opacity-70 disabled:cursor-not-allowed"
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
  const [registerPassword, setRegisterPassword] = useState("");
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
      const firstError =
        newErrors.full_name || newErrors.email || newErrors.password;
      setRegisterValidationError(firstError || "Please check your details");
      return false;
    }

    setRegisterValidationError(null);
    return true;
  };

  const handleSendSignupCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterInfo(null);

    // Validate full name + email + password before sending code.
    // (Password will only be stored after OTP verification.)
    const ok = validateDetails();
    if (!ok) return;

    setRegisterLoading(true);
    try {
      const res = await fetch("/api/auth/admin/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registerEmail }),
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
    const password = registerPassword;

    if (!email) {
      setRegisterValidationError("Email is required");
      return;
    }
    if (!code) {
      setRegisterValidationError("Verification code is required");
      return;
    }
    if (!password) {
      setRegisterValidationError("Password is required");
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
          password,
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
