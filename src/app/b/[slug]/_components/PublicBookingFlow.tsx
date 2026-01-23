"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";

import { CenteredSpinner } from "@/components/CenteredSpinner";
import OtpInput from "@/components/OtpInput";
import PublicBookingShell from "./PublicBookingShell";
import { usePublicBusiness } from "./usePublicBusiness";
import { formatDateInTimeZone, formatPrice } from "@/lib/public-booking";
import { useLocale } from "@/context/LocaleContext";
import Flatpickr from "react-flatpickr";
import { english } from "flatpickr/dist/l10n/default";
import { Arabic } from "flatpickr/dist/l10n/ar";
import { Hebrew } from "flatpickr/dist/l10n/he";
import { CalendarDays, LogIn, LogOut } from "lucide-react";

type Step = "service" | "date" | "time" | "details" | "verify" | "success";

type SlotsResponse = {
  ok: boolean;
  date: string;
  timeZone: string;
  service: { id: string; name: string; durationMinutes: number };
  slots: Array<{ startTime: string; endTime: string }>;
};

type BookingResult = {
  ok: true;
  appointment: {
    id: string;
    serviceId: string;
    serviceName: string;
    durationMinutes: number;
    price: number;
    currency: string;
    date: string;
    startTime: string;
    endTime: string;
    customer: { fullName: string; phone: string; email?: string };
    notes?: string;
    status: string;
  };
  sameDayAppointments?: Array<{
    id: string;
    serviceName: string;
    date: string;
    startTime: string;
    endTime: string;
  }>;
  cancelToken: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

type ActiveAppointmentConflict = {
  code: "ACTIVE_APPOINTMENT_EXISTS" | "SAME_SERVICE_SAME_DAY_EXISTS";
  bookingSessionId: string;
  existingAppointment?: {
    id?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    serviceName?: string;
  };
  existingAppointments?: Array<{
    id?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    serviceName?: string;
  }>;
};

type MyAppointmentsItem = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  serviceName: string;
  status: string;
  cancelledBy?: any;
};

type BookingMeResponse =
  | { ok: true; loggedIn: false }
  | {
    ok: true;
    loggedIn: true;
    date: string;
    scope?: "day" | "future";
    customer?: { email?: string; fullName?: string; phone?: string };
    appointments: MyAppointmentsItem[];
  };

function weekdayFromDateString(dateStr: string): number {
  // Weekday for a civil date is timezone-independent.
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.getUTCDay();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymdFromDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

function normalizeWindows(day: any): Array<{ start: string; end: string }> {
  // Preferred shape (new requirement): windows
  const windows = Array.isArray(day?.windows) ? day.windows : [];
  const fromWindows = windows
    .map((w: any) => ({
      start: String(w?.start ?? "").trim(),
      end: String(w?.end ?? "").trim(),
    }))
    .filter(
      (w: any) =>
        /^\d{2}:\d{2}$/.test(w.start) &&
        /^\d{2}:\d{2}$/.test(w.end) &&
        w.start < w.end
    );
  if (fromWindows.length > 0) return fromWindows;

  // Current DB/UI shape: ranges
  const ranges = Array.isArray(day?.ranges) ? day.ranges : [];
  const fromRanges = ranges
    .map((r: any) => ({
      start: String(r?.start ?? "").trim(),
      end: String(r?.end ?? "").trim(),
    }))
    .filter(
      (w: any) =>
        /^\d{2}:\d{2}$/.test(w.start) &&
        /^\d{2}:\d{2}$/.test(w.end) &&
        w.start < w.end
    );
  if (fromRanges.length > 0) return fromRanges;

  // Legacy shape: start/end
  const start = String(day?.start ?? "").trim();
  const end = String(day?.end ?? "").trim();
  if (/^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) && start < end) {
    return [{ start, end }];
  }

  return [];
}

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

export default function PublicBookingFlow({
  publicIdOrSlug,
}: {
  publicIdOrSlug: string;
}) {
  const raw = String(publicIdOrSlug ?? "").trim();
  const { locale } = useLocale();

  const { data, loading, error, resolvedPublicId } = usePublicBusiness(raw);

  const publicId = React.useMemo(() => {
    if (/^\d{5}$/.test(raw)) return raw;
    return resolvedPublicId;
  }, [raw, resolvedPublicId]);

  const [step, setStep] = React.useState<Step>("service");

  const [serviceId, setServiceId] = React.useState<string>("");
  const [date, setDate] = React.useState<string>("");
  const [startTime, setStartTime] = React.useState<string>("");

  const [customerFullName, setCustomerFullName] = React.useState<string>("");
  const [customerEmail, setCustomerEmail] = React.useState<string>("");
  const [customerPhone, setCustomerPhone] = React.useState<string>("");
  const [customerPhoneValid, setCustomerPhoneValid] = React.useState(true);
  const [customerPhoneTouched, setCustomerPhoneTouched] = React.useState(false);
  const [notes, setNotes] = React.useState<string>("");

  const [otpCode, setOtpCode] = React.useState<string>("");
  const [bookingSessionId, setBookingSessionId] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const slotsCacheRef = React.useRef<Map<string, SlotsResponse>>(new Map());
  const [slots, setSlots] = React.useState<SlotsResponse | null>(null);
  const [slotsLoading, setSlotsLoading] = React.useState(false);
  const [slotsError, setSlotsError] = React.useState<string | null>(null);

  const [result, setResult] = React.useState<BookingResult | null>(null);
  const [activeConflict, setActiveConflict] =
    React.useState<ActiveAppointmentConflict | null>(null);
  const [identified, setIdentified] = React.useState(false);
  const [connected, setConnected] = React.useState(false);

  const limitCustomerToOneUpcomingAppointment = Boolean(
    (data as any)?.bookingRules?.limitCustomerToOneUpcomingAppointment
  );

  // Cookie-based customer identification (server-side): load active appointment if present.
  React.useEffect(() => {
    if (!publicId) return;
    if (!data) return;
    if (result) return;
    // When the business enforces a strict 1-upcoming-appointment rule, do not
    // auto-navigate the customer to their existing appointment screen.
    // Only show that conflict when they attempt to book.
    if (limitCustomerToOneUpcomingAppointment) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/public/booking/active?businessPublicId=${encodeURIComponent(
            publicId
          )}`
        );
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) return;

        if (json?.ok && json?.appointment) {
          setResult(json as BookingResult);
          setStep("success");
          setIdentified(true);
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data, limitCustomerToOneUpcomingAppointment, publicId, result]);

  // Cookie-based customer identification (server-side): detect connected customer even
  // when there is no "active appointment" banner (e.g. multi-appointments allowed).
  React.useEffect(() => {
    if (!publicId) return;
    if (!data) return;

    let cancelled = false;
    (async () => {
      try {
        const tz = String(data?.availability?.timezone ?? "").trim() || "UTC";
        const todayStr = formatDateInTimeZone(new Date(), tz);
        const res = await fetch(
          `/api/public/booking/me?businessPublicId=${encodeURIComponent(
            publicId
          )}&date=${encodeURIComponent(todayStr)}`
        );
        const json = (await res.json().catch(() => null)) as BookingMeResponse | null;
        if (cancelled) return;
        if (!res.ok || !json?.ok) return;

        if ((json as any)?.loggedIn) {
          setConnected(true);
          const cust = (json as any)?.customer ?? {};
          if (!customerEmail.trim() && typeof cust?.email === "string") {
            setCustomerEmail(String(cust.email));
          }
          if (!customerFullName.trim() && typeof cust?.fullName === "string") {
            setCustomerFullName(String(cust.fullName));
          }
          if (!customerPhone.trim() && typeof cust?.phone === "string") {
            setCustomerPhone(String(cust.phone));
          }
        }
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally exclude customer fields from deps: we only want to prefill once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, publicId]);

  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);
  const [cancellingConflictId, setCancellingConflictId] = React.useState<
    string | null
  >(null);
  const [cancellingSameDayId, setCancellingSameDayId] = React.useState<
    string | null
  >(null);

  const [loginOpen, setLoginOpen] = React.useState(false);
  const [loginStep, setLoginStep] = React.useState<"email" | "code">("email");
  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginCode, setLoginCode] = React.useState("");
  const [loginSubmitting, setLoginSubmitting] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);

  const [myAppointmentsOpen, setMyAppointmentsOpen] = React.useState(false);
  const [myAppointmentsDate, setMyAppointmentsDate] = React.useState<string>("");
  const [myAppointmentsScope, setMyAppointmentsScope] = React.useState<
    "day" | "future"
  >("future");
  const [myAppointments, setMyAppointments] = React.useState<MyAppointmentsItem[]>([]);
  const [myAppointmentsLoading, setMyAppointmentsLoading] = React.useState(false);
  const [myAppointmentsError, setMyAppointmentsError] = React.useState<string | null>(null);
  const [cancellingMyAppointmentId, setCancellingMyAppointmentId] = React.useState<
    string | null
  >(null);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const [profileOpen, setProfileOpen] = React.useState(false);
  const [profileStep, setProfileStep] = React.useState<"form" | "verify">("form");
  const [profileFullName, setProfileFullName] = React.useState("");
  const [profilePhone, setProfilePhone] = React.useState("");
  const [profilePhoneValid, setProfilePhoneValid] = React.useState(true);
  const [profilePhoneTouched, setProfilePhoneTouched] = React.useState(false);
  const [profileCurrentEmail, setProfileCurrentEmail] = React.useState("");
  const [profileNewEmail, setProfileNewEmail] = React.useState("");
  const [profileCode, setProfileCode] = React.useState("");
  const [profileSubmitting, setProfileSubmitting] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);

  const resetFlow = React.useCallback(() => {
    setResult(null);
    setIdentified(false);
    setActiveConflict(null);
    setCancelError(null);
    setCancelling(false);
    setCancellingConflictId(null);
    setSubmitting(false);
    setFormError(null);
    setOtpCode("");
    setBookingSessionId("");
    setCustomerFullName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setNotes("");
    setStartTime("");
    setDate("");
    setServiceId("");
    setSlots(null);
    setSlotsError(null);
    setSlotsLoading(false);
    slotsCacheRef.current.clear();

    setStep("service");
  }, []);

  const resetBookingOnly = React.useCallback(() => {
    setResult(null);
    setIdentified(false);
    setActiveConflict(null);
    setCancelError(null);
    setCancelling(false);
    setCancellingConflictId(null);
    setCancellingSameDayId(null);
    setSubmitting(false);
    setFormError(null);
    setOtpCode("");
    setBookingSessionId("");
    setNotes("");
    setStartTime("");
    setDate("");
    setServiceId("");
    setSlots(null);
    setSlotsError(null);
    setSlotsLoading(false);
    slotsCacheRef.current.clear();
    setStep("service");
  }, []);

  React.useEffect(() => {
    if (!myAppointmentsOpen) return;
    if (!publicId) return;
    if (!data) return;

    const tz = String(data?.availability?.timezone ?? "").trim() || "UTC";
    const todayStr = formatDateInTimeZone(new Date(), tz);
    const target = myAppointmentsDate || date || result?.appointment?.date || todayStr;

    let cancelled = false;
    (async () => {
      setMyAppointmentsLoading(true);
      setMyAppointmentsError(null);
      try {
        const res = await fetch(
          myAppointmentsScope === "future"
            ? `/api/public/booking/me?businessPublicId=${encodeURIComponent(
              publicId
            )}&scope=future`
            : `/api/public/booking/me?businessPublicId=${encodeURIComponent(
              publicId
            )}&date=${encodeURIComponent(target)}`
        );
        const json = (await res.json().catch(() => null)) as BookingMeResponse | null;
        if (!res.ok) {
          throw new Error((json as any)?.error || `Request failed (${res.status})`);
        }
        if (!json?.ok) throw new Error("Failed");
        if (!(json as any).loggedIn) {
          setConnected(false);
          throw new Error("Please log in again");
        }

        const cust = (json as any)?.customer ?? {};
        if (!customerEmail.trim() && typeof cust?.email === "string") {
          setCustomerEmail(String(cust.email));
        }
        if (!customerFullName.trim() && typeof cust?.fullName === "string") {
          setCustomerFullName(String(cust.fullName));
        }
        if (!customerPhone.trim() && typeof cust?.phone === "string") {
          setCustomerPhone(String(cust.phone));
        }

        setMyAppointmentsDate((json as any)?.date || target);
        setMyAppointments(
          Array.isArray((json as any)?.appointments) ? (json as any).appointments : []
        );
      } catch (e: any) {
        if (cancelled) return;
        setMyAppointmentsError(e?.message || "Failed");
      } finally {
        if (!cancelled) setMyAppointmentsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    customerEmail,
    customerFullName,
    customerPhone,
    data,
    date,
    myAppointmentsDate,
    myAppointmentsOpen,
    myAppointmentsScope,
    publicId,
    result?.appointment?.date,
  ]);

  const didInitFromUrlRef = React.useRef(false);

  // Initialize from URL (compat with older deep links) exactly once.
  React.useEffect(() => {
    if (!publicId) return;
    if (!data) return;

    didInitFromUrlRef.current = true;

    const sp = new URLSearchParams(window.location.search);
    const nextServiceId = String(sp.get("serviceId") ?? "").trim();
    const nextDate = String(sp.get("date") ?? "").trim();
    const nextTime = String(sp.get("time") ?? "").trim();
    const nextEmail = String(sp.get("email") ?? "").trim();
    const nextPhone = String(sp.get("phone") ?? "").trim();

    if (nextServiceId && !serviceId) setServiceId(nextServiceId);
    if (nextDate && !date) setDate(nextDate);
    if (nextTime && !startTime) setStartTime(nextTime);
    if (nextEmail && !customerEmail) setCustomerEmail(nextEmail);
    if (nextPhone && !customerPhone) setCustomerPhone(nextPhone);

    if (nextEmail && nextServiceId && nextDate && nextTime) {
      setStep("verify");
      return;
    }
    if (nextServiceId && nextDate && nextTime) {
      setStep("details");
      return;
    }
    if (nextServiceId && nextDate) {
      setStep("time");
      return;
    }
    if (nextServiceId) {
      setStep("date");
      return;
    }
  }, [
    customerEmail,
    customerPhone,
    data,
    date,
    publicId,
    serviceId,
    startTime,
  ]);

  const tz = String(data?.availability?.timezone ?? "").trim() || "UTC";

  const businessTodayYmd = React.useMemo(() => {
    return formatDateInTimeZone(new Date(), tz);
  }, [tz]);

  const [dir, setDir] = React.useState<"ltr" | "rtl">("ltr");
  const [lang, setLang] = React.useState("");

  React.useEffect(() => {
    const nextDir = String(
      document.documentElement.getAttribute("dir") || "ltr"
    ).toLowerCase();
    const nextLang = String(
      document.documentElement.getAttribute("lang") || ""
    ).toLowerCase();
    setDir(nextDir === "rtl" ? "rtl" : "ltr");
    setLang(nextLang);
  }, []);

  const fpLocale = React.useMemo(() => {
    if (dir !== "rtl") return undefined;
    if (lang.startsWith("he")) return { ...Hebrew, rtl: true };
    return { ...Arabic, rtl: true };
  }, [dir, lang]);

  const resolvedLocale = React.useMemo(() => fpLocale ?? english, [fpLocale]);

  const availabilityByDay = React.useMemo(() => {
    const days = Array.isArray((data as any)?.availability?.days)
      ? (data as any).availability.days
      : [];
    const map = new Map<
      number,
      { enabled: boolean; windows: Array<{ start: string; end: string }> }
    >();
    for (const d of days) {
      const day = Number(d?.day);
      if (!Number.isFinite(day) || day < 0 || day > 6) continue;
      const enabled = (d as any)?.enabled !== false;
      const windows = normalizeWindows(d);
      map.set(day, { enabled, windows });
    }
    return map;
  }, [data]);

  const isDateAvailableYmd = React.useCallback(
    (ymd: string) => {
      if (!data) return false;
      if (!serviceId) return false;
      const dateStr = String(ymd || "").trim();

      const weekday = weekdayFromDateString(dateStr);
      const conf = availabilityByDay.get(weekday);
      if (!conf) return false;
      if (!conf.enabled) return false;
      if (!conf.windows || conf.windows.length === 0) return false;
      return true;
    },
    [availabilityByDay, data, serviceId]
  );

  const isDisabledYmd = React.useCallback(
    (ymd: string) => {
      const dateStr = String(ymd || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return true;
      if (businessTodayYmd && dateStr < businessTodayYmd) return true;
      return !isDateAvailableYmd(dateStr);
    },
    [businessTodayYmd, isDateAvailableYmd]
  );

  const flatpickrOptions = React.useMemo(() => {
    return {
      mode: "single" as const,
      dateFormat: "Y-m-d",
      inline: true,
      disableMobile: false,
      monthSelectorType: "static" as const,
      minDate: businessTodayYmd || undefined,
      locale: resolvedLocale,
      disable: [
        (d: Date) => {
          const ymd = ymdFromDateLocal(d);
          return isDisabledYmd(ymd);
        },
      ],
    };
  }, [businessTodayYmd, isDisabledYmd, resolvedLocale]);

  const selectedService = React.useMemo(() => {
    if (!data?.services) return null;
    return data.services.find((s) => String(s.id) === String(serviceId));
  }, [data, serviceId]);

  React.useEffect(() => {
    if (step !== "time") return;
    if (!publicId) return;
    if (!serviceId || !date) return;

    const key = `${publicId}|${serviceId}|${date}`;
    const cached = slotsCacheRef.current.get(key);
    if (cached) {
      setSlots(cached);
      setSlotsError(null);
      setSlotsLoading(false);
      return;
    }

    const controller = new AbortController();
    let alive = true;

    (async () => {
      setSlots(null);
      setSlotsError(null);
      setSlotsLoading(true);

      try {
        const res = await fetch(
          `/api/public/business/${encodeURIComponent(
            publicId
          )}/availability?date=${encodeURIComponent(
            date
          )}&serviceId=${encodeURIComponent(serviceId)}`,
          { signal: controller.signal }
        );

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(json?.error || `Request failed (${res.status})`);
        }

        if (!alive) return;
        const parsed = json as SlotsResponse;
        slotsCacheRef.current.set(key, parsed);
        setSlots(parsed);
      } catch (e: any) {
        if (!alive) return;
        if (e?.name === "AbortError") return;
        setSlotsError(e?.message || "Failed to load availability");
      } finally {
        if (!alive) return;
        setSlotsLoading(false);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [date, publicId, serviceId, step]);

  React.useEffect(() => {
    if (step !== "verify") return;
    if (!connected) return;
    setOtpCode("");
    setStep("details");
  }, [connected, step]);

  const shellSubtitle = React.useMemo(() => {
    if (!data) return "";
    if (step === "service") return "Select service";
    if (step === "date") return "Pick a date";
    if (step === "time") return "Choose a time";
    if (step === "details")
      return date && startTime ? `${date} • ${startTime}` : "Your details";
    if (step === "verify")
      return customerEmail
        ? `We sent a code to ${customerEmail}`
        : "Verify email";
    if (step === "success") {
      const appt = result?.appointment;
      return appt
        ? `${appt.date} • ${appt.startTime}–${appt.endTime}`
        : "Booked";
    }
    return "";
  }, [customerEmail, data, date, result, startTime, step]);

  const shellSubtitleRight = React.useMemo<React.ReactNode>(() => {
    if (!data) return null;

    const tz = String(data?.availability?.timezone ?? "").trim() || "UTC";
    const todayStr = formatDateInTimeZone(new Date(), tz);
    const dateForMy = date || result?.appointment?.date || todayStr;

    const rightText = (() => {
      if (!selectedService) return "";
      if (step === "date") return `${selectedService.name}`;
      if (step === "time") return `${selectedService.name}${date ? ` • ${date}` : ""}`;
      return "";
    })();

    return rightText ? (
      <span className="text-sm text-muted-foreground">{rightText}</span>
    ) : null;
  }, [connected, customerEmail, data, date, result, selectedService, step]);

  const openProfileEditor = React.useCallback(() => {
    const email = customerEmail.trim();
    setProfileOpen(true);
    setProfileStep("form");
    setProfileError(null);
    setProfileSubmitting(false);
    setProfileCode("");
    setProfileFullName(customerFullName);
    setProfilePhone(customerPhone);
    setProfilePhoneValid(true);
    setProfilePhoneTouched(false);
    setProfileCurrentEmail(email);
    setProfileNewEmail(email);
  }, [customerEmail, customerFullName, customerPhone]);

  const shellHeaderRight = React.useMemo<React.ReactNode>(() => {
    if (!data) return null;

    const tz = String(data?.availability?.timezone ?? "").trim() || "UTC";
    const todayStr = formatDateInTimeZone(new Date(), tz);
    const dateForMy = date || result?.appointment?.date || todayStr;

    return (
      <div className="flex w-full flex-col items-stretch gap-2">
        {connected ? (
          <div className="flex w-full items-center justify-between gap-2">
            <div className="min-w-0 flex-1 text-xs text-muted-foreground truncate">
              {customerEmail.trim() ? `Logged in as ${customerEmail.trim()}` : ""}
            </div>
            <Button
              type="button"
              size="sm"
              variant="default"
              className="shrink-0 rounded-xl h-7 px-3 text-sm gap-2 border border-transparent"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                try {
                  await disconnectCustomer();
                  setConnected(false);
                  setMyAppointmentsOpen(false);
                  setMyAppointments([]);
                  resetFlow();
                } finally {
                  setLoggingOut(false);
                }
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>{loggingOut ? "Logging out…" : "Logout"}</span>
            </Button>
          </div>
        ) : null}

        <div
          className={
            connected
              ? "flex w-full items-center justify-between gap-2"
              : "flex w-full items-center justify-end gap-2"
          }
        >
          <Button
            type="button"
            size="sm"
            variant={connected ? "outline" : "default"}
            className="shrink-0 rounded-xl h-7 px-3 text-sm gap-2"
            disabled={loggingOut}
            onClick={() => {
              if (connected) {
                setMyAppointmentsScope("future");
                setMyAppointmentsDate(dateForMy);
                setMyAppointmentsOpen(true);
              } else {
                setLoginEmail(customerEmail.trim());
                setLoginStep("email");
                setLoginCode("");
                setLoginError(null);
                setLoginOpen(true);
              }
            }}
          >
            {connected ? (
              <>
                <CalendarDays className="h-4 w-4" />
                <span>My appointments</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>Log in</span>
              </>
            )}
          </Button>

          {connected ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 rounded-xl h-7 px-3 text-sm gap-2"
              disabled={loggingOut}
              onClick={openProfileEditor}
            >
              Update details
            </Button>
          ) : null}
        </div>
      </div>
    );
  }, [connected, customerEmail, data, date, disconnectCustomer, loggingOut, openProfileEditor, resetFlow, result?.appointment?.date]);

  const selectedSlot = React.useMemo(() => {
    const list = Array.isArray((slots as any)?.slots) ? ((slots as any).slots as any[]) : [];
    const st = String(startTime || "").trim();
    if (!st) return null;
    const hit = list.find((s) => String((s as any)?.startTime ?? "").trim() === st);
    if (!hit) return null;
    return {
      startTime: String((hit as any)?.startTime ?? "").trim(),
      endTime: String((hit as any)?.endTime ?? "").trim(),
    };
  }, [slots, startTime]);

  const canSkipCustomerDetailsForm =
    connected &&
    customerFullName.trim() &&
    customerEmail.trim() &&
    customerPhone.trim() &&
    customerPhoneValid;

  const showGallery = step === "service";

  const onBack = React.useCallback(() => {
    if (step === "time") {
      setStartTime("");
      setStep("date");
      return;
    }

    if (step === "details") {
      setStep("time");
      return;
    }

    if (step === "verify") {
      setStep("details");
      return;
    }

    if (step === "date") {
      setDate("");
      setStartTime("");
      setStep("service");
      return;
    }

    if (step === "success") {
      if (connected) resetBookingOnly();
      else resetFlow();
      return;
    }

    if (typeof window !== "undefined") {
      window.history.back();
    }
  }, [connected, resetBookingOnly, resetFlow, step]);

  const requestOtp = async () => {
    if (!customerFullName.trim()) throw new Error("Full Name is required");
    if (!customerEmail.trim()) throw new Error("Email is required");
    if (!customerPhone.trim()) throw new Error("Phone is required");
    if (!customerPhoneValid)
      throw new Error("Please enter a valid phone number");
    if (!publicId) throw new Error("Business not found");
    if (!serviceId || !date || !startTime)
      throw new Error("Missing booking details");

    const res = await fetch("/api/public/booking/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessPublicId: publicId,
        email: customerEmail.trim(),
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(json?.error || `Request failed (${res.status})`);
  };

  const requestLoginOtp = async () => {
    if (!publicId) throw new Error("Business not found");
    const email = loginEmail.trim();
    if (!email) throw new Error("Email is required");
    if (!isValidEmail(email)) throw new Error("Please enter a valid email address");

    const res = await fetch("/api/public/booking/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessPublicId: publicId, email }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  };

  const verifyLoginOtp = async () => {
    if (!publicId) throw new Error("Business not found");
    const email = loginEmail.trim();
    const code = loginCode.trim();
    if (!email) throw new Error("Email is required");
    if (!code) throw new Error("Code is required");

    const res = await fetch("/api/public/booking/login/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessPublicId: publicId, email, code }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);

    setConnected(true);
    setCustomerEmail(email);
    if (!customerFullName.trim() && typeof json?.customer?.fullName === "string") {
      setCustomerFullName(String(json.customer.fullName));
    }
    if (!customerPhone.trim() && typeof json?.customer?.phone === "string") {
      setCustomerPhone(String(json.customer.phone));
    }
  };

  const submitProfileUpdate = async () => {
    if (!publicId) throw new Error("Business not found");
    const fullName = profileFullName.trim();
    const phone = profilePhone.trim();
    const currentEmail = profileCurrentEmail.trim();
    const newEmail = profileNewEmail.trim();

    if (!fullName) throw new Error("Full name is required");
    if (!phone) throw new Error("Phone number is required");
    if (!profilePhoneValid) throw new Error("Please enter a valid phone number");
    if (!currentEmail) throw new Error("Email is required");
    if (!isValidEmail(currentEmail)) throw new Error("Please enter a valid email address");
    if (!newEmail) throw new Error("Email is required");
    if (!isValidEmail(newEmail)) throw new Error("Please enter a valid email address");

    const res = await fetch("/api/public/booking/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessPublicId: publicId,
        fullName,
        phone,
        currentEmail,
        newEmail,
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((json as any)?.error || `Request failed (${res.status})`);
    }

    if ((json as any)?.requiresVerification) {
      setProfileStep("verify");
      setProfileCode("");
      return;
    }

    setCustomerFullName(fullName);
    setCustomerPhone(phone);
    setCustomerEmail(currentEmail);
    setConnected(true);
    setProfileOpen(false);
  };

  const submitProfileEmailVerify = async () => {
    if (!publicId) throw new Error("Business not found");
    const currentEmail = profileCurrentEmail.trim();
    const newEmail = profileNewEmail.trim();
    const code = profileCode.trim();
    if (!currentEmail) throw new Error("Email is required");
    if (!newEmail) throw new Error("Email is required");
    if (!code) throw new Error("Code is required");

    const res = await fetch("/api/public/booking/profile/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessPublicId: publicId,
        currentEmail,
        newEmail,
        code,
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((json as any)?.error || `Request failed (${res.status})`);
    }

    const cust = (json as any)?.customer ?? {};
    const email = String(cust?.email ?? "").trim() || newEmail;

    setCustomerFullName(String(cust?.fullName ?? profileFullName).trim());
    setCustomerPhone(String(cust?.phone ?? profilePhone).trim());
    setCustomerEmail(email);
    setConnected(true);
    setProfileOpen(false);
  };

  const verifyBookingSession = async (): Promise<string> => {
    if (!publicId) throw new Error("Business not found");
    if (!customerEmail.trim()) throw new Error("Email is required");
    if (!otpCode.trim()) throw new Error("Code is required");

    const verifyRes = await fetch("/api/public/booking/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessPublicId: publicId,
        email: customerEmail.trim(),
        code: otpCode.trim(),
      }),
    });

    const verifyJson = await verifyRes.json().catch(() => null);

    if (
      verifyRes.status === 409 &&
      String(verifyJson?.code ?? "") === "ACTIVE_APPOINTMENT_EXISTS"
    ) {
      const sessionId = String(verifyJson?.bookingSessionId ?? "").trim();
      if (sessionId) setBookingSessionId(sessionId);
      setActiveConflict({
        code: "ACTIVE_APPOINTMENT_EXISTS",
        bookingSessionId: sessionId,
        existingAppointment: verifyJson?.existingAppointment,
        existingAppointments: Array.isArray(verifyJson?.existingAppointments)
          ? verifyJson.existingAppointments
          : undefined,
      });
      const err: any = new Error(
        verifyJson?.error ||
        "You already have an active upcoming appointment. Please cancel it first."
      );
      err.code = "ACTIVE_APPOINTMENT_EXISTS";
      throw err;
    }

    if (!verifyRes.ok) {
      throw new Error(
        verifyJson?.error || `Request failed (${verifyRes.status})`
      );
    }

    const sessionId = String(verifyJson?.bookingSessionId ?? "").trim();
    if (!sessionId) throw new Error("Verification failed");
    setBookingSessionId(sessionId);
    setActiveConflict(null);
    return sessionId;
  };

  const confirmBooking = async (sessionId?: string) => {
    if (!publicId) throw new Error("Business not found");
    if (!serviceId || !date || !startTime)
      throw new Error("Missing booking details");

    const sid = String(sessionId ?? "").trim();
    if (!sid && !connected) throw new Error("Email verification required");

    const confirmRes = await fetch("/api/public/booking/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessPublicId: publicId,
        serviceId,
        date,
        startTime,
        customerFullName: customerFullName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        notes: notes.trim() || undefined,
        ...(sid ? { bookingSessionId: sid } : {}),
      }),
    });

    const confirmJson = await confirmRes.json().catch(() => null);
    if (!confirmRes.ok) {
      if (
        confirmRes.status === 409 &&
        (String(confirmJson?.code ?? "") === "ACTIVE_APPOINTMENT_EXISTS" ||
          String(confirmJson?.code ?? "") === "SAME_SERVICE_SAME_DAY_EXISTS")
      ) {
        setActiveConflict({
          code:
            String(confirmJson?.code ?? "") === "SAME_SERVICE_SAME_DAY_EXISTS"
              ? "SAME_SERVICE_SAME_DAY_EXISTS"
              : "ACTIVE_APPOINTMENT_EXISTS",
          bookingSessionId: sid,
          existingAppointment: confirmJson?.existingAppointment,
          existingAppointments: Array.isArray(confirmJson?.existingAppointments)
            ? confirmJson.existingAppointments
            : undefined,
        });

        const err: any = new Error(
          confirmJson?.error ||
          (String(confirmJson?.code ?? "") === "SAME_SERVICE_SAME_DAY_EXISTS"
            ? "You already booked this service on this day."
            : "You already have an active upcoming appointment. Please cancel it first.")
        );
        err.code =
          String(confirmJson?.code ?? "") === "SAME_SERVICE_SAME_DAY_EXISTS"
            ? "SAME_SERVICE_SAME_DAY_EXISTS"
            : "ACTIVE_APPOINTMENT_EXISTS";
        throw err;
      }

      throw new Error(
        confirmJson?.error || `Request failed (${confirmRes.status})`
      );
    }

    setActiveConflict(null);

    return confirmJson as BookingResult;
  };

  async function disconnectCustomer() {
    await fetch("/api/public/booking/disconnect", { method: "POST" });
  }

  const cancelExistingAppointment = async (appointmentIdRaw: string) => {
    const sessionId = String(
      bookingSessionId || activeConflict?.bookingSessionId || ""
    ).trim();
    const appointmentId = String(appointmentIdRaw ?? "").trim();
    if (!appointmentId) throw new Error("Appointment not found");

    const res = await fetch("/api/public/booking/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(sessionId
          ? {
            bookingSessionId: sessionId,
            appointmentId,
            customerEmail: customerEmail.trim(),
          }
          : { appointmentId }),
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(json?.error || `Request failed (${res.status})`);
  };

  const cancelBooking = async () => {
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
  };

  const cancelSameDayAppointment = async (appointmentId: string) => {
    const id = String(appointmentId ?? "").trim();
    if (!id) throw new Error("Appointment not found");

    const res = await fetch("/api/public/booking/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: id }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  };

  if (loading && !data) {
    return (
      <PublicBookingShell business={null} title="Booking" showGallery={false}>
        <CenteredSpinner fullPage />
      </PublicBookingShell>
    );
  }

  if (error || !data) {
    return (
      <PublicBookingShell
        business={data}
        title="Booking"
        subtitle=""
        showGallery={false}
      >
        <div className="space-y-4">
          <div className="text-sm text-red-600 dark:text-red-400">
            {error || "Business not found"}
          </div>
        </div>
      </PublicBookingShell>
    );
  }

  return (
    <PublicBookingShell
      business={data}
      title="Booking"
      subtitle={shellSubtitle}
      subtitleRight={shellSubtitleRight}
      headerRight={shellHeaderRight}
      onBack={onBack}
      showGallery={showGallery}
    >
      <Dialog
        open={loginOpen}
        onOpenChange={(open) => {
          setLoginOpen(open);
          if (!open) {
            setLoginError(null);
            setLoginSubmitting(false);
            setLoginCode("");
            setLoginStep("email");
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Log in</DialogTitle>
            <DialogDescription>
              Verify your email once to book and manage appointments faster.
            </DialogDescription>
          </DialogHeader>

          {loginError ? (
            <div className="text-sm text-red-600 dark:text-red-400">
              {loginError}
            </div>
          ) : null}

          {loginStep === "email" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="loginEmail">Email *</Label>
                <Input
                  id="loginEmail"
                  className="rounded-2xl"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>

              <Button
                className="rounded-2xl w-full"
                disabled={loginSubmitting || !isValidEmail(loginEmail.trim())}
                onClick={async () => {
                  setLoginSubmitting(true);
                  setLoginError(null);
                  try {
                    await requestLoginOtp();
                    setLoginStep("code");
                  } catch (e: any) {
                    setLoginError(e?.message || "Failed");
                  } finally {
                    setLoginSubmitting(false);
                  }
                }}
              >
                {loginSubmitting ? "Sending code…" : "Send code"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                We sent a code to {loginEmail}.
              </div>
              <div className="flex justify-center">
                <OtpInput
                  id="login-otp"
                  name="code"
                  length={6}
                  value={loginCode}
                  onChange={setLoginCode}
                  disabled={loginSubmitting}
                  inputClassName="h-10 w-10 sm:h-11 sm:w-11 text-base sm:text-lg"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => {
                    setLoginStep("email");
                    setLoginCode("");
                    setLoginError(null);
                  }}
                  disabled={loginSubmitting}
                >
                  Back
                </Button>
                <Button
                  className="rounded-2xl flex-1"
                  disabled={
                    loginSubmitting ||
                    loginCode.replace(/\D/g, "").length < 6
                  }
                  onClick={async () => {
                    setLoginSubmitting(true);
                    setLoginError(null);
                    try {
                      await verifyLoginOtp();
                      setLoginOpen(false);
                    } catch (e: any) {
                      setLoginError(e?.message || "Failed");
                    } finally {
                      setLoginSubmitting(false);
                    }
                  }}
                >
                  {loginSubmitting ? "Verifying…" : "Verify"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={myAppointmentsOpen}
        onOpenChange={(open) => {
          setMyAppointmentsOpen(open);
          if (!open) {
            setMyAppointmentsError(null);
            setMyAppointmentsLoading(false);
            setCancellingMyAppointmentId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {myAppointmentsScope === "future"
                ? "Your upcoming appointments"
                : "My appointments"}
            </DialogTitle>
            <DialogDescription>
              {myAppointmentsScope === "future"
                ? "Only upcoming booked appointments"
                : myAppointmentsDate
                  ? `For ${myAppointmentsDate}`
                  : ""}
            </DialogDescription>
          </DialogHeader>

          {myAppointmentsError ? (
            <div className="text-sm text-red-600 dark:text-red-400">
              {myAppointmentsError}
            </div>
          ) : null}

          {myAppointmentsLoading ? (
            <CenteredSpinner className="min-h-[120px] items-center" />
          ) : myAppointments.filter(
            (a) => String(a.status || "").toUpperCase() === "BOOKED"
          ).length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {myAppointmentsScope === "future"
                ? "No upcoming appointments."
                : "No appointments for this day."}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {myAppointments
                .filter((a) => String(a.status || "").toUpperCase() === "BOOKED")
                .map((a) => (
                  <div
                    key={a.id}
                    className="py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {a.date ? (
                          <div className="text-xs text-muted-foreground">
                            {a.date}
                          </div>
                        ) : null}
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {a.startTime}–{a.endTime}
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-200">
                          {a.serviceName}
                        </div>

                        <div className="text-xs text-muted-foreground mt-1">Booked</div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl shrink-0"
                        disabled={cancellingMyAppointmentId === a.id}
                        onClick={async () => {
                          setCancellingMyAppointmentId(a.id);
                          setMyAppointmentsError(null);
                          try {
                            await cancelSameDayAppointment(a.id);
                            setMyAppointments((prev) => prev.filter((x) => x.id !== a.id));
                          } catch (e: any) {
                            setMyAppointmentsError(e?.message || "Failed");
                          } finally {
                            setCancellingMyAppointmentId(null);
                          }
                        }}
                      >
                        {cancellingMyAppointmentId === a.id
                          ? "Cancelling…"
                          : "Cancel this appointment"}
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={profileOpen}
        onOpenChange={(open) => {
          setProfileOpen(open);
          if (!open) {
            setProfileError(null);
            setProfileSubmitting(false);
            setProfileStep("form");
            setProfileCode("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Update details</DialogTitle>
            <DialogDescription>
              Update your details. If you change your email, you’ll need to verify the new one.
            </DialogDescription>
          </DialogHeader>

          {profileError ? (
            <div className="text-sm text-red-600 dark:text-red-400">{profileError}</div>
          ) : null}

          {profileStep === "form" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="profileFullName">Full Name *</Label>
                <Input
                  id="profileFullName"
                  className="rounded-2xl"
                  value={profileFullName}
                  onChange={(e) => setProfileFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profileEmail">Email *</Label>
                <Input
                  id="profileEmail"
                  className="rounded-2xl"
                  value={profileNewEmail}
                  onChange={(e) => setProfileNewEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profilePhone">Phone *</Label>
                <PhoneInput
                  id="profilePhone"
                  className="rounded-2xl"
                  inputClassName="rounded-2xl"
                  value={profilePhone}
                  onChange={(v) => setProfilePhone(v)}
                  onValidityChange={setProfilePhoneValid}
                  onBlur={() => setProfilePhoneTouched(true)}
                  aria-invalid={profilePhoneTouched && !profilePhoneValid}
                  placeholder="Phone number"
                />
                {profilePhoneTouched && profilePhone.trim() && !profilePhoneValid ? (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    Please enter a valid phone number.
                  </div>
                ) : null}
              </div>

              <Button
                className="rounded-2xl w-full"
                disabled={
                  profileSubmitting ||
                  !profileFullName.trim() ||
                  !profilePhone.trim() ||
                  !profilePhoneValid ||
                  !profileNewEmail.trim() ||
                  !isValidEmail(profileNewEmail.trim())
                }
                onClick={async () => {
                  setProfileSubmitting(true);
                  setProfileError(null);
                  try {
                    await submitProfileUpdate();
                  } catch (e: any) {
                    setProfileError(e?.message || "Failed");
                  } finally {
                    setProfileSubmitting(false);
                  }
                }}
              >
                {profileSubmitting ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                We sent a code to {profileNewEmail.trim() || "your email"}.
              </div>

              <div className="flex justify-center">
                <OtpInput
                  id="profile-otp"
                  name="code"
                  length={6}
                  value={profileCode}
                  onChange={setProfileCode}
                  disabled={profileSubmitting}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => {
                    setProfileStep("form");
                    setProfileCode("");
                    setProfileError(null);
                  }}
                  disabled={profileSubmitting}
                >
                  Back
                </Button>
                <Button
                  className="rounded-2xl flex-1"
                  disabled={profileSubmitting || profileCode.replace(/\D/g, "").length < 6}
                  onClick={async () => {
                    setProfileSubmitting(true);
                    setProfileError(null);
                    try {
                      await submitProfileEmailVerify();
                    } catch (e: any) {
                      setProfileError(e?.message || "Failed");
                    } finally {
                      setProfileSubmitting(false);
                    }
                  }}
                >
                  {profileSubmitting ? "Verifying…" : "Verify"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Service selection */}
      {step === "service" ? (
        <div className="space-y-3">
          {data.services.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setServiceId(s.id);
                setDate("");
                setStartTime("");
                setFormError(null);
                setStep("date");
              }}
              className={
                "w-full text-start rounded-2xl border border-gray-200 dark:border-gray-800 " +
                "bg-white/70 dark:bg-gray-950/20 p-4 shadow-sm " +
                "transition cursor-pointer " +
                "hover:bg-white hover:shadow-md hover:-translate-y-[1px] " +
                "dark:hover:bg-gray-900/30 " +
                "active:translate-y-0 active:shadow-sm"
              }
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white truncate">
                    {s.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {s.durationMinutes} min
                  </div>
                </div>
                <div className="font-semibold text-gray-900 dark:text-white shrink-0">
                  {formatPrice({ price: s.price, currency: data.currency, locale })}
                </div>
              </div>
            </button>
          ))}

          {!data.services.length && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              No services available.
            </div>
          )}
        </div>
      ) : null}

      {/* Date selection */}
      {step === "date" ? (
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="w-full">
              <Flatpickr
                options={flatpickrOptions as any}
                value={date || undefined}
                onChange={(_selectedDates: Date[], dateStr: string) => {
                  const next = String(dateStr || "").trim();
                  if (!next) return;
                  if (isDisabledYmd(next)) return;
                  setDate(next);
                  setStartTime("");
                  setFormError(null);
                  setStep("time");
                }}
                render={(_props: any, ref: any) => (
                  <input
                    ref={ref as any}
                    type="text"
                    aria-label="Select date"
                    className="sr-only"
                  />
                )}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Time selection */}
      {step === "time" ? (
        <div className="space-y-4">
          <div className="space-y-3">
            {slotsLoading ? (
              <CenteredSpinner className="min-h-[40vh] items-center" />
            ) : slotsError ? (
              <div className="text-sm text-red-600 dark:text-red-400">
                {slotsError}
              </div>
            ) : slots ? (
              <>
                {slots.slots.length ? (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.slots.map((s) => (
                      <button
                        key={s.startTime}
                        className={
                          "w-full h-16 rounded-2xl border border-gray-200 dark:border-gray-800 " +
                          "bg-white/70 dark:bg-gray-950/20 shadow-sm " +
                          "transition cursor-pointer " +
                          "hover:bg-white hover:shadow-md hover:-translate-y-[1px] " +
                          "dark:hover:bg-gray-900/30 " +
                          "active:translate-y-0 active:shadow-sm " +
                          "flex flex-col items-center justify-center text-center"
                        }
                        onClick={() => {
                          setStartTime(s.startTime);
                          setFormError(null);
                          setStep("details");
                        }}
                      >
                        <div className="font-semibold text-gray-900 dark:text-white leading-none">
                          {s.startTime}
                        </div>
                        <div className="text-[11px] text-gray-600 dark:text-gray-300 leading-none mt-1">
                          {s.endTime}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}

                {!slots.slots.length ? (
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    No times available.
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Select a date to see times.
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Details */}
      {step === "details" ? (
        <div className="space-y-4">
          {formError ? (
            <div className="text-sm text-red-600 dark:text-red-400">
              {formError}
            </div>
          ) : null}

          {activeConflict ? (
            <div className="rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 p-4">
              <div className="font-semibold text-amber-900 dark:text-amber-200">
                {activeConflict.code === "SAME_SERVICE_SAME_DAY_EXISTS"
                  ? "You already booked this service on this day"
                  : "You already have an upcoming appointment"}
              </div>
              <div className="text-sm text-amber-800/90 dark:text-amber-200/80 mt-1">
                {activeConflict.code === "SAME_SERVICE_SAME_DAY_EXISTS"
                  ? "Please cancel it first to book the same service again."
                  : "Please cancel it first to book a new one."}
              </div>

              <div className="mt-2 space-y-2">
                {(Array.isArray(activeConflict.existingAppointments)
                  ? activeConflict.existingAppointments
                  : activeConflict.existingAppointment
                    ? [activeConflict.existingAppointment]
                    : []
                )
                  .filter((x: any) => String(x?.id ?? "").trim())
                  .map((appt: any) => {
                    const apptId = String(appt?.id ?? "").trim();
                    const label = `${appt?.serviceName ? `${appt.serviceName} • ` : ""}${appt?.date || ""
                      }${appt?.startTime ? ` • ${appt.startTime}` : ""}`;

                    return (
                      <div
                        key={apptId}
                        className="rounded-xl border border-amber-200/70 dark:border-amber-900/40 bg-white/60 dark:bg-black/10 p-3"
                      >
                        <div className="text-sm text-amber-900/90 dark:text-amber-200/90">
                          {label}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-2xl w-full mt-2"
                          disabled={submitting || cancellingConflictId === apptId}
                          onClick={async () => {
                            setFormError(null);
                            setCancellingConflictId(apptId);
                            try {
                              await cancelExistingAppointment(apptId);
                              setActiveConflict((prev) => {
                                if (!prev) return prev;
                                const list = Array.isArray(prev.existingAppointments)
                                  ? prev.existingAppointments
                                  : [];
                                const nextList = list.filter(
                                  (x: any) => String(x?.id ?? "").trim() !== apptId
                                );

                                // If we only had a single fallback appointment, clear conflict after cancel.
                                if (list.length === 0) return null;
                                if (nextList.length === 0) return null;
                                return { ...prev, existingAppointments: nextList };
                              });
                            } catch (e: any) {
                              if (
                                String(e?.code ?? "") === "ACTIVE_APPOINTMENT_EXISTS" ||
                                String(e?.code ?? "") ===
                                "SAME_SERVICE_SAME_DAY_EXISTS"
                              ) {
                                return;
                              }
                              setFormError(e?.message || "Failed");
                            } finally {
                              setCancellingConflictId(null);
                            }
                          }}
                        >
                          {cancellingConflictId === apptId
                            ? "Cancelling…"
                            : "Cancel this appointment"}
                        </Button>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}

          {canSkipCustomerDetailsForm ? (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/10 p-4">
              <div className="font-semibold text-gray-900 dark:text-white">
                Confirm booking
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {selectedService?.name ? selectedService.name : "Appointment"}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-200 mt-1">
                {date}
                {startTime ? ` • ${startTime}` : ""}
                {selectedSlot?.endTime ? `–${selectedSlot.endTime}` : ""}
              </div>
              {selectedService ? (
                <div className="text-sm text-muted-foreground mt-1">
                  {selectedService.durationMinutes} min • {formatPrice({ price: selectedService.price, currency: data.currency, locale })}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/10 p-4">
              <div className="font-semibold text-amber-900 dark:text-amber-200">
                Please complete your details
              </div>
              <div className="text-sm text-amber-800/90 dark:text-amber-200/80 mt-1">
                We need your name, email, and phone number to book.
              </div>
            </div>
          )}

          {!canSkipCustomerDetailsForm ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  className="rounded-2xl"
                  value={customerFullName}
                  onChange={(e) => setCustomerFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  className="rounded-2xl"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <PhoneInput
                  id="phone"
                  className="rounded-2xl"
                  inputClassName="rounded-2xl"
                  value={customerPhone}
                  onChange={(v) => setCustomerPhone(v)}
                  onValidityChange={setCustomerPhoneValid}
                  onBlur={() => setCustomerPhoneTouched(true)}
                  aria-invalid={customerPhoneTouched && !customerPhoneValid}
                  placeholder="Phone number"
                />
                {customerPhoneTouched && customerPhone.trim() && !customerPhoneValid ? (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    Please enter a valid phone number.
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  className="rounded-2xl"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </>
          ) : null}

          <Button
            onClick={async () => {
              setSubmitting(true);
              setFormError(null);
              try {
                if (connected) {
                  const r = await confirmBooking();
                  setResult(r);
                  setStep("success");
                  setIdentified(true);
                  setConnected(true);
                  return;
                }

                await requestOtp();
                setStep("verify");
              } catch (e: any) {
                if (
                  String(e?.code ?? "") === "ACTIVE_APPOINTMENT_EXISTS" ||
                  String(e?.code ?? "") === "SAME_SERVICE_SAME_DAY_EXISTS"
                ) {
                  // Business rule conflict: show conflict panel only.
                  return;
                }
                setFormError(e?.message || "Failed");
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={
              submitting ||
              !customerFullName.trim() ||
              !customerEmail.trim() ||
              !customerPhone.trim() ||
              !customerPhoneValid
            }
            className="rounded-2xl w-full"
          >
            {submitting
              ? connected
                ? "Confirming…"
                : "Sending code…"
              : connected
                ? "Confirm booking"
                : "Verify email"}
          </Button>
        </div>
      ) : null}

      {/* Verify */}
      {step === "verify" ? (
        <div className="space-y-4">
          {formError ? (
            <div className="text-sm text-red-600 dark:text-red-400">
              {formError}
            </div>
          ) : null}

          {activeConflict ? (
            <div className="rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 p-4">
              <div className="font-semibold text-amber-900 dark:text-amber-200">
                {activeConflict.code === "SAME_SERVICE_SAME_DAY_EXISTS"
                  ? "You already booked this service on this day"
                  : "You already have an upcoming appointment"}
              </div>
              <div className="text-sm text-amber-800/90 dark:text-amber-200/80 mt-1">
                {activeConflict.code === "SAME_SERVICE_SAME_DAY_EXISTS"
                  ? "Please cancel it first to book the same service again."
                  : "Please cancel it first to book a new one."}
              </div>

              <div className="mt-2 space-y-2">
                {(Array.isArray(activeConflict.existingAppointments)
                  ? activeConflict.existingAppointments
                  : activeConflict.existingAppointment
                    ? [activeConflict.existingAppointment]
                    : []
                )
                  .filter((x: any) => String(x?.id ?? "").trim())
                  .map((appt: any) => {
                    const apptId = String(appt?.id ?? "").trim();
                    const label = `${appt?.serviceName ? `${appt.serviceName} • ` : ""}${appt?.date || ""
                      }${appt?.startTime ? ` • ${appt.startTime}` : ""}`;

                    return (
                      <div
                        key={apptId}
                        className="rounded-xl border border-amber-200/70 dark:border-amber-900/40 bg-white/60 dark:bg-black/10 p-3"
                      >
                        <div className="text-sm text-amber-900/90 dark:text-amber-200/90">
                          {label}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-2xl w-full mt-2"
                          disabled={submitting || cancellingConflictId === apptId}
                          onClick={async () => {
                            setFormError(null);
                            setCancellingConflictId(apptId);
                            try {
                              await cancelExistingAppointment(apptId);
                              setActiveConflict((prev) => {
                                if (!prev) return prev;
                                const list = Array.isArray(prev.existingAppointments)
                                  ? prev.existingAppointments
                                  : [];
                                const nextList = list.filter(
                                  (x: any) => String(x?.id ?? "").trim() !== apptId
                                );

                                // If we only had a single fallback appointment, clear conflict after cancel.
                                if (list.length === 0) return null;
                                if (nextList.length === 0) return null;
                                return { ...prev, existingAppointments: nextList };
                              });
                            } catch (e: any) {
                              if (
                                String(e?.code ?? "") === "ACTIVE_APPOINTMENT_EXISTS" ||
                                String(e?.code ?? "") === "SAME_SERVICE_SAME_DAY_EXISTS"
                              ) {
                                return;
                              }
                              setFormError(e?.message || "Failed");
                            } finally {
                              setCancellingConflictId(null);
                            }
                          }}
                        >
                          {cancellingConflictId === apptId
                            ? "Cancelling…"
                            : "Cancel this appointment"}
                        </Button>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}

          <div className="flex justify-center">
            <OtpInput
              id="booking-otp"
              name="code"
              length={6}
              value={otpCode}
              onChange={setOtpCode}
              disabled={submitting}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={async () => {
                setSubmitting(true);
                setFormError(null);
                try {
                  await requestOtp();
                } catch (e: any) {
                  setFormError(e?.message || "Failed");
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting || cancellingConflictId !== null}
            >
              Resend
            </Button>

            <Button
              className="rounded-2xl flex-1"
              onClick={async () => {
                setSubmitting(true);
                setFormError(null);
                try {
                  const sessionId = await verifyBookingSession();
                  const r = await confirmBooking(sessionId);
                  setResult(r);
                  setStep("success");
                  setIdentified(true);
                  setConnected(true);
                } catch (e: any) {
                  if (
                    String(e?.code ?? "") === "ACTIVE_APPOINTMENT_EXISTS" ||
                    String(e?.code ?? "") === "SAME_SERVICE_SAME_DAY_EXISTS"
                  ) {
                    // Business rule violation; show conflict UI, not an OTP error.
                    return;
                  }
                  setFormError(e?.message || "Failed");
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={
                submitting ||
                cancellingConflictId !== null ||
                otpCode.replace(/\D/g, "").length < 6
              }
            >
              {submitting ? "Confirming…" : "Confirm booking"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Success */}
      {step === "success" && result?.appointment ? (
        <div className="space-y-4">
          {cancelError ? (
            <div className="text-sm text-red-600 dark:text-red-400">
              {cancelError}
            </div>
          ) : null}

          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4 shadow-sm">
            <div className="font-semibold text-gray-900 dark:text-white">
              {result.appointment.serviceName}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {result.appointment.customer.fullName}
            </div>
            {result.appointment.notes ? (
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                {result.appointment.notes}
              </div>
            ) : null}
          </div>

          {Array.isArray(result.sameDayAppointments) &&
            result.sameDayAppointments.length > 1 ? (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4 shadow-sm">
              <div className="font-semibold text-gray-900 dark:text-white">
                Your appointments on {result.appointment.date}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                You can cancel any of them below.
              </div>

              <div className="mt-3 space-y-2">
                {result.sameDayAppointments.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/10 p-3"
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {a.startTime}–{a.endTime}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-200">
                      {a.serviceName}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-2xl w-full mt-2"
                      disabled={cancellingSameDayId === a.id || cancelling}
                      onClick={async () => {
                        setCancelError(null);
                        setCancellingSameDayId(a.id);
                        try {
                          await cancelSameDayAppointment(a.id);
                          setResult((prev) => {
                            if (!prev) return prev;
                            const list = Array.isArray(prev.sameDayAppointments)
                              ? prev.sameDayAppointments
                              : [];
                            return {
                              ...prev,
                              sameDayAppointments: list.filter(
                                (x) => x.id !== a.id
                              ),
                            };
                          });
                        } catch (e: any) {
                          setCancelError(e?.message || "Failed");
                        } finally {
                          setCancellingSameDayId(null);
                        }
                      }}
                    >
                      {cancellingSameDayId === a.id
                        ? "Cancelling…"
                        : "Cancel this appointment"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex flex-wrap gap-3">
              {!limitCustomerToOneUpcomingAppointment ? (
                <Button className="rounded-2xl" onClick={() => resetBookingOnly()}>
                  Book another appointment
                </Button>
              ) : null}

              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() =>
                  window.open(
                    googleCalendarUrl({
                      title: result.appointment.serviceName,
                      date: result.appointment.date,
                      startTime: result.appointment.startTime,
                      endTime: result.appointment.endTime,
                    }),
                    "_blank"
                  )
                }
              >
                Add to Google Calendar
              </Button>

              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={async () => {
                  setCancelling(true);
                  setCancelError(null);
                  try {
                    await cancelBooking();
                    resetFlow();
                  } catch (e: any) {
                    setCancelError(e?.message || "Failed");
                  } finally {
                    setCancelling(false);
                  }
                }}
                disabled={cancelling}
              >
                {cancelling ? "Cancelling…" : "Cancel booking"}
              </Button>
            </div>

            {identified ? (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  className="rounded-2xl"
                  onClick={async () => {
                    setCancelling(true);
                    setCancelError(null);
                    try {
                      await disconnectCustomer();
                      setConnected(false);
                      resetFlow();
                    } catch (e: any) {
                      setCancelError(e?.message || "Failed");
                    } finally {
                      setCancelling(false);
                    }
                  }}
                  disabled={cancelling}
                >
                  {cancelling ? "Disconnecting…" : "Not you? Disconnect"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === "success" && !result?.appointment ? (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          No booking found.
        </div>
      ) : null}
    </PublicBookingShell>
  );
}
