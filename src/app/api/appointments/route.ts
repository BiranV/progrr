import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";
import { processReviewRequestsForBusiness } from "@/server/reviews";
import { formatDateInTimeZone } from "@/lib/public-booking";
import { normalizeEmail } from "@/lib/email";

function formatTimeInTimeZone(date: Date, timeZone: string): string {
  // 24-hour, zero-padded HH:mm so string comparisons work.
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
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function isYmd(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());
}

export async function GET(req: Request) {
  try {
    const user = await requireAppUser();
    await ensureIndexes();

    const url = new URL(req.url);
    const date = String(url.searchParams.get("date") ?? "").trim();
    if (!isYmd(date)) {
      return NextResponse.json(
        { error: "Missing or invalid date (expected YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    const c = await collections();
    const businessUserId = new ObjectId(user.id);

    // Convert passed appointments to COMPLETED so the UI + revenue logic stays consistent.
    // We do this lazily on reads to avoid needing a background job.
    const owner = await c.users.findOne({ _id: businessUserId } as any, {
      projection: { "onboarding.availability.timezone": 1 },
    });
    const timeZone = String(
      (owner as any)?.onboarding?.availability?.timezone || "UTC",
    );
    const now = new Date();
    let todayStr: string;
    let nowTimeStr: string;
    try {
      todayStr = formatDateInTimeZone(now, timeZone);
      nowTimeStr = formatTimeInTimeZone(now, timeZone);
    } catch {
      todayStr = formatDateInTimeZone(now, "UTC");
      nowTimeStr = formatTimeInTimeZone(now, "UTC");
    }

    if (date < todayStr) {
      await c.appointments.updateMany(
        {
          businessUserId,
          status: "BOOKED",
          date,
        } as any,
        [
          {
            $set: {
              status: "COMPLETED",
              paymentStatus: {
                $ifNull: ["$paymentStatus", "UNPAID"],
              },
              completedAt: { $ifNull: ["$completedAt", new Date()] },
            },
          },
        ] as any,
      );
    } else if (date === todayStr) {
      await c.appointments.updateMany(
        {
          businessUserId,
          status: "BOOKED",
          date,
          endTime: { $lte: nowTimeStr },
        } as any,
        [
          {
            $set: {
              status: "COMPLETED",
              paymentStatus: {
                $ifNull: ["$paymentStatus", "UNPAID"],
              },
              completedAt: { $ifNull: ["$completedAt", new Date()] },
            },
          },
        ] as any,
      );
    }

    processReviewRequestsForBusiness({ businessUserId }).catch((err) =>
      console.error("Review request processing failed", err),
    );

    const appts = await c.appointments
      .find({ businessUserId, date } as any, {
        projection: {
          serviceName: 1,
          startTime: 1,
          endTime: 1,
          status: 1,
          paymentStatus: 1,
          cancelledBy: 1,
          customer: 1,
          notes: 1,
        },
      })
      .sort({ startTime: 1 })
      .limit(500)
      .toArray();

    const payload = appts.map((a: any) => ({
      id: a?._id?.toHexString?.() ?? "",
      date: String(a?.date ?? ""),
      startTime: String(a?.startTime ?? ""),
      endTime: String(a?.endTime ?? ""),
      serviceName: String(a?.serviceName ?? ""),
      status: String(a?.status ?? ""),
      cancelledBy:
        typeof a?.cancelledBy === "string" ? a.cancelledBy : undefined,
      bookedByYou:
        normalizeEmail(a?.customer?.email) === normalizeEmail(user.email),
      customer: {
        fullName: String(a?.customer?.fullName ?? ""),
        phone: String(a?.customer?.phone ?? ""),
        email: String(a?.customer?.email ?? "") || undefined,
      },
      paymentStatus: String(a?.paymentStatus ?? "") || undefined,
      notes: String(a?.notes ?? "") || undefined,
    }));

    return NextResponse.json({ ok: true, appointments: payload });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
}
