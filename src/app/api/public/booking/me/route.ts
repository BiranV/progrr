import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { isValidBusinessPublicId } from "@/server/business-public-id";
import { CUSTOMER_ACCESS_COOKIE_NAME } from "@/server/customer-access";
import { verifyCustomerAccessToken } from "@/server/jwt";
import { formatDateInTimeZone } from "@/lib/public-booking";

function isValidDateString(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
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
        await ensureIndexes();

        const url = new URL(req.url);
        const businessPublicId = String(
            url.searchParams.get("businessPublicId") ?? ""
        ).trim();
        const dateParam = String(url.searchParams.get("date") ?? "").trim();
        const scope = String(url.searchParams.get("scope") ?? "").trim().toLowerCase();

        if (!businessPublicId) {
            return NextResponse.json(
                { error: "businessPublicId is required" },
                { status: 400 }
            );
        }
        if (!isValidBusinessPublicId(businessPublicId)) {
            return NextResponse.json(
                { error: "Invalid businessPublicId" },
                { status: 400 }
            );
        }

        const cookieStore = await cookies();
        const token = cookieStore.get(CUSTOMER_ACCESS_COOKIE_NAME)?.value;
        if (!token) {
            return NextResponse.json({ ok: true, loggedIn: false });
        }

        let claims: { customerId: string; businessUserId: string };
        try {
            const parsed = await verifyCustomerAccessToken(token);
            claims = {
                customerId: parsed.customerId,
                businessUserId: parsed.businessUserId,
            };
        } catch {
            return NextResponse.json({ ok: true, loggedIn: false });
        }

        const c = await collections();
        const user = await c.users.findOne({
            "onboarding.business.publicId": businessPublicId,
            onboardingCompleted: true,
        } as any);

        if (!user?._id) {
            return NextResponse.json(
                { error: "Business not found" },
                { status: 404 }
            );
        }

        const businessUserId = (user._id as ObjectId).toHexString();
        if (claims.businessUserId !== businessUserId) {
            return NextResponse.json({ ok: true, loggedIn: false });
        }

        const onboarding = (user as any).onboarding ?? {};
        const timeZone =
            String((onboarding as any)?.availability?.timezone ?? "").trim() || "UTC";

        const todayStr = formatDateInTimeZone(new Date(), timeZone);
        const nowTimeStr = formatTimeInTimeZone(new Date(), timeZone);

        const isFutureScope = scope === "future";

        const date = isValidDateString(dateParam)
            ? dateParam
            : todayStr;

        const lastAppointment = await c.appointments.findOne(
            {
                businessUserId: user._id as ObjectId,
                "customer.id": claims.customerId,
            } as any,
            {
                sort: { date: -1, startTime: -1 },
                projection: { customer: 1 },
            }
        );

        const lastCustomer = (lastAppointment as any)?.customer ?? null;

        const appointments = await c.appointments
            .find(
                (isFutureScope
                    ? {
                        businessUserId: user._id as ObjectId,
                        status: "BOOKED",
                        "customer.id": claims.customerId,
                        $or: [
                            { date: { $gt: todayStr } },
                            { date: todayStr, endTime: { $gt: nowTimeStr } },
                        ],
                    }
                    : {
                        businessUserId: user._id as ObjectId,
                        date,
                        status: { $in: ["BOOKED", "COMPLETED"] },
                        "customer.id": claims.customerId,
                    }) as any,
                {
                    projection: {
                        date: 1,
                        startTime: 1,
                        endTime: 1,
                        serviceName: 1,
                        status: 1,
                        cancelledBy: 1,
                    },
                }
            )
            .sort(isFutureScope ? ({ date: 1, startTime: 1 } as any) : ({ startTime: 1 } as any))
            .limit(50)
            .toArray();

        return NextResponse.json({
            ok: true,
            loggedIn: true,
            date: isFutureScope ? todayStr : date,
            scope: isFutureScope ? "future" : "day",
            customer: {
                email: typeof lastCustomer?.email === "string" ? lastCustomer.email : undefined,
                fullName:
                    typeof lastCustomer?.fullName === "string"
                        ? lastCustomer.fullName
                        : undefined,
                phone: typeof lastCustomer?.phone === "string" ? lastCustomer.phone : undefined,
            },
            appointments: appointments.map((a: any) => ({
                id: a?._id?.toHexString?.() ?? "",
                date: String(a?.date ?? ""),
                startTime: String(a?.startTime ?? ""),
                endTime: String(a?.endTime ?? ""),
                serviceName: String(a?.serviceName ?? ""),
                status: String(a?.status ?? ""),
                cancelledBy: a?.cancelledBy,
            })),
        });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
