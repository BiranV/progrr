import { NextResponse } from "next/server";
import {
  collections,
  ensureIndexes,
  type OtpPurpose,
} from "@/server/collections";
import { generateOtp } from "@/server/otp";
import { sendEmail } from "@/server/email";

function normalizeEmail(input: unknown): string {
  return String(input ?? "")
    .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }
    if (!purpose) {
      return NextResponse.json(
        { error: "Role must be admin or client" },
        { status: 400 }
      );
    }

    const c = await collections();

    if (role === "admin") {
      const admin = await c.admins.findOne({ email });
      if (!admin) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }
    } else {
      const client = await c.clients.findOne({ email });
      if (!client) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }
    }

    const { code, hash } = generateOtp(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await c.otps.updateOne(
      { key: email, purpose },
      {
        $set: {
          key: email,
          purpose,
          codeHash: hash,
          expiresAt,
          attempts: 0,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    await sendEmail({
      to: email,
      subject: "Your Progrr password reset code",
      text: `Your Progrr password reset code is: ${code}. This code expires in 10 minutes.`,
    });

    return NextResponse.json({ ok: true, delivery: "email" });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
