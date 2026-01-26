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
        const isAllScope = scope === "all";

        if (!businessPublicId && !isAllScope) {
            return NextResponse.json(
                { error: "businessPublicId is required" },
                { status: 400 }
            );
        }
        if (businessPublicId && !isValidBusinessPublicId(businessPublicId)) {
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

        let claims: { customerId: string };
        try {
            const parsed = await verifyCustomerAccessToken(token);
            claims = {
                customerId: parsed.customerId,
            };
        } catch {
            return NextResponse.json({ ok: true, loggedIn: false });
        }

        const c = await collections();
        const customerObjectId = ObjectId.isValid(claims.customerId)
            ? new ObjectId(claims.customerId)
            : null;
        if (!customerObjectId) {
            return NextResponse.json({ ok: true, loggedIn: false });
        }

        const customer = await c.customers.findOne({ _id: customerObjectId } as any);
        if (!customer) {
            return NextResponse.json({ ok: true, loggedIn: false });
        }

        const isFutureScope = scope === "future";

        if (isAllScope) {
            const appointments = await c.appointments
                .find(
                    isFutureScope
                        ? {
                            status: "BOOKED",
                            customerId: customerObjectId,
                        }
                        : {
                            status: { $in: ["BOOKED", "COMPLETED"] },
                            customerId: customerObjectId,
                        },
                    {
                        projection: {
                            businessUserId: 1,
                            date: 1,
                            startTime: 1,
                            endTime: 1,
                            serviceName: 1,
                            status: 1,
                            cancelledBy: 1,
                        },
                    }
                )
                .sort({ date: 1, startTime: 1 })
                .limit(100)
                .toArray();

            const businessIds = Array.from(
                new Set(
                    appointments
                        .map((a: any) => a?.businessUserId)
                        .filter((id: any) => id && ObjectId.isValid(id))
                        .map((id: any) => String(id))
                )
            );

            const businesses = businessIds.length
                ? await c.users
                    .find(
                        { _id: { $in: businessIds.map((id) => new ObjectId(id)) } } as any,
                        { projection: { "onboarding.business.name": 1 } }
                    )
                    .toArray()
                : [];

            const businessNameById = new Map<string, string>();
            for (const b of businesses as any[]) {
                const id = b?._id?.toHexString?.() ?? "";
                if (!id) continue;
                const name = String((b as any)?.onboarding?.business?.name ?? "").trim();
                if (name) businessNameById.set(id, name);
            }

            return NextResponse.json({
                ok: true,
                loggedIn: true,
                scope: "all",
                customer: {
                    email: typeof (customer as any)?.email === "string" ? (customer as any).email : undefined,
                    fullName: typeof (customer as any)?.fullName === "string" ? (customer as any).fullName : undefined,
                    phone: typeof (customer as any)?.phone === "string" ? (customer as any).phone : undefined,
                },
                appointments: appointments.map((a: any) => ({
                    id: a?._id?.toHexString?.() ?? "",
                    businessUserId: a?.businessUserId?.toHexString?.() ?? "",
                    businessName: businessNameById.get(
                        a?.businessUserId?.toHexString?.() ?? ""
                    ),
                    date: String(a?.date ?? ""),
                    startTime: String(a?.startTime ?? ""),
                    endTime: String(a?.endTime ?? ""),
                    serviceName: String(a?.serviceName ?? ""),
                    status: String(a?.status ?? ""),
                    cancelledBy: a?.cancelledBy,
                })),
            });
        }

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

        const onboarding = (user as any).onboarding ?? {};
        const timeZone =
            String((onboarding as any)?.availability?.timezone ?? "").trim() || "UTC";

        const todayStr = formatDateInTimeZone(new Date(), timeZone);
        const nowTimeStr = formatTimeInTimeZone(new Date(), timeZone);

        const date = isValidDateString(dateParam)
            ? dateParam
            : todayStr;

        const appointments = await c.appointments
            .find(
                (isFutureScope
                    ? {
                        businessUserId: user._id as ObjectId,
                        status: "BOOKED",
                        customerId: customerObjectId,
                        $or: [
                            { date: { $gt: todayStr } },
                            { date: todayStr, endTime: { $gt: nowTimeStr } },
                        ],
                    }
                    : {
                        businessUserId: user._id as ObjectId,
                        date,
                        status: { $in: ["BOOKED", "COMPLETED"] },
                        customerId: customerObjectId,
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
                email: typeof (customer as any)?.email === "string" ? (customer as any).email : undefined,
                fullName:
                    typeof (customer as any)?.fullName === "string"
                        ? (customer as any).fullName
                        : undefined,
                phone: typeof (customer as any)?.phone === "string" ? (customer as any).phone : undefined,
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
