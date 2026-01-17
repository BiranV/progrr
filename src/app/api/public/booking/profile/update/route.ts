import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { isValidBusinessPublicId } from "@/server/business-public-id";
import { CUSTOMER_ACCESS_COOKIE_NAME } from "@/server/customer-access";
import { verifyCustomerAccessToken } from "@/server/jwt";
import { customerIdFor } from "@/server/customer-id";
import { generateOtp } from "@/server/otp";
import { sendEmail } from "@/server/email";
import { buildOtpEmail } from "@/server/emails/auth";
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
        const fullName = String(body?.fullName ?? "").trim();
        const phone = String(body?.phone ?? "").trim();
        const currentEmail = normalizeEmail(body?.currentEmail);
        const newEmailRaw = normalizeEmail(body?.newEmail);

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
        if (!isValidEmail(currentEmail)) {
            return NextResponse.json(
                { error: "Please enter a valid email address" },
                { status: 400 }
            );
        }
        if (!fullName) {
            return NextResponse.json({ error: "Full name is required" }, { status: 400 });
        }
        if (!phone) {
            return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
        }

        const expectedCustomerId = customerIdFor({
            businessUserId: claims.businessUserId,
            email: currentEmail,
        });
        if (!expectedCustomerId || expectedCustomerId !== claims.customerId) {
            return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const wantsEmailChange = Boolean(newEmailRaw) && newEmailRaw !== currentEmail;
        if (wantsEmailChange && !isValidEmail(newEmailRaw)) {
            return NextResponse.json(
                { error: "Please enter a valid email address" },
                { status: 400 }
            );
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

        // Ensure customer exists (or update existing).
        let customerDocId: ObjectId | null = null;
        try {
            const upserted = await c.customers.findOneAndUpdate(
                { businessUserId: user._id as ObjectId, email: currentEmail } as any,
                {
                    $set: {
                        fullName,
                        phone,
                        email: currentEmail,
                        isHidden: false,
                    },
                    $setOnInsert: {
                        businessUserId: user._id as ObjectId,
                        createdAt: new Date(),
                        status: "ACTIVE",
                    },
                },
                { upsert: true, returnDocument: "after" }
            );

            customerDocId = upserted?._id ?? null;
        } catch (e: any) {
            if (e?.code === 11000) {
                // Unique index race (phone/email). Try to locate the existing doc.
                const existingCustomer = await c.customers.findOne({
                    businessUserId: user._id as ObjectId,
                    $or: [{ phone }, { email: currentEmail }],
                } as any);

                if (!existingCustomer?._id) throw e;
                customerDocId = existingCustomer._id as ObjectId;
                await c.customers.updateOne(
                    { _id: customerDocId } as any,
                    { $set: { fullName, phone, email: currentEmail, isHidden: false } }
                );
            } else {
                throw e;
            }
        }

        if (!customerDocId) {
            return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
        }

        // Update all appointments with the current identity (keeps admin UI in sync).
        await c.appointments.updateMany(
            {
                businessUserId: user._id as ObjectId,
                "customer.id": claims.customerId,
            } as any,
            {
                $set: {
                    customerId: customerDocId,
                    "customer.fullName": fullName,
                    "customer.phone": phone,
                    "customer.email": currentEmail,
                },
            }
        );

        if (!wantsEmailChange) {
            return NextResponse.json({
                ok: true,
                customer: { fullName, phone, email: currentEmail },
            });
        }

        const newEmail = newEmailRaw;

        // Ensure new email isn't already used by another customer.
        const existingWithNewEmail = await c.customers.findOne({
            businessUserId: user._id as ObjectId,
            email: newEmail,
        } as any);

        if (existingWithNewEmail?._id && String(existingWithNewEmail._id) !== String(customerDocId)) {
            return NextResponse.json(
                { error: "This email is already used by another customer." },
                { status: 409 }
            );
        }

        const db = await getDb();
        await checkRateLimit({
            db,
            req,
            purpose: "profile_email_change_request",
            email: newEmail,
            perIp: { windowMs: 60_000, limit: 20 },
            perEmail: { windowMs: 60_000, limit: 5 },
        });

        // Create/replace OTP for the new email.
        const { code, hash } = generateOtp(6);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await c.customerOtps.updateOne(
            { key: newEmail, purpose: "profile_email_change" },
            {
                $set: {
                    key: newEmail,
                    purpose: "profile_email_change",
                    codeHash: hash,
                    expiresAt,
                    attempts: 0,
                    createdAt: new Date(),
                    sentAt: new Date(),
                },
            },
            { upsert: true }
        );

        await c.customers.updateOne(
            { _id: customerDocId } as any,
            { $set: { pendingEmail: newEmail, pendingEmailRequestedAt: new Date() } }
        );

        const emailContent = buildOtpEmail({
            subject: "Verify your new email",
            title: "Verify your new email",
            code,
            expiresMinutes: 10,
        });

        await sendEmail({
            to: newEmail,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
        });

        return NextResponse.json({ ok: true, requiresVerification: true, pendingEmail: newEmail });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
