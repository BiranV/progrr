import { NextResponse } from "next/server";
import { collections, ensureIndexes } from "@/server/collections";
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

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(body?.email);

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
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

    const { code, hash } = generateOtp(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await c.otps.updateOne(
      { key: email, purpose: "admin_signup" },
      {
        $set: {
          key: email,
          purpose: "admin_signup",
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
      subject: "Your Progrr admin signup code",
      text: `Your Progrr admin signup code is: ${code}. This code expires in 10 minutes.`,
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
