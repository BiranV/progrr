import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { isValidBusinessPublicId } from "@/server/business-public-id";
import {
  verifyCustomerAccessToken,
  signBookingCancelToken,
} from "@/server/jwt";
import { CUSTOMER_ACCESS_COOKIE_NAME } from "@/server/customer-access";
import { formatDateInTimeZone } from "@/lib/public-booking";

function normalizeEmail(input: unknown): string {
  return String(input ?? "")
    .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
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

export async function GET(req: Request) {
  try {
    await ensureIndexes();

    const url = new URL(req.url);
    const businessPublicId = String(
      url.searchParams.get("businessPublicId") ?? ""
    ).trim();

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

    const cookieStore = await cookies();
    const token = cookieStore.get(CUSTOMER_ACCESS_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ ok: true, appointment: null });
    }

    const claims = await verifyCustomerAccessToken(token);

    const c = await collections();
    const user = await c.users.findOne({
      "onboarding.business.publicId": businessPublicId,
      onboardingCompleted: true,
    } as any);

    if (!user?._id) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const customerObjectId = ObjectId.isValid(claims.customerId)
      ? new ObjectId(claims.customerId)
      : null;
    if (!customerObjectId) {
      return NextResponse.json({ ok: true, appointment: null });
    }

    const customer = await c.customers.findOne({ _id: customerObjectId } as any);
    if (!customer) {
      return NextResponse.json({ ok: true, appointment: null });
    }

    // If the business owner is using the public link (same browser/device),
    // they may have a customer access cookie from previous bookings.
    // Owner bookings should never be blocked by an "active appointment" banner.
    const ownerEmail = normalizeEmail((user as any)?.email);
    const customerEmail = normalizeEmail((customer as any)?.email);
    if (ownerEmail && customerEmail && ownerEmail === customerEmail) {
      return NextResponse.json({ ok: true, appointment: null });
    }

    const onboarding = (user as any).onboarding ?? {};

    const businessSettings = (onboarding as any)?.business ?? {};
    const limitCustomerToOneUpcomingAppointment = Boolean(
      (businessSettings as any).limitCustomerToOneUpcomingAppointment
    );

    // When the business allows multiple upcoming appointments, don't show the
    // "active appointment" banner in the public booking flow.
    if (!limitCustomerToOneUpcomingAppointment) {
      return NextResponse.json({ ok: true, appointment: null });
    }

    const timeZone =
      String((onboarding as any)?.availability?.timezone ?? "").trim() || "UTC";

    const todayStr = formatDateInTimeZone(new Date(), timeZone);
    const nowTimeStr = formatTimeInTimeZone(new Date(), timeZone);

    const appt = await c.appointments.findOne(
      {
        businessUserId: user._id as ObjectId,
        status: "BOOKED",
        customerId: customerObjectId,
        $or: [
          { date: { $gt: todayStr } },
          { date: todayStr, startTime: { $gt: nowTimeStr } },
        ],
      } as any,
      { sort: { date: 1, startTime: 1 } }
    );

    if (!appt) {
      return NextResponse.json({ ok: true, appointment: null });
    }

    const appointmentId = (appt as any)?._id?.toHexString?.() ?? "";
    const cancelToken = await signBookingCancelToken({
      appointmentId,
      phone: String((appt as any)?.customer?.phone ?? "").trim(),
    });

    return NextResponse.json({
      ok: true,
      appointment: {
        id: appointmentId,
        serviceId: String((appt as any)?.serviceId ?? ""),
        serviceName: String((appt as any)?.serviceName ?? ""),
        durationMinutes: Number((appt as any)?.durationMinutes ?? 0),
        price: Number((appt as any)?.price ?? 0),
        currency: String((appt as any)?.currency ?? ""),
        date: String((appt as any)?.date ?? ""),
        startTime: String((appt as any)?.startTime ?? ""),
        endTime: String((appt as any)?.endTime ?? ""),
        customer: {
          fullName: String((appt as any)?.customer?.fullName ?? ""),
          phone: String((appt as any)?.customer?.phone ?? ""),
          email: (appt as any)?.customer?.email,
        },
        notes: (appt as any)?.notes,
        status: String((appt as any)?.status ?? "BOOKED"),
      },
      cancelToken,
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
