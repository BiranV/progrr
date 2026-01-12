import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { normalizePhone, isLikelyValidPhone } from "@/server/phone";
import {
    computeAvailableSlots,
    parseTimeToMinutes,
    minutesToTime,
} from "@/server/booking/slots";
import { verifyBookingVerifyToken, signBookingCancelToken } from "@/server/jwt";

function isValidDateString(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isValidTimeString(s: string): boolean {
    return /^\d{2}:\d{2}$/.test(s);
}

function normalizeSlug(input: string): string {
    return String(input ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function POST(req: Request) {
    try {
        await ensureIndexes();

        const body = await req.json().catch(() => ({}));

        const businessSlugOrId = String(body?.businessSlugOrId ?? "").trim();
        const serviceId = String(body?.serviceId ?? "").trim();
        const date = String(body?.date ?? "").trim();
        const startTime = String(body?.startTime ?? "").trim();

        const customerFullName = String(body?.customerFullName ?? "").trim();
        const customerPhone = normalizePhone(body?.customerPhone);
        const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

        const bookingSessionId = String(body?.bookingSessionId ?? "").trim();

        if (!bookingSessionId) {
            return NextResponse.json(
                { error: "Phone verification required" },
                { status: 401 }
            );
        }

        const claims = await verifyBookingVerifyToken(bookingSessionId);

        if (!businessSlugOrId) {
            return NextResponse.json(
                { error: "businessSlugOrId is required" },
                { status: 400 }
            );
        }
        if (!serviceId) {
            return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
        }
        if (!isValidDateString(date)) {
            return NextResponse.json({ error: "Invalid date" }, { status: 400 });
        }
        if (!isValidTimeString(startTime)) {
            return NextResponse.json({ error: "Invalid startTime" }, { status: 400 });
        }
        if (!customerFullName) {
            return NextResponse.json(
                { error: "Full Name is required" },
                { status: 400 }
            );
        }
        if (!customerPhone) {
            return NextResponse.json({ error: "Phone is required" }, { status: 400 });
        }
        if (!isLikelyValidPhone(customerPhone)) {
            return NextResponse.json(
                { error: "Please enter a valid phone number" },
                { status: 400 }
            );
        }

        if (normalizePhone(claims.phone) !== customerPhone) {
            return NextResponse.json(
                { error: "Phone verification mismatch" },
                { status: 401 }
            );
        }

        const slug = normalizeSlug(businessSlugOrId);
        if (!slug) {
            return NextResponse.json({ error: "Business not found" }, { status: 404 });
        }

        const c = await collections();
        const user = await c.users.findOne({
            "onboarding.business.slug": slug,
            onboardingCompleted: true,
        } as any);

        if (!user) {
            return NextResponse.json({ error: "Business not found" }, { status: 404 });
        }

        const onboarding = (user as any).onboarding ?? {};
        const services: any[] = Array.isArray(onboarding.services)
            ? onboarding.services
            : [];

        const service = services.find((s) => String(s?.id ?? "") === serviceId);
        if (!service) {
            return NextResponse.json({ error: "Service not found" }, { status: 404 });
        }

        const durationMinutes = Number(service?.durationMinutes);
        const price = Number(service?.price);
        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
            return NextResponse.json(
                { error: "Invalid service duration" },
                { status: 400 }
            );
        }
        if (!Number.isFinite(price) || price < 0) {
            return NextResponse.json({ error: "Invalid price" }, { status: 400 });
        }

        const booked = await c.appointments
            .find({
                businessUserId: user._id as ObjectId,
                date,
                status: "BOOKED",
            })
            .toArray();

        const slots = computeAvailableSlots({
            date,
            durationMinutes,
            onboardingAvailability: onboarding.availability,
            bookedAppointments: booked,
        });

        const requested = slots.find((s) => s.startTime === startTime);
        if (!requested) {
            return NextResponse.json(
                { error: "Selected time is no longer available" },
                { status: 409 }
            );
        }

        const startMin = parseTimeToMinutes(startTime);
        const endMin = startMin + durationMinutes;
        const endTime = minutesToTime(endMin);

        const currency = String(onboarding.currency ?? "").trim() || "USD";

        try {
            const insert = await c.appointments.insertOne({
                businessUserId: user._id as ObjectId,
                serviceId,
                serviceName: String(service?.name ?? "").trim(),
                durationMinutes,
                price,
                currency,
                date,
                startTime,
                endTime,
                customer: {
                    fullName: customerFullName,
                    phone: customerPhone,
                },
                ...(notes ? { notes } : {}),
                status: "BOOKED",
                createdAt: new Date(),
            } as any);

            const appointmentId = insert.insertedId.toHexString();
            const cancelToken = await signBookingCancelToken({
                appointmentId,
                phone: customerPhone,
            });

            return NextResponse.json({
                ok: true,
                appointment: {
                    id: appointmentId,
                    serviceId,
                    serviceName: String(service?.name ?? "").trim(),
                    durationMinutes,
                    price,
                    currency,
                    date,
                    startTime,
                    endTime,
                    customer: {
                        fullName: customerFullName,
                        phone: customerPhone,
                    },
                    notes: notes || undefined,
                    status: "BOOKED",
                },
                cancelToken,
            });
        } catch (e: any) {
            // Duplicate booking due to race.
            if (e?.code === 11000) {
                return NextResponse.json(
                    { error: "Selected time is no longer available" },
                    { status: 409 }
                );
            }
            throw e;
        }
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
