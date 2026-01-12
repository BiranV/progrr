"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type BookingDraft = {
    businessSlugOrId: string;
    serviceId: string;
    date: string;
    startTime: string;
    customerFullName: string;
    customerPhone: string;
    notes?: string;
};

const DRAFT_KEY = "progrr.bookingDraft.v1";

export default function PublicDetailsPage({ params }: { params: { slug: string } }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const slug = String(params.slug || "").trim();
    const serviceId = String(searchParams.get("serviceId") || "").trim();
    const date = String(searchParams.get("date") || "").trim();
    const time = String(searchParams.get("time") || "").trim();

    const [fullName, setFullName] = React.useState("");
    const [phone, setPhone] = React.useState("");
    const [notes, setNotes] = React.useState("");

    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!serviceId) {
            router.replace(`/b/${encodeURIComponent(slug)}`);
            return;
        }
        if (!date) {
            router.replace(`/b/${encodeURIComponent(slug)}/calendar?serviceId=${encodeURIComponent(serviceId)}`);
            return;
        }
        if (!time) {
            router.replace(`/b/${encodeURIComponent(slug)}/times?serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`);
            return;
        }
    }, [date, router, serviceId, slug, time]);

    const submit = async () => {
        setSubmitting(true);
        setError(null);

        try {
            const draft: BookingDraft = {
                businessSlugOrId: slug,
                serviceId,
                date,
                startTime: time,
                customerFullName: fullName.trim(),
                customerPhone: phone.trim(),
                notes: notes.trim() || undefined,
            };

            if (!draft.customerFullName) throw new Error("Full Name is required");
            if (!draft.customerPhone) throw new Error("Phone is required");

            sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

            // Request OTP, then go to verify.
            const res = await fetch("/api/public/booking/request-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: draft.customerPhone }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);

            router.push(`/b/${encodeURIComponent(slug)}/verify?phone=${encodeURIComponent(draft.customerPhone)}`);
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
                        <CardTitle>Your details</CardTitle>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                            {date} • {time}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

                        <div className="space-y-2">
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes (optional)</Label>
                            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() =>
                                    router.replace(`/b/${encodeURIComponent(slug)}/times?serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`)
                                }
                            >
                                Back
                            </Button>
                            <Button onClick={submit} disabled={submitting}>
                                {submitting ? "Sending code…" : "Verify phone"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
