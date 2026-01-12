"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    type PublicBusiness,
    formatDateInTimeZone,
} from "@/lib/public-booking";

type SlotsResponse = {
    ok: boolean;
    date: string;
    timeZone: string;
    slots: Array<{ startTime: string; endTime: string }>;
};

function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

export default function PublicCalendarPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const { slug } = React.use(params);
    const normalizedSlug = String(slug ?? "").trim();

    const serviceId = String(searchParams.get("serviceId") ?? "").trim();

    const [business, setBusiness] = React.useState<PublicBusiness | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [enabledDates, setEnabledDates] = React.useState<Set<string>>(new Set());
    const [month, setMonth] = React.useState<Date>(() => new Date());

    React.useEffect(() => {
        if (!normalizedSlug) {
            setBusiness(null);
            setLoading(false);
            return;
        }

        if (!serviceId) {
            router.replace(`/b/${encodeURIComponent(normalizedSlug)}`);
            return;
        }

        let cancelled = false;

        (async () => {
            setLoading(true);
            try {
                const res = await fetch(
                    `/api/public/business/${encodeURIComponent(normalizedSlug)}`
                );
                const json = await res.json().catch(() => null);
                if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
                if (cancelled) return;
                setBusiness(json as PublicBusiness);
            } catch {
                if (!cancelled) setBusiness(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [router, serviceId, normalizedSlug]);

    React.useEffect(() => {
        if (!business || !serviceId) return;

        let cancelled = false;

        (async () => {
            const tz =
                String(business.availability?.timezone ?? "").trim() || "UTC";

            const s = new Set<string>();
            const from = startOfMonth(month);
            const to = endOfMonth(month);

            for (let d = from; d <= to; d = addDays(d, 1)) {
                const dateStr = formatDateInTimeZone(d, tz);
                if (!dateStr) continue;

                const dayRes = await fetch(
                    `/api/public/business/${encodeURIComponent(
                        normalizedSlug
                    )}/availability?date=${encodeURIComponent(
                        dateStr
                    )}&serviceId=${encodeURIComponent(serviceId)}`
                );

                const dayJson = (await dayRes.json().catch(
                    () => null
                )) as SlotsResponse | null;

                if (!dayRes.ok || !dayJson?.ok) continue;
                if (Array.isArray(dayJson.slots) && dayJson.slots.length > 0) {
                    s.add(dateStr);
                }
            }

            if (!cancelled) setEnabledDates(s);
        })();

        return () => {
            cancelled = true;
        };
    }, [business, month, serviceId, normalizedSlug]);

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

    if (!business) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <Card className="w-full max-w-xl">
                    <CardHeader>
                        <CardTitle>Pick a date</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm text-red-600 dark:text-red-400">
                            Business not found
                        </div>
                        <Button
                            variant="outline"
                            onClick={() =>
                                router.replace(`/b/${encodeURIComponent(normalizedSlug)}`)
                            }
                        >
                            Back
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const tz =
        String(business.availability?.timezone ?? "").trim() || "UTC";

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-10">
            <div className="mx-auto w-full max-w-3xl space-y-6">
                <Card>
                    <CardHeader className="space-y-1">
                        <CardTitle>Pick a date</CardTitle>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                            {business.business.name}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Calendar
                            mode="single"
                            month={month}
                            onMonthChange={setMonth}
                            disabled={(date) => {
                                const dateStr = formatDateInTimeZone(date, tz);
                                return !enabledDates.has(dateStr);
                            }}
                            onSelect={(date) => {
                                if (!date) return;
                                const dateStr = formatDateInTimeZone(date, tz);
                                if (!dateStr) return;
                                if (!enabledDates.has(dateStr)) return;

                                router.push(
                                    `/b/${encodeURIComponent(
                                        normalizedSlug
                                    )}/times?serviceId=${encodeURIComponent(
                                        serviceId
                                    )}&date=${encodeURIComponent(dateStr)}`
                                );
                            }}
                        />

                        <div className="mt-4 flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() =>
                                    router.replace(`/b/${encodeURIComponent(normalizedSlug)}`)
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
