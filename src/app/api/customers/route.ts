import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";
import { formatDateInTimeZone } from "@/lib/public-booking";

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

export async function GET() {
  try {
    const user = await requireAppUser();
    await ensureIndexes();

    const c = await collections();
    const businessUserId = new ObjectId(user.id);

    const owner = await c.users.findOne({ _id: businessUserId });
    const timeZone =
      String((owner as any)?.onboarding?.availability?.timezone ?? "").trim() ||
      "UTC";
    const todayStr = formatDateInTimeZone(new Date(), timeZone);
    const nowTimeStr = formatTimeInTimeZone(new Date(), timeZone);

    const customers = await c.customers
      .find({ businessUserId } as any, {
        projection: {
          fullName: 1,
          phone: 1,
          email: 1,
          lastAppointmentAt: 1,
          createdAt: 1,
        },
      })
      .sort({ lastAppointmentAt: -1, createdAt: -1 })
      .limit(1000)
      .toArray();

    const activeCounts = await c.appointments
      .aggregate([
        {
          $match: {
            businessUserId,
            status: "BOOKED",
            $or: [
              { date: { $gt: todayStr } },
              { date: todayStr, startTime: { $gt: nowTimeStr } },
            ],
          },
        },
        { $group: { _id: "$customerId", count: { $sum: 1 } } },
      ])
      .toArray();

    const countByCustomerId = new Map<string, number>();
    for (const row of activeCounts as any[]) {
      const id = row?._id?.toHexString?.();
      if (!id) continue;
      countByCustomerId.set(id, Number(row?.count) || 0);
    }

    const payload = customers.map((cust: any) => {
      const id = cust?._id?.toHexString?.() ?? "";
      return {
        _id: id,
        fullName: String(cust?.fullName ?? ""),
        phone: String(cust?.phone ?? ""),
        email: String(cust?.email ?? "") || undefined,
        activeBookingsCount: countByCustomerId.get(id) ?? 0,
        lastAppointmentAt: cust?.lastAppointmentAt,
        createdAt: cust?.createdAt,
      };
    });

    return NextResponse.json({ ok: true, customers: payload });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
