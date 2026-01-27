import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";
import { processReviewRequestsForBusiness } from "@/server/reviews";

const ALLOWED_STATUSES = ["PAID", "UNPAID"] as const;
type PaymentStatus = (typeof ALLOWED_STATUSES)[number];

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
    const paymentStatusRaw = String((body as any)?.paymentStatus ?? "")
      .trim()
      .toUpperCase();
    const paymentStatus = (ALLOWED_STATUSES as readonly string[]).includes(
      paymentStatusRaw,
    )
      ? (paymentStatusRaw as PaymentStatus)
      : null;

    if (!paymentStatus) {
      return NextResponse.json(
        {
          error: `Invalid paymentStatus (allowed: ${ALLOWED_STATUSES.join(", ")})`,
        },
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

    const now = new Date();
    await c.appointments.updateOne(
      { _id: apptId } as any,
      {
        $set: {
          paymentStatus,
          paymentPaidAt: paymentStatus === "PAID" ? now : null,
          ...(paymentStatus === "UNPAID"
            ? {
                reviewEmailScheduled: false,
                reviewEmailScheduledAt: null,
              }
            : {}),
        },
      } as any,
    );

    processReviewRequestsForBusiness({
      businessUserId: new ObjectId(user.id),
      appointmentId: apptId,
      now,
    }).catch((err) => console.error("Review request failed", err));

    return NextResponse.json({ ok: true, paymentStatus });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
}
