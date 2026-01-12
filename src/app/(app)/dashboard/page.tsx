"use client";

import React from "react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
    const { user } = useAuth();

    const onboardingCompleted = Boolean((user as any)?.onboardingCompleted);
    const businessId = String((user as any)?.id ?? "").trim();
    const publicUrl =
        typeof window !== "undefined" && onboardingCompleted && businessId
            ? `${window.location.origin}/b/${encodeURIComponent(businessId)}`
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
