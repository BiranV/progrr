import { NextResponse } from "next/server";

import { collections, ensureIndexes } from "@/server/collections";
import { generateOtp } from "@/server/otp";
import { getDb } from "@/server/mongo";
import { checkRateLimitPhone } from "@/server/rate-limit";
import { normalizePhone, isLikelyValidPhone } from "@/server/phone";
import { sendSms } from "@/server/sms";

export async function POST(req: Request) {
    try {
        await ensureIndexes();

        const body = await req.json().catch(() => ({}));
        const phoneRaw = body?.phone;
        const phone = normalizePhone(phoneRaw);

        if (!phone) {
            return NextResponse.json({ error: "Phone is required" }, { status: 400 });
        }
        if (!isLikelyValidPhone(phone)) {
            return NextResponse.json(
                { error: "Please enter a valid phone number" },
                { status: 400 }
            );
        }

        const c = await collections();
        const db = await getDb();

        await checkRateLimitPhone({
            db,
            req,
            purpose: "booking_otp_request",
            phone,
            perIp: { windowMs: 60_000, limit: 20 },
            perPhone: { windowMs: 60_000, limit: 5 },
        });

        const purpose = "booking_verify" as const;

        // Cooldown to prevent rapid resend loops.
        const existingOtp = await c.customerOtps.findOne({ key: phone, purpose });
        const lastSentAt = existingOtp?.sentAt || existingOtp?.createdAt;
        const cooldownMs = 30_000;
        if (lastSentAt && Date.now() - lastSentAt.getTime() < cooldownMs) {
            const retryAfterSeconds = Math.max(
                1,
                Math.ceil((cooldownMs - (Date.now() - lastSentAt.getTime())) / 1000)
            );
            return NextResponse.json(
                {
                    error: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
                },
                { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
            );
        }

        const { code, hash } = generateOtp(6);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await c.customerOtps.updateOne(
            { key: phone, purpose },
            {
                $set: {
                    key: phone,
                    purpose,
                    codeHash: hash,
                    expiresAt,
                    attempts: 0,
                    createdAt: new Date(),
                    sentAt: new Date(),
                },
            },
            { upsert: true }
        );

        await sendSms({
            to: phone,
            text: `Your booking verification code is ${code}. It expires in 10 minutes.`,
        });

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
