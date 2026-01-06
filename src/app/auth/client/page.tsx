"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

import AuthShell from "../_components/AuthShell";
import AuthBanner, { type AuthBannerState } from "../_components/AuthBanner";
import OtpInput from "../_components/OtpInput";

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export default function ClientAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoadingAuth } = useAuth();

  const nextPath = searchParams.get("next") || "";

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
      router.replace(nextPath || "/dashboard");
    }
  }, [isAuthenticated, isLoadingAuth, nextPath, router]);

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const normalized = email.trim();
    if (!normalized) {
      setError("Email is required");
      return;
    }
    if (!isValidEmail(normalized)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/client/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          setError(
            "Clients can only log in after being invited by a coach. Please ask your coach to send you an invitation link."
          );
          setStep("email");
          return;
        }

        if (data?.code === "CLIENT_BLOCKED") {
          setError(
            data?.error ||
              "Your account is not connected to any coach. Please ask your coach to send you an invitation link."
          );
          setStep("email");
          return;
        }

        setError(data?.error || `Failed to send code (${res.status})`);
        return;
      }

      setInfo("Verification code sent to your email.");
      setStep("code");
    } catch (err: any) {
      setError(err?.message || "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const normalized = email.trim();
    const otp = code.trim();

    if (!normalized) {
      setError("Email is required");
      return;
    }
    if (!isValidEmail(normalized)) {
      setError("Please enter a valid email address");
      return;
    }
    if (!otp) {
      setError("Verification code is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/client/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, code: otp }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          setError(
            "Clients can only log in after being invited by a coach. Please ask your coach to send you an invitation link."
          );
          setStep("email");
          setCode("");
          return;
        }

        if (data?.code === "CLIENT_BLOCKED") {
          setError(
            data?.error ||
              "Your account is not connected to any coach. Please ask your coach to send you an invitation link."
          );
          setStep("email");
          setCode("");
          return;
        }

        setError(data?.error || `Failed to verify code (${res.status})`);
        return;
      }

      router.replace(nextPath || "/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to verify code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <Card className="relative w-full border-0 overflow-hidden shadow-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-600 to-indigo-600" />
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-bold">Client Login</CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Invite-only access
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            <Link
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              href={
                nextPath
                  ? `/auth?next=${encodeURIComponent(nextPath)}`
                  : "/auth"
              }
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300">
            Clients can only log in after being invited by a coach.
          </p>

          <AuthBanner banner={banner} />

          <AuthBanner
            banner={
              error
                ? { type: "error", text: error }
                : info
                ? { type: "message", text: info }
                : null
            }
          />

          <form
            className="space-y-4"
            noValidate
            onSubmit={step === "email" ? sendCode : verifyCode}
          >
            <div className="space-y-2">
              <Label htmlFor="client_email">
                Email{" "}
                <span className="text-gray-900 dark:text-gray-100">*</span>
              </Label>
              <Input
                id="client_email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || step === "code"}
              />
            </div>

            {step === "code" ? (
              <div className="space-y-2">
                <Label htmlFor="client_code">
                  Email code{" "}
                  <span className="text-gray-900 dark:text-gray-100">*</span>
                </Label>
                <OtpInput
                  id="client_code"
                  name="client_code"
                  length={6}
                  value={code}
                  onChange={setCode}
                  disabled={loading}
                />
              </div>
            ) : null}

            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
              type="submit"
              disabled={loading}
            >
              {step === "email"
                ? loading
                  ? "Sending..."
                  : "Send email code"
                : loading
                ? "Verifying..."
                : "Verify & Continue"}
            </Button>

            {step === "code" ? (
              <Button
                type="button"
                variant="outline"
                className="w-full bg-white/70 dark:bg-gray-900/40"
                disabled={loading}
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                  setInfo(null);
                }}
              >
                Use a different email
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
