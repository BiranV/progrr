import { NextResponse } from "next/server";

import { collections, ensureIndexes } from "@/server/collections";
import { generateOtp } from "@/server/otp";
import { sendEmail } from "@/server/email";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";
import { buildOtpEmail } from "@/server/emails/auth";

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
    const email = normalizeEmail(body?.email);
    const flow = String(body?.flow ?? "")
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    if (flow !== "login" && flow !== "signup") {
      return NextResponse.json({ error: "Invalid flow" }, { status: 400 });
    }

    const c = await collections();
    const db = await getDb();

    await checkRateLimit({
      db,
      req,
      purpose: "otp_request",
      email,
      perIp: { windowMs: 60_000, limit: 10 },
      perEmail: { windowMs: 60_000, limit: 5 },
    });

    const existing = await c.users.findOne({ email });

    if (flow === "login" && !existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (flow === "signup" && existing) {
      return NextResponse.json(
        { error: "EMAIL_ALREADY_EXISTS" },
        { status: 409 }
      );
    }

    // IMPORTANT: never auto-switch signup into login.
    const purpose = flow;

    // Cooldown to prevent rapid resend loops.
    const existingOtp = await c.otps.findOne({ key: email, purpose });
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

    await c.otps.updateOne(
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
      subject: purpose === "login" ? "Your login code" : "Your signup code",
      title: purpose === "login" ? "Your login code" : "Your signup code",
      code,
      expiresMinutes: 10,
    });

    await sendEmail({
      to: email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    return NextResponse.json({
      ok: true,
      delivery: "email",
      mode: purpose,
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
