import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";
import { BUSINESS_TYPES } from "@/lib/onboardingPresets";

const ALLOWED_BUSINESS_TYPES = new Set(BUSINESS_TYPES.map((t) => t.key));

const OTHER_CURRENCY_CODE = "OTHER";

const ALLOWED_CURRENCIES = new Set([
  "NIS",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "CAD",
  "CHF",
  OTHER_CURRENCY_CODE,
]);

function asString(v: unknown, maxLen = 200): string | undefined {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function asUrlPath(v: unknown, maxLen = 500): string | undefined {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  if (s.length > maxLen) return s.slice(0, maxLen);
  // We only allow site-local upload paths for branding assets.
  if (!s.startsWith("/uploads/")) return undefined;
  return s;
}

function asHttpUrl(v: unknown, maxLen = 500): string | undefined {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  if (s.length > maxLen) return s.slice(0, maxLen);
  if (!/^https?:\/\//i.test(s)) return undefined;
  return s;
}

function normalizeBrandingLogo(v: unknown) {
  if (!v || typeof v !== "object") return undefined;
  const url = asHttpUrl((v as any).url, 500);
  const publicId = asString((v as any).publicId ?? (v as any).public_id, 300);
  if (!url || !publicId) return undefined;
  const width = asNumber((v as any).width);
  const height = asNumber((v as any).height);
  const bytes = asNumber((v as any).bytes);
  const format = asString((v as any).format, 40);
  return { url, publicId, width, height, bytes, format };
}

function normalizeBrandingGallery(v: unknown) {
  if (!Array.isArray(v)) return undefined;
  const out: any[] = [];
  for (const item of v) {
    if (typeof item === "string") {
      const legacy = asUrlPath(item, 500) ?? asHttpUrl(item, 500);
      if (legacy) out.push({ url: legacy, publicId: "" });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const url = asHttpUrl((item as any).url, 500);
    const publicId =
      asString((item as any).publicId ?? (item as any).public_id, 300) ?? "";
    if (!url) continue;
    out.push({
      url,
      publicId,
      width: asNumber((item as any).width),
      height: asNumber((item as any).height),
      bytes: asNumber((item as any).bytes),
      format: asString((item as any).format, 40),
    });
  }
  return out.slice(0, 10);
}

function asNumber(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function overlaps(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function normalizeAvailabilityRanges(
  input: any
): Array<{ start: string; end: string }> {
  if (!Array.isArray(input)) return [];
  const out: Array<{ start: string; end: string }> = [];
  for (const r of input) {
    const start = asString((r as any)?.start, 10) ?? "";
    const end = asString((r as any)?.end, 10) ?? "";
    if (!start && !end) continue;
    out.push({ start, end });
  }
  return out;
}

function normalizeAvailabilityDay(d: any) {
  const day = Number(d?.day);
  if (!Number.isInteger(day) || day < 0 || day > 6) return null;

  const enabled = Boolean(d?.enabled);
  const rangesIn = normalizeAvailabilityRanges(d?.ranges);

  // Legacy migration: { start, end } => ranges: [{start,end}]
  const legacyStart = asString(d?.start, 10);
  const legacyEnd = asString(d?.end, 10);
  const ranges =
    rangesIn.length > 0
      ? rangesIn
      : legacyStart || legacyEnd
      ? [{ start: legacyStart ?? "", end: legacyEnd ?? "" }]
      : [];

  return { day, enabled, ranges };
}

function validateAvailabilityDays(
  days: Array<{
    day: number;
    enabled: boolean;
    ranges: Array<{ start: string; end: string }>;
  }>
): string | null {
  for (const d of days) {
    if (!d.enabled) continue;

    const ranges = Array.isArray(d.ranges) ? d.ranges : [];
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

    for (const r of parsed) {
      if (
        !r.start ||
        !r.end ||
        !Number.isFinite(r.startMin) ||
        !Number.isFinite(r.endMin)
      ) {
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
}

function normalizeService(s: any) {
  const id = asString(s?.id, 64) ?? crypto.randomUUID();
  const name = asString(s?.name, 80);
  const durationMinutes = asNumber(s?.durationMinutes);
  const price = asNumber(s?.price);
  const description = asString(s?.description, 1000) ?? "";

  const rawActive = (s as any)?.isActive;
  const isActive =
    rawActive === false ||
    rawActive === 0 ||
    String(rawActive ?? "")
      .trim()
      .toLowerCase() === "false"
      ? false
      : true;

  if (!name) return null;
  if (!durationMinutes || durationMinutes <= 0 || durationMinutes > 24 * 60)
    return null;
  if (price !== undefined && (price < 0 || price > 1_000_000)) return null;

  return { id, name, durationMinutes, price, description, isActive };
}

function firstServiceError(services: any[]): string | null {
  if (!Array.isArray(services) || services.length === 0)
    return "Service is required";

  const multi = services.length > 1;
  for (let i = 0; i < services.length; i++) {
    const s = services[i];
    const prefix = multi ? `Service ${i + 1} ` : "Service ";

    const name = asString(s?.name, 80);
    if (!name) return `${prefix}name is required`;

    const durationMinutes = asNumber(s?.durationMinutes);
    if (!durationMinutes || durationMinutes <= 0 || durationMinutes > 24 * 60) {
      return `${prefix}duration is required`;
    }

    const price = asNumber(s?.price);
    if (price !== undefined && (price < 0 || price > 1_000_000))
      return `${prefix}price is invalid`;

    const description = asString(s?.description, 1000);
    // description is optional; length is handled by asString maxLen
    void description;

    // isActive is optional boolean; we accept any value and coerce during normalize.
  }

  return null;
}

export async function GET() {
  try {
    const appUser = await requireAppUser();
    const c = await collections();

    const user = await c.users.findOne({ _id: new ObjectId(appUser.id) });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Lazy migration: convert legacy availability day {start,end} into {ranges:[{start,end}]}.
    try {
      const days = Array.isArray((user as any)?.onboarding?.availability?.days)
        ? ((user as any).onboarding.availability.days as any[])
        : [];
      let changed = false;
      const migrated = days
        .map((d) => {
          const normalized = normalizeAvailabilityDay(d);
          if (!normalized) return null;
          const hadRanges = Array.isArray((d as any)?.ranges);
          const hadLegacy =
            (d as any)?.start !== undefined || (d as any)?.end !== undefined;
          if (!hadRanges && hadLegacy) changed = true;
          return normalized;
        })
        .filter(Boolean) as Array<any>;

      if (changed) {
        const err = validateAvailabilityDays(migrated);
        // If legacy data is invalid, still migrate shape (don’t block GET).
        await c.users.updateOne(
          { _id: new ObjectId(appUser.id) },
          {
            $set: {
              "onboarding.availability.days": migrated,
              "onboarding.updatedAt": new Date(),
            },
          }
        );
        // If invalid, we leave it to the UI to prompt fix.
        void err;
        (user as any).onboarding = (user as any).onboarding ?? {};
        (user as any).onboarding.availability =
          (user as any).onboarding.availability ?? {};
        (user as any).onboarding.availability.days = migrated;
      }
    } catch {
      // Ignore migration failures.
    }

    return NextResponse.json({
      onboardingCompleted: Boolean((user as any).onboardingCompleted),
      onboarding: (user as any).onboarding ?? {},
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const appUser = await requireAppUser();
    const body = await req.json().catch(() => ({}));

    const currencyRaw = asString((body as any)?.currency, 8);
    const currency = currencyRaw ? currencyRaw.toUpperCase() : undefined;

    const customCurrencyName = asString(
      (body as any)?.customCurrency?.name,
      40
    );
    const customCurrencySymbol = asString(
      (body as any)?.customCurrency?.symbol,
      10
    );

    const businessTypesRaw = Array.isArray(body?.businessTypes)
      ? body.businessTypes
      : undefined;
    const legacyBusinessType = asString(body?.businessType, 60);

    const businessName = asString(body?.business?.name, 120);
    const businessPhone = asString(body?.business?.phone, 40);
    const businessAddress = asString(body?.business?.address, 200);

    const timezone = asString(body?.availability?.timezone, 80);
    const weekStartsOnRaw = (body as any)?.availability?.weekStartsOn;
    const weekStartsOn =
      typeof weekStartsOnRaw === "number"
        ? weekStartsOnRaw
        : Number(weekStartsOnRaw);

    const servicesIn = Array.isArray(body?.services)
      ? body.services
      : undefined;
    const daysIn = Array.isArray(body?.availability?.days)
      ? body.availability.days
      : undefined;

    const brandingLogoUrlRaw = (body as any)?.branding?.logoUrl;
    const brandingGalleryRaw = (body as any)?.branding?.gallery;
    const brandingLogoRaw = (body as any)?.branding?.logo;

    const set: any = {};
    const unset: any = {};

    if (currency !== undefined) {
      if (!ALLOWED_CURRENCIES.has(currency)) {
        return NextResponse.json(
          { error: "Invalid currency" },
          { status: 400 }
        );
      }

      if (currency === OTHER_CURRENCY_CODE) {
        if (!customCurrencyName) {
          return NextResponse.json(
            { error: "Currency name is required" },
            { status: 400 }
          );
        }
        if (!customCurrencySymbol) {
          return NextResponse.json(
            { error: "Currency symbol is required" },
            { status: 400 }
          );
        }
        set["onboarding.customCurrency.name"] = customCurrencyName;
        set["onboarding.customCurrency.symbol"] = customCurrencySymbol;

        // Business-level currency is only for standard codes.
        unset["onboarding.business.currency"] = "";
      } else {
        unset["onboarding.customCurrency"] = "";

        // Keep business-level currency in sync (normalize legacy NIS -> ILS).
        set["onboarding.business.currency"] =
          currency === "NIS" ? "ILS" : currency;
      }

      set["onboarding.currency"] = currency;
    }

    if (businessTypesRaw !== undefined) {
      const normalized = businessTypesRaw
        .map((v: any) => asString(v, 60))
        .filter(Boolean)
        .map((v: any) => String(v).toLowerCase())
        .filter((v: string) => ALLOWED_BUSINESS_TYPES.has(v));
      // Single-select: keep only one business type.
      set["onboarding.businessTypes"] = Array.from(new Set(normalized)).slice(
        0,
        1
      );
    } else if (legacyBusinessType !== undefined) {
      const v = legacyBusinessType.toLowerCase();
      if (ALLOWED_BUSINESS_TYPES.has(v)) {
        set["onboarding.businessTypes"] = [v];
      } else {
        set["onboarding.businessTypes"] = [];
      }
    }

    if (businessName !== undefined)
      set["onboarding.business.name"] = businessName;
    if (businessPhone !== undefined)
      set["onboarding.business.phone"] = businessPhone;
    if (businessAddress !== undefined)
      set["onboarding.business.address"] = businessAddress;

    if (timezone !== undefined)
      set["onboarding.availability.timezone"] = timezone;
    if (weekStartsOn === 0 || weekStartsOn === 1) {
      set["onboarding.availability.weekStartsOn"] = weekStartsOn;
    }

    if (servicesIn) {
      const err = firstServiceError(servicesIn);
      if (err) {
        return NextResponse.json({ error: err }, { status: 400 });
      }
      const normalized = servicesIn
        .map(normalizeService)
        .filter(Boolean) as Array<any>;
      if (!normalized.length) {
        return NextResponse.json(
          { error: "Service is required" },
          { status: 400 }
        );
      }
      set["onboarding.services"] = normalized;
    }

    if (daysIn) {
      const normalized = daysIn
        .map(normalizeAvailabilityDay)
        .filter(Boolean) as Array<any>;

      const err = validateAvailabilityDays(normalized as any);
      if (err) {
        return NextResponse.json({ error: err }, { status: 400 });
      }

      set["onboarding.availability.days"] = normalized;
    }

    // Branding (legacy + Cloudinary-compatible)
    if (brandingLogoRaw !== undefined) {
      const logo = normalizeBrandingLogo(brandingLogoRaw);
      if (logo) {
        set["onboarding.branding.logo"] = logo;
      }
    }

    if (brandingLogoUrlRaw !== undefined) {
      // Legacy support (local or https). Prefer Cloudinary object elsewhere.
      const url =
        asUrlPath(brandingLogoUrlRaw, 500) ??
        asHttpUrl(brandingLogoUrlRaw, 500);
      if (url) set["onboarding.branding.logoUrl"] = url;
    }

    if (brandingGalleryRaw !== undefined) {
      // Accept either legacy string[] or object[]
      const gallery = normalizeBrandingGallery(brandingGalleryRaw);
      if (gallery) set["onboarding.branding.gallery"] = gallery;
    }

    // NOTE: Branding validation is handled above in the Cloudinary-compatible blocks.

    set["onboarding.updatedAt"] = new Date();

    const c = await collections();
    const update: any = {
      $set: set,
      $setOnInsert: { onboardingCompleted: false },
    };
    if (Object.keys(unset).length) update.$unset = unset;
    await c.users.updateOne({ _id: new ObjectId(appUser.id) }, update, {
      upsert: false,
    });

    const updated = await c.users.findOne({ _id: new ObjectId(appUser.id) });
    return NextResponse.json({
      ok: true,
      onboardingCompleted: Boolean((updated as any)?.onboardingCompleted),
      onboarding: (updated as any)?.onboarding ?? {},
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
