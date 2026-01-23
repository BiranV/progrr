import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";
import { ensureBusinessSlugForUser } from "@/server/business-slug";
import { signAuthToken } from "@/server/jwt";
import { setAuthCookie } from "@/server/auth-cookie";
import { cloudinaryUrl, uploadImageBuffer } from "@/server/cloudinary-upload";
import { BUSINESS_TYPES } from "@/lib/onboardingPresets";

const ALLOWED_BUSINESS_TYPES = new Set(BUSINESS_TYPES.map((t) => t.key));
const OTHER_CURRENCY_CODE = "OTHER";
const ALLOWED_CURRENCIES = new Set(["ILS"]);

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_BANNER_BYTES = 5 * 1024 * 1024;
const MAX_GALLERY_BYTES = 5 * 1024 * 1024;
const MAX_GALLERY_COUNT = 10;

function isAllowedImageMime(mime: string) {
    const t = String(mime || "").toLowerCase();
    return t === "image/png" || t === "image/jpeg" || t === "image/webp";
}

function asString(v: unknown, maxLen = 200): string | undefined {
    const s = String(v ?? "").trim();
    if (!s) return undefined;
    return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function asNumber(v: unknown): number | undefined {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return undefined;
    return n;
}

function asBoolean(v: unknown): boolean | undefined {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "true") return true;
        if (s === "false") return false;
    }
    return undefined;
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
    if (!durationMinutes || durationMinutes < 10 || durationMinutes > 24 * 60) return null;
    if (price !== undefined && (price < 0 || price > 1_000_000)) return null;

    return { id, name, durationMinutes, price, description, isActive };
}

function firstServiceError(services: any[]): string | null {
    if (!Array.isArray(services) || services.length === 0) return "Service is required";

    const multi = services.length > 1;
    for (let i = 0; i < services.length; i++) {
        const s = services[i];
        const prefix = multi ? `Service ${i + 1} ` : "Service ";

        if (!String(s?.name ?? "").trim()) return `${prefix}name is required`;

        const durationMinutes = Number(s?.durationMinutes);
        if (!Number.isFinite(durationMinutes) || durationMinutes < 10) {
            return `${prefix}duration must be at least 10 minutes`;
        }

        const price = asNumber(s?.price);
        if (price !== undefined && (price < 0 || price > 1_000_000)) {
            return `${prefix}price is invalid`;
        }
    }

    return null;
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

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
    return aStart < bEnd && bStart < aEnd;
}

function normalizeAvailabilityRanges(input: any): Array<{ start: string; end: string }> {
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

    return { day, enabled, ranges: rangesIn };
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
}

export async function POST(req: Request) {
    try {
        await ensureIndexes();
        const appUser = await requireAppUser();
        const c = await collections();

        const user = await c.users.findOne({ _id: new ObjectId(appUser.id) });
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let payload: any = {};
        let logoFile: File | null = null;
        let bannerFile: File | null = null;
        let galleryFiles: File[] = [];

        const contentType = String(req.headers.get("content-type") || "");
        if (contentType.includes("multipart/form-data")) {
            const form = await req.formData();
            const payloadRaw = form.get("payload");
            if (typeof payloadRaw === "string") {
                try {
                    payload = JSON.parse(payloadRaw || "{}") ?? {};
                } catch {
                    return NextResponse.json(
                        { error: "Invalid payload" },
                        { status: 400 }
                    );
                }
            }

            const logoCandidate = form.get("logo");
            const bannerCandidate = form.get("banner");
            const galleryCandidates = form.getAll("gallery");

            logoFile = logoCandidate instanceof File ? logoCandidate : null;
            bannerFile = bannerCandidate instanceof File ? bannerCandidate : null;
            galleryFiles = galleryCandidates.filter((f) => f instanceof File) as File[];
        } else {
            payload = (await req.json().catch(() => ({}))) ?? {};
        }

        const onboarding = payload && typeof payload === "object" ? payload : {};
        const business = onboarding.business ?? {};
        const availability = onboarding.availability ?? {};

        const businessTypesRaw = Array.isArray(onboarding.businessTypes)
            ? onboarding.businessTypes
            : [];
        const legacyBusinessType = asString((onboarding as any)?.businessType, 60);
        const normalizedBusinessTypes = businessTypesRaw
            .map((v: any) => asString(v, 60))
            .filter(Boolean)
            .map((v: any) => String(v).toLowerCase())
            .filter((v: string) => ALLOWED_BUSINESS_TYPES.has(v))
            .slice(0, 1);
        if (!normalizedBusinessTypes.length && legacyBusinessType) {
            const legacy = legacyBusinessType.toLowerCase();
            if (ALLOWED_BUSINESS_TYPES.has(legacy)) {
                normalizedBusinessTypes.push(legacy);
            }
        }

        const currencyRaw = asString(onboarding.currency, 8);
        const currency = currencyRaw
            ? currencyRaw.toUpperCase() === "NIS"
                ? "ILS"
                : currencyRaw.toUpperCase()
            : "";

        if (currency && !ALLOWED_CURRENCIES.has(currency)) {
            return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
        }

        const customCurrencyName = asString(onboarding.customCurrency?.name, 40);
        const customCurrencySymbol = asString(onboarding.customCurrency?.symbol, 10);
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
        }

        const name = String(business.name ?? "").trim();
        const phone = String(business.phone ?? "").trim();
        const address = String(business.address ?? "").trim();
        const timezone = String(availability.timezone ?? "").trim();

        const missing: string[] = [];
        if (!name) missing.push("Name");
        if (!phone) missing.push("Phone");
        if (!address) missing.push("Address");
        if (!timezone) missing.push("Timezone");

        if (missing.length > 0) {
            return NextResponse.json(
                { error: `${missing[0]} is required` },
                { status: 400 }
            );
        }

        try {
            new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
        } catch {
            return NextResponse.json({ error: "Invalid time zone" }, { status: 400 });
        }

        const servicesIn = Array.isArray(onboarding.services)
            ? onboarding.services
            : [];
        const servicesErr = firstServiceError(servicesIn);
        if (servicesErr) {
            return NextResponse.json({ error: servicesErr }, { status: 400 });
        }

        const normalizedServices = servicesIn
            .map(normalizeService)
            .filter(Boolean) as Array<any>;
        if (!normalizedServices.length) {
            return NextResponse.json(
                { error: "Service is required" },
                { status: 400 }
            );
        }

        const daysIn = Array.isArray(availability.days) ? availability.days : [];
        const normalizedDays = daysIn
            .map(normalizeAvailabilityDay)
            .filter(Boolean) as Array<any>;
        const availabilityError = validateAvailabilityDays(normalizedDays as any);
        if (availabilityError) {
            return NextResponse.json({ error: availabilityError }, { status: 400 });
        }

        if (logoFile) {
            if (!isAllowedImageMime(logoFile.type)) {
                return NextResponse.json(
                    { error: "Logo must be a PNG, JPG, or WEBP image" },
                    { status: 400 }
                );
            }
            if (logoFile.size > MAX_LOGO_BYTES) {
                return NextResponse.json(
                    { error: "Logo is too large (max 2MB)" },
                    { status: 400 }
                );
            }
        }

        if (bannerFile) {
            if (!isAllowedImageMime(bannerFile.type)) {
                return NextResponse.json(
                    { error: "Banner must be a PNG, JPG, or WEBP image" },
                    { status: 400 }
                );
            }
            if (bannerFile.size > MAX_BANNER_BYTES) {
                return NextResponse.json(
                    { error: "Banner is too large (max 5MB)" },
                    { status: 400 }
                );
            }
        }

        if (galleryFiles.length > MAX_GALLERY_COUNT) {
            return NextResponse.json(
                { error: `Gallery limit reached (max ${MAX_GALLERY_COUNT})` },
                { status: 400 }
            );
        }

        for (const file of galleryFiles) {
            if (!isAllowedImageMime(file.type)) {
                return NextResponse.json(
                    { error: "Gallery images must be PNG, JPG, or WEBP" },
                    { status: 400 }
                );
            }
            if (file.size > MAX_GALLERY_BYTES) {
                return NextResponse.json(
                    { error: "Gallery image is too large (max 5MB)" },
                    { status: 400 }
                );
            }
        }

        const userId = String(appUser.id);
        const branding: any = {};

        if (logoFile) {
            const buffer = Buffer.from(await logoFile.arrayBuffer());
            const folder = `progrr/businesses/${userId}/logo`;
            const uploaded = await uploadImageBuffer(buffer, {
                folder,
                overwrite: true,
                unique_filename: true,
                resource_type: "image",
            });
            const publicId = String(uploaded.public_id ?? "").trim();
            const url = cloudinaryUrl(publicId, {
                width: 512,
                height: 512,
                crop: "fill",
            });
            branding.logo = {
                url,
                publicId,
                width: uploaded.width,
                height: uploaded.height,
                bytes: uploaded.bytes,
                format: uploaded.format,
            };
        }

        if (bannerFile) {
            const buffer = Buffer.from(await bannerFile.arrayBuffer());
            const folder = `progrr/businesses/${userId}/banner`;
            const uploaded = await uploadImageBuffer(buffer, {
                folder,
                overwrite: true,
                unique_filename: true,
                resource_type: "image",
            });
            const publicId = String(uploaded.public_id ?? "").trim();
            const url = cloudinaryUrl(publicId, {
                width: 1600,
                height: 560,
                crop: "fill",
            });
            branding.banner = {
                url,
                publicId,
                width: uploaded.width,
                height: uploaded.height,
                bytes: uploaded.bytes,
                format: uploaded.format,
            };
        }

        if (galleryFiles.length) {
            const gallery: Array<any> = [];
            for (const file of galleryFiles) {
                const buffer = Buffer.from(await file.arrayBuffer());
                const folder = `progrr/businesses/${userId}/gallery`;
                const uploaded = await uploadImageBuffer(buffer, {
                    folder,
                    overwrite: true,
                    unique_filename: true,
                    resource_type: "image",
                });
                const publicId = String(uploaded.public_id ?? "").trim();
                const url = cloudinaryUrl(publicId, { width: 1400, crop: "limit" });
                gallery.push({
                    url,
                    publicId,
                    width: uploaded.width,
                    height: uploaded.height,
                    bytes: uploaded.bytes,
                    format: uploaded.format,
                });
            }
            branding.gallery = gallery;
        }

        await ensureBusinessSlugForUser({
            userId: new ObjectId(appUser.id),
            businessName: name,
        });

        const limitCustomer = asBoolean(business?.limitCustomerToOneUpcomingAppointment);

        const onboardingUpdate: any = {
            business: {
                name,
                phone,
                address,
                limitCustomerToOneUpcomingAppointment: limitCustomer ?? false,
                ...(currency && currency !== OTHER_CURRENCY_CODE
                    ? { currency }
                    : {}),
            },
            availability: {
                timezone,
                weekStartsOn:
                    availability?.weekStartsOn === 0 || availability?.weekStartsOn === 1
                        ? availability.weekStartsOn
                        : 0,
                days: normalizedDays,
            },
            services: normalizedServices,
            currency: currency || "ILS",
            customCurrency:
                currency === OTHER_CURRENCY_CODE
                    ? { name: customCurrencyName, symbol: customCurrencySymbol }
                    : undefined,
            businessTypes: normalizedBusinessTypes,
            branding: Object.keys(branding).length ? branding : { gallery: [] },
            updatedAt: new Date(),
        };

        await c.users.updateOne(
            { _id: new ObjectId(appUser.id) },
            {
                $set: {
                    onboarding: onboardingUpdate,
                    onboardingCompleted: true,
                    onboardingCompletedAt: new Date(),
                },
            }
        );

        const token = await signAuthToken({
            sub: appUser.id,
            onboardingCompleted: true,
        });

        const res = NextResponse.json({
            ok: true,
            onboardingCompleted: true,
            onboarding: onboardingUpdate,
        });
        setAuthCookie(res, token);
        return res;
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
