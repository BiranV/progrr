"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Apple,
  Dumbbell,
  Hand,
  Loader2,
  Flower2 as Lotus,
  PenTool,
  Plus,
  Scissors,
  Shapes,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { TimePicker } from "@/components/ui/time-picker";
import { Label } from "@/components/ui/label";
import ProgressBar from "@/components/onboarding/ProgressBar";
import { Switch as UISwitch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import AuthBanner from "../auth/_components/AuthBanner";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/context/AuthContext";
import { BUSINESS_TYPES, SERVICE_PRESETS } from "@/lib/onboardingPresets";
import ImageCropperModal, {
  type ImageCropperMode,
} from "@/components/ImageCropper";
import { useI18n } from "@/i18n/useI18n";

type OnboardingData = {
  businessTypes?: string[];
  business?: {
    name?: string;
    phone?: string;
    address?: string;
    limitCustomerToOneUpcomingAppointment?: boolean;
  };
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
    banner?: {
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
const DEFAULT_TIMEZONE = "Asia/Jerusalem";

const CURRENCIES: Array<{ code: string; label: string; symbol: string }> = [
  { code: "ILS", label: "ILS (₪)", symbol: "₪" },
];

const ALLOWED_CURRENCY_CODES = new Set(["ILS"]);
const UI_TIMEZONES = [DEFAULT_TIMEZONE];

function normalizeCurrency(v: unknown): string {
  const code = String(v ?? "")
    .trim()
    .toUpperCase();
  if (code === "NIS") return "ILS";
  return ALLOWED_CURRENCY_CODES.has(code) ? code : "ILS";
}

function currencySymbol(code: string): string {
  const normalized = normalizeCurrency(code);
  return CURRENCIES.find((c) => c.code === normalized)?.symbol ?? "₪";
}

function effectiveCurrencySymbol(data: OnboardingData): string {
  const code = normalizeCurrency(data.currency);
  if (code === OTHER_CURRENCY_CODE) {
    const s = String(data.customCurrency?.symbol ?? "").trim();
    return s || "¤";
  }
  return currencySymbol(code);
}

function currencyLabel(data: OnboardingData, otherLabel: string): string {
  const code = normalizeCurrency(data.currency);
  if (code === OTHER_CURRENCY_CODE) {
    const name = String(data.customCurrency?.name ?? "").trim();
    const symbol = String(data.customCurrency?.symbol ?? "").trim();
    const left = name || otherLabel;
    return symbol ? `${left} (${symbol})` : left;
  }
  return CURRENCIES.find((c) => c.code === code)?.label ?? code;
}

const BUSINESS_TYPE_OPTIONS = BUSINESS_TYPES;
const BUSINESS_TYPE_ICONS: Record<string, LucideIcon> = {
  hair_salon: Scissors,
  beauty_clinic: Sparkles,
  nails: Hand,
  tattoo_piercing: PenTool,
  spa_massage: Lotus,
  fitness_coach: Dumbbell,
  nutrition_clinic: Apple,
  other: Shapes,
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function newId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function detectTimeZone(): string {
  return DEFAULT_TIMEZONE;
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

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function normalizeRangesForUi(
  raw: any
): Array<{ id: string; start: string; end: string }> {
  if (Array.isArray(raw)) {
    const out: Array<{ id: string; start: string; end: string }> = [];
    for (const r of raw) {
      const start =
        typeof (r as any)?.start === "string" ? String((r as any).start) : "";
      const end =
        typeof (r as any)?.end === "string" ? String((r as any).end) : "";
      if (!start && !end) continue;
      const id =
        typeof (r as any)?.id === "string" && String((r as any).id).trim()
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
  return DAY_KEYS.map((_, day) => ({
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


export default function OnboardingPage() {
  const router = useRouter();
  const { updateUser, user } = useAuth();


  const logoInputId = React.useId();
  const bannerInputId = React.useId();
  const galleryAddInputId = React.useId();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [step, setStep] = useState(0);
  const totalSteps = 6;

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const [cropOpen, setCropOpen] = useState(false);
  const [cropMode, setCropMode] = useState<ImageCropperMode>("logo");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [galleryPendingPreviews, setGalleryPendingPreviews] = useState<
    string[]
  >([]);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [pendingLogo, setPendingLogo] = useState<
    { file: File; url: string } | null
  >(null);
  const [pendingBanner, setPendingBanner] = useState<
    { file: File; url: string } | null
  >(null);
  const [pendingGalleryFiles, setPendingGalleryFiles] = useState<
    Array<{ file: File; url: string }>
  >([]);
  const objectUrlsRef = useRef<string[]>([]);

  const trackObjectUrl = (url: string) => {
    objectUrlsRef.current.push(url);
    return url;
  };

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
    // Intentionally only on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const InlineError = ({ message }: { message?: string }) => {
    if (!message) return null;
    return (
      <p className="text-[13px] text-rose-500 dark:text-rose-400 mt-0.5 ms-1">
        {message}
      </p>
    );
  };

  const inputErrorClass = "border-rose-300 ring-1 ring-rose-300/20";

  const [businessPhoneValid, setBusinessPhoneValid] = useState(true);
  const { t, dict } = useI18n();
  const dayLabels = dict.onboarding.dayLabels || [];
  const dayShortLabels = dict.onboarding.dayShortLabels || dayLabels;
  const getDayLabel = React.useCallback(
    (day: number) => dayLabels[day] || "",
    [dayLabels]
  );
  const getDayShortLabel = React.useCallback(
    (day: number) => dayShortLabels[day] || getDayLabel(day),
    [dayShortLabels, getDayLabel]
  );
  const initialTimeZone = React.useMemo(() => detectTimeZone(), []);
  const supportedTimeZones = React.useMemo(() => {
    let zones: string[] = [];
    try {
      const fn = (Intl as any)?.supportedValuesOf;
      if (typeof fn === "function") {
        const values = fn("timeZone") as unknown;
        if (Array.isArray(values)) {
          zones = values.map((v) => String(v)).filter(Boolean);
        }
      }
    } catch {
      // ignore
    }
    const base = [DEFAULT_TIMEZONE, initialTimeZone].filter(Boolean);
    return Array.from(new Set([...base, ...zones]));
  }, [initialTimeZone]);

  const uiTimeZones = React.useMemo(() => UI_TIMEZONES, [supportedTimeZones]);

  const [data, setData] = useState<OnboardingData>({
    businessTypes: [],
    business: { name: "", phone: "", address: "" },
    branding: { logo: undefined, banner: undefined, gallery: [] },
    currency: "ILS",
    services: [
      {
        id: crypto.randomUUID(),
        name: "",
        durationMinutes: 30,
        price: undefined,
      },
    ],
    availability: {
      timezone: initialTimeZone || DEFAULT_TIMEZONE,
      weekStartsOn: 0,
      days: defaultDays(),
    },
  });

  const [servicesAutoGenerated, setServicesAutoGenerated] = useState(false);
  const lastPresetTypeRef = React.useRef<string | null>(null);

  const generateServicePresetsForType = (typeKey: string | null) => {
    if (!typeKey) return [];

    const presets = SERVICE_PRESETS[typeKey];
    if (!Array.isArray(presets) || presets.length === 0) return [];

    const next: Array<{
      id: string;
      name: string;
      durationMinutes: number;
      price?: number;
    }> = [];
    const seen = new Set<string>();

    for (const preset of presets) {
      const nameKey = String(preset?.nameKey ?? "").trim();
      const name = nameKey ? t(nameKey) : "";
      if (!name) continue;

      const norm = name.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);

      next.push({
        id: crypto.randomUUID(),
        name,
        durationMinutes:
          typeof preset.durationMinutes === "number" && preset.durationMinutes > 0
            ? preset.durationMinutes
            : 30,
        price: undefined,
      });

      if (next.length >= 4) break;
    }

    return next;
  };

  const isServicesEffectivelyEmpty = (services: OnboardingData["services"]) => {
    const list = Array.isArray(services) ? services : [];
    if (list.length === 0) return true;

    // Treat the default placeholder row as empty so presets can replace it.
    if (
      list.length === 1 &&
      !String(list[0]?.name ?? "").trim() &&
      typeof list[0]?.price !== "number" &&
      (Number(list[0]?.durationMinutes) || 0) <= 0
    ) {
      return true;
    }

    if (
      list.length === 1 &&
      !String(list[0]?.name ?? "").trim() &&
      typeof list[0]?.price !== "number" &&
      Number(list[0]?.durationMinutes) === 30
    ) {
      return true;
    }

    return list.every((s) => !String(s?.name ?? "").trim());
  };

  useEffect(() => {
    if (loading) return;
    if (step !== 2) return;

    const selectedType = String(
      (Array.isArray(data.businessTypes) ? data.businessTypes : [])[0] ?? ""
    ).trim();
    const normalizedType = selectedType || null;
    const typeChanged = normalizedType !== lastPresetTypeRef.current;
    if (!typeChanged) return;

    const generated = generateServicePresetsForType(normalizedType);

    const canAutoPrefill =
      servicesAutoGenerated || isServicesEffectivelyEmpty(data.services);
    if (!canAutoPrefill) {
      lastPresetTypeRef.current = normalizedType;
      return;
    }

    if (!generated.length) {
      // If presets were previously auto-generated but no longer apply (e.g. only “Other”),
      // fall back to a single empty row.
      if (servicesAutoGenerated) {
        setData((d) => ({
          ...d,
          services: [
            {
              id: crypto.randomUUID(),
              name: "",
              durationMinutes: 30,
              price: undefined,
            },
          ],
        }));
        setServicesAutoGenerated(false);
      }
      lastPresetTypeRef.current = normalizedType;
      return;
    }

    setData((d) => ({ ...d, services: generated }));
    setServicesAutoGenerated(true);
    lastPresetTypeRef.current = normalizedType;
    // We intentionally do NOT auto-save here; save happens as usual on Next.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, loading, data.businessTypes]);

  const availabilityToastAtRef = React.useRef(0);

  const toastOnce = (message: string) => {
    const now = Date.now();
    if (now - availabilityToastAtRef.current < 900) return;
    availabilityToastAtRef.current = now;
    toast.error(message);
  };

  const orderedAvailabilityDays = useMemo(() => {
    const days =
      Array.isArray(data.availability?.days) && data.availability?.days?.length
        ? (data.availability.days as any[])
        : defaultDays();
    const byDay = new Map(days.map((d: any) => [d.day, d] as const));
    return Array.from({ length: 7 }, (_, i) => i)
      .map((day) => byDay.get(day))
      .filter(Boolean) as Array<{
        day: number;
        enabled: boolean;
        ranges: Array<{ id: string; start: string; end: string }>;
      }>;
  }, [data.availability?.days]);

  const updateAvailabilityRangeTime = (
    day: number,
    rangeId: string,
    field: "start" | "end",
    value: string
  ) => {
    setData((prev) => {
      const current = prev.availability || {
        weekStartsOn: 0,
        days: defaultDays(),
      };
      const normalizedDays = normalizeAvailabilityDaysForUi(current.days);

      const nextDays = normalizedDays.map((d: any) => {
        if (d.day !== day) return d;

        const nextRanges = normalizeRangesForUi(d.ranges).map((r) =>
          r.id === rangeId ? { ...r, [field]: value } : r
        );
        return {
          ...d,
          ranges: nextRanges.length ? nextRanges : normalizeRangesForUi(null),
        };
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
      const current = prev.availability || {
        weekStartsOn: 0,
        days: defaultDays(),
      };
      const normalizedDays = normalizeAvailabilityDaysForUi(current.days);

      const nextDays = normalizedDays.map((d: any) => {
        if (d.day !== day) return d;

        const ranges = normalizeRangesForUi(d.ranges);
        const complete = ranges
          .map((r) => ({
            startMin: parseTimeToMinutes(String(r.start ?? "").trim()),
            endMin: parseTimeToMinutes(String(r.end ?? "").trim()),
          }))
          .filter(
            (x) =>
              Number.isFinite(x.startMin) &&
              Number.isFinite(x.endMin) &&
              x.endMin > x.startMin
          )
          .sort((a, b) => a.startMin - b.startMin);

        const lastEnd = complete.length
          ? complete[complete.length - 1].endMin
          : 17 * 60;
        const startMin = Math.max(0, Math.min(23 * 60 + 59, lastEnd));
        if (startMin >= 23 * 60 + 59) {
          toastOnce(
            t("onboarding.errors.noRoomForRange", { day: getDayLabel(day) })
          );
          return d;
        }

        const endMin = Math.min(23 * 60 + 59, startMin + 60);
        if (endMin <= startMin) {
          toastOnce(
            t("onboarding.errors.noRoomForRange", { day: getDayLabel(day) })
          );
          return d;
        }

        const candidate = {
          id: newId(),
          start: minutesToTime(startMin),
          end: minutesToTime(endMin),
        };
        const collides = complete.some((r) =>
          overlaps(r.startMin, r.endMin, startMin, endMin)
        );
        if (collides) {
          toastOnce(
            t("onboarding.errors.overlappingRanges", { day: getDayLabel(day) })
          );
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
      const current = prev.availability || {
        weekStartsOn: 0,
        days: defaultDays(),
      };
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
    setLoading(false);
  }, []);


  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    setError(null);
    try {
      const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
      const maxBytes = 2 * 1024 * 1024;

      if (file.type && !allowed.has(String(file.type).toLowerCase())) {
        throw new Error(t("onboarding.errors.invalidImageType"));
      }
      if (file.size > maxBytes) {
        throw new Error(t("onboarding.errors.logoTooLarge"));
      }

      if (pendingLogo?.url) {
        URL.revokeObjectURL(pendingLogo.url);
      }

      const url = trackObjectUrl(URL.createObjectURL(file));
      const publicId = "";
      setPendingLogo({ file, url });
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
      if (pendingLogo?.url) {
        URL.revokeObjectURL(pendingLogo.url);
      }
      setPendingLogo(null);
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

  const uploadBanner = async (file: File) => {
    setUploadingBanner(true);
    setError(null);
    try {
      const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
      const maxBytes = 5 * 1024 * 1024;

      if (file.type && !allowed.has(String(file.type).toLowerCase())) {
        throw new Error(t("onboarding.errors.invalidImageType"));
      }
      if (file.size > maxBytes) {
        throw new Error(t("onboarding.errors.bannerTooLarge"));
      }

      if (pendingBanner?.url) {
        URL.revokeObjectURL(pendingBanner.url);
      }

      const url = trackObjectUrl(URL.createObjectURL(file));
      const publicId = "";
      const width = undefined;
      const height = undefined;
      const bytes = undefined;
      const format = undefined;

      setPendingBanner({ file, url });

      setData((d) => ({
        ...d,
        branding: {
          ...(d.branding || {}),
          banner: url
            ? { url, publicId, width, height, bytes, format }
            : undefined,
        },
      }));
    } finally {
      setUploadingBanner(false);
    }
  };

  const removeBanner = async () => {
    setUploadingBanner(true);
    setError(null);
    try {
      if (pendingBanner?.url) {
        URL.revokeObjectURL(pendingBanner.url);
      }
      setPendingBanner(null);
      setData((d) => ({
        ...d,
        branding: {
          ...(d.branding || {}),
          banner: undefined,
        },
      }));
    } finally {
      setUploadingBanner(false);
    }
  };

  const uploadGalleryFiles = async (files: File[] | null) => {
    if (!files || files.length === 0) return;

    setUploadingGallery(true);
    setError(null);
    setGalleryError(null);
    try {
      const current = (data.branding?.gallery || []).length;
      const remaining = Math.max(0, 10 - current);
      if (remaining <= 0)
        throw new Error(t("onboarding.errors.galleryLimit", { max: 10 }));

      const selected = files.slice(0, remaining);

      const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
      const maxBytes = 5 * 1024 * 1024;
      const valid: File[] = [];
      const skipped: string[] = [];

      for (const f of selected) {
        const fileType = String(f.type || "").toLowerCase();
        if (fileType && !allowed.has(fileType)) {
          skipped.push(
            `${f.name || t("onboarding.errors.filePlaceholder")} (${t(
              "onboarding.errors.unsupportedFormat"
            )})`
          );
          continue;
        }
        if (f.size > maxBytes) {
          skipped.push(
            `${f.name || t("onboarding.errors.filePlaceholder")} (${t(
              "onboarding.errors.tooLarge"
            )})`
          );
          continue;
        }
        valid.push(f);
      }

      if (!valid.length) {
        throw new Error(t("onboarding.errors.invalidImageType"));
      }
      if (skipped.length) {
        const preview = skipped.slice(0, 3).join(", ");
        const suffix = skipped.length > 3 ? "…" : "";
        setError(
          t("onboarding.errors.skippedFiles", {
            files: `${preview}${suffix}`,
          })
        );
      }
      const additions = valid.map((file) => {
        const url = trackObjectUrl(URL.createObjectURL(file));
        return { file, url };
      });

      setPendingGalleryFiles((prev) => [...prev, ...additions]);
      setGalleryPendingPreviews([]);

      setData((d) => ({
        ...d,
        branding: {
          ...(d.branding || {}),
          gallery: [
            ...(d.branding?.gallery || []),
            ...additions.map((item) => ({ url: item.url, publicId: "" })),
          ],
        },
      }));
    } catch (e) {
      const msg =
        (e as any)?.message || t("onboarding.errors.uploadImagesFailed");
      setGalleryError(msg);
      setError(msg);
      throw e;
    } finally {
      setUploadingGallery(false);
    }
  };

  const removeGalleryImage = async (item: { url: string; publicId?: string }) => {
    setUploadingGallery(true);
    setError(null);
    try {
      const targetUrl = String(item?.url ?? "").trim();
      if (!targetUrl) return;

      setPendingGalleryFiles((prev) => prev.filter((f) => f.url !== targetUrl));
      setData((d) => ({
        ...d,
        branding: {
          ...(d.branding || {}),
          gallery: (d.branding?.gallery || []).filter(
            (g) => String(g?.url ?? "").trim() !== targetUrl
          ),
        },
      }));

      if (targetUrl.startsWith("blob:")) {
        URL.revokeObjectURL(targetUrl);
      }
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
      if (!target) throw new Error(t("onboarding.errors.imageNotFound"));

      const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
      const maxBytes = 5 * 1024 * 1024;
      if (file.type && !allowed.has(String(file.type).toLowerCase())) {
        throw new Error(t("onboarding.errors.invalidImageType"));
      }
      if (file.size > maxBytes) {
        throw new Error(t("onboarding.errors.galleryImageTooLarge"));
      }

      const newUrl = trackObjectUrl(URL.createObjectURL(file));

      const targetUrl = String((target as any)?.url ?? target ?? "").trim();
      const after = [...before];
      after[index] = { url: newUrl, publicId: "" };

      setPendingGalleryFiles((prev) => [
        ...prev.filter((f) => f.url !== targetUrl),
        { file, url: newUrl },
      ]);

      setData((d) => ({
        ...d,
        branding: { ...(d.branding || {}), gallery: after },
      }));

      if (targetUrl.startsWith("blob:")) {
        URL.revokeObjectURL(targetUrl);
      }
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
        // No persistence during onboarding.
      }
      if (step === 1) {
        if (!data.business?.name?.trim())
          newErrors.businessName = t("onboarding.errors.businessNameRequired");
        if (!data.business?.phone?.trim())
          newErrors.businessPhone = t("onboarding.errors.businessPhoneRequired");
        if (data.business?.phone?.trim() && !businessPhoneValid)
          newErrors.businessPhone = t("onboarding.errors.businessPhoneInvalid");
        if (!data.business?.address?.trim())
          newErrors.businessAddress = t("onboarding.errors.businessAddressRequired");
        if (!String(data.availability?.timezone ?? "").trim())
          newErrors.businessTimezone = t("onboarding.errors.businessTimezoneRequired");

        if (Object.keys(newErrors).length > 0) {
          setFieldErrors(newErrors);
          return;
        }
      }
      if (step === 2) {
        const currency = normalizeCurrency(data.currency);
        if (currency === OTHER_CURRENCY_CODE) {
          if (!data.customCurrency?.name?.trim())
            newErrors.currencyName = t("onboarding.errors.currencyNameRequired");
          if (!data.customCurrency?.symbol?.trim())
            newErrors.currencySymbol = t("onboarding.errors.currencySymbolRequired");
        }

        const services = data.services || [];
        if (services.length === 0) {
          setError(t("onboarding.errors.atLeastOneService"));
          return;
        }

        services.forEach((s) => {
          if (!s.name?.trim())
            newErrors[`serviceName_${s.id}`] = t("onboarding.errors.serviceNameRequired");
          if (!s.durationMinutes || s.durationMinutes <= 0)
            newErrors[`serviceDuration_${s.id}`] = t("onboarding.errors.serviceDurationRequired");
        });

        if (Object.keys(newErrors).length > 0) {
          setFieldErrors(newErrors);
          return;
        }
      }
      if (step === 3) {
        const days = normalizeAvailabilityDaysForUi(data.availability?.days);

        const validateAvailability = (): string | null => {
          for (const d of days) {
            if (!d.enabled) continue;

            const ranges = normalizeRangesForUi((d as any).ranges);
            if (!ranges.length) {
              return t("onboarding.errors.invalidHours", {
                day: getDayLabel(d.day),
              });
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
              return t("onboarding.errors.invalidHours", {
                day: getDayLabel(d.day),
              });
            }

            for (const r of parsed) {
              if (
                !r.start ||
                !r.end ||
                !Number.isFinite(r.startMin) ||
                !Number.isFinite(r.endMin)
              ) {
                return t("onboarding.errors.invalidHours", {
                  day: getDayLabel(d.day),
                });
              }
              if (r.endMin <= r.startMin) {
                return t("onboarding.errors.endAfterStart", {
                  day: getDayLabel(d.day),
                });
              }
            }

            const ordered = [...parsed].sort((a, b) => a.startMin - b.startMin);
            for (let i = 1; i < ordered.length; i++) {
              const prev = ordered[i - 1];
              const curr = ordered[i];
              if (
                overlaps(prev.startMin, prev.endMin, curr.startMin, curr.endMin)
              ) {
                return t("onboarding.errors.overlappingRanges", {
                  day: getDayLabel(d.day),
                });
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
      }
      if (step === 4) {
        const gallery = data.branding?.gallery || [];
        if (gallery.length > 10) {
          setError(t("onboarding.errors.galleryLimit", { max: 10 }));
          return;
        }
      }

      setStep((s) => Math.min(s + 1, totalSteps - 1));
    } catch (e: any) {
      setError(e?.message || t("onboarding.errors.saveFailed"));
    }
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  const complete = async () => {
    setSaving(true);
    setError(null);
    try {
      const normalizedBusinessTypes = (
        Array.isArray(data.businessTypes) ? data.businessTypes : []
      )
        .map((v) => String(v || "").trim())
        .filter(Boolean)
        .slice(0, 1);

      const payload: OnboardingData = {
        ...data,
        businessTypes: normalizedBusinessTypes,
        business: {
          ...(data.business || {}),
          limitCustomerToOneUpcomingAppointment: Boolean(
            data.business?.limitCustomerToOneUpcomingAppointment
          ),
        },
        availability: {
          ...(data.availability || {}),
          timezone: String(data.availability?.timezone ?? "").trim(),
          days: normalizeAvailabilityDaysForUi(data.availability?.days).map(
            (d) => ({
              day: d.day,
              enabled: Boolean(d.enabled),
              ranges: normalizeRangesForUi((d as any).ranges).map((r) => ({
                start: String(r.start ?? "").trim(),
                end: String(r.end ?? "").trim(),
              })),
            })
          ),
        },
        currency: normalizeCurrency(data.currency),
        customCurrency:
          normalizeCurrency(data.currency) === OTHER_CURRENCY_CODE
            ? {
              name: String(data.customCurrency?.name ?? "").trim(),
              symbol: String(data.customCurrency?.symbol ?? "").trim(),
            }
            : undefined,
      };

      const formData = new FormData();
      formData.append("payload", JSON.stringify(payload));
      if (pendingLogo?.file) formData.append("logo", pendingLogo.file);
      if (pendingBanner?.file) formData.append("banner", pendingBanner.file);
      pendingGalleryFiles.forEach((item) => {
        formData.append("gallery", item.file);
      });

      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          json?.error || t("errors.requestFailed", { status: res.status })
        );
      }

      updateUser({
        onboardingCompleted: true,
        onboarding: json?.onboarding ?? payload,
      });
      router.replace("/dashboard");
    } catch (e: any) {
      setError(t("onboarding.errors.finishFailed"));
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
                {t("onboarding.businessTypeTitle")}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t("onboarding.businessTypeSubtitle")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t("onboarding.selectOne")}</Label>
              <div className="flex flex-wrap justify-center gap-3">
                {BUSINESS_TYPE_OPTIONS.map((opt) => {
                  const selected = (data.businessTypes || []).includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setData((d) => {
                          const current = d.businessTypes || [];

                          // Single-select: choosing one replaces the previous selection.
                          const next = current.includes(opt.key)
                            ? []
                            : [opt.key];
                          return { ...d, businessTypes: next };
                        });
                      }}
                      className={
                        "w-[160px] min-h-[90px] h-auto rounded-xl border px-4 py-3 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950 overflow-hidden text-start " +
                        (selected
                          ? "border-neutral-900 bg-neutral-50/70 dark:bg-neutral-900/30 shadow-sm"
                          : "border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-950/30 hover:border-gray-300 dark:hover:border-gray-700")
                      }
                    >
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        {(() => {
                          const Icon = BUSINESS_TYPE_ICONS[opt.key];
                          return Icon ? (
                            <Icon
                              className={
                                "h-6 w-6 " +
                                (selected
                                  ? "text-primary"
                                  : "text-muted-foreground")
                              }
                              aria-hidden="true"
                            />
                          ) : null;
                        })()}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white whitespace-normal break-words [overflow-wrap:anywhere]">
                            {t(opt.titleKey)}
                          </div>
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
                {t("onboarding.businessDetailsTitle")}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t("onboarding.businessDetailsSubtitle")}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("onboarding.businessName")}</Label>
                <Input
                  className={fieldErrors.businessName ? inputErrorClass : ""}
                  value={data.business?.name || ""}
                  onChange={(e) =>
                    setData((d) => ({
                      ...d,
                      business: { ...(d.business || {}), name: e.target.value },
                    }))
                  }
                  placeholder={t("onboarding.businessNamePlaceholder")}
                />
                <InlineError message={fieldErrors.businessName} />
              </div>
              <div className="space-y-2">
                <Label>{t("onboarding.businessPhone")}</Label>
                <PhoneInput
                  value={data.business?.phone || ""}
                  onChange={(v) =>
                    setData((d) => ({
                      ...d,
                      business: {
                        ...(d.business || {}),
                        phone: v,
                      },
                    }))
                  }
                  onValidityChange={setBusinessPhoneValid}
                  inputClassName={fieldErrors.businessPhone ? inputErrorClass : ""}
                  aria-invalid={Boolean(fieldErrors.businessPhone)}
                  placeholder={t("onboarding.businessPhonePlaceholder")}
                />
                <InlineError message={fieldErrors.businessPhone} />
              </div>
              <div className="space-y-2">
                <Label>{t("onboarding.businessAddress")}</Label>
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
                  placeholder={t("onboarding.businessAddressPlaceholder")}
                />
                <InlineError message={fieldErrors.businessAddress} />
              </div>

              <div className="space-y-2">
                <Label>{t("onboarding.timezone")}</Label>
                <Select
                  value={String(data.availability?.timezone || "").trim() || DEFAULT_TIMEZONE}
                  onValueChange={(v) =>
                    setData((d) => ({
                      ...d,
                      availability: {
                        ...(d.availability || {}),
                        timezone: String(v || "").trim(),
                      },
                    }))
                  }
                >
                  <SelectTrigger
                    className={(fieldErrors.businessTimezone ? inputErrorClass : "") + " w-full"}
                  >
                    <SelectValue placeholder={t("onboarding.selectTimezone")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {uiTimeZones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <InlineError message={fieldErrors.businessTimezone} />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t("onboarding.brandingTitle")}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t("onboarding.brandingSubtitle")}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {t("onboarding.businessLogo")}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {t("onboarding.businessLogoHint")}
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
                  setCropMode("logo");
                  setCropFile(file);
                  setCropOpen(true);
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
                      alt={t("onboarding.businessLogoAlt")}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-300">
                      {t("onboarding.noLogo")}
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
                      <span className="inline-flex items-center gap-2">
                        {uploadingLogo ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        <span>
                          {data.branding?.logo?.url || data.branding?.logoUrl
                            ? t("onboarding.replaceLogo")
                            : t("onboarding.uploadLogo")}
                        </span>
                      </span>
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
                          setError(err?.message || t("onboarding.removeLogoFailed"))
                        )
                      }
                    >
                      {t("onboarding.removeLogo")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {t("onboarding.businessBanner")}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {t("onboarding.businessBannerHint")}
                  </div>
                </div>
              </div>

              <input
                id={bannerInputId}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploadingBanner || saving}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setCropMode("banner");
                  setCropFile(file);
                  setCropOpen(true);
                }}
              />

              <div className="mt-4 space-y-3">
                <div className="relative w-full h-[140px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-neutral-950 via-zinc-900 to-zinc-800">
                  {data.branding?.banner?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={String(data.branding.banner.url).trim()}
                      alt={t("onboarding.businessBannerAlt")}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : null}
                  <div className="absolute inset-0 opacity-20 mix-blend-overlay" />

                  {!data.branding?.banner?.url ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-xs font-medium text-white/80">
                        {t("onboarding.noBanner")}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    asChild
                    type="button"
                    variant="outline"
                    disabled={uploadingBanner || saving}
                    className="rounded-xl"
                  >
                    <label htmlFor={bannerInputId} className="cursor-pointer">
                      <span className="inline-flex items-center gap-2">
                        {uploadingBanner ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        <span>
                          {data.branding?.banner?.url
                            ? t("onboarding.replaceBanner")
                            : t("onboarding.uploadBanner")}
                        </span>
                      </span>
                    </label>
                  </Button>

                  {data.branding?.banner?.url ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={uploadingBanner || saving}
                      className="rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() =>
                        removeBanner().catch((err) =>
                          setError(err?.message || t("onboarding.removeBannerFailed"))
                        )
                      }
                    >
                      {t("onboarding.removeBanner")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {t("onboarding.businessGallery")}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {t("onboarding.businessGalleryHint")}
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
                    setError(
                      err?.message || t("onboarding.errors.uploadImagesFailed")
                    )
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
                      alt={t("onboarding.uploading")}
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
                            setError(
                              err?.message ||
                              t("onboarding.errors.replaceImageFailed")
                            )
                          );
                        }}
                      />

                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={t("onboarding.galleryImageAlt", { index: idx + 1 })}
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
                          {replacingIndex === idx ? "…" : t("onboarding.replace")}
                        </label>

                        <button
                          type="button"
                          disabled={uploadingGallery || saving}
                          onClick={() =>
                            removeGalleryImage({ url, publicId }).catch((err) =>
                              setError(err?.message || t("onboarding.removeImageFailed"))
                            )
                          }
                          className="rounded-lg bg-black/45 text-white p-1.5 backdrop-blur-sm hover:bg-black/55 transition disabled:opacity-60"
                          aria-label={t("onboarding.removeImage")}
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
                          {t("onboarding.addImages")}
                        </div>
                      </div>
                    </label>
                  );
                })()}
              </div>

              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                {t("onboarding.galleryPublicNote")}
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
                {t("onboarding.servicesTitle")}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t("onboarding.servicesSubtitle")}
              </p>
              {servicesAutoGenerated ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t("onboarding.servicesAutoGenerated")}
                </p>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <Label className="flex-1">{t("onboarding.serviceName")}</Label>
                <Label className="w-[70px] shrink-0 text-center">{t("onboarding.time")}</Label>
                <Label className="w-[70px] shrink-0 text-center">{t("onboarding.price")}</Label>
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
                          onChange={(e) => {
                            setServicesAutoGenerated(false);
                            setData((d) => ({
                              ...d,
                              services: (d.services || []).map((x) =>
                                x.id === s.id
                                  ? { ...x, name: e.target.value }
                                  : x
                              ),
                            }));
                          }}
                          placeholder={t("onboarding.servicePlaceholder")}
                        />
                      </div>

                      <div className="w-[70px] shrink-0">
                        <Input
                          type="number"
                          min={10}
                          className={`px-2 text-center ${fieldErrors[`serviceDuration_${s.id}`]
                            ? inputErrorClass
                            : ""
                            }`}
                          value={s.durationMinutes}
                          onChange={(e) => {
                            setServicesAutoGenerated(false);
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
                            }));
                          }}
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
                          onChange={(e) => {
                            setServicesAutoGenerated(false);
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
                            }));
                          }}
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
                          aria-label={t("onboarding.removeService")}
                          onClick={() => {
                            setServicesAutoGenerated(false);
                            setData((d) => ({
                              ...d,
                              services: (d.services || []).filter(
                                (x) => x.id !== s.id
                              ),
                            }));
                          }}
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
                  onClick={() => {
                    setServicesAutoGenerated(false);
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
                    }));
                  }}
                >
                  {t("onboarding.addService")}
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
                {t("onboarding.bookingHoursTitle")}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t("onboarding.bookingHoursSubtitle")}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-950/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {t("onboarding.limitCustomersTitle")}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t("onboarding.limitCustomersSubtitle")}
                  </div>
                </div>
                <UISwitch
                  checked={Boolean(
                    data.business?.limitCustomerToOneUpcomingAppointment
                  )}
                  onCheckedChange={(checked) =>
                    setData((prev) => ({
                      ...prev,
                      business: {
                        ...(prev.business || {}),
                        limitCustomerToOneUpcomingAppointment: checked,
                      },
                    }))
                  }
                  disabled={loading || saving}
                  aria-label={t("onboarding.limitCustomersTitle")}
                />
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
                              const current = prev.availability || {
                                weekStartsOn: 0,
                                days: defaultDays(),
                              };
                              const days = normalizeAvailabilityDaysForUi(
                                current.days
                              );
                              return {
                                ...prev,
                                availability: {
                                  ...(current as any),
                                  days: days.map((x: any) =>
                                    x.day === d.day
                                      ? { ...x, enabled: checked }
                                      : x
                                  ),
                                },
                              };
                            })
                          }
                          aria-label={t("onboarding.toggleDay", {
                            day: getDayLabel(d.day),
                          })}
                          disabled={loading || saving}
                        />
                      </div>

                      <div className="h-8 flex items-center text-sm font-medium text-gray-900 dark:text-white select-none">
                        <span className="w-8">
                          {getDayShortLabel(d.day)}
                        </span>
                      </div>

                      <div className="space-y-2 min-w-0">
                        {ranges.map((r, idx) => (
                          <div
                            key={r.id}
                            className="h-8 flex items-center flex-nowrap gap-2 min-w-0"
                          >
                            <TimePicker
                              value={String(r.start ?? "")}
                              onChange={(v) =>
                                updateAvailabilityRangeTime(
                                  d.day,
                                  r.id,
                                  "start",
                                  v
                                )
                              }
                              disabled={loading || saving || !d.enabled}
                              className="h-8 w-[78px] min-w-[78px] px-1.5 text-[13px] shrink-0"
                              aria-label={t("onboarding.timeRangeStartAria", {
                                day: getDayLabel(d.day),
                                index: idx + 1,
                              })}
                            />
                            <span className="text-gray-400 shrink-0">–</span>
                            <TimePicker
                              value={String(r.end ?? "")}
                              onChange={(v) =>
                                updateAvailabilityRangeTime(
                                  d.day,
                                  r.id,
                                  "end",
                                  v
                                )
                              }
                              disabled={loading || saving || !d.enabled}
                              className="h-8 w-[78px] min-w-[78px] px-1.5 text-[13px] shrink-0"
                              aria-label={t("onboarding.timeRangeEndAria", {
                                day: getDayLabel(d.day),
                                index: idx + 1,
                              })}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2 flex flex-col items-end">
                        {ranges.map((r, idx) => (
                          <div
                            key={r.id}
                            className="h-8 flex items-center justify-end"
                          >
                            {idx === 0 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => addAvailabilityRange(d.day)}
                                disabled={loading || saving || !d.enabled}
                                aria-label={t("onboarding.addTimeRange", {
                                  day: getDayLabel(d.day),
                                })}
                              >
                                <Plus className="h-4 w-4 ms-4" />
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() =>
                                  deleteAvailabilityRange(d.day, r.id)
                                }
                                disabled={
                                  loading ||
                                  saving ||
                                  !d.enabled ||
                                  ranges.length <= 1
                                }
                                aria-label={t("onboarding.deleteTimeRange", {
                                  day: getDayLabel(d.day),
                                })}
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
                {t("onboarding.finishTitle")}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t("onboarding.finishSubtitle")}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-5">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t("onboarding.businessTypeTitle")}
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-200">
                  {data.businessTypes && data.businessTypes.length > 0
                    ? data.businessTypes
                      .map(
                        (v) => {
                          const matched = BUSINESS_TYPE_OPTIONS.find(
                            (o) => o.key === v
                          );
                          return matched ? t(matched.titleKey) : v;
                        }
                      )
                      .join(", ")
                    : t("common.emptyDash")}
                </div>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-800" />

              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t("onboarding.brandingTitle")}
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                    {data.branding?.logo?.url || data.branding?.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={String(
                          data.branding?.logo?.url || data.branding?.logoUrl
                        ).trim()}
                        alt={t("onboarding.businessLogoAlt")}
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
                      <span className="font-medium">{t("onboarding.logoLabel")}</span>{" "}
                      {data.branding?.logo?.url || data.branding?.logoUrl
                        ? t("onboarding.uploaded")
                        : t("onboarding.notSet")}
                    </div>
                    <div>
                      <span className="font-medium">{t("onboarding.galleryLabel")}</span>{" "}
                      {t("onboarding.galleryImagesCount", {
                        count: (data.branding?.gallery || []).length,
                      })}
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
                            alt={t("onboarding.galleryImageAlt", {
                              index: idx + 1,
                            })}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {t("onboarding.noGalleryImages")}
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-800" />

              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t("onboarding.businessDetailsTitle")}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <div>
                    <span className="font-medium">{t("onboarding.nameLabel")}</span>{" "}
                    {data.business?.name || t("common.emptyDash")}
                  </div>
                  <div>
                    <span className="font-medium">{t("onboarding.phoneLabel")}</span>{" "}
                    {data.business?.phone || t("common.emptyDash")}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="font-medium">{t("onboarding.addressLabel")}</span>{" "}
                    {data.business?.address || t("common.emptyDash")}
                  </div>
                </div>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-800" />

              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t("onboarding.servicesTitle")}
                </div>

                <div className="text-sm text-gray-700 dark:text-gray-200">
                  <span className="font-medium">{t("onboarding.currencyLabel")}</span>{" "}
                  {currencyLabel(data, t("onboarding.otherCurrency"))}
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
                              {String(s.name || "").trim() || t("common.emptyDash")}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">
                              {t("onboarding.durationLabel")}{" "}
                              {Number.isFinite(s.durationMinutes)
                                ? s.durationMinutes
                                : t("common.emptyDash")}{" "}
                              {t("onboarding.minutesShort")}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white shrink-0">
                            {Number.isFinite(s.price)
                              ? `${effectiveCurrencySymbol(data)}${s.price}`
                              : t("common.emptyDash")}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-700 dark:text-gray-200">
                      {t("common.emptyDash")}
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-800" />

              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t("onboarding.bookingHoursTitle")}
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-200">
                  <span className="font-medium">{t("onboarding.weekStartsOn")}</span>{" "}
                  {getDayLabel(0)}
                </div>

                <div className="space-y-2">
                  {(() => {
                    const days = data.availability?.days || [];
                    const byDay = new Map(days.map((d) => [d.day, d] as const));
                    const ordered = Array.from({ length: 7 }, (_, i) => i)
                      .map((day) => byDay.get(day))
                      .filter(Boolean) as Array<{
                        day: number;
                        enabled: boolean;
                        ranges?: Array<{
                          id?: string;
                          start?: string;
                          end?: string;
                        }>;
                        start?: string;
                        end?: string;
                      }>;

                    return ordered.map((d) => (
                      <div
                        key={d.day}
                        className="flex items-center justify-between gap-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/20 px-3 py-2"
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {getDayLabel(d.day)}
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-200">
                          {d.enabled
                            ? (() => {
                              const ranges = normalizeRangesForUi(
                                (d as any).ranges ?? {
                                  start: (d as any).start,
                                  end: (d as any).end,
                                }
                              );
                              return ranges
                                .map(
                                  (r) =>
                                    `${String(r.start || t("common.emptyDash"))} – ${String(
                                      r.end || t("common.emptyDash")
                                    )}`
                                )
                                .join(", ");
                            })()
                            : t("onboarding.closed")}
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
        <div className="absolute inset-0 opacity-20 mix-blend-overlay"></div>
        <div className="absolute top-4 inset-x-0 z-20 flex justify-center">
          <LanguageSwitcher variant="dark" />
        </div>
      </div>

      {/* Main Content Area with Convex Curve (Sides lower than center) */}
      <div className="flex-1 -mt-10 bg-gray-50 dark:bg-zinc-900 rounded-t-[40px] relative z-10 flex flex-col items-center shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
        {/* User & Step Info */}
        <div className="text-center space-y-1 mt-6 mb-6 px-6 w-full max-w-md">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
            {user?.full_name
              ? t("onboarding.welcomeUser", { name: user.full_name })
              : t("onboarding.welcome")}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            {step === 0
              ? t("onboarding.stepBusinessType")
              : step === 1
                ? t("onboarding.stepBusinessDetails")
                : step === 2
                  ? t("onboarding.stepServices")
                  : step === 3
                    ? t("onboarding.stepBookingHours")
                    : step === 4
                      ? t("onboarding.stepBranding")
                      : t("onboarding.stepReview")}
          </p>

          {/* Progress Bar */}
          <ProgressBar
            progress={progress}
            stepCountLabel={t("onboarding.stepCount", {
              current: step + 1,
              total: totalSteps,
            })}
          />
        </div>

        <div className="flex-1 px-6 pb-28 w-full max-w-md mx-auto">
          <AuthBanner
            banner={error ? { type: "error", text: error } : null}
            onClose={error ? () => setError(null) : undefined}
          />

          <AnimatePresence mode="wait" initial={false}>
            {loading ? (
              <div className="py-20 text-center text-muted-foreground flex flex-col items-center">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-neutral-900 dark:text-white" />
                <p>{t("onboarding.loadingDetails")}</p>
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
      <div className="fixed bottom-0 inset-x-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-lg border-t border-gray-100 dark:border-gray-800 p-4 z-40 shadow-[0_-4px_8px_-1px_rgba(0,0,0,0.02)]">
        <div className="max-w-[420px] mx-auto flex gap-3 w-full">
          {step > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={back}
              disabled={saving}
              className="h-14 flex-1 rounded-2xl text-lg font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              {t("common.back")}
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
              {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : t("common.next")}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={complete}
              disabled={saving || loading}
              className="h-14 flex-1 rounded-2xl text-lg font-bold bg-neutral-900 hover:bg-neutral-800 text-white shadow-lg shadow-black/10 dark:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                t("onboarding.finishButton")
              )}
            </Button>
          )}
        </div>
      </div>

      <ImageCropperModal
        open={cropOpen}
        mode={cropMode}
        file={cropFile}
        onCancel={() => {
          setCropOpen(false);
          setCropFile(null);
        }}
        onConfirm={async (cropped) => {
          try {
            if (cropMode === "logo") {
              await uploadLogo(cropped);
            } else {
              await uploadBanner(cropped);
            }
            setCropOpen(false);
            setCropFile(null);
          } catch (err: any) {
            setError(
              err?.message || t("onboarding.errors.uploadImageFailed")
            );
            throw err;
          }
        }}
      />
    </div>
  );

  return card;
}
