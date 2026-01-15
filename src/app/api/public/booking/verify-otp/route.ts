import { NextResponse } from "next/server";

import { collections, ensureIndexes } from "@/server/collections";
import { verifyOtp } from "@/server/otp";
import { signBookingVerifyToken } from "@/server/jwt";
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
    const code = String(body?.code ?? "").trim();

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

    await c.customerOtps.deleteOne({ key: email, purpose });

    const bookingSessionId = await signBookingVerifyToken({ email });
    return NextResponse.json({ ok: true, bookingSessionId });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
