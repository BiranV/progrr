"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import AuthShell from "../auth/_components/AuthShell";
import AuthBanner from "../auth/_components/AuthBanner";
import OtpInput from "../auth/_components/OtpInput";

export default function InviteClient({
  token: tokenFromPath,
}: {
  token?: string;
}) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = tokenFromPath || params.get("token") || "";

  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "sending" | "verifying" | "success" | "error"
  >(token ? "loading" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [hasRequestedCode, setHasRequestedCode] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/invites/validate?token=${encodeURIComponent(token)}`,
          { method: "GET" }
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `Failed to verify (${res.status})`);
        }

        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setEmail(String(data?.email ?? ""));
        setStatus("ready");
        setCode("");
        setHasRequestedCode(false);
      } catch (e: any) {
        if (cancelled) return;
        setStatus("error");
        setError(e?.message || "Invalid or expired link");
        setHasRequestedCode(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const sendCode = async () => {
    setError(null);
    setStatus("sending");
    try {
      const res = await fetch("/api/invites/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Failed to send (${res.status})`);
      }

      setHasRequestedCode(true);
      setStatus("ready");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Failed to send code");
      setHasRequestedCode(false);
    }
  };

  const verify = async () => {
    setError(null);
    setStatus("verifying");
    try {
      const res = await fetch("/api/invites/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Failed to verify (${res.status})`);
      }

      setStatus("success");
      window.location.href = "/dashboard";
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Invalid code");
    }
  };

  return (
    <AuthShell>
      <Card className="relative w-full border-0 overflow-hidden shadow-2xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-600 to-indigo-600" />
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            {status === "loading"
              ? "Loading invitation..."
              : status === "verifying"
              ? "Verifying..."
              : "Accept invitation"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <AuthBanner
            banner={
              error
                ? { type: "error", text: error }
                : status === "verifying"
                ? { type: "message", text: "Verifying code..." }
                : null
            }
          />

          {status === "idle" ? (
            <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
              This invite link is missing required information.
            </p>
          ) : status === "loading" ? (
            <div className="flex flex-col items-center justify-center gap-3 py-2">
              <Loader2
                className="h-6 w-6 animate-spin text-gray-600 dark:text-gray-300"
                aria-label="Validating invitation"
              />
              <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                Please wait while we validate your invitation.
              </p>
            </div>
          ) : status === "success" ? (
            <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
              Redirecting…
            </p>
          ) : status === "error" ? (
            <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
              Please review the error above.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Email
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {email}
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full bg-white/70 dark:bg-gray-900/40"
                disabled={status === "sending"}
                onClick={() => void sendCode()}
              >
                {status === "sending" ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </span>
                ) : (
                  "Send code"
                )}
              </Button>

              {hasRequestedCode ? (
                <>
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Verification code
                    </div>
                    <OtpInput
                      id="invite_code"
                      name="invite_code"
                      length={6}
                      value={code}
                      onChange={setCode}
                      disabled={status === "verifying"}
                    />
                  </div>

                  <Button
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
                    disabled={status === "verifying" || !String(code).trim()}
                    onClick={() => void verify()}
                  >
                    {status === "verifying"
                      ? "Verifying..."
                      : "Verify & Continue"}
                  </Button>
                </>
              ) : null}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full bg-white/70 dark:bg-gray-900/40"
            onClick={() => (window.location.href = "/auth")}
          >
            Go to Login
          </Button>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
