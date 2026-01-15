import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { normalizePhone, isLikelyValidPhone } from "@/server/phone";
import {
  computeAvailableSlots,
  parseTimeToMinutes,
  minutesToTime,
} from "@/server/booking/slots";
import { verifyBookingVerifyToken, signBookingCancelToken } from "@/server/jwt";
import { signCustomerAccessToken } from "@/server/jwt";
import { isValidBusinessPublicId } from "@/server/business-public-id";
import { formatDateInTimeZone } from "@/lib/public-booking";
import { customerIdFor } from "@/server/customer-id";
import {
  CUSTOMER_ACCESS_COOKIE_NAME,
  customerAccessCookieOptions,
} from "@/server/customer-access";

function normalizeEmail(input: unknown): string {
  return String(input ?? "")
    .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isValidTimeString(s: string): boolean {
  return /^\d{2}:\d{2}$/.test(s);
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
    const serviceId = String(body?.serviceId ?? "").trim();
    const date = String(body?.date ?? "").trim();
    const startTime = String(body?.startTime ?? "").trim();

    const customerFullName = String(body?.customerFullName ?? "").trim();
    const customerEmail = normalizeEmail(body?.customerEmail);
    const customerPhone = normalizePhone(body?.customerPhone);
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

    const bookingSessionId = String(body?.bookingSessionId ?? "").trim();

    if (!bookingSessionId) {
      return NextResponse.json(
        { error: "Email verification required" },
        { status: 401 }
      );
    }

    const claims = await verifyBookingVerifyToken(bookingSessionId);

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
    if (!serviceId) {
      return NextResponse.json(
        { error: "serviceId is required" },
        { status: 400 }
      );
    }
    if (!isValidDateString(date)) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    if (!isValidTimeString(startTime)) {
      return NextResponse.json({ error: "Invalid startTime" }, { status: 400 });
    }
    if (!customerFullName) {
      return NextResponse.json(
        { error: "Full Name is required" },
        { status: 400 }
      );
    }
    if (!customerEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!isValidEmail(customerEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }
    if (!customerPhone) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 });
    }
    if (!isLikelyValidPhone(customerPhone)) {
      return NextResponse.json(
        { error: "Please enter a valid phone number" },
        { status: 400 }
      );
    }

    if (normalizeEmail(claims.email) !== customerEmail) {
      return NextResponse.json(
        { error: "Email verification mismatch" },
        { status: 401 }
      );
    }

    const c = await collections();
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

    const onboarding = (user as any).onboarding ?? {};
    const services: any[] = Array.isArray(onboarding.services)
      ? onboarding.services
      : [];

    const activeServices = services.filter(
      (s) => (s as any)?.isActive !== false
    );

    const service = activeServices.find(
      (s) => String(s?.id ?? "") === serviceId
    );
    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const durationMinutes = Number(service?.durationMinutes);
    const rawPrice = Number(service?.price);
    const price = Number.isFinite(rawPrice) ? rawPrice : 0;
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return NextResponse.json(
        { error: "Invalid service duration" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    // Enforce: only one active future appointment per customer (server-side only).
    const timeZone =
      String((onboarding as any)?.availability?.timezone ?? "").trim() || "UTC";
    const todayStr = formatDateInTimeZone(new Date(), timeZone);
    const nowTimeStr = formatTimeInTimeZone(new Date(), timeZone);

    const businessUserId = (user._id as ObjectId).toHexString();
    const customerId = customerIdFor({ businessUserId, email: customerEmail });

    const existing = await c.appointments.findOne(
      {
        businessUserId: user._id as ObjectId,
        status: "BOOKED",
        $and: [
          {
            $or: [
              { "customer.id": customerId },
              { "customer.email": customerEmail },
              { "customer.phone": customerPhone },
            ],
          },
          {
            $or: [
              { date: { $gt: todayStr } },
              { date: todayStr, startTime: { $gt: nowTimeStr } },
            ],
          },
        ],
      } as any,
      {
        sort: { date: 1, startTime: 1 },
      }
    );

    if (existing) {
      return NextResponse.json(
        {
          error:
            "You already have an active upcoming appointment. Please cancel it first.",
          code: "ACTIVE_APPOINTMENT_EXISTS",
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

    const booked = await c.appointments
      .find({
        businessUserId: user._id as ObjectId,
        date,
        status: "BOOKED",
      })
      .toArray();

    const slots = computeAvailableSlots({
      date,
      durationMinutes,
      onboardingAvailability: onboarding.availability,
      bookedAppointments: booked,
    });

    const requested = slots.find((s) => s.startTime === startTime);
    if (!requested) {
      return NextResponse.json(
        { error: "Selected time is no longer available" },
        { status: 409 }
      );
    }

    const startMin = parseTimeToMinutes(startTime);
    const endMin = startMin + durationMinutes;
    const endTime = minutesToTime(endMin);

    const currency =
      String((onboarding as any)?.business?.currency ?? "").trim() ||
      String(onboarding.currency ?? "").trim() ||
      "ILS";

    try {
      // Create/reuse a business-scoped customer record.
      // Customers are server-side only and used by the Admin → Customers screen.
      let customerDocId: ObjectId | null = null;
      try {
        const upsertedCustomer = await c.customers.findOneAndUpdate(
          {
            businessUserId: user._id as ObjectId,
            $or: [{ phone: customerPhone }, { email: customerEmail }],
          } as any,
          {
            $setOnInsert: {
              businessUserId: user._id as ObjectId,
              createdAt: new Date(),
            },
            $set: {
              fullName: customerFullName,
              phone: customerPhone,
              email: customerEmail,
            },
          },
          { upsert: true, returnDocument: "after" }
        );

        customerDocId = upsertedCustomer?._id ?? null;
      } catch (e: any) {
        // Handle unique index races.
        if (e?.code === 11000) {
          const existingCustomer = await c.customers.findOne({
            businessUserId: user._id as ObjectId,
            $or: [{ phone: customerPhone }, { email: customerEmail }],
          } as any);
          customerDocId = existingCustomer?._id ?? null;
        } else {
          throw e;
        }
      }

      if (!customerDocId) {
        return NextResponse.json(
          { error: "Failed to create customer" },
          { status: 500 }
        );
      }

      const insert = await c.appointments.insertOne({
        businessUserId: user._id as ObjectId,
        customerId: customerDocId,
        serviceId,
        serviceName: String(service?.name ?? "").trim(),
        durationMinutes,
        price,
        currency,
        date,
        startTime,
        endTime,
        customer: {
          id: customerId,
          fullName: customerFullName,
          phone: customerPhone,
          email: customerEmail,
        },
        ...(notes ? { notes } : {}),
        status: "BOOKED",
        createdAt: new Date(),
      } as any);

      const appointmentId = insert.insertedId.toHexString();

      await c.customers.updateOne(
        { _id: customerDocId },
        { $set: { lastAppointmentAt: new Date() } }
      );

      // Consume OTP only when an appointment is successfully created.
      // This avoids forcing a resend if appointment creation is blocked by business rules.
      await c.customerOtps.deleteOne({
        key: customerEmail,
        purpose: "booking_verify",
      });

      const cancelToken = await signBookingCancelToken({
        appointmentId,
        phone: customerPhone,
      });

      const accessToken = await signCustomerAccessToken({
        customerId,
        businessUserId,
      });

      const res = NextResponse.json({
        ok: true,
        appointment: {
          id: appointmentId,
          serviceId,
          serviceName: String(service?.name ?? "").trim(),
          durationMinutes,
          price,
          currency,
          date,
          startTime,
          endTime,
          customer: {
            fullName: customerFullName,
            phone: customerPhone,
            email: customerEmail,
          },
          notes: notes || undefined,
          status: "BOOKED",
        },
        cancelToken,
      });

      res.cookies.set(
        CUSTOMER_ACCESS_COOKIE_NAME,
        accessToken,
        customerAccessCookieOptions()
      );

      return res;
    } catch (e: any) {
      // Duplicate booking due to race.
      if (e?.code === 11000) {
        return NextResponse.json(
          { error: "Selected time is no longer available" },
          { status: 409 }
        );
      }
      throw e;
    }
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
