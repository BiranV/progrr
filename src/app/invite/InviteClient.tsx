"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";

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
      } catch (e: any) {
        if (cancelled) return;
        setStatus("error");
        setError(e?.message || "Invalid or expired link");
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

      setStatus("ready");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Failed to send code");
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            {status === "loading"
              ? "Loading invitation..."
              : status === "verifying"
              ? "Verifying..."
              : "Accept invitation"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === "idle" ? (
            <p className="text-sm text-gray-600">
              This invite link is missing required information.
            </p>
          ) : status === "loading" ? (
            <p className="text-sm text-gray-600">
              Please wait while we validate your invitation.
            </p>
          ) : status === "error" ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : status === "success" ? (
            <p className="text-sm text-gray-600">Redirecting…</p>
          ) : (
            <div className="space-y-3 text-left">
              <div>
                <div className="text-xs text-gray-500 mb-1">Email</div>
                <div className="text-sm font-medium text-gray-900">{email}</div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={status === "sending"}
                  onClick={() => void sendCode()}
                >
                  {status === "sending" ? "Sending..." : "Send code"}
                </Button>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">
                  Verification code
                </div>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  placeholder="Enter the 6-digit code"
                />
              </div>

              <Button
                className="w-full"
                disabled={status === "verifying" || !String(code).trim()}
                onClick={() => void verify()}
              >
                {status === "verifying" ? "Verifying..." : "Verify & Continue"}
              </Button>
            </div>
          )}
          <Button
            className="w-full"
            onClick={() => (window.location.href = "/auth")}
          >
            Go to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
