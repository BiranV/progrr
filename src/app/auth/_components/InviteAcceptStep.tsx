"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthBanner, { type AuthBannerState } from "./AuthBanner";

type InviteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; email: string; name?: string }
  | { status: "submitting"; email: string; name?: string }
  | { status: "success" }
  | { status: "error"; message: string };

function isStrongPassword(password: string): boolean {
  const p = String(password || "");
  if (p.length < 8) return false;
  return true;
}

export default function InviteAcceptStep({
  token,
  nextPath,
  onGoToLogin,
}: {
  token: string;
  nextPath: string;
  onGoToLogin: () => void;
}) {
  const router = useRouter();

  const [state, setState] = React.useState<InviteState>(() =>
    token ? { status: "loading" } : { status: "idle" }
  );

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [banner, setBanner] = React.useState<AuthBannerState>(null);

  React.useEffect(() => {
    if (!token) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setBanner(null);
        setState({ status: "loading" });
        const res = await fetch(
          `/api/invites/validate?token=${encodeURIComponent(token)}`,
          { method: "GET" }
        );

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || `Failed to validate (${res.status})`);
        }

        if (cancelled) return;
        const email = String(data?.email ?? "").trim();
        const name =
          typeof data?.name === "string" && String(data.name).trim()
            ? String(data.name).trim()
            : undefined;
        setState({ status: "ready", email, name });
      } catch (e: any) {
        if (cancelled) return;
        setState({ status: "error", message: e?.message || "Invalid invite" });
        setBanner({ type: "error", text: e?.message || "Invalid invite" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const current = state;
    if (current.status !== "ready") return;

    setBanner(null);

    if (!password) {
      setBanner({ type: "error", text: "Password is required" });
      return;
    }
    if (!isStrongPassword(password)) {
      setBanner({
        type: "error",
        text: "Password must be at least 8 characters",
      });
      return;
    }
    if (password !== confirm) {
      setBanner({ type: "error", text: "Passwords do not match" });
      return;
    }

    setState({
      status: "submitting",
      email: current.email,
      name: current.name,
    });

    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Failed to accept (${res.status})`);
      }

      setState({ status: "success" });
      router.replace(nextPath || "/dashboard");
      router.refresh();
    } catch (e: any) {
      setState({ status: "ready", email: current.email, name: current.name });
      setBanner({
        type: "error",
        text: e?.message || "Failed to accept invite",
      });
    }
  };

  if (state.status === "idle") {
    return (
      <div className="space-y-4">
        <AuthBanner banner={{ type: "error", text: "Missing invite token" }} />
        <Button
          variant="outline"
          className="w-full bg-white/70 dark:bg-gray-900/40"
          onClick={onGoToLogin}
        >
          Go to Login
        </Button>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 py-2">
          <Loader2
            className="h-6 w-6 animate-spin text-gray-600 dark:text-gray-300"
            aria-label="Validating invitation"
          />
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
            Please wait while we validate your invitation.
          </p>
        </div>
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
          Redirecting…
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <AuthBanner banner={banner} />
        <Button
          variant="outline"
          className="w-full bg-white/70 dark:bg-gray-900/40"
          onClick={onGoToLogin}
        >
          Go to Login
        </Button>
      </div>
    );
  }

  const email = state.email;
  const name = state.name;
  const isSubmitting = state.status === "submitting";

  return (
    <div className="space-y-4">
      <AuthBanner banner={banner} />

      <div className="space-y-1">
        {name ? (
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {name}
          </div>
        ) : null}
        <div className="text-xs text-gray-500 dark:text-gray-400">Email</div>
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {email}
        </div>
      </div>

      <form className="space-y-4" noValidate onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="invite_password">
            Password <span className="text-gray-900 dark:text-gray-100">*</span>
          </Label>
          <Input
            id="invite_password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite_password_confirm">
            Confirm password{" "}
            <span className="text-gray-900 dark:text-gray-100">*</span>
          </Label>
          <Input
            id="invite_password_confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <Button
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Confirming..." : "Confirm account"}
        </Button>
      </form>

      <Button
        variant="outline"
        className="w-full bg-white/70 dark:bg-gray-900/40"
        onClick={onGoToLogin}
        disabled={isSubmitting}
      >
        Go to Login
      </Button>
    </div>
  );
}
