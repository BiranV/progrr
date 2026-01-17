import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";
import { formatDateInTimeZone } from "@/lib/public-booking";

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

function weekdayInTimeZone(date: Date, timeZone: string): number {
    const tz = String(timeZone || "UTC").trim() || "UTC";
    const map: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
    };

    try {
        const wd = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            weekday: "short",
        }).format(date);
        return map[String(wd).trim()] ?? 0;
    } catch {
        const wd = new Intl.DateTimeFormat("en-US", {
            timeZone: "UTC",
            weekday: "short",
        }).format(date);
        return map[String(wd).trim()] ?? 0;
    }
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

function isOpenNowFromAvailability(args: {
    now: Date;
    timeZone: string;
    availability: any;
}): boolean {
    const { now, timeZone, availability } = args;

    const dayIndex = weekdayInTimeZone(now, timeZone);
    const nowTime = formatTimeInTimeZone(now, timeZone);
    const nowMin = parseTimeToMinutes(nowTime);
    if (!Number.isFinite(nowMin)) return false;

    const days = Array.isArray(availability?.days) ? availability.days : [];
    const today = days.find((d: any) => Number(d?.day) === dayIndex);
    if (!today || today.enabled === false) return false;

    const rangesRaw = Array.isArray((today as any).ranges)
        ? (today as any).ranges
        : [];

    const ranges: Array<{ start: string; end: string }> = rangesRaw
        .map((r: any) => ({
            start: String(r?.start ?? "").trim(),
            end: String(r?.end ?? "").trim(),
        }))
        .filter((r: any) => /^\d{2}:\d{2}$/.test(r.start) && /^\d{2}:\d{2}$/.test(r.end) && r.start < r.end);

    if (ranges.length === 0) {
        const legacyStart = String((today as any)?.start ?? "").trim();
        const legacyEnd = String((today as any)?.end ?? "").trim();
        if (/^\d{2}:\d{2}$/.test(legacyStart) && /^\d{2}:\d{2}$/.test(legacyEnd) && legacyStart < legacyEnd) {
            ranges.push({ start: legacyStart, end: legacyEnd });
        }
    }

    if (ranges.length === 0) return false;

    for (const r of ranges) {
        const startMin = parseTimeToMinutes(r.start);
        const endMin = parseTimeToMinutes(r.end);
        if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) continue;
        // Treat end time as inclusive (e.g. 09:00–16:00 is still open at 16:00,
        // and becomes closed at 16:01).
        if (startMin <= nowMin && nowMin <= endMin) return true;
    }

    return false;
}

export async function GET() {
    try {
        const user = await requireAppUser();
        await ensureIndexes();

        const c = await collections();
        const businessUserId = new ObjectId(user.id);

        const owner = await c.users.findOne({ _id: businessUserId });
        if (!owner) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const timeZone =
            String((owner as any)?.onboarding?.availability?.timezone ?? "").trim() ||
            "UTC";

        const now = new Date();
        const todayStr = formatDateInTimeZone(now, timeZone);
        const nowTimeStr = formatTimeInTimeZone(now, timeZone);

        const [todayAppointmentsCount, upcomingAppointmentsCount, totalCustomersCount] =
            await Promise.all([
                c.appointments.countDocuments({
                    businessUserId,
                    status: "BOOKED",
                    date: todayStr,
                } as any),
                c.appointments.countDocuments(
                    {
                        businessUserId,
                        status: "BOOKED",
                        $or: [
                            { date: { $gt: todayStr } },
                            { date: todayStr, endTime: { $gt: nowTimeStr } },
                        ],
                    } as any
                ),
                c.customers.countDocuments({
                    businessUserId,
                    isHidden: { $ne: true },
                } as any),
            ]);

        const availability = (owner as any)?.onboarding?.availability ?? {};
        const openNow = isOpenNowFromAvailability({ now, timeZone, availability });

        return NextResponse.json({
            ok: true,
            todayStr,
            todayAppointmentsCount,
            upcomingAppointmentsCount,
            totalCustomersCount,
            businessStatus: {
                isOpenNow: openNow,
                label: openNow ? "Open" : "Closed",
                timeZone,
            },
        });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
