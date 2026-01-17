import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";
import { computeAvailableSlots } from "@/server/booking/slots";
import { formatDateInTimeZone } from "@/lib/public-booking";

function isValidDateString(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
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

export async function GET(req: Request) {
    try {
        const user = await requireAppUser();
        await ensureIndexes();

        const url = new URL(req.url);
        const date = String(url.searchParams.get("date") ?? "").trim();
        const serviceId = String(url.searchParams.get("serviceId") ?? "").trim();

        if (!isValidDateString(date)) {
            return NextResponse.json({ error: "Invalid date" }, { status: 400 });
        }
        if (!serviceId) {
            return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
        }

        const c = await collections();
        const businessUserId = new ObjectId(user.id);

        const owner = await c.users.findOne({ _id: businessUserId } as any);
        if (!owner) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const onboarding = (owner as any)?.onboarding ?? {};
        const services = Array.isArray((onboarding as any)?.services)
            ? ((onboarding as any).services as any[])
            : [];

        const service = services.find((s) => String(s?.id ?? "").trim() === serviceId);
        if (!service || service?.isActive === false) {
            return NextResponse.json({ error: "Service not found" }, { status: 404 });
        }

        const durationMinutes = Number(service?.durationMinutes);
        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
            return NextResponse.json({ error: "Invalid service duration" }, { status: 400 });
        }

        const timeZone = String(onboarding?.availability?.timezone ?? "").trim() || "UTC";
        const todayStr = formatDateInTimeZone(new Date(), timeZone);
        const nowTimeStr = formatTimeInTimeZone(new Date(), timeZone);

        if (date < todayStr) {
            return NextResponse.json({ ok: true, date, timeZone, slots: [] }, { status: 200 });
        }

        const booked = await c.appointments
            .find({ businessUserId, date, status: "BOOKED" } as any)
            .toArray();

        let slots = computeAvailableSlots({
            date,
            durationMinutes,
            onboardingAvailability: onboarding.availability,
            bookedAppointments: booked,
        });

        if (date === todayStr) {
            slots = slots.filter((s) => String((s as any)?.startTime ?? "") > nowTimeStr);
        }

        return NextResponse.json({ ok: true, date, timeZone, slots }, { status: 200 });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
