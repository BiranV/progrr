import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { computeAvailableSlots } from "@/server/booking/slots";

function isValidDateString(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(
    req: Request,
    ctx: { params: Promise<{ slugOrId: string }> }
) {
    try {
        await ensureIndexes();

        const url = new URL(req.url);
        const date = String(url.searchParams.get("date") ?? "").trim();
        const serviceId = String(url.searchParams.get("serviceId") ?? "").trim();

        if (!isValidDateString(date)) {
            return NextResponse.json(
                { error: "Invalid date" },
                { status: 400 }
            );
        }
        if (!serviceId) {
            return NextResponse.json(
                { error: "serviceId is required" },
                { status: 400 }
            );
        }

        const { slugOrId } = await ctx.params;
        const businessId = String(slugOrId ?? "").trim();

        if (!/^[a-f0-9]{24}$/i.test(businessId)) {
            return NextResponse.json({ error: "Business not found" }, { status: 404 });
        }

        const c = await collections();

        const user = await c.users.findOne({
            _id: new ObjectId(businessId),
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
        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
            return NextResponse.json(
                { error: "Invalid service duration" },
                { status: 400 }
            );
        }

        const appts = await c.appointments
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
            bookedAppointments: appts,
        });

        const timeZone =
            String(onboarding?.availability?.timezone ?? "").trim() || "UTC";

        return NextResponse.json({
            ok: true,
            date,
            timeZone,
            service: {
                id: String(service.id),
                name: String(service.name ?? "").trim(),
                durationMinutes,
            },
            slots,
        });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
