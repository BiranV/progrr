import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";

import { collections, ensureIndexes } from "@/server/collections";
import { normalizePhone } from "@/server/phone";
import {
  verifyBookingCancelToken,
  verifyBookingVerifyToken,
  verifyCustomerAccessToken,
} from "@/server/jwt";
import { CUSTOMER_ACCESS_COOKIE_NAME } from "@/server/customer-access";

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
    const cancelToken = String(body?.cancelToken ?? "").trim();
    const bookingSessionId = String(body?.bookingSessionId ?? "").trim();
    const appointmentId = String(body?.appointmentId ?? "").trim();
    const customerEmail = normalizeEmail(body?.customerEmail);

    const c = await collections();

    // Cancellation via customer access cookie (HttpOnly, long-lived)
    // This supports "Not you?" identification + cancellation across reloads.
    if (!cancelToken && !bookingSessionId && appointmentId) {
      const cookieStore = await cookies();
      const token = cookieStore.get(CUSTOMER_ACCESS_COOKIE_NAME)?.value;
      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const claims = await verifyCustomerAccessToken(token);
      const apptId = new ObjectId(appointmentId);
      const appt = await c.appointments.findOne({ _id: apptId });
      if (!appt) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const businessUserId = (appt.businessUserId as ObjectId).toHexString();
      if (claims.businessUserId !== businessUserId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (String((appt as any)?.customer?.id ?? "") !== claims.customerId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (appt.status === "CANCELLED" || appt.status === "CANCELED") {
        return NextResponse.json({ ok: true, alreadyCancelled: true });
      }

      await c.appointments.updateOne(
        { _id: apptId },
        { $set: { status: "CANCELED", cancelledAt: new Date(), cancelledBy: "CUSTOMER" } }
      );

      return NextResponse.json({ ok: true });
    }

    // Legacy cancellation: cancelToken (phone-bound)
    if (cancelToken) {
      const claims = await verifyBookingCancelToken(cancelToken);
      const phone = normalizePhone(claims.phone);

      const apptId = new ObjectId(claims.appointmentId);
      const appt = await c.appointments.findOne({ _id: apptId });
      if (!appt) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      if (normalizePhone(appt.customer.phone) !== phone) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (appt.status === "CANCELLED" || appt.status === "CANCELED") {
        return NextResponse.json({ ok: true, alreadyCancelled: true });
      }

      await c.appointments.updateOne(
        { _id: apptId },
        { $set: { status: "CANCELED", cancelledAt: new Date(), cancelledBy: "CUSTOMER" } }
      );

      return NextResponse.json({ ok: true });
    }

    // Cancellation via verified booking session (email-bound)
    if (!bookingSessionId) {
      return NextResponse.json(
        { error: "cancelToken or bookingSessionId is required" },
        { status: 400 }
      );
    }
    if (!appointmentId) {
      return NextResponse.json(
        { error: "appointmentId is required" },
        { status: 400 }
      );
    }
    if (!customerEmail) {
      return NextResponse.json(
        { error: "customerEmail is required" },
        { status: 400 }
      );
    }

    const claims = await verifyBookingVerifyToken(bookingSessionId);
    if (normalizeEmail(claims.email) !== customerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apptId = new ObjectId(appointmentId);
    const appt = await c.appointments.findOne({ _id: apptId });
    if (!appt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (normalizeEmail(appt.customer.email) !== customerEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (appt.status === "CANCELLED" || appt.status === "CANCELED") {
      return NextResponse.json({ ok: true, alreadyCancelled: true });
    }

    await c.appointments.updateOne(
      { _id: apptId },
      { $set: { status: "CANCELED", cancelledAt: new Date(), cancelledBy: "CUSTOMER" } }
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
