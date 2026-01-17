import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { verifyOtp } from "@/server/otp";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";
import { isValidBusinessPublicId } from "@/server/business-public-id";
import { signCustomerAccessToken } from "@/server/jwt";
import { customerIdFor } from "@/server/customer-id";
import {
    CUSTOMER_ACCESS_COOKIE_NAME,
    customerAccessCookieOptions,
} from "@/server/customer-access";

function normalizeEmail(input: unknown): string {
    return String(input ?? "")
        .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
        .trim()
        .toLowerCase();
}

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
    try {
        await ensureIndexes();

        const body = await req.json().catch(() => ({}));
        const businessPublicId = String(body?.businessPublicId ?? "").trim();
        const email = normalizeEmail(body?.email);
        const code = String(body?.code ?? "").trim();

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }
        if (!isValidEmail(email)) {
            return NextResponse.json(
                { error: "Please enter a valid email address" },
                { status: 400 }
            );
        }
        if (!code) {
            return NextResponse.json({ error: "Code is required" }, { status: 400 });
        }
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

        const c = await collections();
        const db = await getDb();

        await checkRateLimit({
            db,
            req,
            purpose: "booking_otp_verify",
            email,
            perIp: { windowMs: 60_000, limit: 60 },
            perEmail: { windowMs: 10 * 60_000, limit: 10 },
        });

        const purpose = "booking_verify" as const;
        const otp = await c.customerOtps.findOne({ key: email, purpose });
        if (!otp) {
            return NextResponse.json(
                { error: "Code expired or not requested" },
                { status: 400 }
            );
        }

        if (otp.expiresAt.getTime() < Date.now()) {
            await c.customerOtps.deleteOne({ key: email, purpose });
            return NextResponse.json({ error: "Code expired" }, { status: 400 });
        }

        if (otp.attempts >= 5) {
            await c.customerOtps.deleteOne({ key: email, purpose });
            return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
        }

        const ok = verifyOtp(code, otp.codeHash);
        if (!ok) {
            await c.customerOtps.updateOne(
                { key: email, purpose },
                { $inc: { attempts: 1 } }
            );
            return NextResponse.json({ error: "Invalid code" }, { status: 401 });
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

        const businessUserId = (user._id as ObjectId).toHexString();
        const isOwnerBooking = normalizeEmail((user as any)?.email) === email;

        const blocked = isOwnerBooking
            ? null
            : await c.customers.findOne({
                businessUserId: user._id as ObjectId,
                email,
                status: "BLOCKED",
            } as any);

        if (!isOwnerBooking && blocked) {
            return NextResponse.json(
                {
                    error: "You cannot book with this business.",
                    code: "CUSTOMER_BLOCKED_FOR_THIS_BUSINESS",
                },
                { status: 403 }
            );
        }

        const customerId = customerIdFor({ businessUserId, email });
        const accessToken = await signCustomerAccessToken({
            customerId,
            businessUserId,
        });

        // Consume OTP on successful login.
        await c.customerOtps.deleteOne({ key: email, purpose });

        const existingCustomer = await c.customers.findOne(
            {
                businessUserId: user._id as ObjectId,
                email,
            } as any,
            { projection: { fullName: 1, phone: 1, email: 1 } }
        );

        const res = NextResponse.json({
            ok: true,
            customer: {
                email,
                fullName: String((existingCustomer as any)?.fullName ?? "") || undefined,
                phone: String((existingCustomer as any)?.phone ?? "") || undefined,
            },
        });

        res.cookies.set(
            CUSTOMER_ACCESS_COOKIE_NAME,
            accessToken,
            customerAccessCookieOptions()
        );

        return res;
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
