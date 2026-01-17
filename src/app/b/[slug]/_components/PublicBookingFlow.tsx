"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";

import { CenteredSpinner } from "@/components/CenteredSpinner";
import OtpInput from "@/components/OtpInput";
import PublicBookingShell from "./PublicBookingShell";
import { usePublicBusiness } from "./usePublicBusiness";
import { formatDateInTimeZone, formatPrice } from "@/lib/public-booking";
import Flatpickr from "react-flatpickr";
import { Arabic } from "flatpickr/dist/l10n/ar";
import { Hebrew } from "flatpickr/dist/l10n/he";

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
  cancelToken: string;
};

type ActiveAppointmentConflict = {
  bookingSessionId: string;
  existingAppointment?: {
    id?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    serviceName?: string;
  };
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

  // Cookie-based customer identification (server-side): load active appointment if present.
  React.useEffect(() => {
    if (!publicId) return;
    if (!data) return;
    if (result) return;

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
  }, [data, publicId, result]);
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  const resetFlow = React.useCallback(() => {
    setResult(null);
    setIdentified(false);
    setActiveConflict(null);
    setCancelError(null);
    setCancelling(false);
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

  const didInitFromUrlRef = React.useRef(false);

  // Initialize from URL (compat with older deep links) exactly once.
  React.useEffect(() => {
    if (!publicId) return;
    if (!data) return;
    if (didInitFromUrlRef.current) return;

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

  const dir = React.useMemo<"ltr" | "rtl">(() => {
    if (typeof document === "undefined") return "ltr";
    const v = String(document.documentElement.getAttribute("dir") || "ltr").toLowerCase();
    return v === "rtl" ? "rtl" : "ltr";
  }, []);

  const fpLocale = React.useMemo(() => {
    if (dir !== "rtl") return undefined;
    if (typeof document === "undefined") return { ...Arabic, rtl: true };
    const lang = String(document.documentElement.getAttribute("lang") || "").toLowerCase();
    if (lang.startsWith("he")) return { ...Hebrew, rtl: true };
    return { ...Arabic, rtl: true };
  }, [dir]);

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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

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
      locale: fpLocale,
      disable: [
        (d: Date) => {
          const ymd = ymdFromDateLocal(d);
          return isDisabledYmd(ymd);
        },
      ],
    };
  }, [businessTodayYmd, fpLocale, isDisabledYmd]);

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
        if (!res.ok)
          throw new Error(json?.error || `Request failed (${res.status})`);

        if (!alive) return;
        const parsed = json as SlotsResponse;
        slotsCacheRef.current.set(key, parsed);
        setSlots(parsed);
      } catch (e: any) {
        if (!alive) return;
        if (e?.name === "AbortError") return;
        setSlotsError(e?.message || "Failed to load times");
      } finally {
        if (alive) setSlotsLoading(false);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [date, publicId, serviceId, step]);

  const onBack = React.useMemo<(() => void) | undefined>(() => {
    if (step === "service") return undefined;
    if (step === "date")
      return () => {
        setDate("");
        setStartTime("");
        setStep("service");
      };
    if (step === "time")
      return () => {
        setStartTime("");
        setStep("date");
      };
    if (step === "details")
      return () => {
        setStep("time");
      };
    if (step === "verify")
      return () => {
        setOtpCode("");
        setStep("details");
      };
    if (step === "success") return () => resetFlow();
    return undefined;
  }, [resetFlow, step]);

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
    if (!selectedService) return null;
    if (step === "date") return `${selectedService.name}`;
    if (step === "time")
      return `${selectedService.name}${date ? ` • ${date}` : ""}`;
    return null;
  }, [data, date, selectedService, step]);

  const showGallery = step === "service";

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
        bookingSessionId: sessionId,
        existingAppointment: verifyJson?.existingAppointment,
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

  const confirmBookingWithSession = async (sessionId: string) => {
    if (!publicId) throw new Error("Business not found");
    if (!serviceId || !date || !startTime)
      throw new Error("Missing booking details");
    if (!sessionId) throw new Error("Email verification required");

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
        bookingSessionId: sessionId,
      }),
    });

    const confirmJson = await confirmRes.json().catch(() => null);
    if (!confirmRes.ok) {
      if (
        confirmRes.status === 409 &&
        String(confirmJson?.code ?? "") === "ACTIVE_APPOINTMENT_EXISTS"
      ) {
        setActiveConflict({
          bookingSessionId: sessionId,
          existingAppointment: confirmJson?.existingAppointment,
        });

        const err: any = new Error(
          confirmJson?.error ||
          "You already have an active upcoming appointment. Please cancel it first."
        );
        err.code = "ACTIVE_APPOINTMENT_EXISTS";
        throw err;
      }

      throw new Error(
        confirmJson?.error || `Request failed (${confirmRes.status})`
      );
    }

    setActiveConflict(null);

    return confirmJson as BookingResult;
  };

  const disconnectCustomer = async () => {
    await fetch("/api/public/booking/disconnect", { method: "POST" });
  };

  const cancelExistingAppointment = async () => {
    const sessionId = String(
      bookingSessionId || activeConflict?.bookingSessionId || ""
    ).trim();
    const appointmentId = String(
      activeConflict?.existingAppointment?.id ?? ""
    ).trim();
    if (!sessionId) throw new Error("Verification required");
    if (!appointmentId) throw new Error("Appointment not found");

    const res = await fetch("/api/public/booking/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingSessionId: sessionId,
        appointmentId,
        customerEmail: customerEmail.trim(),
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
      onBack={onBack}
      showGallery={showGallery}
    >
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
                "w-full text-left rounded-2xl border border-gray-200 dark:border-gray-800 " +
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
                  {formatPrice({ price: s.price, currency: data.currency })}
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

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              className="rounded-2xl"
              value={customerFullName}
              onChange={(e) => setCustomerFullName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              className="rounded-2xl"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
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

          <Button
            onClick={async () => {
              setSubmitting(true);
              setFormError(null);
              try {
                await requestOtp();
                setStep("verify");
              } catch (e: any) {
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
            {submitting ? "Sending code…" : "Verify email"}
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
                You already have an upcoming appointment
              </div>
              <div className="text-sm text-amber-800/90 dark:text-amber-200/80 mt-1">
                Please cancel it first to book a new one.
              </div>
              {activeConflict.existingAppointment?.date ||
                activeConflict.existingAppointment?.startTime ? (
                <div className="text-sm text-amber-900/90 dark:text-amber-200/90 mt-2">
                  {activeConflict.existingAppointment?.serviceName
                    ? `${activeConflict.existingAppointment.serviceName} • `
                    : ""}
                  {activeConflict.existingAppointment?.date || ""}
                  {activeConflict.existingAppointment?.startTime
                    ? ` • ${activeConflict.existingAppointment.startTime}`
                    : ""}
                </div>
              ) : null}

              <div className="mt-3">
                <Button
                  variant="outline"
                  className="rounded-2xl w-full"
                  disabled={submitting}
                  onClick={async () => {
                    setSubmitting(true);
                    setFormError(null);
                    try {
                      await cancelExistingAppointment();
                      setActiveConflict(null);
                      const sessionId =
                        bookingSessionId ||
                        String(activeConflict?.bookingSessionId ?? "").trim();
                      if (!sessionId) throw new Error("Verification required");
                      const r = await confirmBookingWithSession(sessionId);
                      setResult(r);
                      setStep("success");
                    } catch (e: any) {
                      setFormError(e?.message || "Failed");
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  {submitting ? "Cancelling…" : "Cancel existing appointment"}
                </Button>
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
              disabled={submitting}
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
                  const r = await confirmBookingWithSession(sessionId);
                  setResult(r);
                  setStep("success");
                  setIdentified(true);
                } catch (e: any) {
                  if (String(e?.code ?? "") === "ACTIVE_APPOINTMENT_EXISTS") {
                    // Business rule violation; show conflict UI, not an OTP error.
                    return;
                  }
                  setFormError(e?.message || "Failed");
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting || otpCode.replace(/\D/g, "").length < 6}
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

          <div className="space-y-2">
            <div className="flex flex-wrap gap-3">
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
