import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";
import { normalizePhone, isLikelyValidPhone } from "@/server/phone";
import {
    computeAvailableSlots,
    minutesToTime,
    parseTimeToMinutes,
} from "@/server/booking/slots";
import { formatDateInTimeZone } from "@/lib/public-booking";
import { sendEmail } from "@/server/email";
import { buildAppointmentBookedEmail } from "@/server/emails/booking";
import { isValidEmail, normalizeEmail } from "@/lib/email";

function isValidDateString(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function isValidTimeString(s: string): boolean {
    return /^\d{2}:\d{2}$/.test(String(s || "").trim());
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

export async function POST(req: Request) {
    try {
        const user = await requireAppUser();
        await ensureIndexes();

        const body = await req.json().catch(() => ({}));

        const date = String((body as any)?.date ?? "").trim();
        const serviceId = String((body as any)?.serviceId ?? "").trim();
        const startTime = String((body as any)?.startTime ?? "").trim();

        const customerFullName = String((body as any)?.customerFullName ?? "").trim();
        const customerEmail = normalizeEmail((body as any)?.customerEmail);
        const customerPhone = normalizePhone((body as any)?.customerPhone);
        const notes = typeof (body as any)?.notes === "string" ? String((body as any).notes).trim() : "";

        if (!isValidDateString(date)) {
            return NextResponse.json({ error: "Invalid date" }, { status: 400 });
        }
        if (!serviceId) {
            return NextResponse.json({ error: "serviceId is required" }, { status: 400 });
        }
        if (!isValidTimeString(startTime)) {
            return NextResponse.json({ error: "Invalid startTime" }, { status: 400 });
        }

        if (!customerFullName) {
            return NextResponse.json({ error: "Full Name is required" }, { status: 400 });
        }
        if (!customerEmail) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }
        if (!isValidEmail(customerEmail)) {
            return NextResponse.json(
                { error: "Please enter a valid email address" },
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

        const c = await collections();
        const businessUserId = new ObjectId(user.id);

        const owner = await c.users.findOne({ _id: businessUserId } as any);
        if (!owner) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }


        const onboarding = (owner as any)?.onboarding ?? {};
        const businessName = String(onboarding?.business?.name ?? "").trim() || "Progrr";

        const services = Array.isArray((onboarding as any)?.services)
            ? ((onboarding as any).services as any[])
            : [];
        const service = services.find((s) => String(s?.id ?? "").trim() === serviceId);

        if (!service || service?.isActive === false) {
            return NextResponse.json({ error: "Service not found" }, { status: 404 });
        }

        const durationMinutes = Number(service?.durationMinutes);
        if (!Number.isFinite(durationMinutes) || durationMinutes < 10) {
            return NextResponse.json({ error: "Invalid service duration" }, { status: 400 });
        }

        const price = Number(service?.price ?? 0) || 0;
        const currency =
            String((onboarding as any)?.business?.currency ?? "").trim() ||
            String(onboarding?.currency ?? "").trim() ||
            "ILS";

        const timeZone = String(onboarding?.availability?.timezone ?? "").trim() || "UTC";
        const todayStr = formatDateInTimeZone(new Date(), timeZone);
        const nowTimeStr = formatTimeInTimeZone(new Date(), timeZone);

        if (date < todayStr) {
            return NextResponse.json({ error: "Cannot create appointments in the past" }, { status: 400 });
        }
        if (date === todayStr && startTime <= nowTimeStr) {
            return NextResponse.json({ error: "Selected time has already passed" }, { status: 409 });
        }

        const booked = await c.appointments
            .find({ businessUserId, date, status: "BOOKED" } as any)
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
        const endTime = minutesToTime(startMin + durationMinutes);

        try {
            // Create/reuse a global customer record.
            let customerDocId: ObjectId | null = null;
            try {
                const upsertedCustomer = await c.customers.findOneAndUpdate(
                    { email: customerEmail } as any,
                    {
                        $setOnInsert: {
                            createdAt: new Date(),
                        },
                        $set: {
                            fullName: customerFullName,
                            phone: customerPhone,
                            email: customerEmail,
                            updatedAt: new Date(),
                        },
                    },
                    { upsert: true, returnDocument: "after" }
                );
                customerDocId = upsertedCustomer?._id ?? null;
            } catch (e: any) {
                if (e?.code === 11000) {
                    const existingCustomer = await c.customers.findOne({ email: customerEmail } as any);
                    customerDocId = existingCustomer?._id ?? null;
                } else {
                    throw e;
                }
            }

            if (!customerDocId) {
                return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
            }

            await c.businessCustomers.updateOne(
                { businessUserId, customerId: customerDocId } as any,
                {
                    $setOnInsert: {
                        businessUserId,
                        customerId: customerDocId,
                        createdAt: new Date(),
                        status: "ACTIVE",
                        isHidden: false,
                    },
                    $set: { lastAppointmentAt: new Date() },
                } as any,
                { upsert: true }
            );

            const insert = await c.appointments.insertOne({
                businessUserId,
                customerId: customerDocId,
                serviceId,
                serviceName: String(service?.name ?? "").trim(),
                durationMinutes,
                price,
                currency,
                date,
                startTime,
                endTime,
                paymentStatus: "UNPAID",
                customer: {
                    id: customerDocId.toHexString(),
                    fullName: customerFullName,
                    phone: customerPhone,
                    email: customerEmail,
                },
                ...(notes ? { notes } : {}),
                status: "BOOKED",
                createdBy: "BUSINESS",
                createdAt: new Date(),
            } as any);

            const appointmentId = insert.insertedId.toHexString();

            await c.businessCustomers.updateOne(
                { businessUserId, customerId: customerDocId } as any,
                { $set: { lastAppointmentAt: new Date() } } as any
            );

            // Send confirmation email.
            const canEmail = isValidEmail(customerEmail);
            let emailSent: boolean | undefined = undefined;
            let emailError: string | undefined = undefined;

            if (canEmail) {
                try {
                    const content = buildAppointmentBookedEmail({
                        businessName,
                        serviceName: String(service?.name ?? "").trim(),
                        date,
                        startTime,
                        endTime,
                    });

                    await sendEmail({
                        to: customerEmail,
                        subject: content.subject,
                        text: content.text,
                        html: content.html,
                    });
                    emailSent = true;
                } catch (e: any) {
                    emailSent = false;
                    emailError = String(e?.message || "Failed to send email");
                }
            }

            return NextResponse.json({
                ok: true,
                appointment: {
                    id: appointmentId,
                    date,
                    startTime,
                    endTime,
                    serviceId,
                    serviceName: String(service?.name ?? "").trim(),
                    status: "BOOKED",
                    customer: {
                        fullName: customerFullName,
                        phone: customerPhone,
                        email: customerEmail,
                    },
                    notes: notes || undefined,
                },
                email: emailSent === undefined ? undefined : { sent: emailSent, error: emailError },
            });
        } catch (e: any) {
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
