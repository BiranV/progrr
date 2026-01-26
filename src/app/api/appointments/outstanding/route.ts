import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";
import { formatDateInTimeZone } from "@/lib/public-booking";

function ymdToUtcDate(ymd: string): Date {
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(ymd || ""));
    if (!m) return new Date("Invalid");
    const y = Number(m[1]);
    const mm = Number(m[2]);
    const d = Number(m[3]);
    return new Date(Date.UTC(y, mm - 1, d));
}

export async function GET() {
    try {
        const user = await requireAppUser();
        await ensureIndexes();

        const c = await collections();
        const businessUserId = new ObjectId(user.id);

        const owner = await c.users.findOne({ _id: businessUserId } as any, {
            projection: { "onboarding.availability.timezone": 1, "onboarding.business.currency": 1, "onboarding.customCurrency": 1, "onboarding.currency": 1 },
        });

        const timeZone =
            String((owner as any)?.onboarding?.availability?.timezone ?? "").trim() ||
            "UTC";

        const todayStr = formatDateInTimeZone(new Date(), timeZone);
        const todayUtc = ymdToUtcDate(todayStr);

        const items = await c.appointments
            .find(
                {
                    businessUserId,
                    status: "COMPLETED",
                    paymentStatus: { $ne: "PAID" },
                } as any,
                {
                    projection: {
                        date: 1,
                        serviceName: 1,
                        price: 1,
                        currency: 1,
                        customer: 1,
                    },
                }
            )
            .sort({ date: -1, startTime: -1 })
            .limit(200)
            .toArray();

        const rows = items.map((a: any) => {
            const dateStr = String(a?.date ?? "");
            const apptUtc = ymdToUtcDate(dateStr);
            const daysSince =
                Number.isFinite(apptUtc.getTime()) && Number.isFinite(todayUtc.getTime())
                    ? Math.max(
                        0,
                        Math.floor((todayUtc.getTime() - apptUtc.getTime()) / 86_400_000)
                    )
                    : 0;
            return {
                id: a?._id?.toHexString?.() ?? "",
                date: dateStr,
                customerName: String(a?.customer?.fullName ?? ""),
                serviceName: String(a?.serviceName ?? ""),
                price: Number(a?.price ?? 0) || 0,
                currency: String(a?.currency ?? ""),
                daysSinceCompleted: daysSince,
            };
        });

        const totalAmount = rows.reduce((sum, r) => sum + (Number(r.price) || 0), 0);

        return NextResponse.json({
            ok: true,
            timeZone,
            todayStr,
            count: rows.length,
            totalAmount,
            items: rows,
        });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
