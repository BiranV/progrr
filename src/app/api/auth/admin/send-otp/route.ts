import { NextResponse } from "next/server";
import { collections, ensureIndexes } from "@/server/collections";
import { generateOtp } from "@/server/otp";
import { sendEmail } from "@/server/email";
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

    const c = await collections();
    const db = await getDb();

    await checkRateLimit({
      db,
      req,
      purpose: "otp_request_admin",
      email,
      perIp: { windowMs: 60_000, limit: 10 },
      perEmail: { windowMs: 60_000, limit: 5 },
    });

    // Enforce global uniqueness: an email cannot be both admin and client.
    const clientWithEmail = await c.clients.findOne({ email });
    if (clientWithEmail) {
      return NextResponse.json(
        { error: "This email is registered as a client" },
        { status: 409 }
      );
    }

    const existing = await c.admins.findOne({ email });
    if (flow === "login" && !existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // If the admin already exists, send a login OTP even if the UI was on signup.
    const purpose = existing ? "admin_login" : "admin_signup";

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

    await sendEmail({
      to: email,
      subject:
        purpose === "admin_login"
          ? "Your Progrr login code"
          : "Your Progrr admin signup code",
      text:
        purpose === "admin_login"
          ? `Your Progrr login code is: ${code}. This code expires in 10 minutes.`
          : `Your Progrr admin signup code is: ${code}. This code expires in 10 minutes.`,
    });

    return NextResponse.json({
      ok: true,
      delivery: "email",
      mode: purpose === "admin_login" ? "login" : "signup",
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
