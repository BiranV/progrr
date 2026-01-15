import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";

export async function GET() {
  try {
    const user = await requireAppUser();
    await ensureIndexes();

    const c = await collections();
    const businessUserId = new ObjectId(user.id);

    const customers = await c.customers
      .find(
        {
          businessUserId,
          appointmentsCount: { $gt: 0 },
        } as any,
        {
          projection: {
            fullName: 1,
            phone: 1,
            email: 1,
            appointmentsCount: 1,
            lastAppointmentAt: 1,
            createdAt: 1,
          },
        }
      )
      .sort({ lastAppointmentAt: -1, createdAt: -1 })
      .limit(500)
      .toArray();

    return NextResponse.json({ ok: true, customers });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
