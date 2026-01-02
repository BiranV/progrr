"use client";

import { useEffect, useState, useRef } from "react";
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
    // Check for code in URL (PKCE flow)
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      if (codeProcessed.current) return; // Prevent double execution
      codeProcessed.current = true;

      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          console.error("Error exchanging code:", error);
          toast.error("Invalid or expired invite link: " + error.message);
          setCheckingSession(false); // Stop loading so user sees the error
        } else if (data.session) {
          setSession(data.session);
          setCheckingSession(false);
          // Clean URL
          window.history.replaceState({}, "", "/invite");
        }
      });
    }

    // Check for initial session (handled by Supabase from URL hash)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // If no session yet, wait for onAuthStateChange which fires when hash is processed
      if (session) setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || session) {
        setSession(session);
        setCheckingSession(false);
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setCheckingSession(false);
      }
    });

    // Fallback: if after 2 seconds we still don't have a session and no hash, stop loading
    const timer = setTimeout(() => {
      setCheckingSession(false);
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
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
      });

      if (error) throw error;

      // Activate user in DB
      await activateUserAction();

      toast.success("Password set successfully! Redirecting...");

      // Force a refresh/redirect to dashboard
      router.push("/dashboard");
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
