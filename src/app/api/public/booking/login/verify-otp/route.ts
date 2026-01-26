import { NextResponse } from "next/server";
import { collections, ensureIndexes } from "@/server/collections";
import { verifyOtp } from "@/server/otp";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";
import { isValidBusinessPublicId } from "@/server/business-public-id";
import { signCustomerAccessToken } from "@/server/jwt";
import {
    CUSTOMER_ACCESS_COOKIE_NAME,
    customerAccessCookieOptions,
} from "@/server/customer-access";
import { isValidEmail, normalizeEmail } from "@/lib/email";

export async function POST(req: Request) {
    try {
        await ensureIndexes();

        const body = await req.json().catch(() => ({}));
        const businessPublicId = String(body?.businessPublicId ?? "").trim();
        const email = normalizeEmail(body?.email);
        const code = String(body?.code ?? "").trim();
        const fullName = String(body?.fullName ?? "").trim();
        const phone = String(body?.phone ?? "").trim();

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
        if (businessPublicId && !isValidBusinessPublicId(businessPublicId)) {
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

        let customer = await c.customers.findOne({ email } as any);
        if (!customer) {
            const insert = await c.customers.insertOne({
                email,
                fullName: fullName || email,
                phone: phone || "",
                createdAt: new Date(),
                updatedAt: new Date(),
            } as any);
            customer = await c.customers.findOne({ _id: insert.insertedId } as any);
        } else if (fullName || phone) {
            await c.customers.updateOne(
                { _id: customer._id } as any,
                {
                    $set: {
                        ...(fullName ? { fullName } : {}),
                        ...(phone ? { phone } : {}),
                        updatedAt: new Date(),
                    },
                } as any
            );
            customer = await c.customers.findOne({ _id: customer._id } as any);
        }

        const customerId = customer?._id?.toHexString?.() ?? "";
        if (!customerId) {
            return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
        }

        const accessToken = await signCustomerAccessToken({
            customerId,
        });

        // Consume OTP on successful login.
        await c.customerOtps.deleteOne({ key: email, purpose });

        const res = NextResponse.json({
            ok: true,
            customer: {
                email,
                fullName: String((customer as any)?.fullName ?? "") || undefined,
                phone: String((customer as any)?.phone ?? "") || undefined,
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
