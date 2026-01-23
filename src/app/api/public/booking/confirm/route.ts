import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { normalizePhone, isLikelyValidPhone } from "@/server/phone";
import {
  computeAvailableSlots,
  parseTimeToMinutes,
  minutesToTime,
} from "@/server/booking/slots";
import {
  signBookingCancelToken,
  signCustomerAccessToken,
  verifyCustomerAccessToken,
  verifyBookingVerifyToken,
} from "@/server/jwt";
import { isValidBusinessPublicId } from "@/server/business-public-id";
import { formatDateInTimeZone } from "@/lib/public-booking";
import { customerIdFor } from "@/server/customer-id";
import {
  CUSTOMER_ACCESS_COOKIE_NAME,
  customerAccessCookieOptions,
} from "@/server/customer-access";
import { sendEmail } from "@/server/email";
import { buildAppointmentBookedEmail } from "@/server/emails/booking";

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
    const hasOtp = Boolean(body?.otp || body?.code);
    const hasVerifyToken = Boolean(body?.verifyToken);

    const cookieStore = await cookies();
    const accessCookie = cookieStore.get(CUSTOMER_ACCESS_COOKIE_NAME)?.value;
    const customerAccessClaims = accessCookie
      ? await (async () => {
        try {
          const parsed = await verifyCustomerAccessToken(accessCookie);
          return {
            customerId: String(parsed.customerId ?? "").trim(),
            businessUserId: String(parsed.businessUserId ?? "").trim(),
          };
        } catch {
          return null;
        }
      })()
      : null;

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

    if (hasOtp || hasVerifyToken) {
      return NextResponse.json(
        { error: "Unauthorized", code: "unauthorized" },
        { status: 401 }
      );
    }

    if (!bookingSessionId && !customerAccessClaims) {
      return NextResponse.json(
        { error: "Unauthorized", code: "unauthorized" },
        { status: 401 }
      );
    }

    const c = await collections();
    let sessionEmail = "";
    if (bookingSessionId) {
      try {
        const claims = await verifyBookingVerifyToken(bookingSessionId);
        sessionEmail = normalizeEmail(claims.email);
      } catch (error: any) {
        const code = String(error?.code ?? error?.name ?? "");
        if (code === "ERR_JWT_EXPIRED" || code === "JWTExpired") {
          return NextResponse.json(
            { error: "Session expired", code: "session_expired" },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: "Unauthorized", code: "unauthorized" },
          { status: 401 }
        );
      }
    }

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

    const businessUserId = (user._id as ObjectId).toHexString();
    if (bookingSessionId) {
      if (!sessionEmail || sessionEmail !== customerEmail) {
        return NextResponse.json(
          { error: "Unauthorized", code: "unauthorized" },
          { status: 401 }
        );
      }
    } else {
      if (!customerAccessClaims) {
        return NextResponse.json(
          { error: "Unauthorized", code: "unauthorized" },
          { status: 401 }
        );
      }
      if (customerAccessClaims.businessUserId !== businessUserId) {
        return NextResponse.json(
          { error: "Unauthorized", code: "unauthorized" },
          { status: 401 }
        );
      }
      const expectedCustomerId = customerIdFor({
        businessUserId,
        email: customerEmail,
      });
      if (expectedCustomerId !== customerAccessClaims.customerId) {
        return NextResponse.json(
          { error: "Unauthorized", code: "unauthorized" },
          { status: 401 }
        );
      }
    }
    const isOwnerBooking = normalizeEmail((user as any)?.email) === customerEmail;

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
    if (!Number.isFinite(durationMinutes) || durationMinutes < 10) {
      return NextResponse.json(
        { error: "Invalid service duration" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    const businessSettings = (onboarding as any)?.business ?? {};
    const limitCustomerToOneUpcomingAppointment = Boolean(
      (businessSettings as any).limitCustomerToOneUpcomingAppointment
    );

    // Always enforce: same customer cannot book the same service on the same day.
    // Additionally enforce: only one active future appointment per customer when enabled.
    const timeZone =
      String((onboarding as any)?.availability?.timezone ?? "").trim() || "UTC";
    const todayStr = formatDateInTimeZone(new Date(), timeZone);
    const nowTimeStr = formatTimeInTimeZone(new Date(), timeZone);

    const customerId = customerIdFor({ businessUserId, email: customerEmail });

    // Business-scoped customer block: do not allow booking for this business.
    const existingCustomerForBusiness = isOwnerBooking
      ? null
      : await c.customers.findOne(
        {
          businessUserId: user._id as ObjectId,
          $or: [{ phone: customerPhone }, { email: customerEmail }],
        } as any,
        { projection: { status: 1 } }
      );

    if (
      !isOwnerBooking &&
      String((existingCustomerForBusiness as any)?.status ?? "").toUpperCase() ===
      "BLOCKED"
    ) {
      return NextResponse.json(
        {
          error: "You cannot book with this business.",
          code: "CUSTOMER_BLOCKED_FOR_THIS_BUSINESS",
        },
        { status: 403 }
      );
    }

    if (!isOwnerBooking) {
      const sameServiceSameDay = await c.appointments.findOne(
        {
          businessUserId: user._id as ObjectId,
          status: "BOOKED",
          "customer.id": customerId,
          date,
          serviceId,
        } as any,
        { sort: { startTime: 1 } }
      );

      if (sameServiceSameDay) {
        const sameDayList = await c.appointments
          .find(
            {
              businessUserId: user._id as ObjectId,
              status: "BOOKED",
              "customer.id": customerId,
              date,
            } as any,
            { projection: { date: 1, startTime: 1, endTime: 1, serviceName: 1 } }
          )
          .sort({ startTime: 1 })
          .limit(50)
          .toArray();

        return NextResponse.json(
          {
            error: "You already booked this service on this day.",
            code: "SAME_SERVICE_SAME_DAY_EXISTS",
            existingAppointment: {
              id:
                (sameServiceSameDay as any)?._id?.toHexString?.() ?? undefined,
              date: (sameServiceSameDay as any)?.date,
              startTime: (sameServiceSameDay as any)?.startTime,
              endTime: (sameServiceSameDay as any)?.endTime,
              serviceName: (sameServiceSameDay as any)?.serviceName,
            },
            existingAppointments: sameDayList.map((a: any) => ({
              id: a?._id?.toHexString?.() ?? "",
              date: String(a?.date ?? ""),
              startTime: String(a?.startTime ?? ""),
              endTime: String(a?.endTime ?? ""),
              serviceName: String(a?.serviceName ?? ""),
            })),
            ...(bookingSessionId ? { bookingSessionId } : {}),
          },
          { status: 409 }
        );
      }
    }

    if (!isOwnerBooking && limitCustomerToOneUpcomingAppointment) {
      // Conflict check is computed only after identity is verified (OTP or access cookie).
      const existing = await c.appointments.findOne(
        {
          businessUserId: user._id as ObjectId,
          status: "BOOKED",
          "customer.id": customerId,
          $or: [
            { date: { $gt: todayStr } },
            { date: todayStr, endTime: { $gt: nowTimeStr } },
          ],
        } as any,
        { sort: { date: 1, startTime: 1 } }
      );

      if (existing) {
        const upcomingList = await c.appointments
          .find(
            {
              businessUserId: user._id as ObjectId,
              status: "BOOKED",
              "customer.id": customerId,
              $or: [
                { date: { $gt: todayStr } },
                { date: todayStr, endTime: { $gt: nowTimeStr } },
              ],
            } as any,
            { projection: { date: 1, startTime: 1, endTime: 1, serviceName: 1 } }
          )
          .sort({ date: 1, startTime: 1 })
          .limit(50)
          .toArray();

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
            existingAppointments: upcomingList.map((a: any) => ({
              id: a?._id?.toHexString?.() ?? "",
              date: String(a?.date ?? ""),
              startTime: String(a?.startTime ?? ""),
              endTime: String(a?.endTime ?? ""),
              serviceName: String(a?.serviceName ?? ""),
            })),
            ...(bookingSessionId ? { bookingSessionId } : {}),
          },
          { status: 409 }
        );
      }
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
              status: "ACTIVE",
            },
            $set: {
              fullName: customerFullName,
              phone: customerPhone,
              email: customerEmail,
              isHidden: false,
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
        createdBy: isOwnerBooking ? "BUSINESS" : "CUSTOMER",
        createdAt: new Date(),
      } as any);

      const appointmentId = insert.insertedId.toHexString();

      // Send confirmation email (best-effort).
      const canEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail);
      if (canEmail) {
        try {
          const content = buildAppointmentBookedEmail({
            businessName: String((onboarding as any)?.business?.name ?? "").trim(),
            serviceName: String(service?.name ?? "").trim(),
            date,
            startTime,
            endTime,
          });

          await sendEmail({
            to: customerEmail,
            subject: content.subject,
            text: content.text,
            html: content.html,
          });
        } catch {
          // Ignore email failures.
        }
      }

      await c.customers.updateOne(
        { _id: customerDocId },
        { $set: { lastAppointmentAt: new Date() } }
      );

      const cancelToken = await signBookingCancelToken({
        appointmentId,
        phone: customerPhone,
      });

      const accessToken = await signCustomerAccessToken({
        customerId,
        businessUserId,
      });

      const includeSameDayAppointments =
        !isOwnerBooking && !limitCustomerToOneUpcomingAppointment;

      const sameDayAppointments = includeSameDayAppointments
        ? await c.appointments
          .find(
            {
              businessUserId: user._id as ObjectId,
              status: "BOOKED",
              "customer.id": customerId,
              date,
            } as any,
            {
              projection: {
                serviceName: 1,
                date: 1,
                startTime: 1,
                endTime: 1,
              },
            }
          )
          .sort({ startTime: 1 })
          .limit(50)
          .toArray()
        : null;

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
        sameDayAppointments: Array.isArray(sameDayAppointments)
          ? sameDayAppointments.map((a: any) => ({
            id: a?._id?.toHexString?.() ?? "",
            serviceName: String(a?.serviceName ?? ""),
            date: String(a?.date ?? ""),
            startTime: String(a?.startTime ?? ""),
            endTime: String(a?.endTime ?? ""),
          }))
          : undefined,
        cancelToken,
        ...(bookingSessionId ? { bookingSessionId } : {}),
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
