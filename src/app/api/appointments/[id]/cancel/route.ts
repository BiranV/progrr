import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAppUser();
    await ensureIndexes();

    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid appointment id" },
        { status: 400 }
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

    if (appt.status === "CANCELLED" || appt.status === "CANCELED") {
      return NextResponse.json({ ok: true, alreadyCanceled: true });
    }

    await c.appointments.updateOne(
      { _id: apptId },
      { $set: { status: "CANCELED", cancelledAt: new Date() } }
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
