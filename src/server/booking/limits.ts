import { ObjectId } from "mongodb";

import { collections } from "@/server/collections";
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

export async function canCustomerBook(
  businessUserId: ObjectId,
  customerId: ObjectId,
  now: Date,
  opts?: { excludeAppointmentId?: ObjectId }
): Promise<boolean> {
  const c = await collections();

  const owner = await c.users.findOne(
    { _id: businessUserId } as any,
    { projection: { "onboarding.business.limitCustomerToOneUpcomingAppointment": 1, "onboarding.availability.timezone": 1 } }
  );

  const onboarding = (owner as any)?.onboarding ?? {};
  const business = onboarding?.business ?? {};
  const limitCustomerToOneUpcomingAppointment = Boolean(
    business?.limitCustomerToOneUpcomingAppointment
  );

  if (!limitCustomerToOneUpcomingAppointment) return true;

  const timeZone =
    String(onboarding?.availability?.timezone ?? "").trim() || "UTC";
  const todayStr = formatDateInTimeZone(now, timeZone);
  const nowTimeStr = formatTimeInTimeZone(now, timeZone);

  const query: any = {
    businessUserId,
    customerId,
    status: { $nin: ["CANCELLED", "CANCELED", "NO_SHOW"] },
    $or: [
      { date: { $gt: todayStr } },
      { date: todayStr, startTime: { $gt: nowTimeStr } },
    ],
  };

  if (opts?.excludeAppointmentId) {
    query._id = { $ne: opts.excludeAppointmentId };
  }

  const count = await c.appointments.countDocuments(query as any);
  return count < 1;
}
