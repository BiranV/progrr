"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Check, Trash2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/time-picker";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch as UISwitch } from "@/components/ui/switch";

import AuthBanner from "../auth/_components/AuthBanner";
import { useAuth } from "@/context/AuthContext";

type OnboardingData = {
  businessTypes?: string[];
  business?: { name?: string; phone?: string; address?: string };
  branding?: {
    // New (Cloudinary)
    logo?: {
      url: string;
      publicId: string;
      width?: number;
      height?: number;
      bytes?: number;
      format?: string;
    };
    gallery?: Array<{
      url: string;
      publicId?: string;
      width?: number;
      height?: number;
      bytes?: number;
      format?: string;
    }>;

    // Legacy (local disk or older shapes)
    logoUrl?: string;
  };
  currency?: string;
  customCurrency?: { name?: string; symbol?: string };
  services?: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    price?: number;
  }>;
  availability?: {
    timezone?: string;
    weekStartsOn?: 0 | 1;
    days?: Array<{
      day: number;
      enabled: boolean;
      // Legacy shape (kept for backwards compatibility; UI uses ranges).
      start?: string;
      end?: string;
      // New shape (supports multiple ranges/day). `id` is UI-only.
      ranges?: Array<{ id?: string; start?: string; end?: string }>;
    }>;
  };
};

const OTHER_CURRENCY_CODE = "OTHER";

const CURRENCIES: Array<{ code: string; label: string; symbol: string }> = [
  { code: "NIS", label: "NIS (₪)", symbol: "₪" },
  { code: "USD", label: "USD ($)", symbol: "$" },
  { code: "EUR", label: "EUR (€)", symbol: "€" },
  { code: "GBP", label: "GBP (£)", symbol: "£" },
  { code: "AUD", label: "AUD ($)", symbol: "$" },
  { code: "CAD", label: "CAD ($)", symbol: "$" },
  { code: "CHF", label: "CHF (CHF)", symbol: "CHF" },
  { code: OTHER_CURRENCY_CODE, label: "Other", symbol: "" },
];

const ALLOWED_CURRENCY_CODES = new Set(CURRENCIES.map((c) => c.code));

function normalizeCurrency(v: unknown): string {
  const code = String(v ?? "")
    .trim()
    .toUpperCase();
  return ALLOWED_CURRENCY_CODES.has(code) ? code : "NIS";
}

function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? "₪";
}

function effectiveCurrencySymbol(data: OnboardingData): string {
  const code = normalizeCurrency(data.currency);
  if (code === OTHER_CURRENCY_CODE) {
    const s = String(data.customCurrency?.symbol ?? "").trim();
    return s || "¤";
  }
  return currencySymbol(code);
}

function currencyLabel(data: OnboardingData): string {
  const code = normalizeCurrency(data.currency);
  if (code === OTHER_CURRENCY_CODE) {
    const name = String(data.customCurrency?.name ?? "").trim();
    const symbol = String(data.customCurrency?.symbol ?? "").trim();
    const left = name || "Other";
    return symbol ? `${left} (${symbol})` : left;
  }
  return CURRENCIES.find((c) => c.code === code)?.label ?? code;
}

const BUSINESS_TYPE_OPTIONS: Array<{
  value: string;
  label: string;
  description: string;
}> = [
    { value: "salon", label: "Salon", description: "Hair, beauty, nails" },
    {
      value: "barbershop",
      label: "Barbershop",
      description: "Cuts, shaves, grooming",
    },
    { value: "fitness", label: "Fitness", description: "Training, coaching" },
    { value: "therapy", label: "Therapy", description: "Counseling, wellness" },
    {
      value: "consulting",
      label: "Consulting",
      description: "Advisory services",
    },
    { value: "other", label: "Other", description: "Anything else" },
  ];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseTimeToMinutes(hhmm: string): number {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(hhmm ?? ""));
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return NaN;
  if (h < 0 || h > 23) return NaN;
  if (min < 0 || min > 59) return NaN;
  return h * 60 + min;
}

function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.floor(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function normalizeRangesForUi(raw: any): Array<{ id: string; start: string; end: string }> {
  if (Array.isArray(raw)) {
    const out: Array<{ id: string; start: string; end: string }> = [];
    for (const r of raw) {
      const start = typeof (r as any)?.start === "string" ? String((r as any).start) : "";
      const end = typeof (r as any)?.end === "string" ? String((r as any).end) : "";
      if (!start && !end) continue;
      const id = typeof (r as any)?.id === "string" && String((r as any).id).trim()
        ? String((r as any).id)
        : newId();
      out.push({ id, start, end });
    }
    return out.length ? out : [{ id: newId(), start: "09:00", end: "17:00" }];
  }

  const start = typeof raw?.start === "string" ? String(raw.start) : "";
  const end = typeof raw?.end === "string" ? String(raw.end) : "";
  if (start || end) return [{ id: newId(), start, end }];
  return [{ id: newId(), start: "09:00", end: "17:00" }];
}

function defaultDays() {
  return DAY_LABELS.map((_, day) => ({
    day,
    // Default: Sun-Thu enabled, Fri-Sat disabled
    enabled: day >= 0 && day <= 4,
    ranges: [{ id: newId(), start: "09:00", end: "17:00" }],
  }));
}

function normalizeAvailabilityDaysForUi(input: any) {
  const base = defaultDays();
  const byDay = new Map<number, any>();

  if (Array.isArray(input)) {
    for (const raw of input) {
      const day = Number(raw?.day);
      if (!Number.isInteger(day) || day < 0 || day > 6) continue;
      const enabled = Boolean(raw?.enabled);

      const ranges = Array.isArray(raw?.ranges)
        ? normalizeRangesForUi(raw.ranges)
        : normalizeRangesForUi({ start: raw?.start, end: raw?.end });

      byDay.set(day, { day, enabled, ranges });
    }
  }

  return base.map((d) => ({ ...d, ...(byDay.get(d.day) || {}) }));
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore
    }
    const err: any = new Error(message);
    err.status = res.status;
    throw err;
  }

  return (await res.json()) as T;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { updateUser, user } = useAuth();

  const isDev = process.env.NODE_ENV !== "production";

  const logoInputId = React.useId();
  const galleryAddInputId = React.useId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [step, setStep] = useState(0);
  const totalSteps = 6;

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [galleryPendingPreviews, setGalleryPendingPreviews] = useState<
    string[]
  >([]);
  const [galleryError, setGalleryError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      galleryPendingPreviews.forEach((u) => URL.revokeObjectURL(u));
    };
    // Intentionally only on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const InlineError = ({ message }: { message?: string }) => {
    if (!message) return null;
    return (
      <p className="text-[13px] text-rose-500 dark:text-rose-400 mt-0.5 ml-1">
        {message}
      </p>
    );
  };

  const inputErrorClass = "border-rose-300 ring-1 ring-rose-300/20";

  const [data, setData] = useState<OnboardingData>({
    businessTypes: [],
    business: { name: "", phone: "", address: "" },
    branding: { logo: undefined, gallery: [] },
    currency: "NIS",
    services: [
      {
        id: crypto.randomUUID(),
        name: "",
        durationMinutes: 30,
        price: undefined,
      },
    ],
    availability: {
      weekStartsOn: 0,
      days: defaultDays(),
    },
  });

  const availabilityToastAtRef = React.useRef(0);

  const toastOnce = (message: string) => {
    const now = Date.now();
    if (now - availabilityToastAtRef.current < 900) return;
    availabilityToastAtRef.current = now;
    toast.error(message);
  };

  const orderedAvailabilityDays = useMemo(() => {
    const weekStartsOn = (data.availability?.weekStartsOn ?? 0) === 1 ? 1 : 0;
    const days = Array.isArray(data.availability?.days) && data.availability?.days?.length
      ? (data.availability.days as any[])
      : defaultDays();
    const byDay = new Map(days.map((d: any) => [d.day, d] as const));
    return Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7)
      .map((day) => byDay.get(day))
      .filter(Boolean) as Array<{
        day: number;
        enabled: boolean;
        ranges: Array<{ id: string; start: string; end: string }>;
      }>;
  }, [data.availability?.days, data.availability?.weekStartsOn]);

  const updateAvailabilityRangeTime = (
    day: number,
    rangeId: string,
    field: "start" | "end",
    value: string
  ) => {
    setData((prev) => {
      const current = prev.availability || { weekStartsOn: 0, days: defaultDays() };
      const normalizedDays = normalizeAvailabilityDaysForUi(current.days);

      const nextDays = normalizedDays.map((d: any) => {
        if (d.day !== day) return d;

        const nextRanges = normalizeRangesForUi(d.ranges).map((r) =>
          r.id === rangeId ? { ...r, [field]: value } : r
        );
        return { ...d, ranges: nextRanges.length ? nextRanges : normalizeRangesForUi(null) };
      });

      return {
        ...prev,
        availability: {
          ...(current as any),
          days: nextDays,
        },
      };
    });
  };

  const addAvailabilityRange = (day: number) => {
    setData((prev) => {
      const current = prev.availability || { weekStartsOn: 0, days: defaultDays() };
      const normalizedDays = normalizeAvailabilityDaysForUi(current.days);

      const nextDays = normalizedDays.map((d: any) => {
        if (d.day !== day) return d;

        const ranges = normalizeRangesForUi(d.ranges);
        const complete = ranges
          .map((r) => ({
            startMin: parseTimeToMinutes(String(r.start ?? "").trim()),
            endMin: parseTimeToMinutes(String(r.end ?? "").trim()),
          }))
          .filter((x) => Number.isFinite(x.startMin) && Number.isFinite(x.endMin) && x.endMin > x.startMin)
          .sort((a, b) => a.startMin - b.startMin);

        const lastEnd = complete.length ? complete[complete.length - 1].endMin : 17 * 60;
        const startMin = Math.max(0, Math.min(23 * 60 + 59, lastEnd));
        if (startMin >= 23 * 60 + 59) {
          toastOnce(`No room to add another range on ${DAY_LABELS[day]}.`);
          return d;
        }

        const endMin = Math.min(23 * 60 + 59, startMin + 60);
        if (endMin <= startMin) {
          toastOnce(`No room to add another range on ${DAY_LABELS[day]}.`);
          return d;
        }

        const candidate = { id: newId(), start: minutesToTime(startMin), end: minutesToTime(endMin) };
        const collides = complete.some((r) => overlaps(r.startMin, r.endMin, startMin, endMin));
        if (collides) {
          toastOnce(`Overlapping time ranges for ${DAY_LABELS[day]}.`);
          return d;
        }

        return { ...d, ranges: [...ranges, candidate] };
      });

      return {
        ...prev,
        availability: {
          ...(current as any),
          days: nextDays,
        },
      };
    });
  };

  const deleteAvailabilityRange = (day: number, rangeId: string) => {
    setData((prev) => {
      const current = prev.availability || { weekStartsOn: 0, days: defaultDays() };
      const normalizedDays = normalizeAvailabilityDaysForUi(current.days);

      const nextDays = normalizedDays.map((d: any) => {
        if (d.day !== day) return d;
        const ranges = normalizeRangesForUi(d.ranges);
        if (ranges.length <= 1) return d;
        const nextRanges = ranges.filter((r) => r.id !== rangeId);
        return { ...d, ranges: nextRanges.length ? nextRanges : ranges };
      });

      return {
        ...prev,
        availability: {
          ...(current as any),
          days: nextDays,
        },
      };
    });
  };

  const progress = useMemo(
    () => Math.round(((step + 1) / totalSteps) * 100),
    [step]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiFetch<{
          onboardingCompleted: boolean;
          onboarding: OnboardingData;
        }>("/api/onboarding", { method: "GET" });

        if (cancelled) return;

        if (res.onboardingCompleted) {
          router.replace("/dashboard");
          return;
        }

        setData((prev) => {
          const normalizeBranding = (b: any): OnboardingData["branding"] => {
            const branding = (b && typeof b === "object" ? b : {}) as any;
            const logoFromObj = branding.logo?.url
              ? {
                url: String(branding.logo.url).trim(),
                publicId: String(branding.logo.publicId ?? "").trim(),
                width:
                  typeof branding.logo.width === "number"
                    ? branding.logo.width
                    : undefined,
                height:
                  typeof branding.logo.height === "number"
                    ? branding.logo.height
                    : undefined,
                bytes:
                  typeof branding.logo.bytes === "number"
                    ? branding.logo.bytes
                    : undefined,
                format:
                  typeof branding.logo.format === "string"
                    ? branding.logo.format
                    : undefined,
              }
              : undefined;

            const legacyLogoUrl = String(branding.logoUrl ?? "").trim();

            const galleryIn = Array.isArray(branding.gallery)
              ? branding.gallery
              : [];

            const gallery = galleryIn
              .map((x: any) => {
                if (typeof x === "string") {
                  const url = String(x ?? "").trim();
                  if (!url) return null;
                  return { url, publicId: "" };
                }
                const url = String(x?.url ?? "").trim();
                if (!url) return null;
                return {
                  url,
                  publicId: String(x?.publicId ?? x?.public_id ?? "").trim(),
                  width: typeof x?.width === "number" ? x.width : undefined,
                  height: typeof x?.height === "number" ? x.height : undefined,
                  bytes: typeof x?.bytes === "number" ? x.bytes : undefined,
                  format: typeof x?.format === "string" ? x.format : undefined,
                };
              })
              .filter(Boolean)
              .slice(0, 10) as NonNullable<
                OnboardingData["branding"]
              >["gallery"];

            const logo =
              logoFromObj ||
              (legacyLogoUrl
                ? { url: legacyLogoUrl, publicId: "" }
                : undefined);

            return {
              ...branding,
              logo,
              gallery,
            };
          };

          const merged: OnboardingData = {
            ...prev,
            ...(res.onboarding || {}),
            business: { ...prev.business, ...(res.onboarding?.business || {}) },
            branding: normalizeBranding((res.onboarding as any)?.branding),
            availability: {
              ...prev.availability,
              ...(res.onboarding?.availability || {}),
              days:
                res.onboarding?.availability?.days &&
                  res.onboarding.availability.days.length
                  ? normalizeAvailabilityDaysForUi(res.onboarding.availability.days)
                  : prev.availability?.days,
            },
            services:
              res.onboarding?.services && res.onboarding.services.length
                ? res.onboarding.services
                : prev.services,
          };

          if (!merged.availability?.days || !merged.availability.days.length) {
            merged.availability = {
              ...(merged.availability || {}),
              days: defaultDays(),
            };
          }

          if (
            (merged.availability as any)?.weekStartsOn !== 0 &&
            (merged.availability as any)?.weekStartsOn !== 1
          ) {
            merged.availability = {
              ...(merged.availability || {}),
              weekStartsOn: 0,
            };
          }

          if (!merged.services || !merged.services.length) {
            merged.services = [
              { id: crypto.randomUUID(), name: "", durationMinutes: 30 },
            ];
          }

          if (!merged.businessTypes) {
            merged.businessTypes = [];
          }

          merged.currency = normalizeCurrency((merged as any).currency);

          return merged;
        });
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load onboarding");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const savePartial = async (partial: Partial<OnboardingData>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{
        onboardingCompleted: boolean;
        onboarding: OnboardingData;
      }>("/api/onboarding", { method: "PATCH", body: JSON.stringify(partial) });
      setData((prev) => ({
        ...prev,
        ...(res.onboarding || {}),
        business: { ...prev.business, ...(res.onboarding?.business || {}) },
        branding: { ...prev.branding, ...(res.onboarding?.branding || {}) },
        availability: {
          ...prev.availability,
          ...(res.onboarding?.availability || {}),
          days:
            res.onboarding?.availability?.days &&
              Array.isArray(res.onboarding.availability.days) &&
              res.onboarding.availability.days.length
              ? normalizeAvailabilityDaysForUi(res.onboarding.availability.days)
              : prev.availability?.days,
        },
        services: res.onboarding?.services ?? prev.services,
      }));
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/branding/logo", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.error || `Request failed (${res.status})`);

      const url = String(json?.logo?.url ?? json?.url ?? "").trim();
      const publicId = String(json?.logo?.publicId ?? "").trim();
      setData((d) => ({
        ...d,
        branding: {
          ...(d.branding || {}),
          logo: url ? { url, publicId } : undefined,
          logoUrl: undefined,
        },
      }));
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    setUploadingLogo(true);
    setError(null);
    try {
      const res = await fetch("/api/branding/logo", {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.error || `Request failed (${res.status})`);

      setData((d) => ({
        ...d,
        branding: {
          ...(d.branding || {}),
          logo: undefined,
          logoUrl: undefined,
        },
      }));
    } finally {
      setUploadingLogo(false);
    }
  };

  const uploadGalleryFiles = async (files: File[] | null) => {
    if (!files || files.length === 0) return;

    setUploadingGallery(true);
    setError(null);
    setGalleryError(null);
    let localPreviews: string[] = [];
    let clearPreviewsDelayMs = 0;
    try {
      const current = (data.branding?.gallery || []).length;
      const remaining = Math.max(0, 10 - current);
      if (remaining <= 0) throw new Error("Gallery limit reached (max 10)");

      const selected = files.slice(0, remaining);

      const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
      const maxBytes = 5 * 1024 * 1024;
      const valid: File[] = [];
      const skipped: string[] = [];

      for (const f of selected) {
        const t = String(f.type || "").toLowerCase();
        if (t && !allowed.has(t)) {
          skipped.push(`${f.name || "image"} (unsupported format)`);
          continue;
        }
        if (f.size > maxBytes) {
          skipped.push(`${f.name || "image"} (too large)`);
          continue;
        }
        valid.push(f);
      }

      if (!valid.length) {
        throw new Error(
          "Please upload JPG, PNG, or WEBP images (max 5MB each)"
        );
      }
      if (skipped.length) {
        setError(
          `Some files were skipped: ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? "…" : ""
          }`
        );
      }

      // Show instant feedback (local previews) while upload happens.
      localPreviews = valid.map((f) => URL.createObjectURL(f));
      setGalleryPendingPreviews((prev) => [...prev, ...localPreviews]);

      if (isDev) {
        console.log(
          "[branding/gallery] selected:",
          valid.map((f) => ({ name: f.name, type: f.type, size: f.size }))
        );
      }

      const fd = new FormData();
      valid.forEach((f) => fd.append("images", f));

      if (isDev) {
        console.log("[branding/gallery] form keys:", Array.from(fd.keys()));
      }

      const res = await fetch("/api/branding/gallery", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const json = await res.json().catch(() => null);

      if (isDev) {
        console.log("[branding/gallery] response:", res.status, json);
      }

      if (!res.ok)
        throw new Error(json?.error || `Request failed (${res.status})`);

      const gallery = Array.isArray(json?.gallery)
        ? json.gallery
          .map((x: any) => {
            if (typeof x === "string") {
              const url = String(x ?? "").trim();
              if (!url) return null;
              return { url, publicId: "" };
            }
            const url = String(x?.url ?? "").trim();
            if (!url) return null;
            return {
              url,
              publicId: String(x?.publicId ?? x?.public_id ?? "").trim(),
              width: typeof x?.width === "number" ? x.width : undefined,
              height: typeof x?.height === "number" ? x.height : undefined,
              bytes: typeof x?.bytes === "number" ? x.bytes : undefined,
              format: typeof x?.format === "string" ? x.format : undefined,
            };
          })
          .filter(Boolean)
        : [];

      setData((d) => ({
        ...d,
        branding: { ...(d.branding || {}), gallery },
      }));

      // Success: clear previews immediately.
      clearPreviewsDelayMs = 0;
    } catch (e) {
      // Failure: keep previews visible briefly so it doesn't feel like "nothing happened".
      clearPreviewsDelayMs = 2500;
      const msg = (e as any)?.message || "Failed to upload images";
      setGalleryError(msg);
      setError(msg);
      throw e;
    } finally {
      if (localPreviews.length) {
        const clear = () => {
          setGalleryPendingPreviews((prev) =>
            prev.filter((u) => !localPreviews.includes(u))
          );
          localPreviews.forEach((u) => URL.revokeObjectURL(u));
        };

        if (clearPreviewsDelayMs > 0) {
          window.setTimeout(clear, clearPreviewsDelayMs);
        } else {
          clear();
        }
      }
      setUploadingGallery(false);
    }
  };

  const removeGalleryImage = async (item: {
    url: string;
    publicId?: string;
  }) => {
    setUploadingGallery(true);
    setError(null);
    try {
      const res = await fetch("/api/branding/gallery", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: String(item?.url ?? "").trim(),
          publicId: String(item?.publicId ?? "").trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(json?.error || `Request failed (${res.status})`);

      const gallery = Array.isArray(json?.gallery)
        ? json.gallery
          .map((x: any) => {
            if (typeof x === "string") {
              const url = String(x ?? "").trim();
              if (!url) return null;
              return { url, publicId: "" };
            }
            const url = String(x?.url ?? "").trim();
            if (!url) return null;
            return {
              url,
              publicId: String(x?.publicId ?? x?.public_id ?? "").trim(),
              width: typeof x?.width === "number" ? x.width : undefined,
              height: typeof x?.height === "number" ? x.height : undefined,
              bytes: typeof x?.bytes === "number" ? x.bytes : undefined,
              format: typeof x?.format === "string" ? x.format : undefined,
            };
          })
          .filter(Boolean)
        : [];

      setData((d) => ({
        ...d,
        branding: { ...(d.branding || {}), gallery },
      }));
    } finally {
      setUploadingGallery(false);
    }
  };

  const replaceGalleryImage = async (index: number, file: File) => {
    setReplacingIndex(index);
    setError(null);
    try {
      const before = [...(data.branding?.gallery || [])];
      const target = before[index];
      if (!target) throw new Error("Image not found");

      // Upload new (server appends)
      const fd = new FormData();
      fd.append("images", file);
      const upRes = await fetch("/api/branding/gallery", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const upJson = await upRes.json().catch(() => null);
      if (!upRes.ok)
        throw new Error(upJson?.error || `Request failed (${upRes.status})`);

      const added = Array.isArray(upJson?.added) ? upJson.added : [];
      const first = added?.[0];
      const newUrl =
        typeof first === "string"
          ? String(first ?? "").trim()
          : String(first?.url ?? "").trim();
      const newPublicId =
        typeof first === "string"
          ? ""
          : String(first?.publicId ?? first?.public_id ?? "").trim();
      if (!newUrl) throw new Error("Upload failed");

      // Remove old
      await removeGalleryImage({
        url: String((target as any)?.url ?? target ?? "").trim(),
        publicId: String((target as any)?.publicId ?? "").trim(),
      });

      // Reorder to keep the replaced image at the same position.
      const after = [...(data.branding?.gallery || [])]
        .filter((x) => x !== target)
        .filter(Boolean) as any[];
      after[index] = {
        url: newUrl,
        publicId: newPublicId,
      };

      await savePartial({
        branding: { ...(data.branding || {}), gallery: after },
      });
    } finally {
      setReplacingIndex(null);
    }
  };

  const next = async () => {
    setFieldErrors({});
    setError(null);
    const newErrors: Record<string, string> = {};

    try {
      if (step === 0) {
        await savePartial({ businessTypes: data.businessTypes });
      }
      if (step === 1) {
        if (!data.business?.name?.trim())
          newErrors.businessName = "Business name is required";
        if (!data.business?.phone?.trim())
          newErrors.businessPhone = "Phone number is required";
        if (!data.business?.address?.trim())
          newErrors.businessAddress = "Address is required";

        if (Object.keys(newErrors).length > 0) {
          setFieldErrors(newErrors);
          return;
        }
        await savePartial({ business: data.business });
      }
      if (step === 2) {
        const currency = normalizeCurrency(data.currency);
        if (currency === OTHER_CURRENCY_CODE) {
          if (!data.customCurrency?.name?.trim())
            newErrors.currencyName = "Currency name is required";
          if (!data.customCurrency?.symbol?.trim())
            newErrors.currencySymbol = "Symbol is required";
        }

        const services = data.services || [];
        if (services.length === 0) {
          setError("At least one service is required");
          return;
        }

        services.forEach((s) => {
          if (!s.name?.trim())
            newErrors[`serviceName_${s.id}`] = "Service name is required";
          if (!s.durationMinutes || s.durationMinutes <= 0)
            newErrors[`serviceDuration_${s.id}`] = "Duration is required";
        });

        if (Object.keys(newErrors).length > 0) {
          setFieldErrors(newErrors);
          return;
        }

        await savePartial({
          services: data.services,
          currency: normalizeCurrency(data.currency),
          customCurrency:
            normalizeCurrency(data.currency) === OTHER_CURRENCY_CODE
              ? {
                name: String(data.customCurrency?.name ?? "").trim(),
                symbol: String(data.customCurrency?.symbol ?? "").trim(),
              }
              : undefined,
        });
      }
      if (step === 3) {
        const days = normalizeAvailabilityDaysForUi(data.availability?.days);

        const validateAvailability = (): string | null => {
          for (const d of days) {
            if (!d.enabled) continue;

            const ranges = normalizeRangesForUi((d as any).ranges);
            if (!ranges.length) {
              return `Please set valid hours for ${DAY_LABELS[d.day]}.`;
            }

            const parsed = ranges
              .map((r) => ({
                start: String(r.start ?? "").trim(),
                end: String(r.end ?? "").trim(),
                startMin: parseTimeToMinutes(String(r.start ?? "").trim()),
                endMin: parseTimeToMinutes(String(r.end ?? "").trim()),
              }))
              .filter((x) => x.start || x.end);

            if (!parsed.length) {
              return `Please set valid hours for ${DAY_LABELS[d.day]}.`;
            }

            for (const r of parsed) {
              if (!r.start || !r.end || !Number.isFinite(r.startMin) || !Number.isFinite(r.endMin)) {
                return `Please set valid hours for ${DAY_LABELS[d.day]}.`;
              }
              if (r.endMin <= r.startMin) {
                return `End time must be after start time for ${DAY_LABELS[d.day]}.`;
              }
            }

            const ordered = [...parsed].sort((a, b) => a.startMin - b.startMin);
            for (let i = 1; i < ordered.length; i++) {
              const prev = ordered[i - 1];
              const curr = ordered[i];
              if (overlaps(prev.startMin, prev.endMin, curr.startMin, curr.endMin)) {
                return `Overlapping time ranges for ${DAY_LABELS[d.day]}.`;
              }
            }
          }

          return null;
        };

        const availabilityError = validateAvailability();
        if (availabilityError) {
          setError(availabilityError);
          return;
        }

        await savePartial({
          availability: {
            ...(data.availability || {}),
            days: days.map((d) => ({
              day: d.day,
              enabled: Boolean(d.enabled),
              ranges: normalizeRangesForUi((d as any).ranges).map((r) => ({
                start: String(r.start ?? "").trim(),
                end: String(r.end ?? "").trim(),
              })),
            })),
          },
        });
      }
      if (step === 4) {
        const gallery = data.branding?.gallery || [];
        if (gallery.length > 10) {
          setError("Gallery limit reached (max 10 images)");
          return;
        }
        await savePartial({ branding: data.branding });
      }

      setStep((s) => Math.min(s + 1, totalSteps - 1));
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    }
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  const complete = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch<{ ok: true }>("/api/onboarding/complete", {
        method: "POST",
      });
      // Immediately hydrate onboarding data so the dashboard header can show the
      // business name + logo on first paint.
      updateUser({ onboardingCompleted: true });
      try {
        const res = await fetch("/api/onboarding", { method: "GET" });
        if (res.ok) {
          const payload = await res.json().catch(() => null);
          if (payload && typeof payload === "object") {
            updateUser({
              onboardingCompleted: Boolean(
                (payload as any).onboardingCompleted ?? true
              ),
              onboarding: (payload as any).onboarding ?? {},
            });
          }
        }
      } catch {
        // Ignore.
      }
      router.replace("/dashboard");
    } catch (e: any) {
      setError(e?.message || "Failed to finish onboarding");
    } finally {
      setSaving(false);
    }
  };

  const content = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Business type
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Choose what best describes you.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Select one or more *</Label>
              <div className="-m-1 grid grid-cols-2 gap-3">
                {BUSINESS_TYPE_OPTIONS.map((opt) => {
                  const selected = (data.businessTypes || []).includes(
                    opt.value
                  );
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setData((d) => {
                          const current = d.businessTypes || [];
                          const next = current.includes(opt.value)
                            ? current.filter((x) => x !== opt.value)
                            : [...current, opt.value];
                          return { ...d, businessTypes: next };
                        });
                      }}
                      className={
                        "m-1 text-left rounded-xl border px-4 py-3 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950 " +
                        (selected
                          ? "border-neutral-900 bg-neutral-50/70 dark:bg-neutral-900/30 shadow-sm"
                          : "border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/30 hover:border-gray-300 dark:hover:border-gray-700")
                      }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {opt.label}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            {opt.description}
                          </div>
                        </div>
                        <div
                          className={
                            "h-5 w-5 rounded-full border flex items-center justify-center shrink-0 " +
                            (selected
                              ? "border-neutral-900 bg-neutral-900 text-white"
                              : "border-gray-300 dark:border-gray-700")
                          }
                          aria-hidden="true"
                        >
                          {selected ? <Check className="h-3.5 w-3.5" /> : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Business details
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Basic info your clients will see.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  className={fieldErrors.businessName ? inputErrorClass : ""}
                  value={data.business?.name || ""}
                  onChange={(e) =>
                    setData((d) => ({
                      ...d,
                      business: { ...(d.business || {}), name: e.target.value },
                    }))
                  }
                  placeholder="Acme Studio"
                />
                <InlineError message={fieldErrors.businessName} />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  className={fieldErrors.businessPhone ? inputErrorClass : ""}
                  value={data.business?.phone || ""}
                  onChange={(e) =>
                    setData((d) => ({
                      ...d,
                      business: {
                        ...(d.business || {}),
                        phone: e.target.value,
                      },
                    }))
                  }
                  placeholder="+1 (555) 123-4567"
                />
                <InlineError message={fieldErrors.businessPhone} />
              </div>
              <div className="space-y-2">
                <Label>Address *</Label>
                <Input
                  className={fieldErrors.businessAddress ? inputErrorClass : ""}
                  value={data.business?.address || ""}
                  onChange={(e) =>
                    setData((d) => ({
                      ...d,
                      business: {
                        ...(d.business || {}),
                        address: e.target.value,
                      },
                    }))
                  }
                  placeholder="123 Main St, City"
                />
                <InlineError message={fieldErrors.businessAddress} />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Business branding
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Add a logo and a few photos — these will be visible to clients.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    Business logo
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Recommended: square image (will display as a circle)
                  </div>
                </div>
              </div>

              <input
                id={logoInputId}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploadingLogo || saving}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  uploadLogo(file).catch((err) =>
                    setError(err?.message || "Failed to upload logo")
                  );
                }}
              />

              <div className="mt-4 flex items-center gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 ring-2 ring-gray-200 dark:ring-gray-700 shadow-sm flex items-center justify-center">
                  {data.branding?.logo?.url || data.branding?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={String(
                        data.branding?.logo?.url || data.branding?.logoUrl
                      ).trim()}
                      alt="Business logo"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-300">
                      No logo
                    </span>
                  )}
                </div>

                <div className="flex-1 flex flex-wrap gap-2">
                  <Button
                    asChild
                    type="button"
                    variant="outline"
                    disabled={uploadingLogo || saving}
                    className="rounded-xl"
                  >
                    <label htmlFor={logoInputId} className="cursor-pointer">
                      {uploadingLogo
                        ? "Uploading…"
                        : data.branding?.logo?.url || data.branding?.logoUrl
                          ? "Replace logo"
                          : "Upload logo"}
                    </label>
                  </Button>

                  {data.branding?.logo?.url || data.branding?.logoUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={uploadingLogo || saving}
                      className="rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() =>
                        removeLogo().catch((err) =>
                          setError(err?.message || "Failed to remove logo")
                        )
                      }
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    Business gallery
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Up to 10 images of your space, work, products, or services.
                  </div>
                </div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 shrink-0">
                  {(data.branding?.gallery || []).length +
                    galleryPendingPreviews.length}
                  /10
                </div>
              </div>

              <input
                id={galleryAddInputId}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploadingGallery || saving}
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  uploadGalleryFiles(picked).catch((err) =>
                    setError(err?.message || "Failed to upload images")
                  );
                }}
              />

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {galleryPendingPreviews.map((url, idx) => (
                  <div
                    key={`pending-${url}-${idx}`}
                    className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Uploading"
                      className="h-full w-full object-cover opacity-70"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-full bg-black/50 text-white p-2 backdrop-blur-sm">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    </div>
                  </div>
                ))}

                {(data.branding?.gallery || []).map((item: any, idx) => {
                  const url =
                    typeof item === "string"
                      ? String(item ?? "").trim()
                      : String(item?.url ?? "").trim();
                  const publicId =
                    typeof item === "string"
                      ? ""
                      : String(item?.publicId ?? item?.public_id ?? "").trim();
                  if (!url) return null;
                  return (
                    <div
                      key={`${url}-${idx}`}
                      className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
                    >
                      <input
                        id={`${galleryAddInputId}-replace-${idx}`}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={uploadingGallery || saving}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          replaceGalleryImage(idx, file).catch((err) =>
                            setError(err?.message || "Failed to replace image")
                          );
                        }}
                      />

                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Gallery image ${idx + 1}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />

                      <div className="absolute inset-x-0 top-0 p-1.5 flex justify-end gap-1">
                        <label
                          htmlFor={`${galleryAddInputId}-replace-${idx}`}
                          className={
                            "rounded-lg bg-black/45 text-white text-[11px] px-2 py-1 backdrop-blur-sm hover:bg-black/55 transition " +
                            (uploadingGallery ||
                              saving ||
                              replacingIndex === idx
                              ? "opacity-60 pointer-events-none"
                              : "cursor-pointer")
                          }
                        >
                          {replacingIndex === idx ? "…" : "Replace"}
                        </label>

                        <button
                          type="button"
                          disabled={uploadingGallery || saving}
                          onClick={() =>
                            removeGalleryImage({ url, publicId }).catch((err) =>
                              setError(err?.message || "Failed to remove image")
                            )
                          }
                          className="rounded-lg bg-black/45 text-white p-1.5 backdrop-blur-sm hover:bg-black/55 transition disabled:opacity-60"
                          aria-label="Remove image"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {(() => {
                  const count =
                    (data.branding?.gallery || []).length +
                    galleryPendingPreviews.length;
                  if (count >= 10) return null;
                  return (
                    <label
                      htmlFor={galleryAddInputId}
                      className={
                        "aspect-square rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-950/10 flex items-center justify-center text-center p-2 hover:border-gray-300 dark:hover:border-gray-600 transition " +
                        (uploadingGallery || saving
                          ? "opacity-60 pointer-events-none"
                          : "cursor-pointer")
                      }
                    >
                      <div className="flex flex-col items-center gap-1">
                        {uploadingGallery ? (
                          <Loader2 className="h-5 w-5 animate-spin text-gray-500 dark:text-gray-300" />
                        ) : null}
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          {uploadingGallery ? "Uploading…" : "Add images"}
                        </div>
                      </div>
                    </label>
                  );
                })()}
              </div>

              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                These photos appear on your public booking page.
              </div>

              {galleryError ? (
                <div className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                  {galleryError}
                </div>
              ) : null}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Services
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Add at least one service.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <Label className="flex-1">Service name *</Label>
                <Label className="w-[70px] shrink-0 text-center">Time</Label>
                <Label className="w-[70px] shrink-0 text-center">Price</Label>
                <div className="w-8 shrink-0"></div>
              </div>

              <div className="space-y-3">
                {(data.services || []).map((s) => (
                  <div key={s.id}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <Input
                          className={
                            fieldErrors[`serviceName_${s.id}`]
                              ? inputErrorClass
                              : ""
                          }
                          value={s.name}
                          onChange={(e) =>
                            setData((d) => ({
                              ...d,
                              services: (d.services || []).map((x) =>
                                x.id === s.id
                                  ? { ...x, name: e.target.value }
                                  : x
                              ),
                            }))
                          }
                          placeholder="Service"
                        />
                      </div>

                      <div className="w-[70px] shrink-0">
                        <Input
                          type="number"
                          min={5}
                          className={`px-2 text-center ${fieldErrors[`serviceDuration_${s.id}`]
                            ? inputErrorClass
                            : ""
                            }`}
                          value={s.durationMinutes}
                          onChange={(e) =>
                            setData((d) => ({
                              ...d,
                              services: (d.services || []).map((x) =>
                                x.id === s.id
                                  ? {
                                    ...x,
                                    durationMinutes: Number(
                                      e.target.value || 0
                                    ),
                                  }
                                  : x
                              ),
                            }))
                          }
                        />
                      </div>

                      <div className="w-[70px] shrink-0">
                        <Input
                          className={`px-2 text-center ${fieldErrors[`servicePrice_${s.id}`]
                            ? inputErrorClass
                            : ""
                            }`}
                          type="number"
                          min={0}
                          value={typeof s.price === "number" ? s.price : ""}
                          onChange={(e) =>
                            setData((d) => ({
                              ...d,
                              services: (d.services || []).map((x) =>
                                x.id === s.id
                                  ? {
                                    ...x,
                                    price:
                                      e.target.value === ""
                                        ? undefined
                                        : Number(e.target.value),
                                  }
                                  : x
                              ),
                            }))
                          }
                          placeholder={effectiveCurrencySymbol(data)}
                        />
                      </div>

                      <div className="w-8 shrink-0 flex pt-1 justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-500"
                          disabled={(data.services || []).length <= 1}
                          aria-label="Remove service"
                          onClick={() =>
                            setData((d) => ({
                              ...d,
                              services: (d.services || []).filter(
                                (x) => x.id !== s.id
                              ),
                            }))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {(fieldErrors[`serviceName_${s.id}`] ||
                      fieldErrors[`serviceDuration_${s.id}`] ||
                      fieldErrors[`servicePrice_${s.id}`]) && (
                        <div className="text-xs text-rose-500 mt-1 px-1">
                          {fieldErrors[`serviceName_${s.id}`] ||
                            fieldErrors[`serviceDuration_${s.id}`] ||
                            fieldErrors[`servicePrice_${s.id}`]}
                        </div>
                      )}
                  </div>
                ))}
              </div>

              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setData((d) => ({
                      ...d,
                      services: [
                        ...(d.services || []),
                        {
                          id: crypto.randomUUID(),
                          name: "",
                          durationMinutes: 30,
                        },
                      ],
                    }))
                  }
                >
                  Add service
                </Button>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Availability
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Set your weekly hours.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/30 px-3 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Week starts on
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  {(data.availability?.weekStartsOn ?? 0) === 1
                    ? "Monday"
                    : "Sunday"}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-300 select-none">
                  Sun
                </span>
                <UISwitch
                  checked={(data.availability?.weekStartsOn ?? 0) === 1}
                  onCheckedChange={(checked) =>
                    setData((prev) => ({
                      ...prev,
                      availability: {
                        ...(prev.availability || {}),
                        weekStartsOn: checked ? 1 : 0,
                      },
                    }))
                  }
                  aria-label="Toggle week start between Sunday and Monday"
                />
                <span className="text-xs text-gray-600 dark:text-gray-300 select-none">
                  Mon
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {orderedAvailabilityDays.map((d) => {
                const ranges = normalizeRangesForUi((d as any).ranges);

                return (
                  <div key={d.day} className="space-y-2">
                    <div className="grid grid-cols-[48px_48px_1fr_40px] items-start gap-x-2 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/20">
                      <div className="h-8 flex items-center justify-center">
                        <UISwitch
                          checked={Boolean(d.enabled)}
                          onCheckedChange={(checked) =>
                            setData((prev) => {
                              const current = prev.availability || { weekStartsOn: 0, days: defaultDays() };
                              const days = normalizeAvailabilityDaysForUi(current.days);
                              return {
                                ...prev,
                                availability: {
                                  ...(current as any),
                                  days: days.map((x: any) =>
                                    x.day === d.day ? { ...x, enabled: checked } : x
                                  ),
                                },
                              };
                            })
                          }
                          aria-label={`Toggle ${DAY_LABELS[d.day]}`}
                          disabled={loading || saving}
                        />
                      </div>

                      <div className="h-8 flex items-center text-sm font-medium text-gray-900 dark:text-white select-none">
                        <span className="w-8">{DAY_LABELS[d.day].substring(0, 3)}</span>
                      </div>

                      <div className="space-y-2 min-w-0">
                        {ranges.map((r, idx) => (
                          <div key={r.id} className="h-8 flex items-center flex-nowrap gap-2 min-w-0">
                            <TimePicker
                              value={String(r.start ?? "")}
                              onChange={(v) => updateAvailabilityRangeTime(d.day, r.id, "start", v)}
                              disabled={loading || saving || !d.enabled}
                              className="h-8 w-[78px] min-w-[78px] px-1.5 text-[13px] shrink-0"
                              aria-label={`${DAY_LABELS[d.day]} ${idx === 0 ? "start" : "additional start"} time`}
                            />
                            <span className="text-gray-400 shrink-0">–</span>
                            <TimePicker
                              value={String(r.end ?? "")}
                              onChange={(v) => updateAvailabilityRangeTime(d.day, r.id, "end", v)}
                              disabled={loading || saving || !d.enabled}
                              className="h-8 w-[78px] min-w-[78px] px-1.5 text-[13px] shrink-0"
                              aria-label={`${DAY_LABELS[d.day]} ${idx === 0 ? "end" : "additional end"} time`}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2 flex flex-col items-end">
                        {ranges.map((r, idx) => (
                          <div key={r.id} className="h-8 flex items-center justify-end">
                            {idx === 0 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => addAvailabilityRange(d.day)}
                                disabled={loading || saving || !d.enabled}
                                aria-label={`Add time range for ${DAY_LABELS[d.day]}`}
                              >
                                <Plus className="h-4 w-4 ms-4" />
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => deleteAvailabilityRange(d.day, r.id)}
                                disabled={loading || saving || !d.enabled || ranges.length <= 1}
                                aria-label={`Delete time range for ${DAY_LABELS[d.day]}`}
                              >
                                <Trash2 className="h-4 w-4 ms-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Finish
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Review and complete onboarding.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-5">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Business type
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-200">
                  {data.businessTypes && data.businessTypes.length > 0
                    ? data.businessTypes
                      .map(
                        (v) =>
                          BUSINESS_TYPE_OPTIONS.find((o) => o.value === v)
                            ?.label ?? v
                      )
                      .join(", ")
                    : "—"}
                </div>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-800" />

              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Branding
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                    {data.branding?.logo?.url || data.branding?.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={String(
                          data.branding?.logo?.url || data.branding?.logoUrl
                        ).trim()}
                        alt="Business logo"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-gray-500 dark:text-gray-300">
                        —
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-700 dark:text-gray-200">
                    <div>
                      <span className="font-medium">Logo:</span>{" "}
                      {data.branding?.logo?.url || data.branding?.logoUrl
                        ? "Uploaded"
                        : "Not set"}
                    </div>
                    <div>
                      <span className="font-medium">Gallery:</span>{" "}
                      {(data.branding?.gallery || []).length} image(s)
                    </div>
                  </div>
                </div>

                {(data.branding?.gallery || []).length > 0 ? (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(data.branding?.gallery || []).map((item: any, idx) => {
                      const url =
                        typeof item === "string"
                          ? String(item ?? "").trim()
                          : String(item?.url ?? "").trim();
                      if (!url) return null;
                      return (
                        <div
                          key={`${url}-${idx}`}
                          className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Gallery image ${idx + 1}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    No gallery images yet.
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-800" />

              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Business details
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <div>
                    <span className="font-medium">Name:</span>{" "}
                    {data.business?.name || "—"}
                  </div>
                  <div>
                    <span className="font-medium">Phone:</span>{" "}
                    {data.business?.phone || "—"}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="font-medium">Address:</span>{" "}
                    {data.business?.address || "—"}
                  </div>
                </div>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-800" />

              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Services
                </div>

                <div className="text-sm text-gray-700 dark:text-gray-200">
                  <span className="font-medium">Currency:</span>{" "}
                  {currencyLabel(data)}
                </div>

                <div className="space-y-2">
                  {(data.services || []).length ? (
                    (data.services || []).map((s, idx) => (
                      <div
                        key={s.id || idx}
                        className="rounded-md border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/20 px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {String(s.name || "").trim() || "—"}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">
                              Duration:{" "}
                              {Number.isFinite(s.durationMinutes)
                                ? s.durationMinutes
                                : "—"}{" "}
                              min
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">
                            {Number.isFinite(s.price)
                              ? `${effectiveCurrencySymbol(data)}${s.price}`
                              : "—"}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-700 dark:text-gray-200">
                      —
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-800" />

              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Availability
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-200">
                  <span className="font-medium">Week starts:</span>{" "}
                  {(data.availability?.weekStartsOn ?? 0) === 1
                    ? "Monday"
                    : "Sunday"}
                </div>

                <div className="space-y-2">
                  {(() => {
                    const weekStartsOn =
                      (data.availability?.weekStartsOn ?? 0) === 1 ? 1 : 0;
                    const days = data.availability?.days || [];
                    const byDay = new Map(days.map((d) => [d.day, d] as const));
                    const ordered = Array.from(
                      { length: 7 },
                      (_, i) => (i + weekStartsOn) % 7
                    )
                      .map((day) => byDay.get(day))
                      .filter(Boolean) as Array<{
                        day: number;
                        enabled: boolean;
                        ranges?: Array<{ id?: string; start?: string; end?: string }>;
                        start?: string;
                        end?: string;
                      }>;

                    return ordered.map((d) => (
                      <div
                        key={d.day}
                        className="flex items-center justify-between gap-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/20 px-3 py-2"
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {DAY_LABELS[d.day]}
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-200">
                          {d.enabled
                            ? (() => {
                              const ranges = normalizeRangesForUi((d as any).ranges ?? { start: (d as any).start, end: (d as any).end });
                              return ranges
                                .map((r) => `${String(r.start || "—")} – ${String(r.end || "—")}`)
                                .join(", ");
                            })()
                            : "Closed"}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const card = (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-black pb-safe">
      {/* Header Container */}
      <div className="relative w-full z-0 h-[140px] bg-gradient-to-br from-neutral-950 via-zinc-900 to-zinc-800 shrink-0">
        <div className="absolute inset-0 opacity-20 bg-[url('/grid.svg')] mix-blend-overlay"></div>
      </div>

      {/* Main Content Area with Convex Curve (Sides lower than center) */}
      <div className="flex-1 -mt-10 bg-gray-50 dark:bg-zinc-900 rounded-t-[40px] relative z-10 flex flex-col items-center shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">

        {/* User & Step Info */}
        <div className="text-center space-y-1 mt-6 mb-6 px-6 w-full max-w-md">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
            {user?.full_name ? `Welcome, ${user.full_name}` : "Welcome"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {step === 0
              ? "Select Business Type"
              : step === 1
                ? "Business Details"
                : step === 2
                  ? "Setup Services"
                  : step === 3
                    ? "Set Availability"
                    : step === 4
                      ? "Business Branding"
                      : "Review & Finish"}
          </p>

          {/* Progress Bar */}
          <div className="pt-4 max-w-xs mx-auto w-full">
            <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 px-1">
              <span>
                Step {step + 1} of {totalSteps}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress
              value={progress}
              className="h-2.5 w-full bg-gray-200 dark:bg-gray-800 [&>div]:bg-neutral-900 rounded-full"
            />
          </div>
        </div>

        <div className="flex-1 px-6 pb-28 w-full max-w-md mx-auto">
          <AuthBanner banner={error ? { type: "error", text: error } : null} />

          <AnimatePresence mode="wait" initial={false}>
            {loading ? (
              <div className="py-20 text-center text-muted-foreground flex flex-col items-center">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-neutral-900 dark:text-white" />
                <p>Loading details...</p>
              </div>
            ) : (
              <motion.div
                key={`step-${step}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {content()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-lg border-t border-gray-100 dark:border-gray-800 p-4 z-40 shadow-[0_-4px_8px_-1px_rgba(0,0,0,0.02)]">
        <div className="max-w-[420px] mx-auto flex gap-3 w-full">
          {step > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={back}
              disabled={saving}
              className="h-14 flex-1 rounded-2xl text-lg font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Back
            </Button>
          )}
          {step < totalSteps - 1 ? (
            <Button
              type="button"
              onClick={next}
              disabled={
                saving ||
                loading ||
                (step === 0 && (data.businessTypes || []).length === 0)
              }
              className="h-14 flex-[2] rounded-2xl text-lg font-bold bg-neutral-900 hover:bg-neutral-800 text-white shadow-lg shadow-black/10 dark:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving ? "Saving…" : "Next"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={complete}
              disabled={saving || loading}
              className="h-14 flex-1 rounded-2xl text-lg font-bold bg-neutral-900 hover:bg-neutral-800 text-white shadow-lg shadow-black/10 dark:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving ? "Finishing…" : "Finish Setup"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return card;
}
