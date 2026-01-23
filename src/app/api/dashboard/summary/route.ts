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
        let todayStr: string;
        try {
            todayStr = formatDateInTimeZone(now, timeZone);
        } catch {
            todayStr = formatDateInTimeZone(now, "UTC");
        }
        const nowTimeStr = formatTimeInTimeZone(now, timeZone);

        const onboarding = (owner as any)?.onboarding ?? {};
        const business = onboarding?.business ?? {};
        const currencyCodeRaw =
            String(business.currency ?? "").trim() ||
            String(onboarding.currency ?? "").trim() ||
            "ILS";
        const currencyCode =
            currencyCodeRaw.toUpperCase() === "NIS" ? "ILS" : currencyCodeRaw;
        const customCurrency = onboarding.customCurrency ?? undefined;

        const currencySymbol = (code: string): string => {
            const normalized = String(code || "").trim().toUpperCase();
            const canonical = normalized === "NIS" ? "ILS" : normalized;
            return canonical === "ILS" ? "₪" : "";
        };

        // Keep appointment statuses in sync: if a booked appointment has passed, mark it completed.
        await Promise.all([
            // Any previous day bookings are definitely completed.
            c.appointments.updateMany(
                {
                    businessUserId,
                    status: "BOOKED",
                    date: { $lt: todayStr },
                } as any,
                { $set: { status: "COMPLETED" } }
            ),
            // Today's bookings become completed once their end time has passed.
            c.appointments.updateMany(
                {
                    businessUserId,
                    status: "BOOKED",
                    date: todayStr,
                    endTime: { $lte: nowTimeStr },
                } as any,
                { $set: { status: "COMPLETED" } }
            ),
        ]);

        const [todayAppointmentsCount, upcomingAppointmentsCount, totalCustomersCount, revenueAgg] =
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
                        // Only remaining appointments *today*.
                        date: todayStr,
                        endTime: { $gt: nowTimeStr },
                    } as any
                ),
                c.businessCustomers.countDocuments({
                    businessUserId,
                    isHidden: { $ne: true },
                } as any),
                c.appointments
                    .aggregate([
                        {
                            $match: {
                                businessUserId,
                                status: "COMPLETED",
                                date: todayStr,
                            },
                        },
                        {
                            $group: {
                                _id: null,
                                revenue: { $sum: "$price" },
                                completedCount: { $sum: 1 },
                            },
                        },
                    ])
                    .toArray(),
            ]);

        const revenueRow = Array.isArray(revenueAgg) ? (revenueAgg[0] as any) : null;
        const revenueToday = Number.isFinite(Number(revenueRow?.revenue))
            ? Number(revenueRow.revenue)
            : 0;
        const completedAppointmentsCount = Number.isFinite(Number(revenueRow?.completedCount))
            ? Number(revenueRow.completedCount)
            : 0;

        const availability = (owner as any)?.onboarding?.availability ?? {};
        const openNow = isOpenNowFromAvailability({ now, timeZone, availability });

        return NextResponse.json({
            ok: true,
            todayStr,
            todayAppointmentsCount,
            upcomingAppointmentsCount,
            totalCustomersCount,
            revenueToday,
            completedAppointmentsCount,
            currency: {
                code: currencyCode,
                symbol:
                    currencyCode === "OTHER"
                        ? String(customCurrency?.symbol ?? "").trim()
                        : currencySymbol(currencyCode),
                ...(currencyCode === "OTHER"
                    ? { name: String(customCurrency?.name ?? "").trim() }
                    : {}),
            },
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
