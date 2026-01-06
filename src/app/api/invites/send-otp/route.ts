import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { verifyClientInviteToken } from "@/server/invite-token";
import { generateOtp } from "@/server/otp";
import { sendEmail } from "@/server/email";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

function normalizeEmail(input: unknown): string {
  return String(input ?? "")
    .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "").trim();

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Invite token is required" },
        { status: 400 }
      );
    }

    const claims = await verifyClientInviteToken(token);
    if (!ObjectId.isValid(claims.inviteId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid invite" },
        { status: 400 }
      );
    }

    const c = await collections();
    const invite = await c.invites.findOne({
      _id: new ObjectId(claims.inviteId),
    });

    if (!invite) {
      return NextResponse.json(
        { ok: false, error: "This invitation link is invalid or has expired." },
        { status: 404 }
      );
    }

    const email = normalizeEmail(invite.email);
    if (email !== normalizeEmail(claims.email)) {
      return NextResponse.json(
        { ok: false, error: "This invitation link is invalid or has expired." },
        { status: 400 }
      );
    }

    if (String(invite.status).toUpperCase() !== "PENDING") {
      return NextResponse.json(
        { ok: false, error: "This invitation has already been used." },
        { status: 400 }
      );
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { ok: false, error: "This invitation link has expired." },
        { status: 400 }
      );
    }

    const db = await getDb();
    await checkRateLimit({
      db,
      req,
      purpose: "invite_otp_request",
      email,
      perIp: { windowMs: 60_000, limit: 10 },
      perEmail: { windowMs: 60_000, limit: 5 },
    });

    // Cooldown to prevent rapid resend loops.
    const existingOtp = await c.otps.findOne({
      key: email,
      purpose: "client_onboarding",
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
          ok: false,
          error: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
        },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    const { code, hash } = generateOtp(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await c.otps.updateOne(
      { key: email, purpose: "client_onboarding" },
      {
        $set: {
          key: email,
          purpose: "client_onboarding",
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
      { ok: false, error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
