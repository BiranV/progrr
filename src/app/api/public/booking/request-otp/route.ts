import { NextResponse } from "next/server";

import { collections, ensureIndexes } from "@/server/collections";
import { generateOtp } from "@/server/otp";
import { sendEmail } from "@/server/email";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";
import { buildOtpEmail } from "@/server/emails/auth";
import { isValidBusinessPublicId } from "@/server/business-public-id";
import { ObjectId } from "mongodb";

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

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
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
      purpose: "booking_otp_request",
      email,
      perIp: { windowMs: 60_000, limit: 20 },
      perEmail: { windowMs: 60_000, limit: 5 },
    });

    const user = await c.users.findOne({
      "onboarding.business.publicId": businessPublicId,
      onboardingCompleted: true,
    } as any);

    if (!user) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const isOwnerBooking = normalizeEmail((user as any)?.email) === email;

    // Business-scoped customer block: do NOT send OTP if blocked for this business.
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

    const purpose = "booking_verify" as const;

    // Cooldown to prevent rapid resend loops.
    const existingOtp = await c.customerOtps.findOne({ key: email, purpose });
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
      { key: email, purpose },
      {
        $set: {
          key: email,
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

    const emailContent = buildOtpEmail({
      subject: "Verify your booking",
      title: "Verify your booking",
      code,
      expiresMinutes: 10,
    });

    await sendEmail({
      to: email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
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
