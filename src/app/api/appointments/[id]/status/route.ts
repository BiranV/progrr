import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";

const ALLOWED_STATUSES = ["BOOKED", "COMPLETED", "CANCELED"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAppUser();
    await ensureIndexes();

    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid appointment id" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const nextStatusRaw = String((body as any)?.status ?? "")
      .trim()
      .toUpperCase();
    const nextStatus = (ALLOWED_STATUSES as readonly string[]).includes(
      nextStatusRaw,
    )
      ? (nextStatusRaw as AllowedStatus)
      : null;

    if (!nextStatus) {
      return NextResponse.json(
        { error: `Invalid status (allowed: ${ALLOWED_STATUSES.join(", ")})` },
        { status: 400 },
      );
    }

    const c = await collections();
    const apptId = new ObjectId(id);
    const appt = await c.appointments.findOne({ _id: apptId });
    if (!appt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if ((appt.businessUserId as ObjectId).toHexString() !== String(user.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await c.appointments.updateOne(
      { _id: apptId } as any,
      [
        {
          $set: {
            status: nextStatus,
            paymentStatus: {
              $cond: [
                { $eq: [nextStatus, "COMPLETED"] },
                { $ifNull: ["$paymentStatus", "UNPAID"] },
                {
                  $cond: [
                    { $eq: [nextStatus, "BOOKED"] },
                    "UNPAID",
                    "$paymentStatus",
                  ],
                },
              ],
            },
          },
        },
      ] as any,
    );

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
}
