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

function isFutureBooking(args: {
  date: string;
  startTime: string;
  todayStr: string;
  nowTimeStr: string;
}): boolean {
  if (args.date > args.todayStr) return true;
  if (args.date < args.todayStr) return false;
  return args.startTime > args.nowTimeStr;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAppUser();
    await ensureIndexes();

    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid customer id" },
        { status: 400 }
      );
    }

    const c = await collections();
    const businessUserId = new ObjectId(user.id);

    const customer = await c.customers.findOne({
      _id: new ObjectId(id),
      businessUserId,
    });

    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const owner = await c.users.findOne({ _id: businessUserId });
    const timeZone =
      String((owner as any)?.onboarding?.availability?.timezone ?? "").trim() ||
      "UTC";
    const todayStr = formatDateInTimeZone(new Date(), timeZone);
    const nowTimeStr = formatTimeInTimeZone(new Date(), timeZone);

    const phone = String((customer as any)?.phone ?? "").trim();
    const email = String((customer as any)?.email ?? "")
      .trim()
      .toLowerCase();

    const appts = await c.appointments
      .find(
        {
          businessUserId,
          $or: [
            { customerId: customer._id },
            ...(phone ? [{ "customer.phone": phone }] : []),
            ...(email ? [{ "customer.email": email }] : []),
          ],
        } as any,
        {
          projection: {
            serviceName: 1,
            date: 1,
            startTime: 1,
            endTime: 1,
            status: 1,
            createdAt: 1,
            cancelledAt: 1,
          },
        }
      )
      .sort({ date: -1, startTime: -1, createdAt: -1 })
      .limit(500)
      .toArray();

    const history = appts.map((a: any) => {
      const rawStatus = String(a?.status ?? "");
      const cancelled = rawStatus === "CANCELLED" || rawStatus === "CANCELED";

      let status: "ACTIVE" | "CANCELED" | "COMPLETED";
      if (cancelled) {
        status = "CANCELED";
      } else {
        status = isFutureBooking({
          date: String(a?.date ?? ""),
          startTime: String(a?.startTime ?? ""),
          todayStr,
          nowTimeStr,
        })
          ? "ACTIVE"
          : "COMPLETED";
      }

      return {
        id: a?._id?.toHexString?.() ?? "",
        serviceName: String(a?.serviceName ?? ""),
        date: String(a?.date ?? ""),
        startTime: String(a?.startTime ?? ""),
        endTime: String(a?.endTime ?? ""),
        status,
      };
    });

    const activeBookingsCount = history.filter(
      (h) => h.status === "ACTIVE"
    ).length;

    return NextResponse.json({
      ok: true,
      customer: {
        id: customer._id!.toHexString(),
        fullName: String((customer as any)?.fullName ?? ""),
        phone: String((customer as any)?.phone ?? ""),
        email: String((customer as any)?.email ?? "") || undefined,
      },
      activeBookingsCount,
      bookings: history,
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
