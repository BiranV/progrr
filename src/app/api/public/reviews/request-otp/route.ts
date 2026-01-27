import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import crypto from "crypto";

import { collections, ensureIndexes } from "@/server/collections";
import { generateOtp } from "@/server/otp";
import { sendEmail } from "@/server/email";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";
import { buildOtpEmail } from "@/server/emails/auth";
import { isValidBusinessPublicId } from "@/server/business-public-id";
import { isValidEmail, normalizeEmail } from "@/lib/email";

function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const businessPublicId = String(body?.businessPublicId ?? "").trim();
    const appointmentId = String(body?.appointmentId ?? "").trim();
    const email = normalizeEmail(body?.email);

    if (!businessPublicId || !isValidBusinessPublicId(businessPublicId)) {
      return NextResponse.json(
        { error: "Invalid businessPublicId" },
        { status: 400 },
      );
    }
    if (!appointmentId || !isValidObjectId(appointmentId)) {
      return NextResponse.json(
        { error: "Invalid appointmentId" },
        { status: 400 },
      );
    }
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 },
      );
    }

    const c = await collections();
    const db = await getDb();

    await checkRateLimit({
      db,
      req,
      purpose: "review_otp_request",
      email,
      perIp: { windowMs: 60_000, limit: 20 },
      perEmail: { windowMs: 60_000, limit: 5 },
    });

    const owner = await c.users.findOne(
      { "onboarding.business.publicId": businessPublicId } as any,
      { projection: { _id: 1, "onboarding.business.name": 1 } },
    );

    if (!owner?._id) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }

    const appointment = await c.appointments.findOne(
      {
        _id: new ObjectId(appointmentId),
        businessUserId: owner._id,
      } as any,
      {
        projection: {
          status: 1,
          reviewSubmitted: 1,
          "customer.email": 1,
        },
      },
    );

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 },
      );
    }

    if (String((appointment as any).status ?? "") !== "COMPLETED") {
      return NextResponse.json(
        { error: "Review is not available for this appointment" },
        { status: 400 },
      );
    }

    if (Boolean((appointment as any).reviewSubmitted)) {
      return NextResponse.json(
        { error: "Review already submitted" },
        { status: 409 },
      );
    }

    const appointmentEmail = normalizeEmail(
      (appointment as any)?.customer?.email,
    );
    if (!appointmentEmail || !isValidEmail(appointmentEmail)) {
      return NextResponse.json(
        { error: "Appointment email is missing" },
        { status: 400 },
      );
    }

    if (appointmentEmail !== email) {
      return NextResponse.json(
        { error: "Email does not match this appointment" },
        { status: 400 },
      );
    }

    const purpose = "review" as const;

    const verifyToken =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : crypto.randomBytes(24).toString("hex");

    const existingOtp = await c.customerOtps.findOne({ key: email, purpose });
    const lastSentAt = existingOtp?.sentAt || existingOtp?.createdAt;
    const cooldownMs = 30_000;
    if (lastSentAt && Date.now() - lastSentAt.getTime() < cooldownMs) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((cooldownMs - (Date.now() - lastSentAt.getTime())) / 1000),
      );
      return NextResponse.json(
        {
          error: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
        },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
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
          verifyToken,
          businessPublicId,
          appointmentId,
          expiresAt,
          attempts: 0,
          createdAt: new Date(),
          sentAt: new Date(),
        },
      },
      { upsert: true },
    );

    const businessName =
      String((owner as any)?.onboarding?.business?.name ?? "").trim() ||
      "Progrr";

    const emailContent = buildOtpEmail({
      subject: `${businessName} review verification`,
      title: "Verify your review",
      code,
      expiresMinutes: 10,
    });

    await sendEmail({
      to: email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    return NextResponse.json({ ok: true, verifyToken });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
}
