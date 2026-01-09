import { NextResponse } from "next/server";
import { collections, ensureIndexes } from "@/server/collections";
import { generateOtp } from "@/server/otp";
import { sendEmail } from "@/server/email";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";
import { buildOtpEmail } from "@/server/emails/auth";
import {
  ensureLegacySingleRelation,
  resolveClientAdminContext,
} from "@/server/client-relations";

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

    // Hard rule: do not create users during login.
    const client = await c.clients.findOne({ email });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Lazily migrate legacy single-admin clients into the relation model.
    await ensureLegacySingleRelation({ c, user: client });

    // If the client has no active coaches (all deleted/blocked), do not send OTP.
    const resolved = await resolveClientAdminContext({ c, user: client });
    if (resolved.needsSelection) {
      let message =
        "Your account no longer has access to this platform. Please contact your coach.";

      // Check specific statuses for better error messages
      if (
        resolved.reason === "NO_ACTIVE_RELATIONS" ||
        resolved.reason === "NO_RELATIONS"
      ) {
        // Query explicit status to give better feedback
        const rels = await c.clientAdminRelations
          .find({ userId: client._id })
          .toArray();

        const isBlocked = rels.some(
          (r) => String((r as any).status).toUpperCase() === "BLOCKED"
        );
        const isDeleted = rels.some(
          (r) => String((r as any).status).toUpperCase() === "DELETED"
        );
        const isInactive = rels.some(
          (r) => String((r as any).status).toUpperCase() === "INACTIVE"
        );

        if (isBlocked) {
          message = "Your account has been blocked. Please contact your coach.";
        } else if (isDeleted) {
          message = "Your account has been deleted.";
        } else if (isInactive) {
          message =
            "Your account is inactive. Please contact your coach to reactivate it.";
        } else if (rels.length === 0) {
          message = "Your account is not connected to any coach.";
        }
      }

      return NextResponse.json(
        {
          error: message,
          code: "CLIENT_BLOCKED",
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

    const emailContent = buildOtpEmail({
      subject: "Your Progrr login code",
      title: "Your login code",
      code,
      expiresMinutes: 10,
    });

    await sendEmail({
      to: email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
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
