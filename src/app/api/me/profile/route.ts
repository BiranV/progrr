import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";

export const runtime = "nodejs";

const bodySchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(30).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireAppUser();
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = bodySchema.parse(await req.json().catch(() => ({})));

    const phone =
      typeof parsed.phone === "string" && parsed.phone.trim()
        ? parsed.phone.trim()
        : undefined;

    const c = await collections();
    await c.admins.updateOne(
      { _id: new ObjectId(user.id) },
      phone
        ? { $set: { fullName: parsed.fullName, phone } }
        : { $set: { fullName: parsed.fullName }, $unset: { phone: "" } }
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message = error?.name === "ZodError" ? "Invalid request body" : null;

    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : message || "Request failed" },
      { status }
    );
  }
}
