import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { isValidBusinessPublicId } from "@/server/business-public-id";
import { CUSTOMER_ACCESS_COOKIE_NAME, customerAccessCookieOptions } from "@/server/customer-access";
import { verifyCustomerAccessToken, signCustomerAccessToken } from "@/server/jwt";
import { customerIdFor } from "@/server/customer-id";
import { verifyOtp } from "@/server/otp";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";

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
        const currentEmail = normalizeEmail(body?.currentEmail);
        const newEmail = normalizeEmail(body?.newEmail);
        const code = String(body?.code ?? "").trim();

        if (!businessPublicId) {
            return NextResponse.json(
                { error: "businessPublicId is required" },
                { status: 400 }
            );
        }
        if (!isValidBusinessPublicId(businessPublicId)) {
            return NextResponse.json({ error: "Invalid businessPublicId" }, { status: 400 });
        }

        const cookieStore = await cookies();
        const token = cookieStore.get(CUSTOMER_ACCESS_COOKIE_NAME)?.value;
        if (!token) {
            return NextResponse.json({ error: "Not logged in" }, { status: 401 });
        }

        let claims: { customerId: string; businessUserId: string };
        try {
            const parsed = await verifyCustomerAccessToken(token);
            claims = { customerId: parsed.customerId, businessUserId: parsed.businessUserId };
        } catch {
            return NextResponse.json({ error: "Not logged in" }, { status: 401 });
        }

        if (!currentEmail) {
            return NextResponse.json({ error: "currentEmail is required" }, { status: 400 });
        }
        if (!newEmail) {
            return NextResponse.json({ error: "newEmail is required" }, { status: 400 });
        }
        if (!isValidEmail(currentEmail) || !isValidEmail(newEmail)) {
            return NextResponse.json(
                { error: "Please enter a valid email address" },
                { status: 400 }
            );
        }
        if (!code) {
            return NextResponse.json({ error: "Code is required" }, { status: 400 });
        }

        const expectedCustomerId = customerIdFor({
            businessUserId: claims.businessUserId,
            email: currentEmail,
        });
        if (!expectedCustomerId || expectedCustomerId !== claims.customerId) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const c = await collections();

        const user = await c.users.findOne({
            "onboarding.business.publicId": businessPublicId,
            onboardingCompleted: true,
        } as any);

        if (!user?._id) {
            return NextResponse.json({ error: "Business not found" }, { status: 404 });
        }

        const businessUserId = (user._id as ObjectId).toHexString();
        if (claims.businessUserId !== businessUserId) {
            return NextResponse.json({ error: "Not logged in" }, { status: 401 });
        }

        const db = await getDb();
        await checkRateLimit({
            db,
            req,
            purpose: "profile_email_change_verify",
            email: newEmail,
            perIp: { windowMs: 60_000, limit: 60 },
            perEmail: { windowMs: 10 * 60_000, limit: 10 },
        });

        const customer = await c.customers.findOne({
            businessUserId: user._id as ObjectId,
            email: currentEmail,
        } as any);

        if (!customer?._id) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        if (normalizeEmail((customer as any)?.pendingEmail) !== newEmail) {
            return NextResponse.json(
                { error: "No pending email change for this account" },
                { status: 400 }
            );
        }

        // Ensure new email isn't already used by another customer.
        const existingWithNewEmail = await c.customers.findOne({
            businessUserId: user._id as ObjectId,
            email: newEmail,
        } as any);

        if (existingWithNewEmail?._id && String(existingWithNewEmail._id) !== String(customer._id)) {
            return NextResponse.json(
                { error: "This email is already used by another customer." },
                { status: 409 }
            );
        }

        const otp = await c.customerOtps.findOne({ key: newEmail, purpose: "profile_email_change" });
        if (!otp) {
            return NextResponse.json(
                { error: "Code expired or not requested" },
                { status: 400 }
            );
        }

        if (otp.expiresAt.getTime() < Date.now()) {
            await c.customerOtps.deleteOne({ key: newEmail, purpose: "profile_email_change" });
            return NextResponse.json({ error: "Code expired" }, { status: 400 });
        }

        if (otp.attempts >= 5) {
            await c.customerOtps.deleteOne({ key: newEmail, purpose: "profile_email_change" });
            return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
        }

        const ok = verifyOtp(code, otp.codeHash);
        if (!ok) {
            await c.customerOtps.updateOne(
                { key: newEmail, purpose: "profile_email_change" },
                { $inc: { attempts: 1 } }
            );
            return NextResponse.json({ error: "Invalid code" }, { status: 401 });
        }

        const customerIdOld = claims.customerId;
        const customerIdNew = customerIdFor({ businessUserId: claims.businessUserId, email: newEmail });
        if (!customerIdNew) {
            return NextResponse.json({ error: "Invalid new email" }, { status: 400 });
        }

        const fullName = String((customer as any)?.fullName ?? "").trim();
        const phone = String((customer as any)?.phone ?? "").trim();

        await c.appointments.updateMany(
            {
                businessUserId: user._id as ObjectId,
                "customer.id": customerIdOld,
            } as any,
            {
                $set: {
                    customerId: customer._id as ObjectId,
                    "customer.id": customerIdNew,
                    "customer.email": newEmail,
                    "customer.fullName": fullName,
                    "customer.phone": phone,
                },
            }
        );

        await c.customers.updateOne(
            { _id: customer._id as ObjectId } as any,
            {
                $set: { email: newEmail },
                $unset: { pendingEmail: "", pendingEmailRequestedAt: "" },
            }
        );

        // Consume OTP after success.
        await c.customerOtps.deleteOne({ key: newEmail, purpose: "profile_email_change" });

        const accessToken = await signCustomerAccessToken({
            customerId: customerIdNew,
            businessUserId: claims.businessUserId,
        });

        const res = NextResponse.json({
            ok: true,
            customer: { fullName, phone, email: newEmail },
        });

        res.cookies.set(CUSTOMER_ACCESS_COOKIE_NAME, accessToken, customerAccessCookieOptions());

        return res;
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
