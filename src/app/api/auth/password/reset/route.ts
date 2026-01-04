import { NextResponse } from "next/server";
import {
  collections,
  ensureIndexes,
  type OtpPurpose,
} from "@/server/collections";
import { verifyOtp } from "@/server/otp";
import { hashPassword } from "@/server/password";

function normalizeEmail(input: unknown): string {
  return String(input ?? "")
    .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

function purposeForRole(role: string): OtpPurpose | null {
  if (role === "admin") return "admin_password_reset";
  if (role === "client") return "client_password_reset";
  return null;
}

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);
    const role = String(body?.role ?? "")
      .trim()
      .toLowerCase();
    const purpose = purposeForRole(role);
    const code = String(body?.code ?? "").trim();
    const password = String(body?.password ?? "");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!purpose) {
      return NextResponse.json(
        { error: "Role must be admin or client" },
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
        { error: "New password is required" },
        { status: 400 }
      );
    }

    const c = await collections();

    const otp = await c.otps.findOne({ key: email, purpose });
    if (!otp) {
      return NextResponse.json(
        { error: "Code expired or not requested" },
        { status: 400 }
      );
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      await c.otps.deleteOne({ key: email, purpose });
      return NextResponse.json({ error: "Code expired" }, { status: 400 });
    }

    if (otp.attempts >= 5) {
      await c.otps.deleteOne({ key: email, purpose });
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
    }

    const ok = verifyOtp(code, otp.codeHash);
    if (!ok) {
      await c.otps.updateOne(
        { key: email, purpose },
        { $inc: { attempts: 1 } }
      );
      return NextResponse.json({ error: "Invalid code" }, { status: 401 });
    }

    await c.otps.deleteOne({ key: email, purpose });

    const passwordHash = await hashPassword(password);

    if (role === "admin") {
      const update = await c.admins.updateOne(
        { email },
        { $set: { passwordHash } }
      );
      if (update.matchedCount === 0) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }
    } else {
      const update = await c.clients.updateOne(
        { email },
        { $set: { passwordHash } }
      );
      if (update.matchedCount === 0) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
