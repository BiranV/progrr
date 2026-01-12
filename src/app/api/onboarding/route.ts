import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";

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
    if (!durationMinutes || durationMinutes <= 0 || durationMinutes > 24 * 60) return null;
    if (price !== undefined && (price < 0 || price > 1_000_000)) return null;

    return { id, name, durationMinutes, price };
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

        const businessType = asString(body?.businessType, 60);

        const businessName = asString(body?.business?.name, 120);
        const businessPhone = asString(body?.business?.phone, 40);
        const businessAddress = asString(body?.business?.address, 200);

        const timezone = asString(body?.availability?.timezone, 80);

        const servicesIn = Array.isArray(body?.services) ? body.services : undefined;
        const daysIn = Array.isArray(body?.availability?.days)
            ? body.availability.days
            : undefined;

        const set: any = {};

        if (businessType !== undefined) set["onboarding.businessType"] = businessType;

        if (businessName !== undefined) set["onboarding.business.name"] = businessName;
        if (businessPhone !== undefined) set["onboarding.business.phone"] = businessPhone;
        if (businessAddress !== undefined) set["onboarding.business.address"] = businessAddress;

        if (timezone !== undefined) set["onboarding.availability.timezone"] = timezone;

        if (servicesIn) {
            const normalized = servicesIn
                .map(normalizeService)
                .filter(Boolean) as Array<any>;
            set["onboarding.services"] = normalized;
        }

        if (daysIn) {
            const normalized = daysIn.map(normalizeDay).filter(Boolean) as Array<any>;
            set["onboarding.availability.days"] = normalized;
        }

        set["onboarding.updatedAt"] = new Date();

        const c = await collections();
        await c.users.updateOne(
            { _id: new ObjectId(appUser.id) },
            { $set: set, $setOnInsert: { onboardingCompleted: false } },
            { upsert: false }
        );

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
