"use client";

import React from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const RESULT_KEY = "progrr.bookingResult.v1";

function googleCalendarUrl(args: {
    title: string;
    date: string; // YYYY-MM-DD
    startTime: string; // HH:mm
    endTime: string; // HH:mm
}): string {
    const start = `${args.date}T${args.startTime.replace(":", "")}00`;
    const end = `${args.date}T${args.endTime.replace(":", "")}00`;
    const dates = `${start}/${end}`;

    const url = new URL("https://calendar.google.com/calendar/render");
    url.searchParams.set("action", "TEMPLATE");
    url.searchParams.set("text", args.title);
    url.searchParams.set("dates", dates);
    return url.toString();
}

export default function PublicSuccessPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const router = useRouter();

    const { slug } = React.use(params);
    const normalizedSlug = String(slug ?? "").trim();

    const [result, setResult] = React.useState<any>(null);
    const [cancelling, setCancelling] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        try {
            const raw = sessionStorage.getItem(RESULT_KEY);
            if (!raw) {
                setResult(null);
                return;
            }
            setResult(JSON.parse(raw));
        } catch {
            setResult(null);
        }
    }, []);

    if (!result?.appointment) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                <Card className="w-full max-w-xl">
                    <CardHeader>
                        <CardTitle>Booking</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                            No booking found.
                        </div>
                        <Button
                            onClick={() =>
                                router.replace(`/b/${encodeURIComponent(normalizedSlug)}`)
                            }
                        >
                            Start over
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const appt = result.appointment;

    const cancel = async () => {
        setCancelling(true);
        setError(null);
        try {
            const cancelToken = String(result?.cancelToken ?? "").trim();
            if (!cancelToken) throw new Error("Cancel token missing");

            const res = await fetch("/api/public/booking/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cancelToken }),
            });

            const json = await res.json().catch(() => null);
            if (!res.ok)
                throw new Error(json?.error || `Request failed (${res.status})`);

            sessionStorage.removeItem(RESULT_KEY);
            router.replace(`/b/${encodeURIComponent(normalizedSlug)}`);
        } catch (e: any) {
            setError(e?.message || "Failed");
        } finally {
            setCancelling(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-10">
            <div className="mx-auto w-full max-w-3xl space-y-6">
                <Card>
                    <CardHeader className="space-y-1">
                        <CardTitle>Booked</CardTitle>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                            {appt.date} • {appt.startTime}–{appt.endTime}
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {error && (
                            <div className="text-sm text-red-600 dark:text-red-400">
                                {error}
                            </div>
                        )}

                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                            <div className="font-medium text-gray-900 dark:text-white">
                                {appt.serviceName}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                                {appt.customer.fullName}
                            </div>
                            {appt.notes ? (
                                <div className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                                    {appt.notes}
                                </div>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                onClick={() =>
                                    window.open(
                                        googleCalendarUrl({
                                            title: appt.serviceName,
                                            date: appt.date,
                                            startTime: appt.startTime,
                                            endTime: appt.endTime,
                                        }),
                                        "_blank"
                                    )
                                }
                            >
                                Add to Google Calendar
                            </Button>

                            <Button
                                variant="outline"
                                onClick={cancel}
                                disabled={cancelling}
                            >
                                {cancelling ? "Cancelling…" : "Cancel booking"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
