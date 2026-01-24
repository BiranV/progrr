import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";

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

    const customer = await c.businessCustomers.findOne({
      businessUserId,
      customerId: _id,
    } as any);
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

    const result = await c.businessCustomers.findOneAndUpdate(
      { customerId: _id, businessUserId } as any,
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
