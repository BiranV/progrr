import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { verifyOtp } from "@/server/otp";
import { requireOwner } from "@/server/owner";
import { hashPassword } from "@/server/password";
import { signAuthToken } from "@/server/jwt";
import { setAuthCookie } from "@/server/auth-cookie";

function normalizeEmail(input: unknown): string {
  return String(input ?? "")
    .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const code = String(body?.code ?? "").trim();
    const password = String(body?.password ?? "");
    const fullName = String(body?.full_name ?? body?.fullName ?? "").trim();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }
    if (!code) {
      return NextResponse.json(
        { error: "Verification code is required" },
        { status: 400 }
      );
    }
    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    const c = await collections();

    const existing = await c.admins.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: "This email is already registered. Please log in instead." },
        { status: 409 }
      );
    }

    const otp = await c.otps.findOne({ key: email, purpose: "admin_signup" });
    if (!otp) {
      return NextResponse.json(
        { error: "Code expired or not requested" },
        { status: 400 }
      );
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      await c.otps.deleteOne({ key: email, purpose: "admin_signup" });
      return NextResponse.json({ error: "Code expired" }, { status: 400 });
    }

    if (otp.attempts >= 5) {
      await c.otps.deleteOne({ key: email, purpose: "admin_signup" });
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
    }

    const ok = verifyOtp(code, otp.codeHash);
    if (!ok) {
      await c.otps.updateOne(
        { key: email, purpose: "admin_signup" },
        { $inc: { attempts: 1 } }
      );
      return NextResponse.json({ error: "Invalid code" }, { status: 401 });
    }

    await c.otps.deleteOne({ key: email, purpose: "admin_signup" });

    const owner = await requireOwner();
    const passwordHash = await hashPassword(password);

    const insert = await c.admins.insertOne({
      ownerId: new ObjectId(owner._id),
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
