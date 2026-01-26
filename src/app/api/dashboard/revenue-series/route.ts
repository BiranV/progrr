import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";
import { formatDateInTimeZone } from "@/lib/public-booking";

function isIntString(v: string): boolean {
    return /^-?\d+$/.test(String(v ?? "").trim());
}

function parseIntSafe(v: string, fallback = 0): number {
    if (!isIntString(v)) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

function isYmd(v: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "").trim());
}

function ymdToUtcDate(ymd: string): Date {
    const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(ymd);
    if (!m) return new Date(Date.UTC(1970, 0, 1));
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return new Date(Date.UTC(y, mo - 1, d));
}

function utcDateToYmd(d: Date): string {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    return `${y}-${pad2(m)}-${pad2(day)}`;
}

function addDaysUtc(d: Date, days: number): Date {
    const copy = new Date(d.getTime());
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
}

function startOfMonthUtc(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addMonthsUtc(d: Date, months: number): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
}

function endOfMonthUtc(d: Date): Date {
    // d is any date in month
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

type Point = { date: string; revenue: number; completedCount: number };

export async function GET(req: Request) {
    try {
        const user = await requireAppUser();
        await ensureIndexes();

        const url = new URL(req.url);
        const period = String(url.searchParams.get("period") ?? "week").trim();
        const offsetRaw = String(url.searchParams.get("offset") ?? "0").trim();
        const offset = parseIntSafe(offsetRaw, 0);

        if (period !== "week" && period !== "month") {
            return NextResponse.json(
                { error: "Invalid period (expected week|month)" },
                { status: 400 }
            );
        }

        const c = await collections();
        const businessUserId = new ObjectId(user.id);

        const owner = await c.users.findOne({ _id: businessUserId } as any, {
            projection: { "onboarding.availability.timezone": 1 },
        });

        const tz = String((owner as any)?.onboarding?.availability?.timezone ?? "").trim() || "UTC";

        let todayStr = "";
        try {
            todayStr = formatDateInTimeZone(new Date(), tz);
        } catch {
            todayStr = formatDateInTimeZone(new Date(), "UTC");
        }

        if (!isYmd(todayStr)) {
            return NextResponse.json(
                { error: "Failed to determine business date" },
                { status: 500 }
            );
        }

        let fromUtc: Date;
        let toUtc: Date;

        if (period === "week") {
            // Last 7 days window anchored to the business's current day.
            // offset=-1 => previous 7-day window, offset=+1 => next.
            const anchor = addDaysUtc(ymdToUtcDate(todayStr), offset * 7);
            const start = addDaysUtc(anchor, -6);
            fromUtc = start;
            toUtc = anchor;
        } else {
            // Full month view anchored to current business month.
            const anchorMonth = addMonthsUtc(startOfMonthUtc(ymdToUtcDate(todayStr)), offset);
            fromUtc = startOfMonthUtc(anchorMonth);
            toUtc = endOfMonthUtc(anchorMonth);
        }

        const from = utcDateToYmd(fromUtc);
        const to = utcDateToYmd(toUtc);

        const agg = await c.appointments
            .aggregate([
                {
                    $match: {
                        businessUserId,
                        status: "COMPLETED",
                        paymentStatus: "PAID",
                        date: { $gte: from, $lte: to },
                    },
                },
                {
                    $group: {
                        _id: "$date",
                        revenue: { $sum: "$price" },
                        completedCount: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ])
            .toArray();

        const byDate = new Map<string, { revenue: number; completedCount: number }>();
        for (const row of agg as any[]) {
            const key = String(row?._id ?? "");
            if (!isYmd(key)) continue;
            byDate.set(key, {
                revenue: Number(row?.revenue ?? 0) || 0,
                completedCount: Number(row?.completedCount ?? 0) || 0,
            });
        }

        const points: Point[] = [];
        for (let d = new Date(fromUtc.getTime()); d.getTime() <= toUtc.getTime(); d = addDaysUtc(d, 1)) {
            const ymd = utcDateToYmd(d);
            const hit = byDate.get(ymd);
            points.push({
                date: ymd,
                revenue: hit?.revenue ?? 0,
                completedCount: hit?.completedCount ?? 0,
            });
        }

        const totalRevenue = points.reduce((sum, p) => sum + (Number(p.revenue) || 0), 0);

        return NextResponse.json({
            ok: true,
            period,
            offset,
            from,
            to,
            timeZone: tz,
            totalRevenue,
            points,
        });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
