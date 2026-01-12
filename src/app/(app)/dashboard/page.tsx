"use client";

import React from "react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
    const { user, updateUser } = useAuth();

    React.useEffect(() => {
        let cancelled = false;

        const loadOnboarding = async () => {
            if (!user) return;
            if ((user as any)?.onboarding?.business?.slug) return;
            if (!Boolean((user as any)?.onboardingCompleted)) return;

            try {
                const res = await fetch("/api/onboarding", { method: "GET" });
                if (!res.ok) return;
                const data = await res.json().catch(() => null);
                if (cancelled) return;
                if (data && typeof data === "object") {
                    updateUser({
                        onboardingCompleted: Boolean((data as any).onboardingCompleted),
                        onboarding: (data as any).onboarding ?? {},
                    });
                }
            } catch {
                // Ignore and fall back to showing the onboarding message.
            }
        };

        loadOnboarding();
        return () => {
            cancelled = true;
        };
    }, [updateUser, user]);

    const slug = String((user as any)?.onboarding?.business?.slug ?? "").trim();
    const publicUrl = typeof window !== "undefined" && slug
        ? `${window.location.origin}/b/${encodeURIComponent(slug)}`
        : "";

    const copy = async () => {
        if (!publicUrl) return;
        try {
            await navigator.clipboard.writeText(publicUrl);
            toast.success("Booking link copied");
        } catch {
            toast.error("Failed to copy");
        }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Dashboard
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Share your booking link with customers.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Public booking link</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Input
                        readOnly
                        value={publicUrl || "Complete onboarding to generate your link."}
                    />
                    <Button onClick={copy} disabled={!publicUrl}>
                        Share booking link
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
