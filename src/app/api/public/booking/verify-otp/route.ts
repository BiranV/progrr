import { NextResponse } from "next/server";

import { collections, ensureIndexes } from "@/server/collections";
import { verifyOtp } from "@/server/otp";
import { signBookingVerifyToken } from "@/server/jwt";
import { getDb } from "@/server/mongo";
import { checkRateLimitPhone } from "@/server/rate-limit";
import { normalizePhone, isLikelyValidPhone } from "@/server/phone";

export async function POST(req: Request) {
    try {
        await ensureIndexes();

        const body = await req.json().catch(() => ({}));
        const phone = normalizePhone(body?.phone);
        const code = String(body?.code ?? "").trim();

        if (!phone) {
            return NextResponse.json({ error: "Phone is required" }, { status: 400 });
        }
        if (!isLikelyValidPhone(phone)) {
            return NextResponse.json(
                { error: "Please enter a valid phone number" },
                { status: 400 }
            );
        }
        if (!code) {
            return NextResponse.json({ error: "Code is required" }, { status: 400 });
        }

        const c = await collections();
        const db = await getDb();

        await checkRateLimitPhone({
            db,
            req,
            purpose: "booking_otp_verify",
            phone,
            perIp: { windowMs: 60_000, limit: 60 },
            perPhone: { windowMs: 10 * 60_000, limit: 10 },
        });

        const purpose = "booking_verify" as const;
        const otp = await c.customerOtps.findOne({ key: phone, purpose });
        if (!otp) {
            return NextResponse.json(
                { error: "Code expired or not requested" },
                { status: 400 }
            );
        }

        if (otp.expiresAt.getTime() < Date.now()) {
            await c.customerOtps.deleteOne({ key: phone, purpose });
            return NextResponse.json({ error: "Code expired" }, { status: 400 });
        }

        if (otp.attempts >= 5) {
            await c.customerOtps.deleteOne({ key: phone, purpose });
            return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
        }

        const ok = verifyOtp(code, otp.codeHash);
        if (!ok) {
            await c.customerOtps.updateOne(
                { key: phone, purpose },
                { $inc: { attempts: 1 } }
            );
            return NextResponse.json({ error: "Invalid code" }, { status: 401 });
        }

        await c.customerOtps.deleteOne({ key: phone, purpose });

        const bookingSessionId = await signBookingVerifyToken({ phone });
        return NextResponse.json({ ok: true, bookingSessionId });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
