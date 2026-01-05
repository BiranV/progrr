import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { collections } from "@/server/collections";
import { requireAppUser } from "@/server/auth";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = await requireAppUser();

    if (user.role !== "admin") {
      return NextResponse.json(
        { error: user.role ? "Forbidden" : "Unauthorized" },
        { status: user.role ? 403 : 401 }
      );
    }

    const { clientId } = await ctx.params;
    const targetClientId = String(clientId ?? "").trim();
    if (!ObjectId.isValid(targetClientId)) {
      return NextResponse.json({ ok: true, deletedCount: 0 });
    }

    const c = await collections();
    const adminId = new ObjectId(user.id);

    const result = await c.entities.deleteMany({
      entity: "Message",
      adminId,
      "data.clientId": targetClientId,
    });

    return NextResponse.json({
      ok: true,
      deletedCount: result.deletedCount ?? 0,
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : "Internal Server Error" },
      { status }
    );
  }
}
