"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";

export default function InvitePage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const email = params.get("email") || "";
  const code = params.get("code") || "";

  const [status, setStatus] = useState<
    "idle" | "verifying" | "success" | "error"
  >(email && code ? "verifying" : "idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email || !code) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/client/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `Failed to verify (${res.status})`);
        }

        if (cancelled) return;
        setStatus("success");
        window.location.href = "/dashboard";
      } catch (e: any) {
        if (cancelled) return;
        setStatus("error");
        setError(e?.message || "Invalid or expired link");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email, code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            {status === "verifying" ? "Verifying invite..." : "Client invite"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === "idle" ? (
            <p className="text-sm text-gray-600">
              This invite link is missing required information. Please return to
              the login page and request a new email code.
            </p>
          ) : status === "verifying" ? (
            <p className="text-sm text-gray-600">
              Please wait while we verify your email code.
            </p>
          ) : status === "error" ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <p className="text-sm text-gray-600">Redirecting…</p>
          )}
          <Button
            className="w-full"
            onClick={() => (window.location.href = "/")}
          >
            Go to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
