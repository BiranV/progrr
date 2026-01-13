import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";

const ALLOWED_BUSINESS_TYPES = new Set([
  "salon",
  "barbershop",
  "fitness",
  "therapy",
  "consulting",
  "other",
]);

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

function normalizeGallery(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    const p = asUrlPath(item, 500);
    if (!p) continue;
    out.push(p);
  }
  return Array.from(new Set(out)).slice(0, 10);
}

function asNumber(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function normalizeDay(d: any) {
  const day = Number(d?.day);
  if (!Number.isInteger(day) || day < 0 || day > 6) return null;

  const enabled = Boolean(d?.enabled);
  const start = asString(d?.start, 10);
  const end = asString(d?.end, 10);

  return { day, enabled, start, end };
}

function normalizeService(s: any) {
  const id = asString(s?.id, 64) ?? crypto.randomUUID();
  const name = asString(s?.name, 80);
  const durationMinutes = asNumber(s?.durationMinutes);
  const price = asNumber(s?.price);

  if (!name) return null;
  if (!durationMinutes || durationMinutes <= 0 || durationMinutes > 24 * 60)
    return null;
  if (price !== undefined && (price < 0 || price > 1_000_000)) return null;

  return { id, name, durationMinutes, price };
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
      } else {
        unset["onboarding.customCurrency"] = "";
      }

      set["onboarding.currency"] = currency;
    }

    if (businessTypesRaw !== undefined) {
      const normalized = businessTypesRaw
        .map((v: any) => asString(v, 60))
        .filter(Boolean)
        .map((v: any) => String(v).toLowerCase())
        .filter((v: string) => ALLOWED_BUSINESS_TYPES.has(v));
      set["onboarding.businessTypes"] = Array.from(new Set(normalized));
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
      const normalized = daysIn.map(normalizeDay).filter(Boolean) as Array<any>;
      set["onboarding.availability.days"] = normalized;
    }

    if (brandingLogoUrlRaw !== undefined) {
      const logoUrl = asUrlPath(brandingLogoUrlRaw, 500);
      if (logoUrl) {
        set["onboarding.branding.logoUrl"] = logoUrl;
      } else {
        unset["onboarding.branding.logoUrl"] = "";
      }
    }

    if (brandingGalleryRaw !== undefined) {
      const gallery = normalizeGallery(brandingGalleryRaw);
      if (!gallery) {
        return NextResponse.json({ error: "Invalid gallery" }, { status: 400 });
      }
      set["onboarding.branding.gallery"] = gallery;
    }

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
