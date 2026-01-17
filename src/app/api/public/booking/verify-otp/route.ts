import { NextResponse } from "next/server";

import { collections, ensureIndexes } from "@/server/collections";
import { verifyOtp } from "@/server/otp";
import { signBookingVerifyToken } from "@/server/jwt";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";
import { isValidBusinessPublicId } from "@/server/business-public-id";
import { formatDateInTimeZone } from "@/lib/public-booking";
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

function formatTimeInTimeZone(date: Date, timeZone: string): string {
  const tz = String(timeZone || "UTC").trim() || "UTC";
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
  }

  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const h = get("hour");
  const m = get("minute");
  if (!h || !m) return "";
  return `${h}:${m}`;
}

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const businessPublicId = String(body?.businessPublicId ?? "").trim();
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

    // After successful OTP verification, check business rules (block list + active appointment conflict).
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

    // Business-scoped customer block: prevent booking for this business.
    const blocked = await c.customers.findOne({
      businessUserId: user._id as ObjectId,
      email,
      status: "BLOCKED",
    } as any);

    if (blocked) {
      return NextResponse.json(
        {
          error: "You cannot book with this business.",
          code: "CUSTOMER_BLOCKED_FOR_THIS_BUSINESS",
        },
        { status: 403 }
      );
    }

    // Identity verified: issue a short-lived booking session token.
    // IMPORTANT: Do NOT consume/invalidate the OTP here.
    const bookingSessionId = await signBookingVerifyToken({ email });

    const onboarding = (user as any).onboarding ?? {};
    const businessSettings = (onboarding as any)?.business ?? {};
    const limitCustomerToOneUpcomingAppointment = Boolean(
      (businessSettings as any).limitCustomerToOneUpcomingAppointment
    );

    if (!limitCustomerToOneUpcomingAppointment) {
      return NextResponse.json({ ok: true, bookingSessionId });
    }

    const timeZone =
      String((onboarding as any)?.availability?.timezone ?? "").trim() || "UTC";

    const todayStr = formatDateInTimeZone(new Date(), timeZone);
    const nowTimeStr = formatTimeInTimeZone(new Date(), timeZone);

    // Conflict check MUST use verified identity only (email), never cookies/session.
    const existing = await c.appointments.findOne(
      {
        businessUserId: user._id as ObjectId,
        status: "BOOKED",
        "customer.email": email,
        $or: [
          { date: { $gt: todayStr } },
          { date: todayStr, endTime: { $gt: nowTimeStr } },
        ],
      } as any,
      { sort: { date: 1, startTime: 1 } }
    );

    if (existing) {
      return NextResponse.json(
        {
          error:
            "You already have an active upcoming appointment. Please cancel it first.",
          code: "ACTIVE_APPOINTMENT_EXISTS",
          bookingSessionId,
          existingAppointment: {
            id: (existing as any)?._id?.toHexString?.() ?? undefined,
            date: (existing as any)?.date,
            startTime: (existing as any)?.startTime,
            endTime: (existing as any)?.endTime,
            serviceName: (existing as any)?.serviceName,
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, bookingSessionId });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
