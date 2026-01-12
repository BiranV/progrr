"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SlotsResponse = {
    ok: boolean;
    date: string;
    timeZone: string;
    service: { id: string; name: string; durationMinutes: number };
    slots: Array<{ startTime: string; endTime: string }>;
};

export default function PublicTimesPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const { slug } = React.use(params);
    const normalizedSlug = String(slug ?? "").trim();

    const serviceId = String(searchParams.get("serviceId") ?? "").trim();
    const date = String(searchParams.get("date") ?? "").trim();

    const [data, setData] = React.useState<SlotsResponse | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!normalizedSlug) {
            setData(null);
            setError("Business not found");
            setLoading(false);
            return;
        }

        if (!serviceId) {
            router.replace(`/b/${encodeURIComponent(normalizedSlug)}`);
            return;
        }

        if (!date) {
            router.replace(
                `/b/${encodeURIComponent(
                    normalizedSlug
                )}/calendar?serviceId=${encodeURIComponent(serviceId)}`
            );
            return;
        }

        let cancelled = false;

        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(
                    `/api/public/business/${encodeURIComponent(
                        normalizedSlug
                    )}/availability?date=${encodeURIComponent(
                        date
                    )}&serviceId=${encodeURIComponent(serviceId)}`
                );

                const json = await res.json().catch(() => null);
                if (!res.ok)
                    throw new Error(json?.error || `Request failed (${res.status})`);

                if (cancelled) return;
                setData(json as SlotsResponse);
            } catch (e: any) {
                if (cancelled) return;
                setError(e?.message || "Failed to load slots");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [date, router, serviceId, normalizedSlug]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <Card className="w-full max-w-xl">
                    <CardContent className="p-6 text-sm text-gray-600 dark:text-gray-300">
                        Loading…
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <Card className="w-full max-w-xl">
                    <CardHeader>
                        <CardTitle>Pick a time</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm text-red-600 dark:text-red-400">
                            {error || "No slots"}
                        </div>
                        <Button variant="outline" onClick={() => router.back()}>
                            Back
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-10">
            <div className="mx-auto w-full max-w-3xl space-y-6">
                <Card>
                    <CardHeader className="space-y-1">
                        <CardTitle>Pick a time</CardTitle>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                            {data.service.name} • {data.date}
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                        {data.slots.map((s) => (
                            <button
                                key={s.startTime}
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                                onClick={() =>
                                    router.push(
                                        `/b/${encodeURIComponent(
                                            normalizedSlug
                                        )}/details?serviceId=${encodeURIComponent(
                                            serviceId
                                        )}&date=${encodeURIComponent(
                                            date
                                        )}&time=${encodeURIComponent(s.startTime)}`
                                    )
                                }
                            >
                                <div className="font-medium text-gray-900 dark:text-white">
                                    {s.startTime}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                    Ends {s.endTime}
                                </div>
                            </button>
                        ))}

                        {!data.slots.length && (
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                                No times available.
                            </div>
                        )}

                        <div className="pt-2">
                            <Button
                                variant="outline"
                                onClick={() =>
                                    router.replace(
                                        `/b/${encodeURIComponent(
                                            normalizedSlug
                                        )}/calendar?serviceId=${encodeURIComponent(serviceId)}`
                                    )
                                }
                            >
                                Back
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
