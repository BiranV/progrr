"use client";

import React from "react";
import Flatpickr from "react-flatpickr";

import { english } from "flatpickr/dist/l10n/default";
import { Arabic } from "flatpickr/dist/l10n/ar";
import { Hebrew } from "flatpickr/dist/l10n/he";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronsUpDown,
  Check,
  Loader2,
  MoreVertical,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/useI18n";
import { formatTimeRange } from "@/lib/utils";
import { normalizeEmail } from "@/lib/email";
import { formatPhoneNumber } from "@/lib/phone-format";

import { CenteredSpinner } from "@/components/CenteredSpinner";
import { PhoneLink } from "@/components/PhoneLink";
import SwipeableAppointmentCard from "@/components/calendar/SwipeableAppointmentCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SidePanel from "@/components/ui/side-panel";

import { useAuth } from "@/context/AuthContext";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatDateForDisplay(date: string): string {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(date ?? ""));
  if (!match) return date;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function wrapRtlSegment(value: string): string {
  const text = String(value ?? "");
  if (!text) return text;
  return `\u2067${text}\u2069`;
}

function weekdayFromDateString(dateStr: string): number {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(dateStr));
  if (!match) return NaN;
  const [_, y, m, d] = match;
  const date = new Date(`${y}-${m}-${d}T00:00:00`);
  return date.getDay();
}

function ymdFromDateLocal(date: Date): string {
  const SWIPE_HINT_KEY = "calendarSwipeHintSeen";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const SWIPE_HINT_KEY = "calendarSwipeHintSeen";

export default function CalendarClient() {
  const { t, language } = useI18n();
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
  const [showSwipeHint, setShowSwipeHint] = React.useState(false);
  const [isTouch, setIsTouch] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  type Appointment = {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    serviceName: string;
    status: string;
    paymentStatus?: "PAID" | "UNPAID" | string;
    cancelledBy?: string;
    bookedByYou?: boolean;
    customer: { fullName: string; phone: string; email?: string };
    notes?: string;
  };

  type AppointmentStatus = "BOOKED" | "COMPLETED" | "CANCELED";
  type ManualStatus = "COMPLETED" | "CANCELED";
  const SWIPE_FEEDBACK_MS = 3500;
  type SwipeFeedback = {
    message: string;
    nextStatus: AppointmentStatus;
    previous: {
      status: AppointmentStatus;
      cancelledBy?: string;
      paymentStatus?: Appointment["paymentStatus"];
    };
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
        throw new Error(
          json?.error || t("errors.requestFailed", { status: res.status }),
        );
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

  const [cancelling, setCancelling] = React.useState(false);

  const [rescheduleId, setRescheduleId] = React.useState<string | null>(null);
  const [rescheduleTitle, setRescheduleTitle] = React.useState<{
    timeRange: string;
    serviceName: string;
  } | null>(null);
  const [timesLoading, setTimesLoading] = React.useState(false);
  const [timesError, setTimesError] = React.useState<string | null>(null);
  const [availableTimes, setAvailableTimes] = React.useState<
    Array<{ startTime: string; endTime: string }>
  >([]);
  const [selectedStartTime, setSelectedStartTime] = React.useState<string>("");
  const [rescheduling, setRescheduling] = React.useState(false);

  const resetReschedule = React.useCallback(() => {
    setRescheduleId(null);
    setRescheduleTitle(null);
    setTimesError(null);
    setAvailableTimes([]);
    setSelectedStartTime("");
  }, []);

  const [statusUpdatingId, setStatusUpdatingId] = React.useState<string | null>(
    null,
  );
  const [paymentUpdatingId, setPaymentUpdatingId] = React.useState<
    string | null
  >(null);
  const [statusConfirmationsById, setStatusConfirmationsById] = React.useState<
    Record<string, { from: AppointmentStatus; to: ManualStatus }>
  >({});
  const [cancelConfirmationsById, setCancelConfirmationsById] = React.useState<
    Record<string, { notifyCustomer: boolean }>
  >({});

  const [swipeFeedbackById, setSwipeFeedbackById] = React.useState<
    Record<string, SwipeFeedback>
  >({});
  const swipeFeedbackTimers = React.useRef<Record<string, number>>({});

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
        throw new Error(
          json?.error || t("errors.requestFailed", { status: res.status }),
        );
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
        email: normalizeEmail((c as any)?.email) || undefined,
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
      Boolean(normalizeEmail(c.email || ""));
    return serviceOk && startOk && customerOk;
  }, [createServiceId, createStartTime, selectedCustomerForPicker]);

  const isRtl = React.useMemo(
    () => /^he(\b|-)|^ar(\b|-)/i.test(String(language || "")),
    [language],
  );

  const resolvedLocale = React.useMemo(() => {
    const lang = String(language || "").toLowerCase();
    if (lang.startsWith("he")) {
      return {
        ...Hebrew,
        rtl: true,
        months: {
          shorthand: Hebrew.months.shorthand.map(wrapRtlSegment),
          longhand: Hebrew.months.longhand.map(wrapRtlSegment),
        },
      };
    }
    if (lang.startsWith("ar")) {
      return {
        ...Arabic,
        rtl: true,
        months: {
          shorthand: Arabic.months.shorthand.map(wrapRtlSegment),
          longhand: Arabic.months.longhand.map(wrapRtlSegment),
        },
      };
    }
    return { ...english };
  }, [language]);

  const flatpickrKey = React.useMemo(
    () => `${language || ""}-${isRtl ? "rtl" : "ltr"}`,
    [isRtl, language],
  );

  const availabilityByDay = React.useMemo(() => {
    const days = Array.isArray((user as any)?.onboarding?.availability?.days)
      ? ((user as any).onboarding.availability.days as any[])
      : [];
    const map = new Map<
      number,
      { enabled: boolean; ranges: Array<{ start?: string; end?: string }> }
    >();

    for (const raw of days) {
      const day = Number((raw as any)?.day);
      if (!Number.isInteger(day)) continue;
      const enabled = Boolean((raw as any)?.enabled);
      const ranges = Array.isArray((raw as any)?.ranges)
        ? ((raw as any).ranges as Array<{ start?: string; end?: string }>).map(
            (r) => ({ start: r?.start, end: r?.end }),
          )
        : String((raw as any)?.start ?? "").trim() ||
            String((raw as any)?.end ?? "").trim()
          ? [{ start: (raw as any)?.start, end: (raw as any)?.end }]
          : [];

      map.set(day, { enabled, ranges });
    }

    return map;
  }, [user]);

  const todayYmd = React.useMemo(() => ymdFromDateLocal(new Date()), []);

  const isDateAvailableYmd = React.useCallback(
    (ymd: string) => {
      if (availabilityByDay.size === 0) return true;
      const dateStr = String(ymd || "").trim();
      const weekday = weekdayFromDateString(dateStr);
      if (!Number.isInteger(weekday)) return false;
      const conf = availabilityByDay.get(weekday);
      if (!conf || !conf.enabled) return false;
      const ranges = Array.isArray(conf.ranges) ? conf.ranges : [];
      return ranges.some(
        (r) => String(r?.start ?? "").trim() && String(r?.end ?? "").trim(),
      );
    },
    [availabilityByDay],
  );

  const isDisabledYmd = React.useCallback(
    (ymd: string) => {
      const dateStr = String(ymd || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return true;
      return !isDateAvailableYmd(dateStr);
    },
    [isDateAvailableYmd],
  );

  const normalizeStatusKey = React.useCallback(
    (status: unknown): AppointmentStatus => {
      const s = String(status ?? "").toUpperCase();
      if (s === "COMPLETED") return "COMPLETED";
      if (s === "CANCELED" || s === "CANCELLED") return "CANCELED";
      if (s === "BOOKED") return "BOOKED";
      return "CANCELED";
    },
    [],
  );

  const isCanceledStatus = React.useCallback((status: unknown) => {
    const s = String(status ?? "").toUpperCase();
    return s === "CANCELED" || s === "CANCELLED";
  }, []);

  const statusLabel = React.useCallback(
    (status: unknown) => {
      const s = normalizeStatusKey(status);
      if (s === "COMPLETED") return t("calendar.status.completed");
      if (s === "CANCELED") return t("calendar.status.canceled");
      return t("calendar.status.booked");
    },
    [normalizeStatusKey, t],
  );

  const translateCalendarError = React.useCallback(
    (message: string) => {
      if (message === "Cannot change status of a canceled appointment") {
        return t("calendar.errors.cannotChangeCanceled");
      }
      return message;
    },
    [t],
  );

  const updateStatus = React.useCallback(
    async (appointment: Appointment, nextStatus: ManualStatus) => {
      setError(null);
      setStatusUpdatingId(appointment.id);
      try {
        const res = await fetch(
          `/api/appointments/${encodeURIComponent(appointment.id)}/status`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
          },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            json?.error || t("errors.requestFailed", { status: res.status }),
          );
        }

        toast.success(
          nextStatus === "COMPLETED"
            ? t("calendar.toast.markedCompleted")
            : t("calendar.toast.markedCanceled"),
        );

        await queryClient.invalidateQueries({
          queryKey: ["appointments", date],
        });
        await queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
        await queryClient.invalidateQueries({
          queryKey: ["dashboardRevenueSeries"],
        });
      } catch (e: any) {
        const raw = String(e?.message || t("errors.failedToSave"));
        const msg = translateCalendarError(raw);
        setError(msg);
        toast.error(msg);
      } finally {
        setStatusUpdatingId(null);
      }
    },
    [date, queryClient, t, translateCalendarError],
  );

  const updateAppointmentCache = React.useCallback(
    (appointmentId: string, updater: (current: Appointment) => Appointment) => {
      const key = ["appointments", date] as const;
      const previous = queryClient.getQueryData<Appointment[]>(key);
      queryClient.setQueryData(key, (oldData: unknown) => {
        if (!Array.isArray(oldData)) return oldData;
        return (oldData as Appointment[]).map((appt) =>
          appt.id === appointmentId ? updater(appt) : appt,
        );
      });
      return Array.isArray(previous) ? previous : null;
    },
    [date, queryClient],
  );

  const dismissSwipeFeedback = React.useCallback((appointmentId: string) => {
    const timerId = swipeFeedbackTimers.current[appointmentId];
    if (timerId) {
      window.clearTimeout(timerId);
      delete swipeFeedbackTimers.current[appointmentId];
    }

    setSwipeFeedbackById((prev) => {
      if (!prev[appointmentId]) return prev;
      const next = { ...prev };
      delete next[appointmentId];
      return next;
    });
  }, []);

  React.useEffect(() => {
    return () => {
      Object.values(swipeFeedbackTimers.current).forEach((id) => {
        window.clearTimeout(id);
      });
      swipeFeedbackTimers.current = {};
    };
  }, []);

  const showSwipeFeedback = React.useCallback(
    (appointment: Appointment, nextStatus: AppointmentStatus) => {
      const previousStatus = normalizeStatusKey(appointment.status);
      const message =
        nextStatus === "COMPLETED"
          ? t("calendar.inlineFeedback.completed")
          : t("calendar.inlineFeedback.canceled");

      setSwipeFeedbackById((prev) => ({
        ...prev,
        [appointment.id]: {
          message,
          nextStatus,
          previous: {
            status: previousStatus,
            cancelledBy: appointment.cancelledBy,
            paymentStatus: appointment.paymentStatus,
          },
        },
      }));

      const existing = swipeFeedbackTimers.current[appointment.id];
      if (existing) window.clearTimeout(existing);
      swipeFeedbackTimers.current[appointment.id] = window.setTimeout(() => {
        dismissSwipeFeedback(appointment.id);
      }, SWIPE_FEEDBACK_MS);
    },
    [dismissSwipeFeedback, normalizeStatusKey, t],
  );

  const undoSwipeFeedback = React.useCallback(
    async (appointmentId: string) => {
      const feedback = swipeFeedbackById[appointmentId];
      if (!feedback) return;

      dismissSwipeFeedback(appointmentId);
      setStatusUpdatingId(appointmentId);

      updateAppointmentCache(appointmentId, (current) => ({
        ...current,
        status: feedback.previous.status,
        cancelledBy: feedback.previous.cancelledBy,
        paymentStatus: feedback.previous.paymentStatus,
      }));

      try {
        const res = await fetch(
          `/api/appointments/${encodeURIComponent(appointmentId)}/status`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: feedback.previous.status }),
          },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            json?.error || t("errors.requestFailed", { status: res.status }),
          );
        }
      } catch (e: any) {
        const raw = String(e?.message || t("errors.failedToSave"));
        const msg = translateCalendarError(raw);
        toast.error(msg);
      } finally {
        setStatusUpdatingId(null);
        await queryClient.invalidateQueries({
          queryKey: ["appointments", date],
        });
        await queryClient.invalidateQueries({
          queryKey: ["dashboardSummary"],
        });
        await queryClient.invalidateQueries({
          queryKey: ["dashboardRevenueSeries"],
        });
      }
    },
    [
      date,
      dismissSwipeFeedback,
      queryClient,
      swipeFeedbackById,
      t,
      translateCalendarError,
      updateAppointmentCache,
    ],
  );

  const swipeUpdateStatus = React.useCallback(
    async (appointment: Appointment, nextStatus: ManualStatus) => {
      const from = normalizeStatusKey(appointment.status);
      if (from === nextStatus) return;

      setStatusUpdatingId(appointment.id);
      const previous = updateAppointmentCache(appointment.id, (current) => ({
        ...current,
        status: nextStatus,
        cancelledBy:
          nextStatus === "CANCELED" ? "BUSINESS" : current.cancelledBy,
      }));

      try {
        const res = await fetch(
          `/api/appointments/${encodeURIComponent(appointment.id)}/status`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
          },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            json?.error || t("errors.requestFailed", { status: res.status }),
          );
        }

        await queryClient.invalidateQueries({
          queryKey: ["appointments", date],
        });
        await queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
        await queryClient.invalidateQueries({
          queryKey: ["dashboardRevenueSeries"],
        });
      } catch (e: any) {
        if (previous) {
          queryClient.setQueryData(["appointments", date], previous);
        }
        const raw = String(e?.message || t("errors.failedToSave"));
        const msg = translateCalendarError(raw);
        toast.error(msg);
      } finally {
        setStatusUpdatingId(null);
      }
    },
    [
      date,
      normalizeStatusKey,
      queryClient,
      t,
      translateCalendarError,
      updateAppointmentCache,
    ],
  );

  const swipeCancelAppointment = React.useCallback(
    async (appointment: Appointment, notifyCustomer: boolean) => {
      if (isCanceledStatus(appointment.status)) return;

      setStatusUpdatingId(appointment.id);
      const previous = updateAppointmentCache(appointment.id, (current) => ({
        ...current,
        status: "CANCELED",
        cancelledBy: "BUSINESS",
      }));

      try {
        const res = await fetch(
          `/api/appointments/${encodeURIComponent(appointment.id)}/cancel`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notifyCustomer }),
          },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            json?.error || t("errors.requestFailed", { status: res.status }),
          );
        }

        if (notifyCustomer && json?.email?.sent === false) {
          toast.error(
            String(
              json?.email?.error ||
                t("calendar.errors.failedToEmailCustomerCancel"),
            ),
          );
        }

        await queryClient.invalidateQueries({
          queryKey: ["appointments", date],
        });
        await queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
        await queryClient.invalidateQueries({
          queryKey: ["dashboardRevenueSeries"],
        });
      } catch (e: any) {
        if (previous) {
          queryClient.setQueryData(["appointments", date], previous);
        }
        const raw = String(e?.message || t("errors.failedToSave"));
        const msg = translateCalendarError(raw);
        toast.error(msg);
      } finally {
        setStatusUpdatingId(null);
      }
    },
    [
      date,
      isCanceledStatus,
      queryClient,
      t,
      translateCalendarError,
      updateAppointmentCache,
    ],
  );

  const updatePaymentStatus = React.useCallback(
    async (appointment: Appointment, nextPaymentStatus: "PAID" | "UNPAID") => {
      setError(null);
      setPaymentUpdatingId(appointment.id);
      try {
        const res = await fetch(
          `/api/appointments/${encodeURIComponent(appointment.id)}/payment-status`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentStatus: nextPaymentStatus }),
          },
        );
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            json?.error || t("errors.requestFailed", { status: res.status }),
          );
        }

        await queryClient.invalidateQueries({
          queryKey: ["appointments", date],
        });
        await queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
        await queryClient.invalidateQueries({
          queryKey: ["dashboardRevenueSeries"],
        });
      } catch (e: any) {
        const raw = String(e?.message || t("errors.failedToSave"));
        const msg = translateCalendarError(raw);
        setError(msg);
        toast.error(msg);
      } finally {
        setPaymentUpdatingId(null);
      }
    },
    [date, queryClient, t, translateCalendarError],
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
        throw new Error(
          json?.error || t("errors.requestFailed", { status: res.status }),
        );
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
        throw new Error(
          json?.error || t("errors.requestFailed", { status: res.status }),
        );
      }

      toast.success(t("calendar.appointmentCreated"));

      if (json?.email?.sent === false) {
        toast.error(
          String(
            json?.email?.error ||
              t("calendar.errors.failedToEmailCustomerCreate"),
          ),
        );
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

  const getStatusConfirmationMessage = React.useCallback(
    (
      appt: Appointment,
      change: { from: AppointmentStatus; to: ManualStatus },
    ) => {
      const isIncoming = isIncomingAppointment({
        date: String(appt.date ?? ""),
        endTime: String(appt.endTime ?? ""),
      });

      if (change.from === "CANCELED" && change.to === "COMPLETED") {
        return t("calendar.statusConfirm.canceledToCompleted");
      }
      if (isIncoming && change.to === "COMPLETED") {
        return t("calendar.statusConfirm.futureCompleted");
      }

      return null;
    },
    [isIncomingAppointment, t],
  );

  const requestStatusChange = React.useCallback(
    (appointment: Appointment, nextStatus: ManualStatus) => {
      const from = normalizeStatusKey(appointment.status);
      if (from === nextStatus) return;
      const change = { from, to: nextStatus };
      const message = getStatusConfirmationMessage(appointment, change);
      if (message) {
        setStatusConfirmationsById((prev) => ({
          ...prev,
          [appointment.id]: change,
        }));
        return;
      }
      updateStatus(appointment, nextStatus);
    },
    [getStatusConfirmationMessage, normalizeStatusKey, updateStatus],
  );

  const clearStatusConfirmation = React.useCallback((appointmentId: string) => {
    setStatusConfirmationsById((prev) => {
      if (!prev[appointmentId]) return prev;
      const next = { ...prev };
      delete next[appointmentId];
      return next;
    });
  }, []);

  const confirmStatusChange = React.useCallback(
    async (appointment: Appointment) => {
      const pending = statusConfirmationsById[appointment.id];
      if (!pending) return;
      try {
        await updateStatus(appointment, pending.to);
      } finally {
        clearStatusConfirmation(appointment.id);
      }
    },
    [clearStatusConfirmation, statusConfirmationsById, updateStatus],
  );

  const clearCancelConfirmation = React.useCallback((appointmentId: string) => {
    setCancelConfirmationsById((prev) => {
      if (!prev[appointmentId]) return prev;
      const next = { ...prev };
      delete next[appointmentId];
      return next;
    });
  }, []);

  const cancelStatusChange = React.useCallback(
    (appointmentId: string) => {
      clearStatusConfirmation(appointmentId);
      clearCancelConfirmation(appointmentId);
    },
    [clearStatusConfirmation, clearCancelConfirmation],
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
          throw new Error(
            json?.error || t("errors.requestFailed", { status: res.status }),
          );
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
                t("calendar.errors.failedToEmailCustomerCancel"),
            ),
          );
        }
      } finally {
        setCancelling(false);
      }
    },
    [date, queryClient],
  );

  const confirmCancelChange = React.useCallback(
    async (appointmentId: string, notifyCustomer: boolean) => {
      try {
        await cancelAppointmentById(appointmentId, notifyCustomer);
      } finally {
        clearCancelConfirmation(appointmentId);
      }
    },
    [cancelAppointmentById, clearCancelConfirmation],
  );

  React.useEffect(() => {
    if (!appointmentsQuery.isError) return;
    const msg =
      (appointmentsQuery.error as any)?.message ||
      t("calendar.errors.failedToLoadAppointments");
    setError(msg);
  }, [appointmentsQuery.isError, appointmentsQuery.error, t]);

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
    // - Future date: only BOOKED (exclude COMPLETED)
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

  React.useEffect(() => {
    if (!isTouch) {
      setShowSwipeHint(false);
      return;
    }
    if (!visibleAppointments.length) return;
    try {
      const seen = window.localStorage.getItem(SWIPE_HINT_KEY) === "true";
      if (!seen) setShowSwipeHint(true);
    } catch {
      setShowSwipeHint(true);
    }
  }, [isTouch, visibleAppointments.length]);

  const dismissSwipeHint = React.useCallback(() => {
    try {
      window.localStorage.setItem(SWIPE_HINT_KEY, "true");
    } catch {
      // ignore
    }
    setShowSwipeHint(false);
  }, []);

  const openReschedule = React.useCallback(
    async (appt: {
      id: string;
      startTime: string;
      endTime: string;
      serviceName: string;
    }) => {
      setRescheduleId(appt.id);
      setRescheduleTitle({
        timeRange: formatTimeRange(appt.startTime, appt.endTime),
        serviceName: appt.serviceName,
      });
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
          throw new Error(
            json?.error || t("errors.requestFailed", { status: res.status }),
          );
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
        setTimesError(
          e?.message || t("calendar.errors.failedToLoadAvailableTimes"),
        );
      } finally {
        setTimesLoading(false);
      }
    },
    [date, t],
  );

  const submitReschedule = React.useCallback(async () => {
    if (!rescheduleId) return;
    setRescheduling(true);
    setTimesError(null);
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
        throw new Error(
          json?.error || t("errors.requestFailed", { status: res.status }),
        );
      }

      const emailSent = json?.email?.sent;
      if (emailSent === false) {
        setError(
          String(
            json?.email?.error ||
              t("calendar.errors.failedToEmailCustomerReschedule"),
          ),
        );
      }

      const matchedSlot = availableTimes.find(
        (slot) => slot.startTime === selectedStartTime,
      );
      const nextEndTime = matchedSlot?.endTime;
      queryClient.setQueryData(["appointments", date], (oldData: any) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map((appt) => {
          if (String(appt?.id ?? "") !== String(rescheduleId)) return appt;
          return {
            ...appt,
            startTime: selectedStartTime,
            endTime: nextEndTime ?? appt.endTime,
          };
        });
      });

      resetReschedule();
      await queryClient.invalidateQueries({ queryKey: ["appointments", date] });
    } finally {
      setRescheduling(false);
    }
  }, [
    availableTimes,
    date,
    queryClient,
    resetReschedule,
    rescheduleId,
    selectedStartTime,
    t,
  ]);

  const flatpickrOptions = React.useMemo(() => {
    return {
      mode: "single" as const,
      dateFormat: "Y-m-d",
      inline: true,
      disableMobile: false,
      monthSelectorType: "static" as const,
      locale: resolvedLocale,
      disable: [
        (d: Date) => {
          const ymd = ymdFromDateLocal(d);
          return isDisabledYmd(ymd);
        },
      ],
      onDayCreate: (
        _dObj: Date,
        _dStr: string,
        fp: any,
        dayElem: HTMLElement,
      ) => {
        const elem = dayElem as HTMLElement & { dateObj?: Date };
        const ymd = ymdFromDateLocal(elem.dateObj as Date);
        if (todayYmd && ymd < todayYmd) {
          dayElem.classList.add("pastDay");
        }
      },
    };
  }, [isDisabledYmd, resolvedLocale, todayYmd]);

  return (
    <div className="space-y-6 pb-5">
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
          key={flatpickrKey}
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
          {formatDateForDisplay(date)}
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
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl text-primary hover:bg-primary/10"
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
            aria-label={t("calendar.refresh")}
            title={t("calendar.refresh")}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
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
        <div className="flex justify-center">
          <div className="w-full max-w-md rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-200 text-center">
            {error}
          </div>
        </div>
      ) : null}

      <SidePanel
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
        title={t("calendar.newAppointmentTitle")}
        description={t("calendar.newAppointmentDescription")}
      >
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
                    <SelectItem key={s.id} value={s.id}>
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
                disabled={
                  !createServiceId || availableCreateSlotsQuery.isPending
                }
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
                    <SelectItem key={s.startTime} value={s.startTime}>
                      <span dir="ltr">
                        {formatTimeRange(s.startTime, s.endTime)}
                      </span>
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
                          ? `${selectedCustomerForPicker.fullName || t("calendar.noName")} • ${formatPhoneNumber(selectedCustomerForPicker.phone, language) || selectedCustomerForPicker.phone}${selectedCustomerForPicker.email ? ` • ${selectedCustomerForPicker.email}` : ""}`
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
                            <div
                              key={c._id}
                              role="button"
                              tabIndex={disabled ? -1 : 0}
                              aria-disabled={disabled}
                              onClick={() => {
                                if (disabled) return;
                                setCreateExistingCustomerId(c._id);
                                setCreateCustomerPickerOpen(false);
                                setCreateCustomerSearch("");
                              }}
                              onKeyDown={(e) => {
                                if (disabled) return;
                                if (e.key !== "Enter" && e.key !== " ") return;
                                e.preventDefault();
                                setCreateExistingCustomerId(c._id);
                                setCreateCustomerPickerOpen(false);
                                setCreateCustomerSearch("");
                              }}
                              className={
                                "w-full rounded-md px-2 py-2 text-sm transition-colors text-start" +
                                (disabled
                                  ? " opacity-50 cursor-default"
                                  : " hover:bg-muted") +
                                (isSelected ? " bg-muted" : "")
                              }
                            >
                              <div className="truncate flex items-center gap-1">
                                <span className="truncate">
                                  {c.fullName || t("calendar.noName")}
                                </span>
                                <span className="text-muted-foreground">•</span>
                                <PhoneLink
                                  phone={c.phone}
                                  className="text-xs"
                                  stopPropagation
                                />
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
                            </div>
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

          <div className="pt-2">
            <Button
              type="button"
              className="rounded-2xl w-full"
              onClick={createAppointment}
              disabled={creating || !canCreateAppointment}
              data-panel-primary="true"
            >
              {creating ? t("calendar.saving") : t("calendar.save")}
            </Button>
          </div>
        </div>
      </SidePanel>

      {showLoading ? (
        <CenteredSpinner className="min-h-[20vh] items-center" />
      ) : visibleAppointments.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {t("calendar.noAppointmentsForDay")}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleAppointments.map((a, index) => {
            const statusConfirmation = statusConfirmationsById[a.id];
            const cancelConfirmation = cancelConfirmationsById[a.id];
            const confirmationMessage = statusConfirmation
              ? getStatusConfirmationMessage(a, statusConfirmation)
              : cancelConfirmation
                ? t("calendar.statusConfirm.cancelConfirm")
                : null;
            const isStatusConfirming = Boolean(confirmationMessage);
            const statusKey = normalizeStatusKey(a.status);
            const swipeFeedback = swipeFeedbackById[a.id];
            const isSwipeFeedbackVisible = Boolean(swipeFeedback);

            return (
              <SwipeableAppointmentCard
                key={a.id}
                showHint={showSwipeHint && index === 0}
                onHintDismiss={dismissSwipeHint}
                onSwipeRight={() => {
                  if (
                    statusUpdatingId === a.id ||
                    isStatusConfirming ||
                    isSwipeFeedbackVisible
                  )
                    return;
                  if (statusKey !== "COMPLETED") {
                    showSwipeFeedback(a, "COMPLETED");
                    swipeUpdateStatus(a, "COMPLETED");
                  }
                }}
                onSwipeLeft={() => {
                  if (
                    statusUpdatingId === a.id ||
                    isStatusConfirming ||
                    isSwipeFeedbackVisible
                  )
                    return;
                  if (statusKey === "CANCELED") return;
                  const incoming = isIncomingAppointment({
                    date: a.date,
                    endTime: a.endTime,
                  });
                  const notifyCustomer = incoming && statusKey === "BOOKED";
                  showSwipeFeedback(a, "CANCELED");
                  swipeCancelAppointment(a, notifyCustomer);
                }}
                disabled={
                  statusUpdatingId === a.id ||
                  isStatusConfirming ||
                  isSwipeFeedbackVisible
                }
              >
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 shadow-sm overflow-hidden">
                  {isSwipeFeedbackVisible ? (
                    <div className="relative flex items-center justify-between gap-3 px-4 py-3 overflow-hidden">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100 rtl:flex-row-reverse rtl:text-right">
                        {swipeFeedback?.nextStatus === "COMPLETED" ? (
                          <Check className="h-4 w-4 text-emerald-600 no-rtl-flip" />
                        ) : (
                          <X className="h-4 w-4 text-rose-600 no-rtl-flip" />
                        )}
                        <span>{swipeFeedback?.message}</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-3 rounded-md text-xs font-semibold"
                        onClick={() => undoSwipeFeedback(a.id)}
                        disabled={statusUpdatingId === a.id}
                      >
                        {t("calendar.inlineFeedback.undo")}
                      </Button>
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-200/70 dark:bg-slate-800/70">
                        <div
                          className="h-full bg-slate-500/70 dark:bg-slate-300/70 swipe-undo-progress"
                          style={{
                            animationDuration: `${SWIPE_FEEDBACK_MS}ms`,
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-gray-100/80 dark:bg-gray-900/40 relative overflow-hidden">
                        <div
                          className={
                            "absolute inset-0 z-10 flex items-center justify-between gap-3 px-3 py-2 bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100 transition-transform duration-200 " +
                            (isStatusConfirming
                              ? "translate-y-0 pointer-events-auto"
                              : "-translate-y-full pointer-events-none")
                          }
                          aria-hidden={!isStatusConfirming}
                        >
                          <div className="text-sm font-semibold leading-snug min-w-0 flex-1 text-slate-700 dark:text-slate-300">
                            {confirmationMessage}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="rounded-md whitespace-nowrap h-7 px-2 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-transparent"
                              onClick={() => {
                                if (statusConfirmation) {
                                  confirmStatusChange(a);
                                } else if (cancelConfirmation) {
                                  confirmCancelChange(
                                    a.id,
                                    cancelConfirmation.notifyCustomer,
                                  );
                                }
                              }}
                              disabled={statusUpdatingId === a.id}
                            >
                              {t("calendar.statusConfirm.confirm")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="rounded-md whitespace-nowrap h-7 px-2 text-xs !text-slate-600 dark:!text-slate-400 hover:bg-transparent hover:!text-slate-700 dark:hover:!text-slate-300"
                              onClick={() => cancelStatusChange(a.id)}
                              disabled={statusUpdatingId === a.id}
                            >
                              {t("calendar.statusConfirm.cancel")}
                            </Button>
                          </div>
                        </div>
                        <div
                          className={
                            "absolute inset-0 z-10 flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100 transition-transform duration-200 " +
                            (rescheduleId === a.id
                              ? "translate-y-0 pointer-events-auto"
                              : "-translate-y-full pointer-events-none")
                          }
                          aria-hidden={rescheduleId !== a.id}
                        >
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                            {t("calendar.reschedule.availableHours")}
                          </div>
                          <div className="flex-1 min-w-[140px]">
                            <Select
                              value={selectedStartTime}
                              onValueChange={(v) => setSelectedStartTime(v)}
                              disabled={
                                timesLoading || availableTimes.length === 0
                              }
                            >
                              <SelectTrigger className="h-7 rounded-md text-xs bg-white/80 dark:bg-slate-950/40 flex items-center gap-2">
                                <SelectValue
                                  placeholder={t(
                                    "calendar.reschedule.selectTime",
                                  )}
                                />
                                {timesLoading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                                ) : null}
                              </SelectTrigger>
                              <SelectContent>
                                {availableTimes.map((t) => (
                                  <SelectItem
                                    key={t.startTime}
                                    value={t.startTime}
                                  >
                                    <span dir="ltr">
                                      {formatTimeRange(t.startTime, t.endTime)}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-md whitespace-nowrap h-7 px-2 text-xs"
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
                                  setTimesError(
                                    e?.message ||
                                      t("calendar.reschedule.failed"),
                                  );
                                }
                              }}
                            >
                              {rescheduling
                                ? t("calendar.saving")
                                : t("calendar.save")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="rounded-md whitespace-nowrap h-7 px-2 text-xs !text-slate-600 dark:!text-slate-400 hover:bg-transparent hover:!text-slate-700 dark:hover:!text-slate-300"
                              disabled={rescheduling || timesLoading}
                              onClick={resetReschedule}
                            >
                              {t("common.cancel")}
                            </Button>
                          </div>
                        </div>
                        <div className="font-semibold text-gray-900 dark:text-white truncate">
                          <span dir="ltr">
                            {formatTimeRange(a.startTime, a.endTime)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            className={
                              "border backdrop-blur-sm " +
                              (String(a.status) === "BOOKED"
                                ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/70"
                                : String(a.status) === "COMPLETED"
                                  ? "bg-blue-50/80 text-blue-700 border-blue-200/70"
                                  : isCanceledStatus(a.status)
                                    ? "bg-gray-100/80 text-gray-600 border-gray-200/70 dark:bg-gray-800/60 dark:text-gray-200 dark:border-gray-700/60"
                                    : "bg-gray-100/80 text-gray-600 border-gray-200/70 dark:bg-gray-800/60 dark:text-gray-200 dark:border-gray-700/60")
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
                                  disabled={
                                    statusUpdatingId === a.id ||
                                    isStatusConfirming
                                  }
                                  aria-label={t(
                                    "calendar.actions.changeStatus",
                                  )}
                                  title={t("calendar.actions.changeStatus")}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {(() => {
                                  const current = normalizeStatusKey(a.status);
                                  const isIncoming = isIncomingAppointment({
                                    date: String((a as any)?.date ?? ""),
                                    endTime: String((a as any)?.endTime ?? ""),
                                  });

                                  return (
                                    <>
                                      {current === "BOOKED" && isIncoming ? (
                                        <DropdownMenuItem
                                          onClick={() => openReschedule(a)}
                                          disabled={statusUpdatingId === a.id}
                                        >
                                          {t("calendar.actions.changeHour")}
                                        </DropdownMenuItem>
                                      ) : null}

                                      {current !== "COMPLETED" ? (
                                        <DropdownMenuItem
                                          onClick={() =>
                                            requestStatusChange(a, "COMPLETED")
                                          }
                                          disabled={statusUpdatingId === a.id}
                                        >
                                          {t("calendar.actions.setAsCompleted")}
                                        </DropdownMenuItem>
                                      ) : null}

                                      {current !== "CANCELED" ? (
                                        <DropdownMenuItem
                                          onClick={() => {
                                            const incoming =
                                              isIncomingAppointment({
                                                date: a.date,
                                                endTime: a.endTime,
                                              });
                                            if (
                                              incoming &&
                                              current === "BOOKED"
                                            ) {
                                              setCancelConfirmationsById(
                                                (prev) => ({
                                                  ...prev,
                                                  [a.id]: {
                                                    notifyCustomer: true,
                                                  },
                                                }),
                                              );
                                            } else {
                                              cancelAppointmentById(
                                                a.id,
                                                false,
                                              );
                                            }
                                          }}
                                          disabled={statusUpdatingId === a.id}
                                        >
                                          {t("calendar.actions.setAsCanceled")}
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

                      <div className="flex items-start gap-3 p-3">
                        <div className="min-w-0 w-full">
                          {rescheduleId === a.id && timesError ? (
                            <div className="mb-2 text-xs text-red-600 dark:text-red-400">
                              {timesError}
                            </div>
                          ) : null}

                          <div className="flex items-center justify-between gap-3 w-full">
                            <div className="text-sm text-gray-700 dark:text-gray-200 truncate">
                              {a.serviceName}
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ms-auto">
                              {isCanceledStatus(a.status) ? (
                                <span className="text-xs text-muted-foreground">
                                  {String(a.cancelledBy || "").toUpperCase() ===
                                  "BUSINESS"
                                    ? t("calendar.cancelledBy.business")
                                    : String(
                                          a.cancelledBy || "",
                                        ).toUpperCase() === "CUSTOMER"
                                      ? t("calendar.cancelledBy.customer")
                                      : t("calendar.cancelledBy.unknown")}
                                </span>
                              ) : null}
                              {normalizeStatusKey(a.status) === "COMPLETED" ? (
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={
                                      String(
                                        a.paymentStatus ?? "UNPAID",
                                      ).toUpperCase() === "PAID"
                                    }
                                    onCheckedChange={(checked) =>
                                      updatePaymentStatus(
                                        a,
                                        checked ? "PAID" : "UNPAID",
                                      )
                                    }
                                    disabled={paymentUpdatingId === a.id}
                                    aria-label={t("calendar.paid")}
                                    className="scale-90"
                                  />
                                  <span className="text-xs text-gray-600 dark:text-gray-300 select-none">
                                    {t("calendar.paid")}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {a.bookedByYou ? (
                            <div className="text-xs text-muted-foreground mt-1">
                              {t("calendar.bookedByYou")}
                            </div>
                          ) : null}

                          <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-3 w-full">
                            <span className="flex items-center gap-1 min-w-0 rtl:flex-row-reverse">
                              <User className="h-3.5 w-3.5 text-gray-500" />
                              <span className="truncate">
                                {a.customer.fullName}
                              </span>
                            </span>
                            {a.customer.phone ? (
                              <PhoneLink
                                phone={a.customer.phone}
                                className="text-xs ms-auto"
                              />
                            ) : null}
                          </div>
                          {a.notes ? (
                            <div className="text-xs text-muted-foreground mt-1">
                              {a.notes}
                            </div>
                          ) : null}

                          {String(a.status) === "BOOKED" ? (
                            <div className="mt-2" />
                          ) : null}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </SwipeableAppointmentCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
