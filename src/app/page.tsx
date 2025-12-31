"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signInWithPassword,
  signUpWithPassword,
} from "@/app/actions/supabase-auth";
import { useFormStatus } from "react-dom";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const authErrorFromUrl = searchParams.get("authError");
  const authMessageFromUrl = searchParams.get("authMessage");

  const nextPath = searchParams.get("next");
  const [tab, setTab] = useState<"login" | "signup">("login");
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
    if (authErrorFromUrl) {
      setBanner({ type: "error", text: authErrorFromUrl });
    } else if (authMessageFromUrl) {
      setBanner({ type: "message", text: authMessageFromUrl });
    }

    // Important: remove banner params so refresh doesn't re-show the same message.
    clearAuthBannersFromUrl();
  }, [
    authErrorFromUrl,
    authMessageFromUrl,
    clearAuthBannersFromUrl,
    urlHasBanner,
  ]);

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) {
      router.replace(nextPath || "/dashboard");
    }
  }, [isAuthenticated, isLoadingAuth, nextPath, router]);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="text-lg text-gray-600 font-medium animate-pulse">
            Loading Progrr...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* Animated Background Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Branding */}
          <div className="hidden lg:flex flex-col items-center justify-center text-center space-y-0">
            <div className="relative">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69538c86530afecdd4f04cee/9d28c112f_ChatGPTImageDec30202506_28_18PM-Photoroom.png"
                alt="Progrr Logo"
                className="relative w-64 h-64 object-contain drop-shadow-2xl"
              />
            </div>
            <div className="space-y-4 -mt-8">
              <h1 className="text-6xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent pb-2">
                progrr
              </h1>
              <p className="text-xl text-gray-600 max-w-md">
                Transform your coaching business with intelligent client
                management
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-4">
                <div className="px-4 py-2 bg-white rounded-full shadow-md">
                  <span className="text-sm font-semibold text-purple-600">
                    📊 Track Progress
                  </span>
                </div>
                <div className="px-4 py-2 bg-white rounded-full shadow-md">
                  <span className="text-sm font-semibold text-indigo-600">
                    💪 Build Plans
                  </span>
                </div>
                <div className="px-4 py-2 bg-white rounded-full shadow-md">
                  <span className="text-sm font-semibold text-purple-600">
                    🎯 Achieve Goals
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Auth Form */}
          <div className="w-full max-w-md mx-auto">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69538c86530afecdd4f04cee/9d28c112f_ChatGPTImageDec30202506_28_18PM-Photoroom.png"
                alt="Progrr Logo"
                className="w-32 h-32 mx-auto object-contain mb-4"
              />
              <h1 className="text-4xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                Progrr
              </h1>
              <p className="text-gray-600">Your coaching companion</p>
            </div>

            <Card className="backdrop-blur-lg bg-white/80 shadow-2xl border-0 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600"></div>
              <CardContent className="pt-8 pb-6 px-8 min-h-[500px] flex flex-col">
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
                  <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 rounded-xl mb-6 h-12">
                    <TabsTrigger
                      value="login"
                      className="rounded-lg h-10 cursor-pointer data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all"
                    >
                      Login
                    </TabsTrigger>
                    <TabsTrigger
                      value="signup"
                      className="rounded-lg h-10 cursor-pointer data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all"
                    >
                      Sign up
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="flex-1 flex flex-col">
                    <LoginForm banner={banner} />
                  </TabsContent>

                  <TabsContent value="signup" className="flex-1 flex flex-col">
                    <RegisterForm banner={banner} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <p className="text-center text-sm text-gray-500 mt-6">
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
}: {
  banner:
    | { type: "error"; text: string }
    | { type: "message"; text: string }
    | null;
}) {
  return (
    <div className="space-y-5 flex-1 flex flex-col">
      {banner ? (
        <div
          className={
            banner.type === "error"
              ? "text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3"
              : "text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3"
          }
        >
          {banner.text}
        </div>
      ) : null}

      <form
        action={signInWithPassword}
        className="space-y-4 flex-1 flex flex-col"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login_email" className="text-gray-700">
              Email Address
            </Label>
            <Input
              id="login_email"
              name="email"
              type="email"
              placeholder="coach@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login_password" className="text-gray-700">
              Password
            </Label>
            <Input
              id="login_password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        <SubmitButton
          pendingText="Signing in..."
          text="Login to your account"
        />

        <div className="pt-2">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <div className="text-xs text-gray-500">OR CONTINUE WITH</div>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-12 rounded-xl mt-4"
            disabled
          >
            <span className="flex items-center justify-center gap-2">
              <GoogleBadge />
              <span>Google</span>
            </span>
          </Button>
        </div>
      </form>
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
      className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] mt-auto disabled:opacity-70 disabled:cursor-not-allowed"
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

function RegisterForm({
  banner,
}: {
  banner:
    | { type: "error"; text: string }
    | { type: "message"; text: string }
    | null;
}) {
  return (
    <div className="space-y-5 flex-1 flex flex-col">
      {banner ? (
        <div
          className={
            banner.type === "error"
              ? "text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3"
              : "text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3"
          }
        >
          {banner.text}
        </div>
      ) : null}

      <form
        action={signUpWithPassword}
        className="space-y-4 flex-1 flex flex-col"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="register_full_name" className="text-gray-700">
              Full Name
            </Label>
            <Input
              id="register_full_name"
              name="full_name"
              type="text"
              placeholder="John Doe"
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register_email" className="text-gray-700">
              Email Address
            </Label>
            <Input
              id="register_email"
              name="email"
              type="email"
              placeholder="coach@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="register_password" className="text-gray-700">
              Password
            </Label>
            <Input
              id="register_password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>
        </div>

        <SubmitButton pendingText="Creating..." text="Continue" />
      </form>
    </div>
  );
}

function GoogleBadge() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white text-[11px] font-semibold text-gray-600"
    >
      G
    </span>
  );
}
