"use client";

import React from "react";
import Flatpickr from "react-flatpickr";
import { Arabic } from "flatpickr/dist/l10n/ar";
import { Hebrew } from "flatpickr/dist/l10n/he";

import { CenteredSpinner } from "@/components/CenteredSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function CalendarPage() {
    const [date, setDate] = React.useState<string>(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    });

    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [appointments, setAppointments] = React.useState<
        Array<{
            id: string;
            date: string;
            startTime: string;
            endTime: string;
            serviceName: string;
            status: string;
            customer: { fullName: string; phone: string; email?: string };
            notes?: string;
        }>
    >([]);

    const dir = React.useMemo<"ltr" | "rtl">(() => {
        if (typeof document === "undefined") return "ltr";
        const v = String(
            document.documentElement.getAttribute("dir") || "ltr"
        ).toLowerCase();
        return v === "rtl" ? "rtl" : "ltr";
    }, []);

    const fpLocale = React.useMemo(() => {
        if (dir !== "rtl") return undefined;
        if (typeof document === "undefined") return { ...Arabic, rtl: true };
        const lang = String(
            document.documentElement.getAttribute("lang") || ""
        ).toLowerCase();
        if (lang.startsWith("he")) return { ...Hebrew, rtl: true };
        return { ...Arabic, rtl: true };
    }, [dir]);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/appointments?date=${encodeURIComponent(date)}`
            );
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(json?.error || `Request failed (${res.status})`);
            }
            const list = Array.isArray(json?.appointments) ? json.appointments : [];
            setAppointments(list);
        } catch (e: any) {
            setError(e?.message || "Failed to load appointments");
            setAppointments([]);
        } finally {
            setLoading(false);
        }
    }, [date]);

    React.useEffect(() => {
        load();
    }, [load]);

    const flatpickrOptions = React.useMemo(() => {
        return {
            mode: "single" as const,
            dateFormat: "Y-m-d",
            inline: true,
            disableMobile: false,
            monthSelectorType: "static" as const,
            locale: fpLocale,
        };
    }, [fpLocale]);

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Calendar
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Tap a day to see appointments.
                </p>
            </div>

            <div className="w-full">
                <Flatpickr
                    options={flatpickrOptions as any}
                    value={date}
                    onChange={(_selectedDates: Date[], dateStr: string) => {
                        const next = String(dateStr || "").trim();
                        if (!next) return;
                        setDate(next);
                    }}
                    render={(_props: any, ref: any) => (
                        <input ref={ref as any} type="text" className="sr-only" />
                    )}
                />
            </div>

            <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {date}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={load}
                    disabled={loading}
                >
                    Refresh
                </Button>
            </div>

            {error ? (
                <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
            ) : null}

            {loading ? (
                <CenteredSpinner className="min-h-[20vh] items-center" />
            ) : appointments.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                    No appointments for this day.
                </div>
            ) : (
                <div className="space-y-2">
                    {appointments.map((a) => (
                        <div
                            key={a.id}
                            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-3 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-semibold text-gray-900 dark:text-white truncate">
                                        {a.startTime}–{a.endTime} • {a.serviceName}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-300 truncate">
                                        {a.customer.fullName}
                                        {a.customer.phone ? ` • ${a.customer.phone}` : ""}
                                    </div>
                                    {a.customer.email ? (
                                        <div className="text-xs text-gray-600 dark:text-gray-300 truncate">
                                            {a.customer.email}
                                        </div>
                                    ) : null}
                                    {a.notes ? (
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {a.notes}
                                        </div>
                                    ) : null}
                                </div>

                                <Badge
                                    className={
                                        String(a.status) === "BOOKED"
                                            ? "bg-emerald-600"
                                            : "bg-gray-600"
                                    }
                                >
                                    {String(a.status)}
                                </Badge>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
