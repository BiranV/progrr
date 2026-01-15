"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { CenteredSpinner } from "@/components/CenteredSpinner";
import PublicBookingShell from "./PublicBookingShell";
import { usePublicBusiness } from "./usePublicBusiness";
import { formatDateInTimeZone, formatPrice } from "@/lib/public-booking";

type Step = "service" | "date" | "time" | "details" | "verify" | "success";

type SlotsResponse = {
  ok: boolean;
  date: string;
  timeZone: string;
  service: { id: string; name: string; durationMinutes: number };
  slots: Array<{ startTime: string; endTime: string }>;
};

const DRAFT_KEY = "progrr.bookingDraft.v1";
const RESULT_KEY = "progrr.bookingResult.v1";

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
    customer: { fullName: string; phone: string };
    notes?: string;
    status: string;
  };
  cancelToken: string;
};

function weekdayFromDateString(dateStr: string): number {
  // Weekday for a civil date is timezone-independent.
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.getUTCDay();
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

  const [month, setMonth] = React.useState<Date>(() => new Date());

  const [serviceId, setServiceId] = React.useState<string>("");
  const [date, setDate] = React.useState<string>("");
  const [startTime, setStartTime] = React.useState<string>("");

  const [customerFullName, setCustomerFullName] = React.useState<string>("");
  const [customerPhone, setCustomerPhone] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");

  const [otpCode, setOtpCode] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const slotsCacheRef = React.useRef<Map<string, SlotsResponse>>(new Map());
  const [slots, setSlots] = React.useState<SlotsResponse | null>(null);
  const [slotsLoading, setSlotsLoading] = React.useState(false);
  const [slotsError, setSlotsError] = React.useState<string | null>(null);

  const [result, setResult] = React.useState<BookingResult | null>(null);
  // Restore success screen on refresh if the user is still on this business.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!publicId) return;
    if (result) return;

    try {
      const raw = sessionStorage.getItem(RESULT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as any;
      if (!parsed?.appointment) return;
      setResult(parsed as BookingResult);
      setStep("success");
    } catch {
      // ignore
    }
  }, [publicId, result]);

  // Restore a draft (optional) so verify links still work after refresh.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!publicId) return;

    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as any;
      const pid = String(
        parsed?.businessPublicId ?? parsed?.businessSlug ?? ""
      ).trim();
      if (pid && pid !== publicId) return;

      if (!serviceId) setServiceId(String(parsed?.serviceId ?? "").trim());
      if (!date) setDate(String(parsed?.date ?? "").trim());
      if (!startTime) setStartTime(String(parsed?.startTime ?? "").trim());
      if (!customerFullName)
        setCustomerFullName(String(parsed?.customerFullName ?? "").trim());
      if (!customerPhone)
        setCustomerPhone(String(parsed?.customerPhone ?? "").trim());
      if (!notes)
        setNotes(typeof parsed?.notes === "string" ? parsed.notes.trim() : "");
    } catch {
      // ignore
    }
  }, [
    customerFullName,
    customerPhone,
    date,
    notes,
    publicId,
    serviceId,
    startTime,
  ]);
  const [cancelError, setCancelError] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);

  // Initialize from URL (compat with older deep links) exactly once.
  React.useEffect(() => {
    if (!publicId) return;
    if (!data) return;

    const sp = new URLSearchParams(window.location.search);
    const nextServiceId = String(sp.get("serviceId") ?? "").trim();
    const nextDate = String(sp.get("date") ?? "").trim();
    const nextTime = String(sp.get("time") ?? "").trim();
    const nextPhone = String(sp.get("phone") ?? "").trim();

    if (nextServiceId && !serviceId) setServiceId(nextServiceId);
    if (nextDate && !date) setDate(nextDate);
    if (nextTime && !startTime) setStartTime(nextTime);
    if (nextPhone && !customerPhone) setCustomerPhone(nextPhone);

    if (nextPhone && nextServiceId && nextDate && nextTime) {
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
  }, [publicId, data]);

  const tz = String(data?.availability?.timezone ?? "").trim() || "UTC";

  const weekStartsOn = React.useMemo<0 | 1>(() => {
    const v = Number((data as any)?.availability?.weekStartsOn);
    return v === 1 ? 1 : 0;
  }, [data]);

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

  const isDateEnabled = React.useCallback(
    (d: Date) => {
      if (!data) return false;
      if (!serviceId) return false;
      const dateStr = formatDateInTimeZone(d, tz);
      if (!dateStr) return false;

      const todayStr = formatDateInTimeZone(new Date(), tz);
      if (todayStr && dateStr < todayStr) return false;

      const weekday = weekdayFromDateString(dateStr);
      const conf = availabilityByDay.get(weekday);
      if (!conf) return false;
      if (!conf.enabled) return false;
      if (!conf.windows || conf.windows.length === 0) return false;
      return true;
    },
    [availabilityByDay, data, serviceId, tz]
  );

  const isPastDate = React.useCallback(
    (d: Date) => {
      const dateStr = formatDateInTimeZone(d, tz);
      if (!dateStr) return true;
      const todayStr = formatDateInTimeZone(new Date(), tz);
      if (!todayStr) return false;
      return dateStr < todayStr;
    },
    [tz]
  );

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
    if (step === "success")
      return () => {
        setResult(null);
        setCancelError(null);
        setCancelling(false);
        setSubmitting(false);
        setFormError(null);
        setOtpCode("");
        setCustomerFullName("");
        setCustomerPhone("");
        setNotes("");
        setStartTime("");
        setDate("");
        setServiceId("");
        setStep("service");
      };
    return undefined;
  }, [step]);

  const shellSubtitle = React.useMemo(() => {
    if (!data) return "";
    if (step === "service") return "Select service";
    if (step === "date") return "Pick a date";
    if (step === "time") return "Choose a time";
    if (step === "details")
      return date && startTime ? `${date} • ${startTime}` : "Your details";
    if (step === "verify")
      return customerPhone
        ? `We sent a code to ${customerPhone}`
        : "Verify phone";
    if (step === "success") {
      const appt = result?.appointment;
      return appt
        ? `${appt.date} • ${appt.startTime}–${appt.endTime}`
        : "Booked";
    }
    return "";
  }, [customerPhone, data, date, result, selectedService, startTime, step]);

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
    if (!customerPhone.trim()) throw new Error("Phone is required");
    if (!publicId) throw new Error("Business not found");
    if (!serviceId || !date || !startTime)
      throw new Error("Missing booking details");

    try {
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          businessPublicId: publicId,
          serviceId,
          date,
          startTime,
          customerFullName: customerFullName.trim(),
          customerPhone: customerPhone.trim(),
          notes: notes.trim() || undefined,
        })
      );
    } catch {
      // ignore
    }

    const res = await fetch("/api/public/booking/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: customerPhone.trim() }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(json?.error || `Request failed (${res.status})`);
  };

  const confirmBooking = async () => {
    if (!publicId) throw new Error("Business not found");
    if (!serviceId || !date || !startTime)
      throw new Error("Missing booking details");

    const verifyRes = await fetch("/api/public/booking/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: customerPhone.trim(),
        code: otpCode.trim(),
      }),
    });

    const verifyJson = await verifyRes.json().catch(() => null);
    if (!verifyRes.ok)
      throw new Error(
        verifyJson?.error || `Request failed (${verifyRes.status})`
      );

    const bookingSessionId = String(verifyJson?.bookingSessionId ?? "").trim();
    if (!bookingSessionId) throw new Error("Verification failed");

    const confirmRes = await fetch("/api/public/booking/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessPublicId: publicId,
        serviceId,
        date,
        startTime,
        customerFullName: customerFullName.trim(),
        customerPhone: customerPhone.trim(),
        notes: notes.trim() || undefined,
        bookingSessionId,
      }),
    });

    const confirmJson = await confirmRes.json().catch(() => null);
    if (!confirmRes.ok)
      throw new Error(
        confirmJson?.error || `Request failed (${confirmRes.status})`
      );

    try {
      sessionStorage.setItem(RESULT_KEY, JSON.stringify(confirmJson));
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }

    return confirmJson as BookingResult;
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
      <PublicBookingShell
        business={null}
        title="Booking"
        subtitle="Loading…"
        showGallery={false}
      >
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
            <div className="w-full max-w-[400px]">
              <Calendar
                mode="single"
                showOutsideDays
                month={month}
                onMonthChange={setMonth}
                weekStartsOn={weekStartsOn}
                className="w-full rounded-2xl border border-gray-200/70 bg-white/80 p-2 shadow-sm backdrop-blur dark:border-gray-800/70 dark:bg-gray-950/30"
                modifiers={{
                  past: (d) => isPastDate(d),
                  unavailable: (d) => !isPastDate(d) && !isDateEnabled(d),
                }}
                modifiersClassNames={{
                  past: "text-gray-300 dark:text-gray-700 font-normal opacity-25",
                  unavailable:
                    "text-gray-400 dark:text-gray-600 font-normal opacity-55",
                }}
                disabled={(d) => isPastDate(d) || !isDateEnabled(d)}
                selected={date ? new Date(`${date}T12:00:00Z`) : undefined}
                onSelect={(d) => {
                  if (!d) return;
                  if (isPastDate(d)) return;
                  if (!isDateEnabled(d)) return;
                  const dateStr = formatDateInTimeZone(d, tz);
                  if (!dateStr) return;
                  setDate(dateStr);
                  setStartTime("");
                  setFormError(null);
                  setStep("time");
                }}
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
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              className="rounded-2xl"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+1 555 123 4567"
            />
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
            disabled={submitting}
            className="rounded-2xl w-full"
          >
            {submitting ? "Sending code…" : "Verify phone"}
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

          <Input
            className="rounded-2xl"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            placeholder="Enter 6-digit code"
          />

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
                  const r = await confirmBooking();
                  setResult(r);
                  setStep("success");
                } catch (e: any) {
                  setFormError(e?.message || "Failed");
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting || otpCode.trim().length < 4}
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

          <div className="flex flex-wrap gap-2">
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
                  setResult(null);
                  setStep("service");
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
