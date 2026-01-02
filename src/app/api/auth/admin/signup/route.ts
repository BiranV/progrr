import { NextResponse } from "next/server";
import { collections, ensureIndexes } from "@/server/collections";
import { requireOwner } from "@/server/owner";
import { hashPassword } from "@/server/password";
import { signAuthToken } from "@/server/jwt";
import { setAuthCookie } from "@/server/auth-cookie";

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body?.password ?? "");
    const fullName = String(body?.full_name ?? body?.fullName ?? "").trim();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    const owner = await requireOwner();
    const c = await collections();

    const existing = await c.admins.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: "This email is already registered. Please log in instead." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const insert = await c.admins.insertOne({
      ownerId: owner._id,
      email,
      passwordHash,
      createdAt: new Date(),
      fullName: fullName || undefined,
      role: "admin",
    } as any);

    const adminId = insert.insertedId.toHexString();
    const token = await signAuthToken({ sub: adminId, role: "admin", adminId });

    const res = NextResponse.json({ ok: true });
    setAuthCookie(res, token);
    return res;
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
