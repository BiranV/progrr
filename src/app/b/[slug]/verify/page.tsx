"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BookingDraft = {
    businessSlug: string;
    serviceId: string;
    date: string;
    startTime: string;
    customerFullName: string;
    customerPhone: string;
    notes?: string;
};

const DRAFT_KEY = "progrr.bookingDraft.v1";
const RESULT_KEY = "progrr.bookingResult.v1";

export default function PublicVerifyPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const { slug } = React.use(params);
    const normalizedSlug = String(slug ?? "").trim();

    const phone = String(searchParams.get("phone") ?? "").trim();

    const [code, setCode] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const loadDraft = (): BookingDraft | null => {
        try {
            const raw = sessionStorage.getItem(DRAFT_KEY);
            if (!raw) return null;
            return JSON.parse(raw) as BookingDraft;
        } catch {
            return null;
        }
    };

    React.useEffect(() => {
        const draft = loadDraft();
        if (!draft) {
            router.replace(`/b/${encodeURIComponent(normalizedSlug)}`);
            return;
        }

        if (!phone) {
            router.replace(
                `/b/${encodeURIComponent(
                    normalizedSlug
                )}/details?serviceId=${encodeURIComponent(
                    draft.serviceId
                )}&date=${encodeURIComponent(
                    draft.date
                )}&time=${encodeURIComponent(draft.startTime)}`
            );
            return;
        }
    }, [phone, router, normalizedSlug]);

    const verifyAndConfirm = async () => {
        setSubmitting(true);
        setError(null);

        try {
            const draft = loadDraft();
            if (!draft) throw new Error("Missing booking details");

            const verifyRes = await fetch("/api/public/booking/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, code }),
            });

            const verifyJson = await verifyRes.json().catch(() => null);
            if (!verifyRes.ok)
                throw new Error(
                    verifyJson?.error || `Request failed (${verifyRes.status})`
                );

            const bookingSessionId = String(
                verifyJson?.bookingSessionId ?? ""
            ).trim();
            if (!bookingSessionId) throw new Error("Verification failed");

            const confirmRes = await fetch("/api/public/booking/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...draft, bookingSessionId }),
            });

            const confirmJson = await confirmRes.json().catch(() => null);
            if (!confirmRes.ok)
                throw new Error(
                    confirmJson?.error || `Request failed (${confirmRes.status})`
                );

            sessionStorage.setItem(RESULT_KEY, JSON.stringify(confirmJson));
            sessionStorage.removeItem(DRAFT_KEY);

            router.replace(`/b/${encodeURIComponent(normalizedSlug)}/success`);
        } catch (e: any) {
            setError(e?.message || "Failed");
        } finally {
            setSubmitting(false);
        }
    };

    const resend = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/public/booking/request-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone }),
            });

            const json = await res.json().catch(() => null);
            if (!res.ok)
                throw new Error(json?.error || `Request failed (${res.status})`);
        } catch (e: any) {
            setError(e?.message || "Failed");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-10">
            <div className="mx-auto w-full max-w-3xl space-y-6">
                <Card>
                    <CardHeader className="space-y-1">
                        <CardTitle>Verify phone</CardTitle>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                            We sent a code to {phone}
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {error && (
                            <div className="text-sm text-red-600 dark:text-red-400">
                                {error}
                            </div>
                        )}

                        <Input
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder="Enter 6-digit code"
                        />

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={resend} disabled={submitting}>
                                Resend
                            </Button>

                            <Button
                                onClick={verifyAndConfirm}
                                disabled={submitting || code.trim().length < 4}
                            >
                                {submitting ? "Confirming…" : "Confirm booking"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
