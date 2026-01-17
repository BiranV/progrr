"use client";

import React from "react";
import Flatpickr from "react-flatpickr";
import { Arabic } from "flatpickr/dist/l10n/ar";
import { Hebrew } from "flatpickr/dist/l10n/he";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";

import { CenteredSpinner } from "@/components/CenteredSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CalendarPage() {
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();

    const [date, setDate] = React.useState<string>(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    });

    React.useEffect(() => {
        const qp = String(searchParams?.get("date") ?? "").trim();
        if (!qp) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(qp)) return;
        setDate((prev) => (prev === qp ? prev : qp));
        // only react to param changes
    }, [searchParams]);

    const [error, setError] = React.useState<string | null>(null);
    const [showAll, setShowAll] = React.useState(false);

    type Appointment = {
        id: string;
        date: string;
        startTime: string;
        endTime: string;
        serviceName: string;
        status: string;
        cancelledBy?: string;
        bookedByYou?: boolean;
        customer: { fullName: string; phone: string; email?: string };
        notes?: string;
    };

    const appointmentsQuery = useQuery({
        queryKey: ["appointments", date],
        staleTime: 30 * 1000,
        queryFn: async (): Promise<Appointment[]> => {
            const res = await fetch(`/api/appointments?date=${encodeURIComponent(date)}`);
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(json?.error || `Request failed (${res.status})`);
            }
            return Array.isArray(json?.appointments) ? (json.appointments as Appointment[]) : [];
        },
    });

    const loading = appointmentsQuery.isPending;
    const appointments = React.useMemo(
        () => appointmentsQuery.data ?? [],
        [appointmentsQuery.data]
    );

    const [cancelId, setCancelId] = React.useState<string | null>(null);
    const [cancelling, setCancelling] = React.useState(false);

    const [rescheduleId, setRescheduleId] = React.useState<string | null>(null);
    const [rescheduleTitle, setRescheduleTitle] = React.useState<string>("");
    const [timesLoading, setTimesLoading] = React.useState(false);
    const [timesError, setTimesError] = React.useState<string | null>(null);
    const [availableTimes, setAvailableTimes] = React.useState<
        Array<{ startTime: string; endTime: string }>
    >([]);
    const [selectedStartTime, setSelectedStartTime] = React.useState<string>("");
    const [rescheduling, setRescheduling] = React.useState(false);

    const [statusUpdatingId, setStatusUpdatingId] = React.useState<string | null>(null);

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

    const isCanceledStatus = React.useCallback((status: unknown) => {
        const s = String(status ?? "").toUpperCase();
        return s === "CANCELED" || s === "CANCELLED";
    }, []);

    const isNoShowStatus = React.useCallback((status: unknown) => {
        const s = String(status ?? "").toUpperCase();
        return s === "NO_SHOW" || s === "NO SHOW";
    }, []);

    const statusLabel = React.useCallback((status: unknown) => {
        const s = String(status ?? "").toUpperCase();
        if (s === "NO_SHOW") return "NO SHOW";
        return s;
    }, []);

    const updateStatus = React.useCallback(
        async (appointmentId: string, nextStatus: "BOOKED" | "COMPLETED" | "NO_SHOW") => {
            setError(null);
            setStatusUpdatingId(appointmentId);
            try {
                const res = await fetch(
                    `/api/appointments/${encodeURIComponent(appointmentId)}/status`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: nextStatus }),
                    }
                );
                const json = await res.json().catch(() => null);
                if (!res.ok) {
                    throw new Error(json?.error || `Request failed (${res.status})`);
                }

                toast.success(
                    nextStatus === "NO_SHOW"
                        ? "Marked as NO SHOW"
                        : nextStatus === "COMPLETED"
                            ? "Marked as COMPLETED"
                            : "Marked as BOOKED"
                );

                await queryClient.invalidateQueries({ queryKey: ["appointments", date] });
                await queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
                await queryClient.invalidateQueries({ queryKey: ["dashboardRevenueSeries"] });
            } catch (e: any) {
                const msg = String(e?.message || "Failed");
                setError(msg);
                toast.error(msg);
            } finally {
                setStatusUpdatingId(null);
            }
        },
        [date, queryClient]
    );

    const parseTimeToMinutes = React.useCallback((hhmm: string): number => {
        const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(hhmm ?? ""));
        if (!m) return NaN;
        const h = Number(m[1]);
        const min = Number(m[2]);
        if (!Number.isFinite(h) || !Number.isFinite(min)) return NaN;
        if (h < 0 || h > 23) return NaN;
        if (min < 0 || min > 59) return NaN;
        return h * 60 + min;
    }, []);

    const todayLocal = React.useMemo(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }, []);

    const [nowTimeLocal, setNowTimeLocal] = React.useState(() => {
        const d = new Date();
        const h = String(d.getHours()).padStart(2, "0");
        const m = String(d.getMinutes()).padStart(2, "0");
        return `${h}:${m}`;
    });

    React.useEffect(() => {
        const id = window.setInterval(() => {
            const d = new Date();
            const h = String(d.getHours()).padStart(2, "0");
            const m = String(d.getMinutes()).padStart(2, "0");
            setNowTimeLocal(`${h}:${m}`);
        }, 30 * 1000);
        return () => window.clearInterval(id);
    }, []);

    React.useEffect(() => {
        if (!appointmentsQuery.isError) return;
        const msg = (appointmentsQuery.error as any)?.message || "Failed to load appointments";
        setError(msg);
    }, [appointmentsQuery.isError, appointmentsQuery.error]);

    const visibleAppointments = React.useMemo(() => {
        if (showAll) return appointments;

        // Default view: show only remaining meetings.
        // - Past date: none
        // - Future date: all non-canceled
        // - Today: non-canceled with endTime after now
        const nonCanceled = appointments.filter((a) => !isCanceledStatus(a.status));
        if (date < todayLocal) return [];
        if (date > todayLocal) return nonCanceled;

        const nowMin = parseTimeToMinutes(nowTimeLocal);
        if (!Number.isFinite(nowMin)) return nonCanceled;

        return nonCanceled.filter((a) => {
            const endMin = parseTimeToMinutes(String(a.endTime ?? ""));
            if (!Number.isFinite(endMin)) return true;
            return endMin > nowMin;
        });
    }, [appointments, date, isCanceledStatus, nowTimeLocal, parseTimeToMinutes, showAll, todayLocal]);

    const openReschedule = React.useCallback(
        async (appt: { id: string; startTime: string; endTime: string; serviceName: string }) => {
            setRescheduleId(appt.id);
            setRescheduleTitle(`${appt.startTime}–${appt.endTime} • ${appt.serviceName}`);
            setTimesError(null);
            setAvailableTimes([]);
            setSelectedStartTime("");

            setTimesLoading(true);
            try {
                const res = await fetch(
                    `/api/appointments/${encodeURIComponent(
                        appt.id
                    )}/available-times?date=${encodeURIComponent(date)}`
                );
                const json = await res.json().catch(() => null);
                if (!res.ok) {
                    throw new Error(json?.error || `Request failed (${res.status})`);
                }
                const slots = Array.isArray(json?.slots) ? json.slots : [];
                const normalized = slots
                    .map((s: any) => ({
                        startTime: String(s?.startTime ?? ""),
                        endTime: String(s?.endTime ?? ""),
                    }))
                    .filter((s: any) => /^\d{2}:\d{2}$/.test(s.startTime) && /^\d{2}:\d{2}$/.test(s.endTime));

                setAvailableTimes(normalized);
                const current = normalized.find((t: { startTime: string }) => t.startTime === appt.startTime);
                setSelectedStartTime(current ? current.startTime : normalized[0]?.startTime ?? "");
            } catch (e: any) {
                setTimesError(e?.message || "Failed to load available times");
            } finally {
                setTimesLoading(false);
            }
        },
        [date]
    );

    const submitReschedule = React.useCallback(async () => {
        if (!rescheduleId) return;
        if (!selectedStartTime) throw new Error("Please select a time");

        setRescheduling(true);
        try {
            const res = await fetch(`/api/appointments/${encodeURIComponent(rescheduleId)}/reschedule`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date, startTime: selectedStartTime }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(json?.error || `Request failed (${res.status})`);
            }

            const emailSent = json?.email?.sent;
            if (emailSent === false) {
                setError(
                    String(json?.email?.error || "Rescheduled, but failed to email the customer")
                );
            }

            setRescheduleId(null);
            setRescheduleTitle("");
            await queryClient.invalidateQueries({ queryKey: ["appointments", date] });
        } finally {
            setRescheduling(false);
        }
    }, [date, queryClient, rescheduleId, selectedStartTime]);

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
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={showAll}
                            onCheckedChange={setShowAll}
                            aria-label="Show all appointments"
                        />
                        <span className="text-xs text-gray-600 dark:text-gray-300 select-none">
                            Show all
                        </span>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => {
                            setError(null);
                            appointmentsQuery.refetch();
                        }}
                        disabled={loading}
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            {error ? (
                <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
            ) : null}

            {loading ? (
                <CenteredSpinner className="min-h-[20vh] items-center" />
            ) : visibleAppointments.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                    No appointments for this day.
                </div>
            ) : (
                <div className="space-y-2">
                    {visibleAppointments.map((a) => (
                        <div
                            key={a.id}
                            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-3 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-semibold text-gray-900 dark:text-white truncate">
                                        {a.startTime}–{a.endTime}
                                    </div>
                                    <div className="text-sm text-gray-700 dark:text-gray-200 truncate">
                                        {a.serviceName}
                                    </div>

                                    {a.bookedByYou ? (
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Booked by you
                                        </div>
                                    ) : null}

                                    {isCanceledStatus(a.status) ? (
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {String(a.cancelledBy || "").toUpperCase() === "BUSINESS"
                                                ? "Canceled by you"
                                                : String(a.cancelledBy || "").toUpperCase() === "CUSTOMER"
                                                    ? "Canceled by customer"
                                                    : "Canceled"}
                                        </div>
                                    ) : null}
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

                                    {String(a.status) === "BOOKED" ? (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="rounded-xl"
                                                onClick={() => openReschedule(a)}
                                            >
                                                Change hour
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="rounded-xl border-gray-300 text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
                                                onClick={() => setCancelId(a.id)}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>

                                <Badge
                                    className={
                                        String(a.status) === "BOOKED"
                                            ? "bg-emerald-600 text-white"
                                            : String(a.status) === "COMPLETED"
                                                ? "bg-blue-600 text-white"
                                            : isNoShowStatus(a.status)
                                                ? "bg-amber-600 text-white"
                                            : isCanceledStatus(a.status)
                                                ? "bg-gray-500 text-white dark:bg-gray-700"
                                                : "bg-gray-600 text-white"
                                    }
                                >
                                    {statusLabel(a.status)}
                                </Badge>

                                {!isCanceledStatus(a.status) ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 rounded-xl"
                                                disabled={statusUpdatingId === a.id}
                                                aria-label="Change status"
                                                title="Change status"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={() => updateStatus(a.id, "BOOKED")}
                                                disabled={statusUpdatingId === a.id}
                                            >
                                                Set as BOOKED
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => updateStatus(a.id, "COMPLETED")}
                                                disabled={statusUpdatingId === a.id}
                                            >
                                                Set as COMPLETED
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => updateStatus(a.id, "NO_SHOW")}
                                                disabled={statusUpdatingId === a.id}
                                            >
                                                Set as NO SHOW
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmModal
                open={Boolean(cancelId)}
                onOpenChange={(open) => {
                    if (!open) setCancelId(null);
                }}
                title="Cancel appointment?"
                description="This will mark the appointment as canceled."
                confirmText="Cancel appointment"
                confirmVariant="default"
                loading={cancelling}
                onConfirm={async () => {
                    if (!cancelId) return;
                    setCancelling(true);
                    try {
                        const res = await fetch(
                            `/api/appointments/${encodeURIComponent(cancelId)}/cancel`,
                            { method: "POST" }
                        );
                        const json = await res.json().catch(() => null);
                        if (!res.ok) {
                            throw new Error(
                                json?.error || `Request failed (${res.status})`
                            );
                        }
                        queryClient.setQueryData(
                            ["appointments", date],
                            (prev: unknown): Appointment[] => {
                                const list = Array.isArray(prev) ? (prev as Appointment[]) : [];
                                return list.map((a) =>
                                    a.id === cancelId
                                        ? { ...a, status: "CANCELED", cancelledBy: "BUSINESS" }
                                        : a
                                );
                            }
                        );

                        const emailSent = json?.email?.sent;
                        if (emailSent === false) {
                            setError(
                                String(json?.email?.error || "Canceled, but failed to email the customer")
                            );
                        }

                        setCancelId(null);
                    } finally {
                        setCancelling(false);
                    }
                }}
            />

            <Dialog
                open={Boolean(rescheduleId)}
                onOpenChange={(open) => {
                    if (!open) {
                        setRescheduleId(null);
                        setRescheduleTitle("");
                        setTimesError(null);
                        setAvailableTimes([]);
                        setSelectedStartTime("");
                    }
                }}
            >
                <DialogContent showCloseButton={!rescheduling && !timesLoading}>
                    <DialogHeader>
                        <DialogTitle>Change hour</DialogTitle>
                        <DialogDescription>
                            {rescheduleTitle ? (
                                <span className="block truncate">{rescheduleTitle}</span>
                            ) : null}
                            <span className="block">Choose a new time for {date}.</span>
                        </DialogDescription>
                    </DialogHeader>

                    {timesError ? (
                        <div className="text-sm text-red-600 dark:text-red-400">
                            {timesError}
                        </div>
                    ) : null}

                    {timesLoading ? (
                        <CenteredSpinner className="min-h-[10vh] items-center" />
                    ) : availableTimes.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                            No available times.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-sm font-medium">Available hours</div>
                            <Select
                                value={selectedStartTime}
                                onValueChange={(v) => setSelectedStartTime(v)}
                            >
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Select time" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableTimes.map((t) => (
                                        <SelectItem key={t.startTime} value={t.startTime}>
                                            {t.startTime}–{t.endTime}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={rescheduling || timesLoading}
                            onClick={() => setRescheduleId(null)}
                        >
                            Close
                        </Button>
                        <Button
                            type="button"
                            disabled={
                                rescheduling ||
                                timesLoading ||
                                availableTimes.length === 0 ||
                                !selectedStartTime
                            }
                            onClick={async () => {
                                try {
                                    await submitReschedule();
                                } catch (e: any) {
                                    setTimesError(e?.message || "Failed to reschedule");
                                }
                            }}
                        >
                            {rescheduling ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
