import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";
import {
    computeAvailableSlots,
    parseTimeToMinutes,
    minutesToTime,
} from "@/server/booking/slots";
import { formatDateInTimeZone } from "@/lib/public-booking";
import { sendEmail } from "@/server/email";
import { buildAppointmentRescheduledEmail } from "@/server/emails/booking";
import { isValidEmail, normalizeEmail } from "@/lib/email";

function isValidDateString(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isValidTimeString(s: string): boolean {
    return /^\d{2}:\d{2}$/.test(s);
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

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const user = await requireAppUser();
        await ensureIndexes();

        const { id } = await ctx.params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid appointment id" }, { status: 400 });
        }

        const body = await req.json().catch(() => ({}));
        const date = String(body?.date ?? "").trim();
        const startTime = String(body?.startTime ?? "").trim();

        if (!isValidDateString(date)) {
            return NextResponse.json({ error: "Invalid date" }, { status: 400 });
        }
        if (!isValidTimeString(startTime)) {
            return NextResponse.json({ error: "Invalid startTime" }, { status: 400 });
        }

        const c = await collections();

        const apptId = new ObjectId(id);
        const appt = await c.appointments.findOne({ _id: apptId });
        if (!appt) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const oldDate = String((appt as any)?.date ?? "");
        const oldStartTime = String((appt as any)?.startTime ?? "");
        const oldEndTime = String((appt as any)?.endTime ?? "");

        if ((appt.businessUserId as ObjectId).toHexString() !== String(user.id)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (String((appt as any)?.status ?? "") !== "BOOKED") {
            return NextResponse.json(
                { error: "Only BOOKED appointments can be rescheduled" },
                { status: 409 }
            );
        }

        const durationMinutes = Number((appt as any)?.durationMinutes);
        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
            return NextResponse.json(
                { error: "Invalid appointment duration" },
                { status: 400 }
            );
        }

        const businessUserId = appt.businessUserId as ObjectId;
        const owner = await c.users.findOne({ _id: businessUserId } as any);
        const onboarding = (owner as any)?.onboarding ?? {};
        const timeZone =
            String(onboarding?.availability?.timezone ?? "").trim() || "UTC";

        const todayStr = formatDateInTimeZone(new Date(), timeZone);
        const nowTimeStr = formatTimeInTimeZone(new Date(), timeZone);

        if (date < todayStr) {
            return NextResponse.json(
                { error: "Cannot reschedule to a past date" },
                { status: 400 }
            );
        }
        if (date === todayStr && startTime <= nowTimeStr) {
            return NextResponse.json(
                { error: "Cannot reschedule to a past time" },
                { status: 400 }
            );
        }

        const booked = await c.appointments
            .find({
                businessUserId,
                date,
                status: "BOOKED",
                _id: { $ne: apptId },
            } as any)
            .toArray();

        const slots = computeAvailableSlots({
            date,
            durationMinutes,
            onboardingAvailability: onboarding.availability,
            bookedAppointments: booked,
        });

        const requested = slots.find((s: any) => String(s?.startTime ?? "") === startTime);
        if (!requested) {
            return NextResponse.json(
                { error: "Selected time is no longer available" },
                { status: 409 }
            );
        }

        const startMin = parseTimeToMinutes(startTime);
        const endMin = startMin + durationMinutes;
        const endTime = minutesToTime(endMin);

        const update = await c.appointments.findOneAndUpdate(
            { _id: apptId, businessUserId } as any,
            {
                $set: {
                    date,
                    startTime,
                    endTime,
                    rescheduledAt: new Date(),
                },
            },
            { returnDocument: "after" }
        );

        const updated = update;
        const updatedId = (updated as any)?._id?.toHexString?.() ?? id;

        const customerEmail = normalizeEmail((updated as any)?.customer?.email);
        const canEmail = isValidEmail(customerEmail);

        let emailSent: boolean | undefined = undefined;
        let emailError: string | undefined = undefined;

        if (canEmail) {
            try {
                const businessName = String((onboarding as any)?.business?.name ?? "").trim();
                const serviceName = String((updated as any)?.serviceName ?? "").trim();

                const content = buildAppointmentRescheduledEmail({
                    businessName,
                    serviceName,
                    oldDate: oldDate || String(date),
                    oldStartTime: oldStartTime || String(startTime),
                    oldEndTime: oldEndTime || String(endTime),
                    newDate: String((updated as any)?.date ?? date),
                    newStartTime: String((updated as any)?.startTime ?? startTime),
                    newEndTime: String((updated as any)?.endTime ?? endTime),
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
                id: updatedId,
                date: String((updated as any)?.date ?? date),
                startTime: String((updated as any)?.startTime ?? startTime),
                endTime: String((updated as any)?.endTime ?? endTime),
                serviceName: String((updated as any)?.serviceName ?? ""),
                status: String((updated as any)?.status ?? ""),
            },
            email: emailSent === undefined ? undefined : { sent: emailSent, error: emailError },
        });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
