"use client";

import React from "react";
import Flatpickr from "react-flatpickr";

import { english } from "flatpickr/dist/l10n/default";
import { Arabic } from "flatpickr/dist/l10n/ar";
import { Hebrew } from "flatpickr/dist/l10n/he";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Loader2, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/useI18n";

import { CenteredSpinner } from "@/components/CenteredSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ConfirmModal from "@/components/ui/confirm-modal";
import { Switch } from "@/components/ui/switch";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
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

import { useAuth } from "@/context/AuthContext";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function normalizeEmail(input: string): string {
    return String(input ?? "")
        .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
        .trim()
        .toLowerCase();
}

export default function CalendarClient() {
    const { t } = useI18n();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const [isHydrated, setIsHydrated] = React.useState(false);
    React.useEffect(() => {
        setIsHydrated(true);
    }, []);

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
            const res = await fetch(
                `/api/appointments?date=${encodeURIComponent(date)}`,
            );
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(json?.error || `Request failed (${res.status})`);
            }
            return Array.isArray(json?.appointments)
                ? (json.appointments as Appointment[])
                : [];
        },
    });

    const loading = appointmentsQuery.isPending;
    const showLoading = !isHydrated || loading;
    const appointments = React.useMemo(
        () => appointmentsQuery.data ?? [],
        [appointmentsQuery.data],
    );

    const [refreshing, setRefreshing] = React.useState(false);

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

    const [statusUpdatingId, setStatusUpdatingId] = React.useState<string | null>(
        null,
    );

    const [createOpen, setCreateOpen] = React.useState(false);
    const [createServiceId, setCreateServiceId] = React.useState<string>("");
    const [createStartTime, setCreateStartTime] = React.useState<string>("");
    const [createExistingCustomerId, setCreateExistingCustomerId] =
        React.useState<string>("");
    const [createCustomerSearch, setCreateCustomerSearch] =
        React.useState<string>("");
    const [createCustomerPickerOpen, setCreateCustomerPickerOpen] =
        React.useState(false);
    const [createNotes, setCreateNotes] = React.useState<string>("");
    const [creating, setCreating] = React.useState(false);

    type CustomerForPicker = {
        _id: string;
        fullName: string;
        phone: string;
        email?: string;
        status?: "ACTIVE" | "BLOCKED";
    };

    const customersPickerQuery = useQuery({
        queryKey: ["customers"],
        enabled: createOpen,
        staleTime: 2 * 60 * 1000,
        queryFn: async (): Promise<CustomerForPicker[]> => {
            const res = await fetch("/api/customers", {
                method: "GET",
                headers: { Accept: "application/json" },
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(json?.error || `Request failed (${res.status})`);
            }
            return Array.isArray(json?.customers)
                ? (json.customers as CustomerForPicker[])
                : [];
        },
    });

    const customersForPicker = React.useMemo(() => {
        const rows = customersPickerQuery.data ?? [];
        return rows
            .map((c) => ({
                _id: String((c as any)?._id ?? ""),
                fullName: String((c as any)?.fullName ?? ""),
                phone: String((c as any)?.phone ?? ""),
                email:
                    typeof (c as any)?.email === "string" &&
                        String((c as any).email).trim()
                        ? String((c as any).email).trim()
                        : undefined,
                status:
                    String((c as any)?.status ?? "ACTIVE").toUpperCase() === "BLOCKED"
                        ? "BLOCKED"
                        : "ACTIVE",
            }))
            .filter((c) => c._id && c.phone);
    }, [customersPickerQuery.data]);

    const selectedCustomerForPicker = React.useMemo(() => {
        if (!createExistingCustomerId) return null;
        return (
            customersForPicker.find((c) => c._id === createExistingCustomerId) ?? null
        );
    }, [createExistingCustomerId, customersForPicker]);

    const filteredCustomersForPicker = React.useMemo(() => {
        const q = String(createCustomerSearch || "")
            .trim()
            .toLowerCase();
        if (!q) return customersForPicker;
        return customersForPicker.filter((c) => {
            const hay = `${c.fullName} ${c.phone} ${c.email ?? ""}`.toLowerCase();
            return hay.includes(q);
        });
    }, [createCustomerSearch, customersForPicker]);

    const canCreateAppointment = React.useMemo(() => {
        const serviceOk = Boolean(String(createServiceId || "").trim());
        const startOk = Boolean(String(createStartTime || "").trim());
        const c = selectedCustomerForPicker;
        const customerOk =
            c != null &&
            c.status !== "BLOCKED" &&
            Boolean(String(c.fullName || "").trim()) &&
            Boolean(String(c.phone || "").trim()) &&
            Boolean(String(c.email || "").trim());
        return serviceOk && startOk && customerOk;
    }, [createServiceId, createStartTime, selectedCustomerForPicker]);

    const [docDir, setDocDir] = React.useState<"ltr" | "rtl">("ltr");
    const [docLang, setDocLang] = React.useState("");

    React.useEffect(() => {
        const nextDir = String(
            document.documentElement.getAttribute("dir") || "ltr",
        ).toLowerCase();
        const nextLang = String(
            document.documentElement.getAttribute("lang") || "",
        ).toLowerCase();
        setDocDir(nextDir === "rtl" ? "rtl" : "ltr");
        setDocLang(nextLang);
    }, []);

    const fpLocale = React.useMemo(() => {
        if (docDir !== "rtl") return undefined;
        if (docLang.startsWith("he")) return { ...Hebrew, rtl: true };
        return { ...Arabic, rtl: true };
    }, [docDir, docLang]);

    const resolvedLocale = React.useMemo(() => fpLocale ?? english, [fpLocale]);

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
        async (
            appointmentId: string,
            nextStatus: "BOOKED" | "COMPLETED" | "NO_SHOW",
        ) => {
            setError(null);
            setStatusUpdatingId(appointmentId);
            try {
                const res = await fetch(
                    `/api/appointments/${encodeURIComponent(appointmentId)}/status`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: nextStatus }),
                    },
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
                            : "Marked as BOOKED",
                );

                await queryClient.invalidateQueries({
                    queryKey: ["appointments", date],
                });
                await queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
                await queryClient.invalidateQueries({
                    queryKey: ["dashboardRevenueSeries"],
                });
            } catch (e: any) {
                const msg = String(e?.message || "Failed");
                setError(msg);
                toast.error(msg);
            } finally {
                setStatusUpdatingId(null);
            }
        },
        [date, queryClient],
    );

    const services = React.useMemo(() => {
        const raw = Array.isArray((user as any)?.onboarding?.services)
            ? ((user as any).onboarding.services as any[])
            : [];
        return raw
            .map((s) => ({
                id: String(s?.id ?? "").trim(),
                name: String(s?.name ?? "").trim(),
                durationMinutes: Number(s?.durationMinutes) || 0,
                isActive: s?.isActive !== false,
            }))
            .filter((s) => s.id && s.name && s.durationMinutes > 0 && s.isActive);
    }, [user]);

    const availableCreateSlotsQuery = useQuery({
        queryKey: ["adminCreateSlots", date, createServiceId],
        enabled: createOpen && !!createServiceId,
        staleTime: 0,
        queryFn: async (): Promise<
            Array<{ startTime: string; endTime: string }>
        > => {
            const res = await fetch(
                `/api/appointments/available-times?date=${encodeURIComponent(date)}&serviceId=${encodeURIComponent(
                    createServiceId,
                )}`,
                { method: "GET", headers: { Accept: "application/json" } },
            );
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(json?.error || `Request failed (${res.status})`);
            }
            return Array.isArray(json?.slots) ? (json.slots as any[]) : [];
        },
    });

    const createSlots = React.useMemo(
        () => availableCreateSlotsQuery.data ?? [],
        [availableCreateSlotsQuery.data],
    );

    React.useEffect(() => {
        setCreateStartTime("");
    }, [createServiceId, date]);

    const resetCreateForm = React.useCallback(() => {
        setCreateServiceId("");
        setCreateStartTime("");
        setCreateExistingCustomerId("");
        setCreateCustomerSearch("");
        setCreateCustomerPickerOpen(false);
        setCreateNotes("");
    }, []);

    const createAppointment = React.useCallback(async () => {
        if (!canCreateAppointment) {
            toast.error(t("calendar.fillRequired"));
            return;
        }

        const selected = selectedCustomerForPicker;
        if (!selected) return;

        const customerFullName = selected.fullName.trim();
        const customerPhone = selected.phone.trim();
        const customerEmail = normalizeEmail(selected.email ?? "");

        setCreating(true);
        try {
            const res = await fetch("/api/appointments/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    date,
                    serviceId: createServiceId,
                    startTime: createStartTime,
                    customerFullName,
                    customerPhone,
                    customerEmail,
                    notes: createNotes.trim(),
                }),
            });

            const json = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(json?.error || `Request failed (${res.status})`);
            }

            toast.success(t("calendar.appointmentCreated"));

            if (json?.email?.sent === false) {
                toast.error(String(json?.email?.error || "Failed to send email"));
            }

            setCreateOpen(false);
            resetCreateForm();

            await queryClient.invalidateQueries({ queryKey: ["appointments", date] });
            await queryClient.invalidateQueries({ queryKey: ["customers"] });
            await queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
            await queryClient.invalidateQueries({
                queryKey: ["dashboardRevenueSeries"],
            });
        } catch (e: any) {
            const msg = String(e?.message || t("errors.somethingWentWrong"));
            toast.error(msg);
        } finally {
            setCreating(false);
        }
    }, [
        canCreateAppointment,
        createExistingCustomerId,
        customersForPicker,
        createNotes,
        createServiceId,
        createStartTime,
        date,
        queryClient,
        resetCreateForm,
        selectedCustomerForPicker,
    ]);

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

    const isIncomingAppointment = React.useCallback(
        (appt: { date: string; endTime?: string }) => {
            const apptDate = String(appt?.date ?? "").slice(0, 10);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(apptDate)) return true;
            if (apptDate > todayLocal) return true;
            if (apptDate < todayLocal) return false;

            const nowMin = parseTimeToMinutes(nowTimeLocal);
            const endMin = parseTimeToMinutes(String(appt?.endTime ?? ""));
            if (!Number.isFinite(nowMin) || !Number.isFinite(endMin)) return true;
            return endMin > nowMin;
        },
        [nowTimeLocal, parseTimeToMinutes, todayLocal],
    );

    const cancelAppointmentById = React.useCallback(
        async (appointmentId: string, notifyCustomer: boolean) => {
            setCancelling(true);
            try {
                const res = await fetch(
                    `/api/appointments/${encodeURIComponent(appointmentId)}/cancel`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ notifyCustomer }),
                    },
                );
                const json = await res.json().catch(() => null);
                if (!res.ok) {
                    throw new Error(json?.error || `Request failed (${res.status})`);
                }

                queryClient.setQueryData(
                    ["appointments", date],
                    (prev: unknown): Appointment[] => {
                        const list = Array.isArray(prev) ? (prev as Appointment[]) : [];
                        return list.map((a) =>
                            a.id === appointmentId
                                ? { ...a, status: "CANCELED", cancelledBy: "BUSINESS" }
                                : a,
                        );
                    },
                );

                const emailSent = json?.email?.sent;
                if (notifyCustomer && emailSent === false) {
                    setError(
                        String(
                            json?.email?.error ||
                            "Canceled, but failed to email the customer",
                        ),
                    );
                }
            } finally {
                setCancelling(false);
            }
        },
        [date, queryClient],
    );

    React.useEffect(() => {
        if (!appointmentsQuery.isError) return;
        const msg =
            (appointmentsQuery.error as any)?.message ||
            "Failed to load appointments";
        setError(msg);
    }, [appointmentsQuery.isError, appointmentsQuery.error]);

    const visibleAppointments = React.useMemo(() => {
        if (showAll) {
            const list = [...appointments];
            list.sort((a, b) => {
                const ad = String((a as any)?.date ?? "");
                const bd = String((b as any)?.date ?? "");
                if (ad !== bd) return bd.localeCompare(ad);

                const am = parseTimeToMinutes(String((a as any)?.startTime ?? ""));
                const bm = parseTimeToMinutes(String((b as any)?.startTime ?? ""));
                if (Number.isFinite(am) && Number.isFinite(bm)) return bm - am;

                const at = String((a as any)?.startTime ?? "");
                const bt = String((b as any)?.startTime ?? "");
                return bt.localeCompare(at);
            });
            return list;
        }

        // Default view: show only remaining meetings.
        // - Past date: none
        // - Future date: only BOOKED (exclude COMPLETED / NO SHOW)
        // - Today: only BOOKED with endTime after now
        const nonCanceledBooked = appointments
            .filter((a) => !isCanceledStatus(a.status))
            .filter((a) => String(a.status ?? "").toUpperCase() === "BOOKED");
        if (date < todayLocal) return [];
        if (date > todayLocal) return nonCanceledBooked;

        const nowMin = parseTimeToMinutes(nowTimeLocal);
        if (!Number.isFinite(nowMin)) return nonCanceledBooked;

        return nonCanceledBooked.filter((a) => {
            const endMin = parseTimeToMinutes(String(a.endTime ?? ""));
            if (!Number.isFinite(endMin)) return true;
            return endMin > nowMin;
        });
    }, [
        appointments,
        date,
        isCanceledStatus,
        nowTimeLocal,
        parseTimeToMinutes,
        showAll,
        todayLocal,
    ]);

    const openReschedule = React.useCallback(
        async (appt: {
            id: string;
            startTime: string;
            endTime: string;
            serviceName: string;
        }) => {
            setRescheduleId(appt.id);
            setRescheduleTitle(
                `${appt.startTime}–${appt.endTime} • ${appt.serviceName}`,
            );
            setTimesError(null);
            setAvailableTimes([]);
            setSelectedStartTime("");

            setTimesLoading(true);
            try {
                const res = await fetch(
                    `/api/appointments/${encodeURIComponent(
                        appt.id,
                    )}/available-times?date=${encodeURIComponent(date)}`,
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
                    .filter(
                        (s: any) =>
                            /^\d{2}:\d{2}$/.test(s.startTime) &&
                            /^\d{2}:\d{2}$/.test(s.endTime),
                    );

                setAvailableTimes(normalized);
                const current = normalized.find(
                    (t: { startTime: string }) => t.startTime === appt.startTime,
                );
                setSelectedStartTime(
                    current ? current.startTime : (normalized[0]?.startTime ?? ""),
                );
            } catch (e: any) {
                setTimesError(e?.message || "Failed to load available times");
            } finally {
                setTimesLoading(false);
            }
        },
        [date],
    );

    const submitReschedule = React.useCallback(async () => {
        if (!rescheduleId) return;
        if (!selectedStartTime) throw new Error("Please select a time");

        setRescheduling(true);
        try {
            const res = await fetch(
                `/api/appointments/${encodeURIComponent(rescheduleId)}/reschedule`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ date, startTime: selectedStartTime }),
                },
            );
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(json?.error || `Request failed (${res.status})`);
            }

            const emailSent = json?.email?.sent;
            if (emailSent === false) {
                setError(
                    String(
                        json?.email?.error ||
                        "Rescheduled, but failed to email the customer",
                    ),
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
            locale: resolvedLocale,
        };
    }, [resolvedLocale]);

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {t("calendar.title")}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t("calendar.subtitle")}
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

            <div className="grid grid-cols-3 items-center gap-3">
                <div className="min-w-0 text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {date}
                </div>

                <div className="flex items-center justify-self-center gap-2">
                    <Switch
                        checked={showAll}
                        onCheckedChange={setShowAll}
                        aria-label={t("calendar.showAllAppointments")}
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-300 select-none">
                        {t("calendar.showAll")}
                    </span>
                </div>

                <div className="justify-self-end">
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-2"
                        onClick={async () => {
                            setError(null);
                            setRefreshing(true);
                            try {
                                await appointmentsQuery.refetch();
                            } finally {
                                setRefreshing(false);
                            }
                        }}
                        disabled={showLoading || refreshing}
                    >
                        <span className="relative inline-flex items-center justify-center">
                            <span className={refreshing ? "invisible" : ""}>
                                {t("calendar.refresh")}
                            </span>
                            {refreshing ? (
                                <span className="absolute inset-0 inline-flex items-center justify-center">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                </span>
                            ) : null}
                        </span>
                    </Button>
                </div>
            </div>

            <div className="flex items-center justify-center">
                <Button
                    type="button"
                    className="w-full"
                    onClick={() => {
                        setError(null);
                        setCreateOpen(true);
                    }}
                >
                    {t("calendar.newAppointment")}
                </Button>
            </div>

            {error ? (
                <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
            ) : null}

            <Dialog
                open={createOpen}
                onOpenChange={(open) => {
                    setCreateOpen(open);
                    if (!open) resetCreateForm();
                }}
            >
                <DialogContent>
                    <DialogHeader className="text-start items-start sm:text-start">
                        <DialogTitle className="text-start">
                            {t("calendar.newAppointmentTitle")}
                        </DialogTitle>
                        <DialogDescription className="text-start">
                            {t("calendar.newAppointmentDescription")}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1 min-w-0">
                                <div className="text-xs text-muted-foreground">
                                    {t("calendar.serviceLabel")}
                                </div>
                                <Select
                                    value={createServiceId}
                                    onValueChange={(v) => {
                                        setCreateServiceId(String(v || ""));
                                    }}
                                >
                                    <SelectTrigger className="rounded-xl w-full">
                                        <SelectValue placeholder={t("calendar.servicePlaceholder")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {services.map((s) => (
                                            <SelectItem
                                                key={s.id}
                                                value={s.id}
                                            >
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1 min-w-0">
                                <div className="text-xs text-muted-foreground">
                                    {t("calendar.hourLabel")}
                                </div>
                                <Select
                                    value={createStartTime}
                                    onValueChange={(v) => {
                                        setCreateStartTime(String(v || ""));
                                    }}
                                    disabled={!createServiceId || availableCreateSlotsQuery.isPending}
                                >
                                    <SelectTrigger className="rounded-xl w-full">
                                        <SelectValue
                                            placeholder={
                                                !createServiceId
                                                    ? t("calendar.hourPlaceholder")
                                                    : availableCreateSlotsQuery.isPending
                                                        ? t("calendar.hourLoading")
                                                        : createSlots.length
                                                            ? t("calendar.hourPlaceholder")
                                                            : t("calendar.hourUnavailable")
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {createSlots.map((s) => (
                                            <SelectItem
                                                key={s.startTime}
                                                value={s.startTime}
                                            >
                                                {s.startTime}–{s.endTime}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {availableCreateSlotsQuery.isError ? (
                                    <div className="text-xs text-red-600 dark:text-red-400">
                                        {(availableCreateSlotsQuery.error as any)?.message ||
                                            t("calendar.hourLoadFailed")}
                                    </div>
                                ) : null}
                            </div>

                            <div className="space-y-1 min-w-0 col-span-2">
                                <div className="text-xs text-muted-foreground">
                                    {t("calendar.customerLabel")}
                                </div>
                                <Popover
                                    open={createCustomerPickerOpen}
                                    onOpenChange={(next) => {
                                        if (customersPickerQuery.isPending) return;
                                        setCreateCustomerPickerOpen(next);
                                        if (next) setCreateCustomerSearch("");
                                    }}
                                >
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={customersPickerQuery.isPending}
                                            className="rounded-xl w-full justify-between text-start"
                                        >
                                            <span className="truncate text-start">
                                                {customersPickerQuery.isPending
                                                    ? t("calendar.customersLoading")
                                                    : selectedCustomerForPicker
                                                        ? `${selectedCustomerForPicker.fullName || t("calendar.noName")} • ${selectedCustomerForPicker.phone}${selectedCustomerForPicker.email ? ` • ${selectedCustomerForPicker.email}` : ""}`
                                                        : customersForPicker.length
                                                            ? t("calendar.customerChoose")
                                                            : t("calendar.customerNone")}
                                            </span>
                                            <ChevronsUpDown className="h-4 w-4 opacity-50 ms-2" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        align="start"
                                        className="w-[var(--radix-popover-trigger-width)] p-2 text-start"
                                    >
                                        <Input
                                            value={createCustomerSearch}
                                            onChange={(e) => setCreateCustomerSearch(e.target.value)}
                                            placeholder={t("calendar.customerSearchPlaceholder")}
                                            className="rounded-lg h-9"
                                        />
                                        <div className="mt-2 max-h-60 overflow-y-auto">
                                            {filteredCustomersForPicker.length ? (
                                                <div className="space-y-1">
                                                    {filteredCustomersForPicker.map((c) => {
                                                        const disabled =
                                                            c.status === "BLOCKED" ||
                                                            !c.fullName.trim() ||
                                                            !c.phone.trim() ||
                                                            !c.email;
                                                        const isSelected = c._id === createExistingCustomerId;

                                                        return (
                                                            <button
                                                                key={c._id}
                                                                type="button"
                                                                disabled={disabled}
                                                                onClick={() => {
                                                                    if (disabled) return;
                                                                    setCreateExistingCustomerId(c._id);
                                                                    setCreateCustomerPickerOpen(false);
                                                                    setCreateCustomerSearch("");
                                                                }}
                                                                className={
                                                                    "w-full rounded-md px-2 py-2 text-sm transition-colors text-start" +
                                                                    (disabled
                                                                        ? " opacity-50 cursor-not-allowed"
                                                                        : " hover:bg-muted") +
                                                                    (isSelected ? " bg-muted" : "")
                                                                }
                                                            >
                                                                <div className="truncate">
                                                                    {c.fullName || t("calendar.noName")} • {c.phone}
                                                                </div>
                                                                <div className="truncate text-xs text-muted-foreground">
                                                                    {c.email ? c.email : t("calendar.missingEmail")}
                                                                    {c.status === "BLOCKED"
                                                                        ? ` • ${t("calendar.customerBlocked")}`
                                                                        : !c.fullName.trim() ||
                                                                            !c.phone.trim() ||
                                                                            !c.email
                                                                            ? ` • ${t("calendar.customerIncomplete")}`
                                                                            : ""}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="p-2 text-sm text-muted-foreground">
                                                    {t("calendar.customerNoResults")}
                                                </div>
                                            )}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <div className="text-xs text-muted-foreground">
                                    {t("calendar.customerHelper")}
                                </div>
                                {customersPickerQuery.isError ? (
                                    <div className="text-xs text-red-600 dark:text-red-400">
                                        {(customersPickerQuery.error as any)?.message ||
                                            t("calendar.customersLoadFailed")}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">
                                {t("calendar.notesLabel")}
                            </div>
                            <Textarea
                                className="rounded-xl"
                                value={createNotes}
                                onChange={(e) => setCreateNotes(e.target.value)}
                                placeholder={t("calendar.notesPlaceholder")}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            className="rounded-2xl"
                            onClick={() => {
                                setCreateOpen(false);
                                resetCreateForm();
                            }}
                        >
                            {t("calendar.cancel")}
                        </Button>
                        <Button
                            type="button"
                            className="rounded-2xl"
                            onClick={createAppointment}
                            disabled={creating || !canCreateAppointment}
                        >
                            {creating ? t("calendar.saving") : t("calendar.save")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {showLoading ? (
                <CenteredSpinner className="min-h-[20vh] items-center" />
            ) : visibleAppointments.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                    {t("calendar.noAppointmentsForDay")}
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
                                            {t("calendar.bookedByYou")}
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
                                        <div className="flex items-center justify-between gap-2 mt-2">
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
                                                variant="ghost"
                                                className="rounded-xl ms-auto text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
                                                onClick={() => {
                                                    const incoming = isIncomingAppointment({
                                                        date: a.date,
                                                        endTime: a.endTime,
                                                    });
                                                    if (incoming) setCancelId(a.id);
                                                    else cancelAppointmentById(a.id, false);
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <Badge
                                        className={
                                            String(a.status) === "BOOKED"
                                                ? "bg-emerald-600 text-white"
                                                : String(a.status) === "COMPLETED"
                                                    ? "bg-blue-600 text-white"
                                                    : isNoShowStatus(a.status)
                                                        ? "bg-red-600 text-white"
                                                        : isCanceledStatus(a.status)
                                                            ? "bg-gray-500 text-white dark:bg-gray-700"
                                                            : "bg-gray-600 text-white"
                                        }
                                    >
                                        {statusLabel(a.status)}
                                    </Badge>

                                    {showAll || !isCanceledStatus(a.status) ? (
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
                                                {(() => {
                                                    const current = isCanceledStatus(a.status)
                                                        ? "CANCELED"
                                                        : isNoShowStatus(a.status)
                                                            ? "NO_SHOW"
                                                            : String(a.status ?? "").toUpperCase();

                                                    const apptDate = String(a.date ?? "").slice(0, 10);
                                                    const isValidApptDate = /^\d{4}-\d{2}-\d{2}$/.test(
                                                        apptDate,
                                                    );
                                                    const isPastDateOnly = isValidApptDate && apptDate < todayLocal;
                                                    const isEarlierToday =
                                                        isValidApptDate &&
                                                        apptDate === todayLocal &&
                                                        Number.isFinite(parseTimeToMinutes(a.startTime)) &&
                                                        Number.isFinite(parseTimeToMinutes(nowTimeLocal)) &&
                                                        parseTimeToMinutes(a.startTime) <
                                                        parseTimeToMinutes(nowTimeLocal);
                                                    const isPastAppointment = isPastDateOnly || isEarlierToday;
                                                    const isIncoming = isIncomingAppointment({
                                                        date: String((a as any)?.date ?? ""),
                                                        endTime: String((a as any)?.endTime ?? ""),
                                                    });

                                                    const allowedTargets: Array<
                                                        "BOOKED" | "COMPLETED" | "NO_SHOW" | "CANCELED"
                                                    > =
                                                        current === "COMPLETED"
                                                            ? ["CANCELED", "NO_SHOW"]
                                                            : current === "CANCELED"
                                                                ? ["COMPLETED", "NO_SHOW"]
                                                                : current === "NO_SHOW"
                                                                    ? ["COMPLETED", "CANCELED"]
                                                                    : current === "BOOKED"
                                                                        ? ["COMPLETED", "NO_SHOW", "CANCELED"]
                                                                        : ["COMPLETED", "NO_SHOW", "CANCELED"];

                                                    return (
                                                        <>
                                                            {allowedTargets.includes("BOOKED") && !isPastAppointment ? (
                                                                <DropdownMenuItem
                                                                    onClick={() => updateStatus(a.id, "BOOKED")}
                                                                    disabled={statusUpdatingId === a.id}
                                                                >
                                                                    Set as BOOKED
                                                                </DropdownMenuItem>
                                                            ) : null}

                                                            {allowedTargets.includes("COMPLETED") ? (
                                                                <DropdownMenuItem
                                                                    onClick={() => updateStatus(a.id, "COMPLETED")}
                                                                    disabled={statusUpdatingId === a.id}
                                                                >
                                                                    Set as COMPLETED
                                                                </DropdownMenuItem>
                                                            ) : null}

                                                            {allowedTargets.includes("NO_SHOW") ? (
                                                                <DropdownMenuItem
                                                                    onClick={() => updateStatus(a.id, "NO_SHOW")}
                                                                    disabled={statusUpdatingId === a.id}
                                                                >
                                                                    Set as NO SHOW
                                                                </DropdownMenuItem>
                                                            ) : null}

                                                            {allowedTargets.includes("CANCELED") &&
                                                                !(isIncoming && current === "BOOKED") ? (
                                                                <DropdownMenuItem
                                                                    onClick={() => {
                                                                        const incoming = isIncomingAppointment({
                                                                            date: a.date,
                                                                            endTime: a.endTime,
                                                                        });
                                                                        if (incoming && current === "BOOKED") {
                                                                            setCancelId(a.id);
                                                                        } else {
                                                                            cancelAppointmentById(a.id, false);
                                                                        }
                                                                    }}
                                                                    disabled={statusUpdatingId === a.id}
                                                                >
                                                                    Set as CANCELED
                                                                </DropdownMenuItem>
                                                            ) : null}
                                                        </>
                                                    );
                                                })()}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    ) : null}
                                </div>
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
                    await cancelAppointmentById(cancelId, true);
                    setCancelId(null);
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
                        <div className="text-sm text-muted-foreground">No available times.</div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-sm font-medium">Available hours</div>
                            <Select
                                value={selectedStartTime}
                                onValueChange={(v) => setSelectedStartTime(v)}
                            >
                                <SelectTrigger className="rounded-xl w-full">
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
                            className="rounded-2xl"
                            disabled={rescheduling || timesLoading}
                            onClick={() => setRescheduleId(null)}
                        >
                            Close
                        </Button>
                        <Button
                            type="button"
                            className="rounded-2xl"
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
