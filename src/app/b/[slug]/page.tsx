"use client";

import React from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPrice, type PublicBusiness } from "@/lib/public-booking";

export default function PublicBusinessPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const router = useRouter();

    const { slug } = React.use(params);
    const normalizedSlug = String(slug ?? "").trim();

    const [data, setData] = React.useState<PublicBusiness | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!normalizedSlug) {
            setData(null);
            setError("Business not found");
            setLoading(false);
            return;
        }

        let cancelled = false;

        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(
                    `/api/public/business/${encodeURIComponent(normalizedSlug)}`
                );
                const json = await res.json().catch(() => null);

                if (!res.ok) {
                    if (res.status === 404) throw new Error("Business not found");
                    throw new Error(json?.error || `Request failed (${res.status})`);
                }

                if (cancelled) return;
                setData(json as PublicBusiness);
            } catch (e: any) {
                if (cancelled) return;
                setError(e?.message || "Failed to load business");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [normalizedSlug]);

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
                        <CardTitle>Booking</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm text-red-600 dark:text-red-400">
                            {error || "Business not found"}
                        </div>
                        <Button variant="outline" onClick={() => router.refresh()}>
                            Retry
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
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-2xl">
                            {data.business.name}
                        </CardTitle>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                            {data.business.address}
                        </div>
                    </CardHeader>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Select service</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {data.services.map((s) => (
                            <button
                                key={s.id}
                                onClick={() =>
                                    router.push(
                                        `/b/${encodeURIComponent(
                                            normalizedSlug
                                        )}/calendar?serviceId=${encodeURIComponent(s.id)}`
                                    )
                                }
                                className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">
                                            {s.name}
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-300">
                                            {s.durationMinutes} min
                                        </div>
                                    </div>
                                    <div className="font-semibold text-gray-900 dark:text-white">
                                        {formatPrice({
                                            price: s.price,
                                            currency: data.currency,
                                        })}
                                    </div>
                                </div>
                            </button>
                        ))}

                        {!data.services.length && (
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                                No services available.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
