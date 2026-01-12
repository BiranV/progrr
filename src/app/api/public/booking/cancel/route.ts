import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { normalizePhone } from "@/server/phone";
import { verifyBookingCancelToken } from "@/server/jwt";

export async function POST(req: Request) {
    try {
        await ensureIndexes();

        const body = await req.json().catch(() => ({}));
        const cancelToken = String(body?.cancelToken ?? "").trim();

        if (!cancelToken) {
            return NextResponse.json(
                { error: "cancelToken is required" },
                { status: 400 }
            );
        }

        const claims = await verifyBookingCancelToken(cancelToken);
        const phone = normalizePhone(claims.phone);

        const c = await collections();

        const apptId = new ObjectId(claims.appointmentId);
        const appt = await c.appointments.findOne({ _id: apptId });
        if (!appt) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (normalizePhone(appt.customer.phone) !== phone) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (appt.status === "CANCELLED") {
            return NextResponse.json({ ok: true, alreadyCancelled: true });
        }

        await c.appointments.updateOne(
            { _id: apptId },
            { $set: { status: "CANCELLED", cancelledAt: new Date() } }
        );

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
