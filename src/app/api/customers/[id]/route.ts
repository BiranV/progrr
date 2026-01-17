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
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAppUser();
    await ensureIndexes();

    const url = new URL(req.url);
    const pageRaw = String(url.searchParams.get("page") ?? "1").trim();
    const pageSizeRaw = String(url.searchParams.get("pageSize") ?? "10").trim();
    const page = Math.max(1, Number(pageRaw) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(pageSizeRaw) || 10));

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

    const customerAppointmentsFilter = {
      businessUserId,
      $or: [
        { customerId: customer._id },
        ...(phone ? [{ "customer.phone": phone }] : []),
        ...(email ? [{ "customer.email": email }] : []),
      ],
    } as any;

    const [totalBookingsCount, activeBookingsCount] = await Promise.all([
      c.appointments.countDocuments(customerAppointmentsFilter),
      c.appointments.countDocuments({
        ...customerAppointmentsFilter,
        status: "BOOKED",
        $or: [
          { date: { $gt: todayStr } },
          { date: todayStr, startTime: { $gt: nowTimeStr } },
        ],
      } as any),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalBookingsCount / pageSize));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * pageSize;

    const appts = await c.appointments
      .find(
        customerAppointmentsFilter,
        {
          projection: {
            serviceName: 1,
            date: 1,
            startTime: 1,
            endTime: 1,
            status: 1,
            createdAt: 1,
            cancelledAt: 1,
            cancelledBy: 1,
          },
        }
      )
      .sort({ date: -1, startTime: -1, createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .toArray();

    const history = appts.map((a: any) => {
      const rawStatus = String(a?.status ?? "");
      const cancelled = rawStatus === "CANCELLED" || rawStatus === "CANCELED";

      let status: "BOOKED" | "CANCELED" | "COMPLETED" | "NO_SHOW";
      if (cancelled) {
        status = "CANCELED";
      } else if (rawStatus === "NO_SHOW") {
        status = "NO_SHOW";
      } else if (rawStatus === "COMPLETED") {
        status = "COMPLETED";
      } else {
        status = isFutureBooking({
          date: String(a?.date ?? ""),
          startTime: String(a?.startTime ?? ""),
          todayStr,
          nowTimeStr,
        })
          ? "BOOKED"
          : "COMPLETED";
      }

      return {
        id: a?._id?.toHexString?.() ?? "",
        serviceName: String(a?.serviceName ?? ""),
        date: String(a?.date ?? ""),
        startTime: String(a?.startTime ?? ""),
        endTime: String(a?.endTime ?? ""),
        status,
        cancelledBy:
          typeof a?.cancelledBy === "string" ? String(a.cancelledBy) : undefined,
      };
    });

    return NextResponse.json({
      ok: true,
      customer: {
        id: customer._id!.toHexString(),
        fullName: String((customer as any)?.fullName ?? ""),
        phone: String((customer as any)?.phone ?? ""),
        email: String((customer as any)?.email ?? "") || undefined,
        status: String((customer as any)?.status ?? "ACTIVE"),
        isHidden: Boolean((customer as any)?.isHidden ?? false),
      },
      activeBookingsCount,
      bookingsPagination: {
        page: safePage,
        pageSize,
        totalPages,
        totalBookingsCount,
      },
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

export async function PATCH(
  req: Request,
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

    const body = await req.json().catch(() => ({}));
    const action = String((body as any)?.action ?? "").trim();

    const c = await collections();
    const businessUserId = new ObjectId(user.id);
    const _id = new ObjectId(id);

    const customer = await c.customers.findOne({ _id, businessUserId } as any);
    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const update: any = { $set: {} as any };

    if (action === "block") {
      update.$set.status = "BLOCKED";
    } else if (action === "unblock") {
      update.$set.status = "ACTIVE";
    } else if (action === "hide") {
      update.$set.isHidden = true;
    } else if (action === "unhide") {
      update.$set.isHidden = false;
    } else {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    const result = await c.customers.findOneAndUpdate(
      { _id, businessUserId } as any,
      update,
      { returnDocument: "after" }
    );

    return NextResponse.json({
      ok: true,
      customer: {
        id,
        status: String((result as any)?.status ?? "ACTIVE"),
        isHidden: Boolean((result as any)?.isHidden ?? false),
      },
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
