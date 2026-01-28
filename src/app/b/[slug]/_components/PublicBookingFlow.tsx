"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import SidePanel from "@/components/ui/side-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";

import { CenteredSpinner } from "@/components/CenteredSpinner";
import OtpInput from "@/components/OtpInput";
import Stepper from "@/components/onboarding/Stepper";
import PublicBookingShell from "./PublicBookingShell";
import { usePublicBusiness } from "./usePublicBusiness";
import { formatDateInTimeZone, formatPrice } from "@/lib/public-booking";
import { formatTimeRange } from "@/lib/utils";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { useLocale } from "@/context/LocaleContext";
import { useI18n } from "@/i18n/useI18n";
import Flatpickr from "react-flatpickr";
import { english } from "flatpickr/dist/l10n/default";
import { Arabic } from "flatpickr/dist/l10n/ar";
import { Hebrew } from "flatpickr/dist/l10n/he";
import {
  Briefcase,
  Calendar,
  ChevronLeft,
  Clock,
  Banknote,
  Star,
  Timer,
  User,
} from "lucide-react";

type Step = "service" | "date" | "time" | "confirm" | "success";

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

type PublicReviewItem = {
  id: string;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  customerName: string;
  rating: number;
  comment: string;
  submittedAt: string | null;
};

type PublicReviewsResponse = {
  ok: true;
  reviews: PublicReviewItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function normalizeOtpCode(value: string): string {
  const input = String(value ?? "");
  const withArabicIndic = input.replace(/[٠-٩]/g, (d) =>
    String(d.charCodeAt(0) - 0x660),
  );
  const withEasternIndic = withArabicIndic.replace(/[۰-۹]/g, (d) =>
    String(d.charCodeAt(0) - 0x6f0),
  );
  return withEasternIndic.replace(/\D/g, "");
}

function wrapRtlSegment(value: string): string {
  const text = String(value ?? "");
  if (!text) return text;
  return `\u2067${text}\u2069`;
}

type PublicBookingError = {
  code?: string;
  status?: number;
  key?: string;
};

const PUBLIC_BOOKING_ERROR_MAP: Record<string, string> = {
  CUSTOMER_BLOCKED_FOR_THIS_BUSINESS: "publicBooking.errors.customerBlocked",
  ACTIVE_APPOINTMENT_EXISTS: "publicBooking.errors.activeAppointmentExists",
  SAME_SERVICE_SAME_DAY_EXISTS: "publicBooking.errors.sameServiceSameDay",
  SESSION_EXPIRED: "publicBooking.errors.sessionExpired",
  INVALID_CODE: "publicBooking.errors.invalidCode",
  CODE_EXPIRED: "publicBooking.errors.codeExpired",
  EXPIRED_CODE: "publicBooking.errors.codeExpired",
  UNAUTHORIZED: "publicBooking.errors.emailVerificationRequired",
  BUSINESS_NOT_FOUND: "publicBooking.errors.businessNotFound",
  REQUEST_FAILED: "publicBooking.errors.failed",
};

function getPublicBookingErrorKey(
  error: PublicBookingError | null | undefined,
) {
  if (error?.key) return String(error.key);
  const rawCode = String(error?.code ?? "");
  if (rawCode) {
    const normalized = rawCode.toUpperCase();
    return (
      PUBLIC_BOOKING_ERROR_MAP[normalized] ||
      PUBLIC_BOOKING_ERROR_MAP[rawCode] ||
      "publicBooking.errors.failed"
    );
  }
  return "publicBooking.errors.failed";
}

async function readJsonOrThrow(res: Response) {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw { code: json?.code, status: res.status } as PublicBookingError;
  }
  return json;
}

function ErrorAlert({
  children,
  centered = true,
}: {
  children: React.ReactNode;
  centered?: boolean;
}) {
  const content = (
    <div
      className={
        "w-full rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-200 text-center" +
        (centered ? " max-w-md" : "")
      }
    >
      {children}
    </div>
  );

  if (!centered) return content;
  return <div className="flex justify-center">{content}</div>;
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 text-left">
      <div className="h-8 w-8 shrink-0 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 text-start">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold truncate">{value}</div>
      </div>
    </div>
  );
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
  businessName?: string;
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

function formatDateForDisplay(date: string): string {
  const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(date ?? ""));
  if (!match) return String(date ?? "");
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function formatTimeInTimeZone(date: Date, timeZone: string): string {
  const tz = String(timeZone || "UTC").trim() || "UTC";
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const h = get("hour");
  const m = get("minute");
  if (!h || !m) return "";
  return `${h}:${m}`;
}

function firstNameOnly(value: string): string {
  const parts = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts[0] ?? "";
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
        w.start < w.end,
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
        w.start < w.end,
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
  const { locale, dir } = useLocale();
  const { t, language } = useI18n();
  const searchParams = useSearchParams();

  const { data, loading, error, resolvedPublicId } = usePublicBusiness(raw);

  const publicId = React.useMemo(() => {
    if (/^\d{5}$/.test(raw)) return raw;
    return resolvedPublicId;
  }, [raw, resolvedPublicId]);

  const reviewSectionEnabled = true;

  const reviewToken = React.useMemo(() => {
    return String(searchParams.get("reviewToken") ?? "").trim();
  }, [searchParams]);

  const [reviewsPage, setReviewsPage] = React.useState(1);
  const reviewsPageSize = 10;
  const reviewsQuery = useQuery({
    queryKey: ["publicReviews", reviewsPage, reviewsPageSize],
    enabled: Boolean(publicId),
    queryFn: async (): Promise<PublicReviewsResponse> => {
      const params = new URLSearchParams({
        businessPublicId: String(publicId ?? ""),
        page: String(reviewsPage),
        limit: String(reviewsPageSize),
      });
      const res = await fetch(`/api/public/reviews?${params.toString()}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || t("publicBooking.errors.failed"));
      }
      return json as PublicReviewsResponse;
    },
  });

  const publicReviews = reviewsQuery.data?.reviews ?? [];
  const reviewsTotalPages = reviewsQuery.data?.totalPages ?? 1;
  const [reviewValidation, setReviewValidation] = React.useState<{
    loading: boolean;
    valid: boolean;
    reviewAllowed: boolean;
    reviewSubmitted: boolean;
    appointmentId?: string;
  }>(() => ({
    loading: false,
    valid: false,
    reviewAllowed: false,
    reviewSubmitted: false,
  }));
  const [reviewRating, setReviewRating] = React.useState(0);
  const [reviewComment, setReviewComment] = React.useState("");
  const [reviewSubmitting, setReviewSubmitting] = React.useState(false);
  const [reviewSubmitError, setReviewSubmitError] = React.useState<
    string | null
  >(null);
  const [reviewSubmitted, setReviewSubmitted] = React.useState(false);
  const reviewSectionRef = React.useRef<HTMLDivElement | null>(null);

  const [upcomingAppointments, setUpcomingAppointments] = React.useState<
    MyAppointmentsItem[]
  >([]);
  const [upcomingLoading, setUpcomingLoading] = React.useState(false);

  const [step, setStep] = React.useState<Step>("service");

  const stepsOrder = React.useMemo<Step[]>(
    () => ["service", "date", "time", "confirm", "success"],
    [],
  );
  const stepIndex = React.useMemo(
    () => Math.max(0, stepsOrder.indexOf(step)),
    [step, stepsOrder],
  );
  const totalSteps = stepsOrder.length;

  const [serviceId, setServiceId] = React.useState<string>("");
  const [date, setDate] = React.useState<string>("");
  const [startTime, setStartTime] = React.useState<string>("");

  const [customerFullName, setCustomerFullName] = React.useState<string>("");
  const [customerEmail, setCustomerEmail] = React.useState<string>("");
  const [customerPhone, setCustomerPhone] = React.useState<string>("");
  const [customerPhoneValid, setCustomerPhoneValid] = React.useState(true);
  const [customerPhoneTouched, setCustomerPhoneTouched] = React.useState(false);
  const [notes, setNotes] = React.useState<string>("");

  const [confirmBookingLoading, setConfirmBookingLoading] =
    React.useState(false);
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

  React.useEffect(() => {
    setActiveConflict(null);
  }, [serviceId, date, startTime]);

  const limitCustomerToOneUpcomingAppointment = Boolean(
    (data as any)?.bookingRules?.limitCustomerToOneUpcomingAppointment,
  );

  React.useEffect(() => {
    if (!reviewToken) {
      setReviewValidation({
        loading: false,
        valid: false,
        reviewAllowed: false,
        reviewSubmitted: false,
      });
      setReviewSubmitted(false);
      setReviewSubmitError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setReviewValidation((prev) => ({ ...prev, loading: true }));
      try {
        const qs = new URLSearchParams({ token: reviewToken });
        if (publicId) qs.set("businessPublicId", publicId);
        const res = await fetch(`/api/reviews/validate-token?${qs.toString()}`);
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setReviewValidation({
            loading: false,
            valid: false,
            reviewAllowed: false,
            reviewSubmitted: false,
          });
          return;
        }
        if (!json?.valid) {
          setReviewValidation({
            loading: false,
            valid: false,
            reviewAllowed: false,
            reviewSubmitted: false,
          });
          return;
        }

        setReviewValidation({
          loading: false,
          valid: true,
          reviewAllowed: Boolean(json?.reviewAllowed),
          reviewSubmitted: Boolean(json?.reviewSubmitted),
          appointmentId: String(json?.appointmentId ?? "") || undefined,
        });
        setReviewSubmitted(Boolean(json?.reviewSubmitted));
      } catch {
        if (cancelled) return;
        setReviewValidation({
          loading: false,
          valid: false,
          reviewAllowed: false,
          reviewSubmitted: false,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publicId, reviewToken]);

  const shouldShowReviewForm =
    reviewValidation.valid &&
    reviewValidation.reviewAllowed &&
    !reviewSubmitted &&
    !reviewValidation.reviewSubmitted;

  React.useEffect(() => {
    if (!reviewSectionEnabled) return;
    if (!shouldShowReviewForm) return;
    if (!reviewSectionRef.current) return;
    reviewSectionRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [reviewSectionEnabled, shouldShowReviewForm]);

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
            publicId,
          )}`,
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

  // Cookie-based customer identification (server-side): prefill customer fields.
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
            publicId,
          )}&date=${encodeURIComponent(todayStr)}`,
        );
        const json = (await res
          .json()
          .catch(() => null)) as BookingMeResponse | null;
        if (cancelled) return;
        if (!res.ok || !json?.ok) return;

        if ((json as any)?.loggedIn) {
          setConnected(true);
          const cust = (json as any)?.customer ?? {};
          if (
            !normalizeEmail(customerEmail) &&
            typeof cust?.email === "string"
          ) {
            setCustomerEmail(normalizeEmail(cust.email));
          }
          if (!customerFullName.trim() && typeof cust?.fullName === "string") {
            setCustomerFullName(String(cust.fullName));
          }
          if (!customerPhone.trim() && typeof cust?.phone === "string") {
            setCustomerPhone(String(cust.phone));
          }
        } else {
          setConnected(false);
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
  const [loginStep, setLoginStep] = React.useState<
    "email" | "code" | "details"
  >("email");
  const [loginEmail, setLoginEmail] = React.useState("");
  const [loginCode, setLoginCode] = React.useState("");
  const [loginRequiresDetails, setLoginRequiresDetails] = React.useState(false);
  const [loginPurpose, setLoginPurpose] = React.useState<
    "appointments" | "booking"
  >("appointments");
  const [loginSubmitting, setLoginSubmitting] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);

  const [myAppointmentsOpen, setMyAppointmentsOpen] = React.useState(false);
  const [myAppointmentsDate, setMyAppointmentsDate] =
    React.useState<string>("");
  const [myAppointmentsScope, setMyAppointmentsScope] = React.useState<
    "day" | "future" | "all"
  >("future");
  const [myAppointments, setMyAppointments] = React.useState<
    MyAppointmentsItem[]
  >([]);
  const [myAppointmentsLoading, setMyAppointmentsLoading] =
    React.useState(false);
  const [myAppointmentsError, setMyAppointmentsError] = React.useState<
    string | null
  >(null);
  const [cancellingMyAppointmentId, setCancellingMyAppointmentId] =
    React.useState<string | null>(null);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const [profileOpen, setProfileOpen] = React.useState(false);
  const [profileStep, setProfileStep] = React.useState<"form" | "verify">(
    "form",
  );
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
    setConfirmBookingLoading(false);
    setFormError(null);
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
    setConfirmBookingLoading(false);
    setFormError(null);
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
    const target =
      myAppointmentsDate || date || result?.appointment?.date || todayStr;

    let cancelled = false;
    (async () => {
      setMyAppointmentsLoading(true);
      setMyAppointmentsError(null);
      try {
        const res = await fetch(
          myAppointmentsScope === "all"
            ? `/api/public/booking/me?scope=all`
            : myAppointmentsScope === "future"
              ? `/api/public/booking/me?businessPublicId=${encodeURIComponent(
                  publicId,
                )}&scope=future`
              : `/api/public/booking/me?businessPublicId=${encodeURIComponent(
                  publicId,
                )}&date=${encodeURIComponent(target)}`,
        );
        const json = (await res
          .json()
          .catch(() => null)) as BookingMeResponse | null;
        if (!res.ok) {
          throw {
            code: (json as any)?.code,
            status: res.status,
          } as PublicBookingError;
        }
        if (!json?.ok)
          throw { key: "publicBooking.errors.failed" } as PublicBookingError;
        if (!(json as any)?.loggedIn) {
          throw {
            key: "publicBooking.errors.loginAgain",
          } as PublicBookingError;
        }

        const cust = (json as any)?.customer ?? {};
        if (!normalizeEmail(customerEmail) && typeof cust?.email === "string") {
          setCustomerEmail(normalizeEmail(cust.email));
        }
        if (!customerFullName.trim() && typeof cust?.fullName === "string") {
          setCustomerFullName(String(cust.fullName));
        }
        if (!customerPhone.trim() && typeof cust?.phone === "string") {
          setCustomerPhone(String(cust.phone));
        }

        if (myAppointmentsScope !== "all") {
          setMyAppointmentsDate((json as any)?.date || target);
        } else {
          setMyAppointmentsDate("");
        }
        setMyAppointments(
          Array.isArray((json as any)?.appointments)
            ? (json as any).appointments
            : [],
        );
      } catch (e: any) {
        if (cancelled) return;
        setMyAppointmentsError(getPublicBookingErrorKey(e));
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
    const nextEmail = normalizeEmail(sp.get("email"));
    const nextPhone = String(sp.get("phone") ?? "").trim();

    if (nextServiceId && !serviceId) setServiceId(nextServiceId);
    if (nextDate && !date) setDate(nextDate);
    if (nextTime && !startTime) setStartTime(nextTime);
    if (nextEmail && !customerEmail) setCustomerEmail(nextEmail);
    if (nextPhone && !customerPhone) setCustomerPhone(nextPhone);

    if (nextServiceId && nextDate && nextTime) {
      if (connected) {
        setStep("confirm");
      } else {
        setLoginEmail(nextEmail || normalizeEmail(customerEmail));
        setLoginStep("email");
        setLoginCode("");
        setLoginError(null);
        setLoginPurpose("booking");
        setLoginRequiresDetails(false);
        setLoginOpen(true);
      }
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
    connected,
    serviceId,
    startTime,
  ]);

  React.useEffect(() => {
    if (!connected || !publicId) {
      setUpcomingAppointments([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setUpcomingLoading(true);
      try {
        const res = await fetch(
          `/api/public/booking/me?businessPublicId=${encodeURIComponent(
            publicId,
          )}&scope=future`,
        );
        const json = (await res
          .json()
          .catch(() => null)) as BookingMeResponse | null;
        if (cancelled) return;
        if (!res.ok || !json?.ok || !(json as any)?.loggedIn) {
          setUpcomingAppointments([]);
          return;
        }
        const list = Array.isArray((json as any)?.appointments)
          ? ((json as any).appointments as MyAppointmentsItem[])
          : [];
        setUpcomingAppointments(list);
      } catch {
        if (!cancelled) setUpcomingAppointments([]);
      } finally {
        if (!cancelled) setUpcomingLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connected, publicId]);

  const tz = String(data?.availability?.timezone ?? "").trim() || "UTC";

  const businessTodayYmd = React.useMemo(() => {
    return formatDateInTimeZone(new Date(), tz);
  }, [tz]);

  const businessNowTime = React.useMemo(() => {
    return formatTimeInTimeZone(new Date(), tz);
  }, [tz]);

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
    [availabilityByDay, data, serviceId],
  );

  const isDisabledYmd = React.useCallback(
    (ymd: string) => {
      const dateStr = String(ymd || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return true;
      if (businessTodayYmd && dateStr < businessTodayYmd) return true;
      return !isDateAvailableYmd(dateStr);
    },
    [businessTodayYmd, isDateAvailableYmd],
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
            publicId,
          )}/availability?date=${encodeURIComponent(
            date,
          )}&serviceId=${encodeURIComponent(serviceId)}`,
          { signal: controller.signal },
        );

        const json = await readJsonOrThrow(res);

        if (!alive) return;
        const parsed = json as SlotsResponse;
        slotsCacheRef.current.set(key, parsed);
        setSlots(parsed);
      } catch (e: any) {
        if (!alive) return;
        if (e?.name === "AbortError") return;
        setSlotsError(getPublicBookingErrorKey(e));
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

  const openProfileEditor = React.useCallback(() => {
    const email = normalizeEmail(customerEmail);
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

    if (!connected) {
      return (
        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 rounded-none px-0 text-gray-900 dark:text-white hover:bg-transparent"
            onClick={() => {
              setLoginEmail(normalizeEmail(customerEmail));
              setLoginStep("email");
              setLoginCode("");
              setLoginError(null);
              setLoginPurpose("appointments");
              setLoginRequiresDetails(false);
              setLoginOpen(true);
            }}
          >
            {t("publicBooking.header.login")}
          </Button>
        </div>
      );
    }

    const displayName = customerFullName.trim() || customerEmail.trim();
    return (
      <div className="flex items-center justify-between gap-3">
        {displayName ? (
          <div className="text-sm text-gray-900 dark:text-white truncate max-w-[140px]">
            {displayName}
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 rounded-none px-0 text-gray-900 dark:text-white hover:bg-transparent"
            onClick={openProfileEditor}
          >
            {t("publicBooking.header.updateDetails")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 rounded-none px-0 text-gray-900 dark:text-white hover:bg-transparent"
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              try {
                await disconnectCustomer();
                setConnected(false);
                resetFlow();
              } finally {
                setLoggingOut(false);
              }
            }}
          >
            {loggingOut
              ? t("publicBooking.header.loggingOut")
              : t("publicBooking.header.logout")}
          </Button>
        </div>
      </div>
    );
  }, [
    connected,
    customerEmail,
    customerFullName,
    data,
    disconnectCustomer,
    loggingOut,
    openProfileEditor,
    resetFlow,
    t,
  ]);

  const selectedSlot = React.useMemo(() => {
    const list = Array.isArray((slots as any)?.slots)
      ? ((slots as any).slots as any[])
      : [];
    const st = String(startTime || "").trim();
    if (!st) return null;
    const hit = list.find(
      (s) => String((s as any)?.startTime ?? "").trim() === st,
    );
    if (!hit) return null;
    return {
      startTime: String((hit as any)?.startTime ?? "").trim(),
      endTime: String((hit as any)?.endTime ?? "").trim(),
    };
  }, [slots, startTime]);

  const durationLabel = React.useMemo(() => {
    if (!selectedService) return undefined;
    return t("publicBooking.minutes", {
      count: selectedService.durationMinutes,
    });
  }, [selectedService, t]);

  const priceLabel = React.useMemo(() => {
    if (!selectedService || !data?.currency) return undefined;
    return formatPrice({
      price: selectedService.price,
      currency: data.currency,
      locale,
    });
  }, [data?.currency, locale, selectedService]);

  const bookedAppointments = React.useMemo(() => {
    if (!result?.appointment) return [] as MyAppointmentsItem[];
    const base: MyAppointmentsItem[] = [
      {
        id: result.appointment.id,
        date: result.appointment.date,
        startTime: result.appointment.startTime,
        endTime: result.appointment.endTime,
        serviceName: result.appointment.serviceName,
        status: "BOOKED",
      },
    ];
    const extras: MyAppointmentsItem[] = Array.isArray(
      result.sameDayAppointments,
    )
      ? result.sameDayAppointments.map((a) => ({
          id: a.id,
          date: a.date,
          startTime: a.startTime,
          endTime: a.endTime,
          serviceName: a.serviceName,
          status: "BOOKED",
        }))
      : [];
    const seen = new Set<string>();
    const combined: MyAppointmentsItem[] = [];
    for (const item of [...base, ...extras]) {
      const key = String(item.id ?? "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      combined.push(item);
    }
    return combined;
  }, [result]);

  const futureAppointments = React.useMemo(() => {
    if (!bookedAppointments.length) return [] as MyAppointmentsItem[];
    return bookedAppointments.filter((appt) => {
      const dateStr = String(appt.date ?? "").trim();
      if (!dateStr || !businessTodayYmd) return true;
      if (dateStr > businessTodayYmd) return true;
      if (dateStr < businessTodayYmd) return false;
      const startTime = String(appt.startTime ?? "").trim();
      if (!startTime || !businessNowTime) return true;
      return startTime >= businessNowTime;
    });
  }, [bookedAppointments, businessNowTime, businessTodayYmd]);

  const visibleUpcomingAppointments = React.useMemo(() => {
    const combined = [...upcomingAppointments, ...futureAppointments];
    const seen = new Set<string>();
    const deduped: MyAppointmentsItem[] = [];
    for (const item of combined) {
      const key = String(item.id ?? "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }
    return deduped;
  }, [futureAppointments, upcomingAppointments]);

  const hasRequiredDetails = Boolean(
    customerFullName.trim() &&
    normalizeEmail(customerEmail) &&
    customerPhone.trim() &&
    customerPhoneValid,
  );

  const canSubmitDetails = Boolean(
    !confirmBookingLoading &&
    !activeConflict &&
    (connected ? hasRequiredDetails : true),
  );

  const detailsConfirmLabel = t("publicBooking.details.confirmBookingAction");

  const detailsSubmittingLabel = t("publicBooking.actions.confirming");

  const showGallery = step === "service";

  const renderStepHeader = React.useCallback(
    (title: string, subtitle?: string) => (
      <div className="space-y-1 mt-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">{subtitle}</p>
        ) : null}
      </div>
    ),
    [],
  );

  const onBack = React.useCallback(() => {
    if (step === "time") {
      setStartTime("");
      setActiveConflict(null);
      setStep("date");
      return;
    }

    if (step === "confirm") {
      setActiveConflict(null);
      setStep("time");
      return;
    }

    if (step === "date") {
      setDate("");
      setStartTime("");
      setActiveConflict(null);
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

  const submitPublicReview = React.useCallback(async () => {
    if (!reviewToken) return;
    if (reviewSubmitting) return;
    setReviewSubmitError(null);
    setReviewSubmitting(true);

    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: reviewToken,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || t("errors.failedToSave"));
      }

      setReviewSubmitted(true);
      setReviewRating(0);
      setReviewComment("");
      setReviewValidation((prev) => ({
        ...prev,
        valid: true,
        reviewAllowed: false,
        reviewSubmitted: true,
      }));
      await reviewsQuery.refetch();
    } catch (err: any) {
      setReviewSubmitError(String(err?.message || t("errors.failedToSave")));
    } finally {
      setReviewSubmitting(false);
    }
  }, [
    reviewsQuery,
    reviewComment,
    reviewRating,
    reviewSubmitting,
    reviewToken,
    t,
  ]);

  const requestLoginOtp = async () => {
    if (!publicId)
      throw {
        key: "publicBooking.errors.businessNotFound",
      } as PublicBookingError;
    const email = normalizeEmail(loginEmail);
    setLoginEmail(email);
    if (!email)
      throw { key: "publicBooking.errors.emailRequired" } as PublicBookingError;
    if (!isValidEmail(email))
      throw { key: "publicBooking.errors.invalidEmail" } as PublicBookingError;

    const res = await fetch("/api/public/booking/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessPublicId: publicId, email }),
    });

    const json = await readJsonOrThrow(res);

    if (loginPurpose === "booking") {
      const customer = json?.customer ?? null;
      const fullName = String(customer?.fullName ?? "").trim();
      const phone = String(customer?.phone ?? "").trim();
      if (fullName) setCustomerFullName(fullName);
      if (phone) setCustomerPhone(phone);
      setLoginRequiresDetails(!fullName || !phone);
    }
  };

  const verifyLoginOtp = async () => {
    if (!publicId)
      throw {
        key: "publicBooking.errors.businessNotFound",
      } as PublicBookingError;
    const email = normalizeEmail(loginEmail);
    setLoginEmail(email);
    const code = normalizeOtpCode(loginCode);
    if (!email)
      throw { key: "publicBooking.errors.emailRequired" } as PublicBookingError;
    if (!code)
      throw { key: "publicBooking.errors.codeRequired" } as PublicBookingError;

    if (loginPurpose === "booking") {
      const res = await fetch("/api/public/booking/login/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessPublicId: publicId,
          email,
          code,
        }),
      });
      const json = await readJsonOrThrow(res);

      setConnected(true);
      setCustomerEmail(email);
      if (
        !customerFullName.trim() &&
        typeof json?.customer?.fullName === "string"
      ) {
        setCustomerFullName(String(json.customer.fullName));
      }
      if (!customerPhone.trim() && typeof json?.customer?.phone === "string") {
        setCustomerPhone(String(json.customer.phone));
      }
      if (loginRequiresDetails) {
        setLoginStep("details");
        return;
      }

      setLoginRequiresDetails(false);
      setLoginOpen(false);
      setStep("confirm");
      return;
    }

    const res = await fetch("/api/public/booking/login/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessPublicId: publicId, email, code }),
    });
    const json = await readJsonOrThrow(res);

    setConnected(true);
    setCustomerEmail(email);
    if (
      !customerFullName.trim() &&
      typeof json?.customer?.fullName === "string"
    ) {
      setCustomerFullName(String(json.customer.fullName));
    }
    if (!customerPhone.trim() && typeof json?.customer?.phone === "string") {
      setCustomerPhone(String(json.customer.phone));
    }
  };

  const submitProfileUpdate = async () => {
    if (!publicId)
      throw {
        key: "publicBooking.errors.businessNotFound",
      } as PublicBookingError;
    const fullName = profileFullName.trim();
    const phone = profilePhone.trim();
    const currentEmail = normalizeEmail(profileCurrentEmail);
    const newEmail = normalizeEmail(profileNewEmail);

    if (!fullName)
      throw {
        key: "publicBooking.errors.fullNameRequired",
      } as PublicBookingError;
    if (phone && !profilePhoneValid)
      throw { key: "publicBooking.errors.invalidPhone" } as PublicBookingError;
    if (!currentEmail)
      throw { key: "publicBooking.errors.emailRequired" } as PublicBookingError;
    if (!isValidEmail(currentEmail))
      throw { key: "publicBooking.errors.invalidEmail" } as PublicBookingError;
    if (!newEmail)
      throw { key: "publicBooking.errors.emailRequired" } as PublicBookingError;
    if (!isValidEmail(newEmail))
      throw { key: "publicBooking.errors.invalidEmail" } as PublicBookingError;

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

    const json = await readJsonOrThrow(res);

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
    if (!publicId)
      throw {
        key: "publicBooking.errors.businessNotFound",
      } as PublicBookingError;
    const currentEmail = normalizeEmail(profileCurrentEmail);
    const newEmail = normalizeEmail(profileNewEmail);
    const code = normalizeOtpCode(profileCode);
    if (!currentEmail)
      throw { key: "publicBooking.errors.emailRequired" } as PublicBookingError;
    if (!newEmail)
      throw { key: "publicBooking.errors.emailRequired" } as PublicBookingError;
    if (!code)
      throw { key: "publicBooking.errors.codeRequired" } as PublicBookingError;

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

    const json = await readJsonOrThrow(res);

    const cust = (json as any)?.customer ?? {};
    const email = normalizeEmail(cust?.email) || newEmail;

    setCustomerFullName(String(cust?.fullName ?? profileFullName).trim());
    setCustomerPhone(String(cust?.phone ?? profilePhone).trim());
    setCustomerEmail(email);
    setConnected(true);
    setProfileOpen(false);
  };

  const confirmBooking = async () => {
    if (!publicId)
      throw {
        key: "publicBooking.errors.businessNotFound",
      } as PublicBookingError;
    if (!serviceId || !date || !startTime)
      throw {
        key: "publicBooking.errors.missingBookingDetails",
      } as PublicBookingError;

    const confirmRes = await fetch("/api/public/booking/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessPublicId: publicId,
        serviceId,
        date,
        startTime,
        customerFullName: customerFullName.trim(),
        customerEmail: normalizeEmail(customerEmail),
        customerPhone: customerPhone.trim(),
        notes: notes.trim() || undefined,
      }),
    });

    const confirmJson = await confirmRes.json().catch(() => null);
    if (!confirmRes.ok) {
      const errCode = String(confirmJson?.code ?? "");

      if (
        errCode === "ACTIVE_APPOINTMENT_EXISTS" ||
        errCode === "SAME_SERVICE_SAME_DAY_EXISTS"
      ) {
        setActiveConflict({
          code:
            errCode === "SAME_SERVICE_SAME_DAY_EXISTS"
              ? "SAME_SERVICE_SAME_DAY_EXISTS"
              : "ACTIVE_APPOINTMENT_EXISTS",
          bookingSessionId: "",
          existingAppointment: confirmJson?.existingAppointment,
          existingAppointments: Array.isArray(confirmJson?.existingAppointments)
            ? confirmJson.existingAppointments
            : undefined,
        });
        throw {
          code: errCode,
          status: confirmRes.status,
        } as PublicBookingError;
      }

      throw { code: errCode, status: confirmRes.status } as PublicBookingError;
    }

    setActiveConflict(null);

    return confirmJson as BookingResult;
  };

  const handleDetailsConfirm = React.useCallback(async () => {
    if (!canSubmitDetails) return;
    setConfirmBookingLoading(true);
    setFormError(null);
    try {
      if (!connected) {
        setLoginEmail(normalizeEmail(customerEmail));
        setLoginStep("email");
        setLoginCode("");
        setLoginError(null);
        setLoginPurpose("booking");
        setLoginRequiresDetails(false);
        setLoginOpen(true);
        return;
      }

      if (!hasRequiredDetails) {
        throw {
          key: "publicBooking.details.completeDetailsDescription",
        } as PublicBookingError;
      }

      const r = await confirmBooking();
      setResult(r);
      setStep("success");
      setIdentified(true);
      setConnected(true);
    } catch (e: any) {
      if (
        String(e?.code ?? "") === "ACTIVE_APPOINTMENT_EXISTS" ||
        String(e?.code ?? "") === "SAME_SERVICE_SAME_DAY_EXISTS"
      ) {
        // Business rule conflict: show conflict panel only.
        return;
      }
      setFormError(getPublicBookingErrorKey(e));
    } finally {
      setConfirmBookingLoading(false);
    }
  }, [
    canSubmitDetails,
    confirmBooking,
    connected,
    customerEmail,
    hasRequiredDetails,
    t,
  ]);

  const handleConfirmKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
        return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "TEXTAREA") return;
      event.preventDefault();

      if (step === "confirm") {
        void handleDetailsConfirm();
      }
    },
    [handleDetailsConfirm, step],
  );

  async function disconnectCustomer() {
    const res = await fetch("/api/public/booking/disconnect", {
      method: "POST",
    });
    await readJsonOrThrow(res);
  }

  const cancelExistingAppointment = async (appointmentIdRaw: string) => {
    const appointmentId = String(appointmentIdRaw ?? "").trim();
    if (!appointmentId)
      throw {
        key: "publicBooking.errors.appointmentNotFound",
      } as PublicBookingError;

    const res = await fetch("/api/public/booking/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId,
      }),
    });

    await readJsonOrThrow(res);
  };

  const handleCancelConflictAppointment = React.useCallback(
    async (appointmentId: string) => {
      setFormError(null);
      setCancellingConflictId(appointmentId);
      try {
        await cancelExistingAppointment(appointmentId);
        setActiveConflict((prev) => {
          if (!prev) return prev;
          const list = Array.isArray(prev.existingAppointments)
            ? prev.existingAppointments
            : [];
          const nextList = list.filter(
            (x: any) => String(x?.id ?? "").trim() !== appointmentId,
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
        setFormError(getPublicBookingErrorKey(e));
      } finally {
        setCancellingConflictId(null);
      }
    },
    [cancelExistingAppointment, t],
  );

  const cancelBooking = async () => {
    const cancelToken = String(result?.cancelToken ?? "").trim();
    if (!cancelToken)
      throw {
        key: "publicBooking.errors.cancelTokenMissing",
      } as PublicBookingError;

    const res = await fetch("/api/public/booking/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancelToken }),
    });

    await readJsonOrThrow(res);
  };

  const cancelSameDayAppointment = async (appointmentId: string) => {
    const id = String(appointmentId ?? "").trim();
    if (!id)
      throw {
        key: "publicBooking.errors.appointmentNotFound",
      } as PublicBookingError;

    const res = await fetch("/api/public/booking/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: id }),
    });

    await readJsonOrThrow(res);
  };

  const handleCancelSameDay = React.useCallback(
    async (appointmentId: string) => {
      setCancelError(null);
      setCancellingSameDayId(appointmentId);
      try {
        await cancelSameDayAppointment(appointmentId);
        setResult((prev) => {
          if (!prev) return prev;
          const list = Array.isArray(prev.sameDayAppointments)
            ? prev.sameDayAppointments
            : [];
          return {
            ...prev,
            sameDayAppointments: list.filter((x) => x.id !== appointmentId),
          };
        });
      } catch (e: any) {
        setCancelError(getPublicBookingErrorKey(e));
      } finally {
        setCancellingSameDayId(null);
      }
    },
    [cancelSameDayAppointment, t],
  );

  const handleCancelUpcoming = React.useCallback(
    async (appointmentId: string) => {
      setCancelError(null);
      setCancellingSameDayId(appointmentId);
      try {
        await cancelSameDayAppointment(appointmentId);
        setUpcomingAppointments((prev) =>
          prev.filter((x) => String(x.id) !== String(appointmentId)),
        );
        setResult((prev) => {
          if (!prev) return prev;
          const list = Array.isArray(prev.sameDayAppointments)
            ? prev.sameDayAppointments
            : [];
          return {
            ...prev,
            sameDayAppointments: list.filter((x) => x.id !== appointmentId),
          };
        });
      } catch (e: any) {
        setCancelError(getPublicBookingErrorKey(e));
      } finally {
        setCancellingSameDayId(null);
      }
    },
    [cancelSameDayAppointment],
  );

  const handleAddToGoogle = React.useCallback(() => {
    if (!result?.appointment) return;
    window.open(
      googleCalendarUrl({
        title: result.appointment.serviceName,
        date: result.appointment.date,
        startTime: result.appointment.startTime,
        endTime: result.appointment.endTime,
      }),
      "_blank",
    );
  }, [result]);

  const handleCancelBooking = React.useCallback(async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelBooking();
      resetFlow();
    } catch (e: any) {
      setCancelError(getPublicBookingErrorKey(e));
    } finally {
      setCancelling(false);
    }
  }, [cancelBooking, resetFlow, t]);

  const handleDisconnect = React.useCallback(async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await disconnectCustomer();
      setConnected(false);
      resetFlow();
    } catch (e: any) {
      setCancelError(getPublicBookingErrorKey(e));
    } finally {
      setCancelling(false);
    }
  }, [disconnectCustomer, resetFlow, t]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <CenteredSpinner fullPage />
      </div>
    );
  }

  const publicBookingErrorKey = getPublicBookingErrorKey({
    code: error ?? "REQUEST_FAILED",
  });

  if (error || !data) {
    return (
      <PublicBookingShell
        business={data}
        title={t("publicBooking.title")}
        subtitle=""
        showGallery={false}
      >
        <div className="space-y-4 text-center">
          <ErrorAlert centered>{t(publicBookingErrorKey)}</ErrorAlert>
        </div>
      </PublicBookingShell>
    );
  }

  return (
    <PublicBookingShell
      business={data}
      title={t("publicBooking.title")}
      subtitle={undefined}
      subtitleRight={undefined}
      headerRight={shellHeaderRight}
      onBack={step === "service" ? undefined : onBack}
      showGallery={showGallery}
    >
      <SidePanel
        open={loginOpen}
        onOpenChange={(open) => {
          setLoginOpen(open);
          if (!open) {
            setLoginError(null);
            setLoginSubmitting(false);
            setLoginCode("");
            setLoginStep("email");
            setLoginRequiresDetails(false);
            setCustomerPhoneTouched(false);
          }
        }}
        title={t("publicBooking.login.title")}
        description={t("publicBooking.login.description")}
      >
        {loginError ? <ErrorAlert>{t(loginError)}</ErrorAlert> : null}

        {loginStep === "email" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="loginEmail">
                {t("publicBooking.login.emailLabel")}
              </Label>
              <Input
                id="loginEmail"
                className="rounded-2xl"
                value={loginEmail}
                onChange={(e) => setLoginEmail(normalizeEmail(e.target.value))}
                onBlur={(e) => setLoginEmail(normalizeEmail(e.target.value))}
                placeholder={t("publicBooking.login.emailPlaceholder")}
              />
            </div>

            <Button
              className="rounded-2xl w-full"
              disabled={
                loginSubmitting || !isValidEmail(normalizeEmail(loginEmail))
              }
              data-panel-primary="true"
              onClick={async () => {
                setLoginSubmitting(true);
                setLoginError(null);
                try {
                  await requestLoginOtp();
                  setLoginStep("code");
                } catch (e: any) {
                  setLoginError(getPublicBookingErrorKey(e));
                } finally {
                  setLoginSubmitting(false);
                }
              }}
            >
              {loginSubmitting
                ? t("publicBooking.login.sendingCode")
                : t("publicBooking.login.sendCode")}
            </Button>
          </div>
        ) : loginStep === "code" ? (
          <div className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {t("publicBooking.login.codeSent", { email: loginEmail })}
            </div>
            <div className="flex justify-center">
              <OtpInput
                id="login-otp"
                name="code"
                length={6}
                value={loginCode}
                onChange={setLoginCode}
                disabled={loginSubmitting}
                inputClassName="bg-gray-50 text-slate-900 placeholder:text-slate-400 rounded-xl border-2 focus-visible:ring-2 focus-visible:ring-[#165CF0]/30 focus-visible:border-[#165CF0] border-[#165CF0]"
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
                {t("common.back")}
              </Button>
              <Button
                className="rounded-2xl flex-1"
                disabled={
                  loginSubmitting || normalizeOtpCode(loginCode).length < 6
                }
                data-panel-primary="true"
                onClick={async () => {
                  setLoginSubmitting(true);
                  setLoginError(null);
                  try {
                    await verifyLoginOtp();
                  } catch (e: any) {
                    setLoginError(getPublicBookingErrorKey(e));
                  } finally {
                    setLoginSubmitting(false);
                  }
                }}
              >
                {loginSubmitting
                  ? t("publicBooking.login.verifying")
                  : t("publicBooking.login.verify")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/10 p-3">
              <div className="text-sm text-amber-900 dark:text-amber-200">
                {t("publicBooking.details.completeDetailsDescription")}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="loginFullName">
                {t("publicBooking.details.fullNameLabel")}
              </Label>
              <Input
                id="loginFullName"
                className="rounded-2xl"
                value={customerFullName}
                onChange={(e) => setCustomerFullName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="loginPhone">
                {t("publicBooking.details.phoneLabel")}
              </Label>
              <PhoneInput
                id="loginPhone"
                className="rounded-2xl"
                inputClassName="rounded-2xl"
                value={customerPhone}
                onChange={(v) => setCustomerPhone(v)}
                onValidityChange={setCustomerPhoneValid}
                onBlur={() => setCustomerPhoneTouched(true)}
                aria-invalid={customerPhoneTouched && !customerPhoneValid}
                placeholder={t("publicBooking.details.phonePlaceholder")}
              />
              {customerPhoneTouched &&
              customerPhone.trim() &&
              !customerPhoneValid ? (
                <div className="text-xs text-red-600 dark:text-red-400">
                  {t("publicBooking.details.invalidPhone")}
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  setLoginStep("code");
                }}
                disabled={loginSubmitting}
              >
                {t("common.back")}
              </Button>
              <Button
                className="rounded-2xl flex-1"
                disabled={
                  loginSubmitting ||
                  !customerFullName.trim() ||
                  !customerPhone.trim() ||
                  !customerPhoneValid
                }
                data-panel-primary="true"
                onClick={async () => {
                  setLoginSubmitting(true);
                  setLoginError(null);
                  try {
                    await submitProfileUpdate();
                    setLoginRequiresDetails(false);
                    setLoginOpen(false);
                    setStep("confirm");
                  } catch (e: any) {
                    setLoginError(getPublicBookingErrorKey(e));
                  } finally {
                    setLoginSubmitting(false);
                  }
                }}
              >
                {loginSubmitting
                  ? t("publicBooking.actions.saving")
                  : t("common.save")}
              </Button>
            </div>
          </div>
        )}
      </SidePanel>

      <SidePanel
        open={myAppointmentsOpen}
        onOpenChange={(open) => {
          setMyAppointmentsOpen(open);
          if (!open) {
            setMyAppointmentsError(null);
            setMyAppointmentsLoading(false);
            setCancellingMyAppointmentId(null);
          }
        }}
        title={
          myAppointmentsScope === "future" || myAppointmentsScope === "all"
            ? t("publicBooking.myAppointments.titleUpcoming")
            : t("publicBooking.myAppointments.titleAll")
        }
        description={
          myAppointmentsScope === "future" || myAppointmentsScope === "all"
            ? t("publicBooking.myAppointments.subtitleUpcoming")
            : myAppointmentsDate
              ? t("publicBooking.myAppointments.subtitleForDate", {
                  date: myAppointmentsDate,
                })
              : ""
        }
        showCloseButton
      >
        {myAppointmentsError ? (
          <ErrorAlert>{t(myAppointmentsError)}</ErrorAlert>
        ) : null}

        {myAppointmentsLoading ? (
          <CenteredSpinner className="min-h-[120px] items-center" />
        ) : myAppointments.filter(
            (a) => String(a.status || "").toUpperCase() === "BOOKED",
          ).length === 0 ? (
          <div className="text-sm text-muted-foreground">
            {myAppointmentsScope === "future" || myAppointmentsScope === "all"
              ? t("publicBooking.myAppointments.emptyUpcoming")
              : t("publicBooking.myAppointments.emptyForDay")}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {myAppointments
              .filter((a) => String(a.status || "").toUpperCase() === "BOOKED")
              .map((a) => (
                <div key={a.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {a.date ? (
                        <div className="text-xs text-muted-foreground">
                          {formatDateForDisplay(a.date)}
                        </div>
                      ) : null}
                      {a.businessName ? (
                        <div className="text-xs text-muted-foreground">
                          {a.businessName}
                        </div>
                      ) : null}
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        <span dir="ltr">
                          {formatTimeRange(a.startTime, a.endTime)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-200">
                        {a.serviceName}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="shrink-0 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white cursor-pointer"
                      disabled={cancellingMyAppointmentId === a.id}
                      onClick={async () => {
                        setCancellingMyAppointmentId(a.id);
                        setMyAppointmentsError(null);
                        try {
                          await cancelSameDayAppointment(a.id);
                          setMyAppointments((prev) =>
                            prev.filter((x) => x.id !== a.id),
                          );
                          setFormError(null);
                          setActiveConflict((prev) => {
                            if (!prev) return prev;
                            const id = String(a.id ?? "").trim();
                            const existingId = String(
                              prev.existingAppointment?.id ?? "",
                            ).trim();
                            if (existingId && existingId === id) return null;

                            const list = Array.isArray(
                              prev.existingAppointments,
                            )
                              ? prev.existingAppointments
                              : [];
                            if (list.length === 0) return prev;

                            const nextList = list.filter(
                              (x: any) => String(x?.id ?? "").trim() !== id,
                            );
                            if (nextList.length === 0) return null;
                            return { ...prev, existingAppointments: nextList };
                          });
                        } catch (e: any) {
                          setMyAppointmentsError(getPublicBookingErrorKey(e));
                        } finally {
                          setCancellingMyAppointmentId(null);
                        }
                      }}
                    >
                      {cancellingMyAppointmentId === a.id
                        ? t("publicBooking.actions.cancelling")
                        : t("publicBooking.actions.cancelAppointment")}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </SidePanel>

      <SidePanel
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
        title={t("publicBooking.profile.title")}
        description={t("publicBooking.profile.description")}
      >
        {profileError ? <ErrorAlert>{t(profileError)}</ErrorAlert> : null}

        {profileStep === "form" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="profileFullName">
                {t("publicBooking.profile.fullNameLabel")}
              </Label>
              <Input
                id="profileFullName"
                className="rounded-2xl"
                value={profileFullName}
                onChange={(e) => setProfileFullName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profileEmail">
                {t("publicBooking.profile.emailLabel")}
              </Label>
              <Input
                id="profileEmail"
                className="rounded-2xl"
                value={profileNewEmail}
                onChange={(e) =>
                  setProfileNewEmail(normalizeEmail(e.target.value))
                }
                onBlur={(e) =>
                  setProfileNewEmail(normalizeEmail(e.target.value))
                }
                placeholder={t("publicBooking.profile.emailPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profilePhone">
                {t("publicBooking.profile.phoneLabel")}
              </Label>
              <PhoneInput
                id="profilePhone"
                className="rounded-2xl"
                inputClassName="rounded-2xl"
                value={profilePhone}
                onChange={(v) => setProfilePhone(v)}
                onValidityChange={setProfilePhoneValid}
                onBlur={() => setProfilePhoneTouched(true)}
                aria-invalid={profilePhoneTouched && !profilePhoneValid}
                placeholder={t("publicBooking.profile.phonePlaceholder")}
              />
              {profilePhoneTouched &&
              profilePhone.trim() &&
              !profilePhoneValid ? (
                <div className="text-xs text-red-600 dark:text-red-400">
                  {t("publicBooking.profile.invalidPhone")}
                </div>
              ) : null}
            </div>

            <Button
              className="rounded-2xl w-full"
              disabled={
                profileSubmitting ||
                !profileFullName.trim() ||
                (profilePhone.trim() && !profilePhoneValid) ||
                !normalizeEmail(profileNewEmail) ||
                !isValidEmail(normalizeEmail(profileNewEmail))
              }
              onClick={async () => {
                setProfileSubmitting(true);
                setProfileError(null);
                try {
                  await submitProfileUpdate();
                } catch (e: any) {
                  setProfileError(getPublicBookingErrorKey(e));
                } finally {
                  setProfileSubmitting(false);
                }
              }}
            >
              {profileSubmitting
                ? t("publicBooking.actions.saving")
                : t("common.save")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {t("publicBooking.profile.codeSent", {
                email:
                  normalizeEmail(profileNewEmail) ||
                  t("publicBooking.profile.yourEmail"),
              })}
            </div>

            <div className="flex justify-center">
              <OtpInput
                id="profile-otp"
                name="code"
                length={6}
                value={profileCode}
                onChange={setProfileCode}
                disabled={profileSubmitting}
                inputClassName="bg-gray-50 text-slate-900 placeholder:text-slate-400 rounded-xl border-2 focus-visible:ring-2 focus-visible:ring-[#165CF0]/30 focus-visible:border-[#165CF0] border-[#165CF0]"
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
                {t("common.back")}
              </Button>
              <Button
                className="rounded-2xl flex-1"
                disabled={
                  profileSubmitting || normalizeOtpCode(profileCode).length < 6
                }
                onClick={async () => {
                  setProfileSubmitting(true);
                  setProfileError(null);
                  try {
                    await submitProfileEmailVerify();
                  } catch (e: any) {
                    setProfileError(getPublicBookingErrorKey(e));
                  } finally {
                    setProfileSubmitting(false);
                  }
                }}
              >
                {profileSubmitting
                  ? t("publicBooking.profile.verifying")
                  : t("publicBooking.profile.verify")}
              </Button>
            </div>
          </div>
        )}
      </SidePanel>

      <div className="space-y-3">
        {step !== "service" ? (
          <div className="flex items-center justify-start">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-white text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label={t("common.back")}
            >
              <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
            </button>
          </div>
        ) : null}
        <Stepper totalSteps={totalSteps} currentStep={stepIndex} />
      </div>

      {/* Service selection */}
      {step === "service" ? (
        <div className="space-y-4">
          {renderStepHeader(t("publicBooking.steps.service"))}

          <div className="space-y-3">
            {data.services.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setServiceId(s.id);
                  setDate("");
                  setStartTime("");
                  setFormError(null);
                  setActiveConflict(null);
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
                      {t("publicBooking.minutes", { count: s.durationMinutes })}
                    </div>
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-white shrink-0">
                    {formatPrice({
                      price: s.price,
                      currency: data.currency,
                      locale,
                    })}
                  </div>
                </div>
              </button>
            ))}

            {!data.services.length && (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {t("publicBooking.errors.noServices")}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Date selection */}
      {step === "date" ? (
        <div className="space-y-4">
          {renderStepHeader(t("publicBooking.steps.date"))}

          <div className="flex justify-center">
            <div className="w-full">
              <Flatpickr
                key={flatpickrKey}
                options={flatpickrOptions as any}
                value={date || undefined}
                onChange={(_selectedDates: Date[], dateStr: string) => {
                  const next = String(dateStr || "").trim();
                  if (!next) return;
                  if (isDisabledYmd(next)) return;
                  setDate(next);
                  setStartTime("");
                  setFormError(null);
                  setActiveConflict(null);
                  setStep("time");
                }}
                render={(_props: any, ref: any) => (
                  <input
                    ref={ref as any}
                    type="text"
                    aria-label={t("publicBooking.date.selectDateAria")}
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
          {renderStepHeader(
            t("publicBooking.steps.time"),
            date ? formatDateForDisplay(date) : undefined,
          )}

          <div className="space-y-3">
            {slotsLoading ? (
              <CenteredSpinner className="min-h-[40vh] items-center" />
            ) : slotsError ? (
              <ErrorAlert>{t(slotsError)}</ErrorAlert>
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
                          setActiveConflict(null);

                          if (connected) {
                            setStep("confirm");
                            return;
                          }

                          setLoginEmail(normalizeEmail(customerEmail));
                          setLoginStep("email");
                          setLoginCode("");
                          setLoginError(null);
                          setLoginPurpose("booking");
                          setLoginRequiresDetails(false);
                          setLoginOpen(true);
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
                    {t("publicBooking.errors.noTimes")}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {t("publicBooking.errors.selectDateToSeeTimes")}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Confirm */}
      {step === "confirm" ? (
        <div className="space-y-4" onKeyDown={handleConfirmKeyDown}>
          {renderStepHeader(t("publicBooking.details.confirmBookingTitle"))}

          {formError ? <ErrorAlert>{t(formError)}</ErrorAlert> : null}

          {activeConflict ? (
            <div className="rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 p-4">
              <div className="font-semibold text-amber-900 dark:text-amber-200">
                {activeConflict.code === "SAME_SERVICE_SAME_DAY_EXISTS"
                  ? t("publicBooking.conflict.sameServiceTitle")
                  : t("publicBooking.conflict.upcomingTitle")}
              </div>
              <div className="text-sm text-amber-800/90 dark:text-amber-200/80 mt-1">
                {activeConflict.code === "SAME_SERVICE_SAME_DAY_EXISTS"
                  ? t("publicBooking.conflict.sameServiceDescription")
                  : t("publicBooking.conflict.upcomingDescription")}
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
                    const timeRange =
                      appt?.startTime && appt?.endTime
                        ? formatTimeRange(appt.startTime, appt.endTime)
                        : String(appt?.startTime ?? "").trim();

                    return (
                      <div
                        key={apptId}
                        className="rounded-xl border border-amber-200/70 dark:border-amber-900/40 bg-white/60 dark:bg-black/10 p-3"
                      >
                        <div className="text-sm text-amber-900/90 dark:text-amber-200/90">
                          {appt?.serviceName ? `${appt.serviceName} • ` : ""}
                          {appt?.date ? formatDateForDisplay(appt.date) : ""}
                          {timeRange ? (
                            <>
                              {" • "}
                              <span dir="ltr">{timeRange}</span>
                            </>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="mt-2 w-full rounded-2xl border border-transparent text-sm text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white cursor-pointer"
                          disabled={
                            confirmBookingLoading ||
                            cancellingConflictId === apptId
                          }
                          onClick={() =>
                            handleCancelConflictAppointment(apptId)
                          }
                        >
                          {cancellingConflictId === apptId
                            ? t("publicBooking.actions.cancelling")
                            : t("publicBooking.actions.cancelAppointment")}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : null}

          <div
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/10 p-4"
            dir={isRtl ? "rtl" : "ltr"}
          >
            <div className="flex flex-col gap-3">
              <SummaryRow
                icon={Briefcase}
                label={t("publicBooking.details.serviceLabel")}
                value={
                  selectedService?.name ??
                  t("publicBooking.details.appointmentFallback")
                }
              />

              <div className="grid grid-cols-2 gap-3">
                <SummaryRow
                  icon={Calendar}
                  label={t("publicBooking.details.dateLabel")}
                  value={
                    date ? formatDateForDisplay(date) : t("common.emptyDash")
                  }
                />
                <SummaryRow
                  icon={Clock}
                  label={t("publicBooking.details.timeLabel")}
                  value={
                    startTime
                      ? formatTimeRange(startTime, selectedSlot?.endTime || "")
                      : t("common.emptyDash")
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <SummaryRow
                  icon={Timer}
                  label={t("publicBooking.details.durationLabel")}
                  value={durationLabel ?? t("common.emptyDash")}
                />
                <SummaryRow
                  icon={Banknote}
                  label={t("publicBooking.details.priceLabel")}
                  value={priceLabel ?? t("common.emptyDash")}
                />
              </div>
            </div>
          </div>

          {!hasRequiredDetails ? (
            <div className="rounded-2xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/10 p-4">
              <div className="font-semibold text-amber-900 dark:text-amber-200">
                {t("publicBooking.details.completeDetailsTitle")}
              </div>
              <div className="text-sm text-amber-800/90 dark:text-amber-200/80 mt-1">
                {t("publicBooking.details.completeDetailsDescription")}
              </div>
            </div>
          ) : null}

          {!hasRequiredDetails ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="confirmFullName">
                  {t("publicBooking.details.fullNameLabel")}
                </Label>
                <Input
                  id="confirmFullName"
                  className="rounded-2xl"
                  value={customerFullName}
                  onChange={(e) => setCustomerFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPhone">
                  {t("publicBooking.details.phoneLabel")}
                </Label>
                <PhoneInput
                  id="confirmPhone"
                  className="rounded-2xl"
                  inputClassName="rounded-2xl"
                  value={customerPhone}
                  onChange={(v) => setCustomerPhone(v)}
                  onValidityChange={setCustomerPhoneValid}
                  onBlur={() => setCustomerPhoneTouched(true)}
                  aria-invalid={customerPhoneTouched && !customerPhoneValid}
                  placeholder={t("publicBooking.details.phonePlaceholder")}
                />
                {customerPhoneTouched &&
                customerPhone.trim() &&
                !customerPhoneValid ? (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    {t("publicBooking.details.invalidPhone")}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <Button
            onClick={handleDetailsConfirm}
            disabled={!canSubmitDetails}
            className="rounded-2xl w-full"
          >
            {confirmBookingLoading
              ? detailsSubmittingLabel
              : detailsConfirmLabel}
          </Button>
        </div>
      ) : null}

      {/* Success */}
      {step === "success" && result?.appointment ? (
        <div className="space-y-4">
          {renderStepHeader(t("publicBooking.steps.booked"))}

          {cancelError ? <ErrorAlert>{t(cancelError)}</ErrorAlert> : null}

          {futureAppointments.length ? (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4 shadow-sm">
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {futureAppointments.map((a) => (
                  <div key={a.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {a.date ? (
                          <div className="text-xs text-muted-foreground text-start">
                            <span dir="ltr">
                              {formatDateForDisplay(a.date)}
                            </span>
                          </div>
                        ) : null}
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          <span dir="ltr">
                            {formatTimeRange(a.startTime, a.endTime)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-200">
                          {a.serviceName}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="shrink-0 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white cursor-pointer"
                        disabled={cancellingSameDayId === a.id || cancelling}
                        onClick={() => handleCancelSameDay(a.id)}
                      >
                        {cancellingSameDayId === a.id
                          ? t("publicBooking.actions.cancelling")
                          : t("publicBooking.actions.cancelAppointment")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {futureAppointments.length ? (
            <div className="space-y-2">
              <div className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  className="rounded-2xl w-full bg-transparent"
                  onClick={handleAddToGoogle}
                >
                  {t("publicBooking.success.addToGoogle")}
                </Button>

                {!limitCustomerToOneUpcomingAppointment ? (
                  <Button className="rounded-2xl" onClick={resetBookingOnly}>
                    {t("publicBooking.success.bookAnother")}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === "success" && !result?.appointment ? (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {t("publicBooking.errors.noBookingFound")}
        </div>
      ) : null}

      {connected ? (
        <div className="mt-10 space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("publicBooking.myAppointments.titleUpcoming")}
            </h2>
          </div>

          {upcomingLoading ? (
            <CenteredSpinner size="sm" className="py-6" />
          ) : visibleUpcomingAppointments.length === 0 ? null : (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4 shadow-sm">
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {visibleUpcomingAppointments.map((a) => (
                  <div key={a.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {a.date ? (
                          <div className="text-xs text-muted-foreground text-start">
                            <span dir="ltr">
                              {formatDateForDisplay(a.date)}
                            </span>
                          </div>
                        ) : null}
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          <span dir="ltr">
                            {formatTimeRange(a.startTime, a.endTime)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-200">
                          {a.serviceName}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="shrink-0 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white cursor-pointer"
                        disabled={cancellingSameDayId === a.id || cancelling}
                        onClick={() => handleCancelUpcoming(a.id)}
                      >
                        {cancellingSameDayId === a.id
                          ? t("publicBooking.actions.cancelling")
                          : t("publicBooking.actions.cancelAppointment")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {reviewSectionEnabled ? (
        <div className="mt-10 space-y-5">
          {shouldShowReviewForm ? (
            <div
              ref={reviewSectionRef}
              className="rounded-2xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-4 space-y-4"
            >
              <div className="text-base font-semibold text-gray-900 dark:text-white">
                {t("publicBooking.reviews.leaveTitle")}
              </div>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((value) => {
                  const selected = reviewRating >= value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setReviewRating(value)}
                      className={`rounded-full p-1 transition ${
                        selected ? "text-yellow-500" : "text-gray-300"
                      }`}
                      aria-label={t("publicBooking.reviews.ratingAria", {
                        rating: value,
                      })}
                    >
                      <Star
                        className="h-7 w-7"
                        fill={selected ? "currentColor" : "none"}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Label>{t("publicBooking.reviews.commentLabel")}</Label>
                <Textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={4}
                  placeholder={t("publicBooking.reviews.commentPlaceholder")}
                  disabled={reviewSubmitting}
                />
              </div>
              {reviewSubmitError ? (
                <div className="text-sm text-rose-500">{reviewSubmitError}</div>
              ) : null}
              <Button
                type="button"
                className="rounded-2xl w-full"
                onClick={submitPublicReview}
                disabled={reviewSubmitting || reviewRating === 0}
              >
                {reviewSubmitting
                  ? t("publicBooking.reviews.submitting")
                  : t("publicBooking.reviews.submit")}
              </Button>
            </div>
          ) : null}

          {reviewValidation.valid &&
          (reviewSubmitted || reviewValidation.reviewSubmitted) ? (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 text-sm text-emerald-800 dark:text-emerald-200">
              {t("publicBooking.reviews.thanks")}
            </div>
          ) : null}

          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("publicBooking.reviews.title")}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t("publicBooking.reviews.subtitle")}
            </p>
          </div>

          {reviewsQuery.isPending ? (
            <CenteredSpinner size="sm" className="py-6" />
          ) : reviewsQuery.isError ? (
            <div className="text-sm text-rose-500">
              {(reviewsQuery.error as Error)?.message ||
                t("publicBooking.errors.failed")}
            </div>
          ) : publicReviews.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t("publicBooking.reviews.empty")}
            </div>
          ) : (
            <div className="space-y-3">
              {publicReviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/10 p-4"
                >
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {firstNameOnly(review.customerName) ||
                      t("publicBooking.reviews.customerFallback")}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {review.serviceName ||
                      t("publicBooking.reviews.serviceFallback")}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-yellow-500">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star
                        key={idx}
                        className="h-4 w-4"
                        fill={
                          idx < Math.round(review.rating)
                            ? "currentColor"
                            : "none"
                        }
                      />
                    ))}
                  </div>
                  {review.comment ? (
                    <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                      {review.comment}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {reviewsTotalPages > 1 ? (
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <div>
                {t("publicBooking.reviews.paginationSummary", {
                  page: reviewsPage,
                  total: reviewsTotalPages,
                })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setReviewsPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={reviewsPage <= 1 || reviewsQuery.isFetching}
                >
                  {t("publicBooking.reviews.previous")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setReviewsPage((prev) =>
                      Math.min(reviewsTotalPages, prev + 1),
                    )
                  }
                  disabled={
                    reviewsPage >= reviewsTotalPages || reviewsQuery.isFetching
                  }
                >
                  {t("publicBooking.reviews.next")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </PublicBookingShell>
  );
}
