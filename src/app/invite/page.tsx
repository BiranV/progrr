"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { activateUserAction } from "@/app/actions/user-activation";

export default function InvitePage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const codeProcessed = useRef(false);

  useEffect(() => {
    if (codeProcessed.current) return;
    codeProcessed.current = true;

    const run = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        // Supabase email links can arrive as token_hash (newer) or token (older /auth/v1/verify).
        const tokenHash =
          url.searchParams.get("token_hash") ?? url.searchParams.get("token");
        const type = url.searchParams.get("type");

        // If Supabase redirected with an auth error, surface it immediately.
        const hashParams = new URLSearchParams(
          typeof window !== "undefined" && window.location.hash
            ? window.location.hash.replace(/^#/, "")
            : ""
        );
        const hashError = hashParams.get("error");
        const hashErrorDescription =
          hashParams.get("error_description") ||
          hashParams.get("error_description");
        const queryError = url.searchParams.get("error");
        const queryErrorDescription = url.searchParams.get("error_description");

        if (hashError || queryError) {
          const message =
            hashErrorDescription ||
            queryErrorDescription ||
            hashError ||
            queryError ||
            "Invalid or expired link";
          toast.error(decodeURIComponent(message));
        }

        // 1) PKCE auth-code flow (rare for invite links, but handle it)
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(
            code
          );
          if (error) {
            console.error("Error exchanging code:", error);
            toast.error("Invalid or expired invite link: " + error.message);
          } else if (data.session) {
            setSession(data.session);
            window.history.replaceState({}, "", "/invite");
          }
          setCheckingSession(false);
          return;
        }

        // 2) Email links (invite/recovery) often arrive as token_hash + type
        if (tokenHash && type) {
          const { data, error } = await supabase.auth.verifyOtp({
            type: type as any,
            token_hash: tokenHash,
          });

          if (error) {
            console.error("Error verifying OTP:", error);
            toast.error("Invalid or expired invite link: " + error.message);
          } else if (data.session) {
            setSession(data.session);
            window.history.replaceState({}, "", "/invite");
          }
          setCheckingSession(false);
          return;
        }

        // 3) Supabase verify endpoint commonly redirects with tokens in the hash
        // e.g. /invite#access_token=...&refresh_token=...&type=recovery
        // Some clients/environments don't expose getSessionFromUrl(), so we parse
        // and set the session explicitly.
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("Error setting session from hash:", error);
            toast.error("Invalid or expired invite link: " + error.message);
          } else if (data.session) {
            setSession(data.session);
            window.history.replaceState({}, "", "/invite");
            setCheckingSession(false);
            return;
          }
        }

        // 3a) Some environments place tokens in the query (rare, but handle it)
        const queryAccessToken = url.searchParams.get("access_token");
        const queryRefreshToken = url.searchParams.get("refresh_token");
        if (queryAccessToken && queryRefreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: queryAccessToken,
            refresh_token: queryRefreshToken,
          });

          if (error) {
            console.error("Error setting session from query:", error);
            toast.error("Invalid or expired invite link: " + error.message);
          } else if (data.session) {
            setSession(data.session);
            window.history.replaceState({}, "", "/invite");
            setCheckingSession(false);
            return;
          }
        }

        // 3b) Optional helper when available (supabase-js v2)
        // @ts-expect-error - may exist depending on auth client
        if (typeof supabase.auth.getSessionFromUrl === "function") {
          // @ts-expect-error - available in supabase-js v2
          const { data, error } = await supabase.auth.getSessionFromUrl({
            storeSession: true,
          });
          if (error) {
            console.error("Error getting session from URL:", error);
          } else if (data?.session) {
            setSession(data.session);
            window.history.replaceState({}, "", "/invite");
            setCheckingSession(false);
            return;
          }
        }

        // 4) Finally, check any existing session
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
      } catch (error: any) {
        console.error("Invite init failed:", error);
        toast.error(error?.message || "Failed to open invite link");
      } finally {
        setCheckingSession(false);
      }
    };

    void run();

    // Keep session updated after initial processing
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || session) {
        setSession(session);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
        data: {
          role: "CLIENT",
        },
      });

      if (error) throw error;

      // Activate user in DB
      await activateUserAction();

      toast.success("Password set successfully! Redirecting...");

      // Redirect into the app
      router.replace("/dashboard");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to set password");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-600">
              Invalid or Expired Link
            </CardTitle>
            <CardDescription className="text-red-700">
              This invite link is invalid or has expired. Please ask your admin
              to send a new invite.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Welcome to Progrr
          </CardTitle>
          <CardDescription className="text-center">
            Please set a secure password to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                minLength={6}
                className="h-11"
              />
              <p className="text-xs text-gray-500">
                Must be at least 6 characters long
              </p>
            </div>
            <Button
              type="submit"
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting Password...
                </>
              ) : (
                "Set Password & Login"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
