"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import AuthBanner, { type AuthBannerState } from "./AuthBanner";
import OtpInput from "./OtpInput";

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidFullName = (fullName: string) => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);

  if (parts.length < 2) return false;
  return parts.every((p) => /^\p{L}+$/u.test(p));
};

export default function AdminAuthStep({
  nextPath,
}: {
  nextPath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoadingAuth } = useAuth();

  const banner = useMemo<AuthBannerState>(() => {
    const authError = searchParams.get("authError");
    const authMessage = searchParams.get("authMessage");
    if (authError) return { type: "error", text: authError };
    if (authMessage) return { type: "message", text: authMessage };
    return null;
  }, [searchParams]);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (isAuthenticated) {
      router.replace("/onboarding");
    }
  }, [isAuthenticated, isLoadingAuth, nextPath, router]);

  const [tab, setTab] = useState<"login" | "signup">("login");

  // Login
  const [loginStep, setLoginStep] = useState<"email" | "code">("email");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginInfo, setLoginInfo] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup
  const [signupStep, setSignupStep] = useState<"details" | "code">("details");
  const [signupFullName, setSignupFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupInfo, setSignupInfo] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);

  const resetAll = () => {
    setLoginStep("email");
    setLoginEmail("");
    setLoginCode("");
    setLoginError(null);
    setLoginInfo(null);
    setLoginLoading(false);

    setSignupStep("details");
    setSignupFullName("");
    setSignupEmail("");
    setSignupCode("");
    setSignupError(null);
    setSignupInfo(null);
    setSignupLoading(false);
  };

  useEffect(() => {
    resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleSendLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginInfo(null);

    const email = loginEmail.trim();
    if (!email) {
      setLoginError("Email is required");
      return;
    }
    if (!isValidEmail(email)) {
      setLoginError("Please enter a valid email address");
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, flow: "login" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoginError(data?.error || `Failed to send code (${res.status})`);
        return;
      }

      setLoginInfo("Verification code sent to your email.");
      setLoginStep("code");
    } catch (err: any) {
      setLoginError(err?.message || "Failed to send code");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginInfo(null);

    const email = loginEmail.trim();
    const code = loginCode.trim();
    if (!email) {
      setLoginError("Email is required");
      return;
    }
    if (!isValidEmail(email)) {
      setLoginError("Please enter a valid email address");
      return;
    }
    if (!code) {
      setLoginError("Verification code is required");
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoginError(data?.error || `Failed to verify code (${res.status})`);
        return;
      }

      router.replace("/onboarding");
      router.refresh();
    } catch (err: any) {
      setLoginError(err?.message || "Failed to verify code");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSendSignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    setSignupInfo(null);

    const fullName = signupFullName.trim();
    const email = signupEmail.trim();
    if (!fullName) {
      setSignupError("Full name is required");
      return;
    }
    if (!isValidFullName(fullName)) {
      setSignupError("Please enter your first and last name");
      return;
    }
    if (!email) {
      setSignupError("Email is required");
      return;
    }
    if (!isValidEmail(email)) {
      setSignupError("Please enter a valid email address");
      return;
    }

    setSignupLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, flow: "signup" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSignupError(data?.error || `Failed to send code (${res.status})`);
        return;
      }

      setSignupInfo("Verification code sent to your email.");
      setSignupStep("code");
    } catch (err: any) {
      setSignupError(err?.message || "Failed to send code");
    } finally {
      setSignupLoading(false);
    }
  };

  const handleVerifySignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    setSignupInfo(null);

    const email = signupEmail.trim();
    const code = signupCode.trim();
    const fullName = signupFullName.trim();

    if (!fullName) {
      setSignupError("Full name is required");
      return;
    }
    if (!isValidFullName(fullName)) {
      setSignupError("Please enter your first and last name");
      return;
    }
    if (!email) {
      setSignupError("Email is required");
      return;
    }
    if (!isValidEmail(email)) {
      setSignupError("Please enter a valid email address");
      return;
    }
    if (!code) {
      setSignupError("Verification code is required");
      return;
    }

    setSignupLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, full_name: fullName }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSignupError(data?.error || `Failed to verify code (${res.status})`);
        return;
      }

      router.replace("/onboarding");
      router.refresh();
    } catch (err: any) {
      setSignupError(err?.message || "Failed to verify code");
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <AuthBanner banner={banner} />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v === "signup" ? "signup" : "login")}
      >
        <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <TabsTrigger
            value="login"
            className="rounded-md data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
          >
            Login
          </TabsTrigger>
          <TabsTrigger
            value="signup"
            className="rounded-md data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
          >
            Register
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="space-y-4">
          <AuthBanner
            banner={
              loginError
                ? { type: "error", text: loginError }
                : loginInfo
                  ? { type: "message", text: loginInfo }
                  : null
            }
          />

          <form
            className="space-y-4"
            noValidate
            onSubmit={
              loginStep === "email" ? handleSendLoginOtp : handleVerifyLoginOtp
            }
          >
            <div className="space-y-2">
              <Label htmlFor="admin_login_email">
                Email{" "}
                <span className="text-gray-900 dark:text-gray-100">*</span>
              </Label>
              <Input
                id="admin_login_email"
                type="email"
                autoComplete="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                disabled={loginLoading || loginStep === "code"}
              />
            </div>

            {loginStep === "code" ? (
              <div className="space-y-2">
                <Label htmlFor="admin_login_code">
                  Email code{" "}
                  <span className="text-gray-900 dark:text-gray-100">*</span>
                </Label>
                <OtpInput
                  id="admin_login_code"
                  name="admin_login_code"
                  length={6}
                  value={loginCode}
                  onChange={setLoginCode}
                  disabled={loginLoading}
                />
              </div>
            ) : null}

            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
              type="submit"
              disabled={loginLoading}
            >
              {loginStep === "email"
                ? loginLoading
                  ? "Sending..."
                  : "Send email code"
                : loginLoading
                  ? "Verifying..."
                  : "Verify & Continue"}
            </Button>

            {loginStep === "code" ? (
              <Button
                type="button"
                variant="outline"
                className="w-full bg-white/70 dark:bg-gray-900/40"
                disabled={loginLoading}
                onClick={() => {
                  setLoginStep("email");
                  setLoginCode("");
                  setLoginError(null);
                  setLoginInfo(null);
                }}
              >
                Use a different email
              </Button>
            ) : null}
          </form>
        </TabsContent>

        <TabsContent value="signup" className="space-y-4">
          <AuthBanner
            banner={
              signupError
                ? { type: "error", text: signupError }
                : signupInfo
                  ? { type: "message", text: signupInfo }
                  : null
            }
          />

          <form
            className="space-y-4"
            noValidate
            onSubmit={
              signupStep === "details"
                ? handleSendSignupOtp
                : handleVerifySignupOtp
            }
          >
            <div className="space-y-2">
              <Label htmlFor="admin_signup_name">
                Full name{" "}
                <span className="text-gray-900 dark:text-gray-100">*</span>
              </Label>
              <Input
                id="admin_signup_name"
                autoComplete="name"
                value={signupFullName}
                onChange={(e) => setSignupFullName(e.target.value)}
                disabled={signupLoading || signupStep === "code"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin_signup_email">
                Email{" "}
                <span className="text-gray-900 dark:text-gray-100">*</span>
              </Label>
              <Input
                id="admin_signup_email"
                type="email"
                autoComplete="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                disabled={signupLoading || signupStep === "code"}
              />
            </div>

            {signupStep === "code" ? (
              <div className="space-y-2">
                <Label htmlFor="admin_signup_code">
                  Email code{" "}
                  <span className="text-gray-900 dark:text-gray-100">*</span>
                </Label>
                <OtpInput
                  id="admin_signup_code"
                  name="admin_signup_code"
                  length={6}
                  value={signupCode}
                  onChange={setSignupCode}
                  disabled={signupLoading}
                />
              </div>
            ) : null}

            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
              type="submit"
              disabled={signupLoading}
            >
              {signupStep === "details"
                ? signupLoading
                  ? "Sending..."
                  : "Send email code"
                : signupLoading
                  ? "Verifying..."
                  : "Verify & Create Account"}
            </Button>

            {signupStep === "code" ? (
              <Button
                type="button"
                variant="outline"
                className="w-full bg-white/70 dark:bg-gray-900/40"
                disabled={signupLoading}
                onClick={() => {
                  setSignupStep("details");
                  setSignupCode("");
                  setSignupError(null);
                  setSignupInfo(null);
                }}
              >
                Edit details
              </Button>
            ) : null}
          </form>
        </TabsContent>
      </Tabs>

      {/* Keep a real anchor for accessibility; it won't be used for step navigation */}
      {nextPath ? (
        <div className="hidden">
          <Link href={`/auth?next=${encodeURIComponent(nextPath)}`}>Auth</Link>
        </div>
      ) : null}
    </div>
  );
}
