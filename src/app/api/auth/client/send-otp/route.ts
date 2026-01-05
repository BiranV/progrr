import { NextResponse } from "next/server";
import { collections, ensureIndexes } from "@/server/collections";
import { generateOtp } from "@/server/otp";
import { sendEmail } from "@/server/email";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";
import {
  clearExpiredClientBlock,
  CLIENT_BLOCKED_CODE,
  CLIENT_BLOCKED_MESSAGE,
  computeClientBlockState,
} from "@/server/client-block";

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

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          error: "Please enter a valid email address",
        },
        { status: 400 }
      );
    }

    const c = await collections();
    const db = await getDb();

    await checkRateLimit({
      db,
      req,
      purpose: "otp_request_client",
      email,
      perIp: { windowMs: 60_000, limit: 10 },
      perEmail: { windowMs: 60_000, limit: 5 },
    });

    // Enforce global uniqueness: an email cannot be both admin and client.
    const adminWithEmail = await c.admins.findOne({ email });
    if (adminWithEmail) {
      return NextResponse.json(
        { error: "This email is registered as an admin" },
        { status: 409 }
      );
    }

    // Hard rule: do not create users during login.
    const client = await c.clients.findOne({ email });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const blockState = computeClientBlockState(client);
    if (!blockState.blocked && blockState.shouldClear && client._id) {
      await clearExpiredClientBlock({ c, clientId: client._id });
    } else if (blockState.blocked) {
      return NextResponse.json(
        {
          code: CLIENT_BLOCKED_CODE,
          blockType: blockState.blockType,
          blockedUntil: blockState.blockedUntil,
          error: CLIENT_BLOCKED_MESSAGE,
        },
        { status: 403 }
      );
    }

    // Cooldown to prevent rapid resend loops.
    const existingOtp = await c.otps.findOne({
      key: email,
      purpose: "client_login",
    });
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
      { key: email, purpose: "client_login" },
      {
        $set: {
          key: email,
          purpose: "client_login",
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
      subject: "Your Progrr verification code",
      text: `Your Progrr verification code is: ${code}. This code expires in 10 minutes.`,
    });

    return NextResponse.json({ ok: true, delivery: "email" });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
