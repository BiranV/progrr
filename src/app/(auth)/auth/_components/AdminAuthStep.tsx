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
        // Intentionally do not redirect here.
        // Auth redirects are handled server-side (middleware / server page), and
        // OTP verify handlers navigate to the correct destination.
    }, []);

    const [tab, setTab] = useState<"login" | "signup">("login");

    const [loginStep, setLoginStep] = useState<"email" | "code">("email");
    const [loginEmail, setLoginEmail] = useState("");
    const [loginCode, setLoginCode] = useState("");
    const [loginError, setLoginError] = useState<string | null>(null);
    const [loginInfo, setLoginInfo] = useState<string | null>(null);
    const [loginLoading, setLoginLoading] = useState(false);

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

            const dest = typeof data?.redirectTo === "string"
                ? data.redirectTo
                : (data?.onboardingCompleted ? "/dashboard" : "/onboarding");

            router.replace(dest);
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

            const dest = typeof data?.redirectTo === "string"
                ? data.redirectTo
                : (data?.onboardingCompleted ? "/dashboard" : "/onboarding");

            router.replace(dest);
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
                onValueChange={(v) => setTab(v as "login" | "signup")}
            >
                <TabsList className="grid grid-cols-2 rounded-xl border border-gray-200/70 dark:border-gray-700/60 bg-white/60 dark:bg-gray-900/30 p-1">
                    <TabsTrigger
                        value="login"
                        className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
                    >
                        Login
                    </TabsTrigger>
                    <TabsTrigger
                        value="signup"
                        className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
                    >
                        Create account
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-4">
                    {loginStep === "email" ? (
                        <form onSubmit={handleSendLoginOtp} className="space-y-4">
                            {loginError ? (
                                <AuthBanner banner={{ type: "error", text: loginError }} />
                            ) : null}
                            {loginInfo ? (
                                <AuthBanner banner={{ type: "message", text: loginInfo }} />
                            ) : null}

                            <div className="space-y-2">
                                <Label htmlFor="loginEmail">Email *</Label>
                                <Input
                                    id="loginEmail"
                                    type="email"
                                    autoComplete="email"
                                    value={loginEmail}
                                    onChange={(e) => setLoginEmail(e.target.value)}
                                    placeholder="you@company.com"
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700"
                                disabled={loginLoading}
                            >
                                {loginLoading ? "Sending…" : "Send code"}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyLoginOtp} className="space-y-4">
                            {loginError ? (
                                <AuthBanner banner={{ type: "error", text: loginError }} />
                            ) : null}
                            {loginInfo ? (
                                <AuthBanner banner={{ type: "message", text: loginInfo }} />
                            ) : null}

                            <div className="space-y-2">
                                <Label htmlFor="loginCode">Verification code *</Label>
                                <OtpInput
                                    id="loginCode"
                                    name="loginCode"
                                    value={loginCode}
                                    onChange={setLoginCode}
                                    length={6}
                                    disabled={loginLoading}
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    disabled={loginLoading}
                                    onClick={() => {
                                        setLoginCode("");
                                        setLoginStep("email");
                                    }}
                                >
                                    Edit email
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700"
                                    disabled={loginLoading}
                                >
                                    {loginLoading ? "Verifying…" : "Verify"}
                                </Button>
                            </div>
                        </form>
                    )}
                </TabsContent>

                <TabsContent value="signup" className="space-y-4">
                    {signupStep === "details" ? (
                        <form onSubmit={handleSendSignupOtp} className="space-y-4">
                            {signupError ? (
                                <AuthBanner banner={{ type: "error", text: signupError }} />
                            ) : null}
                            {signupInfo ? (
                                <AuthBanner banner={{ type: "message", text: signupInfo }} />
                            ) : null}

                            <div className="space-y-2">
                                <Label htmlFor="signupFullName">Full name *</Label>
                                <Input
                                    id="signupFullName"
                                    value={signupFullName}
                                    onChange={(e) => setSignupFullName(e.target.value)}
                                    placeholder="First Last"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="signupEmail">Email *</Label>
                                <Input
                                    id="signupEmail"
                                    type="email"
                                    autoComplete="email"
                                    value={signupEmail}
                                    onChange={(e) => setSignupEmail(e.target.value)}
                                    placeholder="you@company.com"
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700"
                                disabled={signupLoading}
                            >
                                {signupLoading ? "Sending…" : "Send code"}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifySignupOtp} className="space-y-4">
                            {signupError ? (
                                <AuthBanner banner={{ type: "error", text: signupError }} />
                            ) : null}
                            {signupInfo ? (
                                <AuthBanner banner={{ type: "message", text: signupInfo }} />
                            ) : null}

                            <div className="space-y-2">
                                <Label htmlFor="signupCode">Verification code *</Label>
                                <OtpInput
                                    id="signupCode"
                                    name="signupCode"
                                    value={signupCode}
                                    onChange={setSignupCode}
                                    length={6}
                                    disabled={signupLoading}
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    disabled={signupLoading}
                                    onClick={() => {
                                        setSignupCode("");
                                        setSignupStep("details");
                                    }}
                                >
                                    Edit details
                                </Button>
                                <Button
                                    type="submit"
                                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700"
                                    disabled={signupLoading}
                                >
                                    {signupLoading ? "Verifying…" : "Verify"}
                                </Button>
                            </div>
                        </form>
                    )}

                    <div className="pt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                        By creating an account, you agree to our{" "}
                        <Link href="#" className="underline">
                            Terms
                        </Link>
                        {" "}and{" "}
                        <Link href="#" className="underline">
                            Privacy Policy
                        </Link>
                        .
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
