"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import AuthBanner, { type AuthBannerState } from "./AuthBanner";
import OtpInput from "./OtpInput";

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export default function ClientAuthStep({
  nextPath,
  onBack,
}: {
  nextPath: string;
  onBack: () => void;
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
      router.replace(nextPath || "/dashboard");
    }
  }, [isAuthenticated, isLoadingAuth, nextPath, router]);

  // OTP login
  const [otpStep, setOtpStep] = useState<"email" | "code">("email");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpInfo, setOtpInfo] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setOtpInfo(null);

    const normalized = otpEmail.trim();
    if (!normalized) {
      setOtpError("Email is required");
      return;
    }
    if (!isValidEmail(normalized)) {
      setOtpError("Please enter a valid email address");
      return;
    }

    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/client/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          setOtpError(
            "Clients can only log in after being invited by a coach. Please ask your coach to send you an invitation link."
          );
          setOtpStep("email");
          return;
        }

        if (data?.code === "CLIENT_BLOCKED") {
          setOtpError(
            data?.error ||
              "Your account is not connected to any coach. Please ask your coach to send you an invitation link."
          );
          setOtpStep("email");
          return;
        }

        setOtpError(data?.error || `Failed to send code (${res.status})`);
        return;
      }

      setOtpInfo("Verification code sent to your email.");
      setOtpStep("code");
    } catch (err: any) {
      setOtpError(err?.message || "Failed to send code");
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setOtpInfo(null);

    const normalized = otpEmail.trim();
    const otp = otpCode.trim();

    if (!normalized) {
      setOtpError("Email is required");
      return;
    }
    if (!isValidEmail(normalized)) {
      setOtpError("Please enter a valid email address");
      return;
    }
    if (!otp) {
      setOtpError("Verification code is required");
      return;
    }

    setOtpLoading(true);
    try {
      const res = await fetch("/api/auth/client/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, code: otp }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          setOtpError(
            "Clients can only log in after being invited by a coach. Please ask your coach to send you an invitation link."
          );
          setOtpStep("email");
          setOtpCode("");
          return;
        }

        if (data?.code === "CLIENT_BLOCKED") {
          setOtpError(
            data?.error ||
              "Your account is not connected to any coach. Please ask your coach to send you an invitation link."
          );
          setOtpStep("email");
          setOtpCode("");
          return;
        }

        setOtpError(data?.error || `Failed to verify code (${res.status})`);
        return;
      }

      router.replace(nextPath || "/dashboard");
      router.refresh();
    } catch (err: any) {
      setOtpError(err?.message || "Failed to verify code");
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm">
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300">
        Clients can only log in after being invited by a coach.
      </p>

      <AuthBanner banner={banner} />

      <AuthBanner
        banner={
          otpError
            ? { type: "error", text: otpError }
            : otpInfo
            ? { type: "message", text: otpInfo }
            : null
        }
      />

      <form
        className="space-y-4"
        noValidate
        onSubmit={otpStep === "email" ? sendCode : verifyCode}
      >
        <div className="space-y-2">
          <Label htmlFor="client_email">
            Email <span className="text-gray-900 dark:text-gray-100">*</span>
          </Label>
          <Input
            id="client_email"
            type="email"
            autoComplete="email"
            value={otpEmail}
            onChange={(e) => setOtpEmail(e.target.value)}
            disabled={otpLoading || otpStep === "code"}
          />
        </div>

        {otpStep === "code" ? (
          <div className="space-y-2">
            <Label htmlFor="client_code">
              Email code{" "}
              <span className="text-gray-900 dark:text-gray-100">*</span>
            </Label>
            <OtpInput
              id="client_code"
              name="client_code"
              length={6}
              value={otpCode}
              onChange={setOtpCode}
              disabled={otpLoading}
            />
          </div>
        ) : null}

        <Button
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
          type="submit"
          disabled={otpLoading}
        >
          {otpStep === "email"
            ? otpLoading
              ? "Sending..."
              : "Send email code"
            : otpLoading
            ? "Verifying..."
            : "Verify & Continue"}
        </Button>

        {otpStep === "code" ? (
          <Button
            type="button"
            variant="outline"
            className="w-full bg-white/70 dark:bg-gray-900/40"
            disabled={otpLoading}
            onClick={() => {
              setOtpStep("email");
              setOtpCode("");
              setOtpError(null);
              setOtpInfo(null);
            }}
          >
            Use a different email
          </Button>
        ) : null}
      </form>
    </div>
  );
}
