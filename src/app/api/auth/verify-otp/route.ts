import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { verifyOtp } from "@/server/otp";
import { signAuthToken } from "@/server/jwt";
import { setAuthCookie } from "@/server/auth-cookie";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";
import { ensureBusinessPublicIdForUser } from "@/server/business-public-id";

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
    const fullName = String(body?.full_name ?? body?.fullName ?? "").trim();
    const flow = String(body?.flow ?? "")
      .trim()
      .toLowerCase();

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

    if (flow !== "login" && flow !== "signup") {
      return NextResponse.json({ error: "Invalid flow" }, { status: 400 });
    }

    const c = await collections();

    const db = await getDb();
    await checkRateLimit({
      db,
      req,
      purpose: "otp_verify",
      email,
      perIp: { windowMs: 60_000, limit: 30 },
      perEmail: { windowMs: 600_000, limit: 10 },
    });

    const existing = await c.users.findOne({ email });

    if (flow === "login" && !existing) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (flow === "signup" && existing) {
      return NextResponse.json(
        { error: "EMAIL_ALREADY_EXISTS" },
        { status: 409 }
      );
    }

    // IMPORTANT: never auto-switch signup into login.
    const purpose = flow;

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

    let userId: string;
    let onboardingCompleted = false;
    let fullNameOut: string | null = null;

    if (flow === "login") {
      // existing is guaranteed by the checks above
      userId = existing!._id!.toHexString();
      onboardingCompleted = Boolean((existing as any).onboardingCompleted);
      fullNameOut = (existing as any).fullName ?? null;
    } else {
      // flow === "signup" and existing is guaranteed to be null by the checks above
      const trialStartAt = new Date();
      const trialEndAt = new Date(trialStartAt.getTime() + 14 * 24 * 60 * 60 * 1000);

      const insert = await c.users.insertOne({
        email,
        createdAt: trialStartAt,
        fullName: fullName || undefined,
        onboardingCompleted: false,
        onboarding: {
          business: {
            trialStartAt,
            trialEndAt,
            subscriptionStatus: "trial",
          },
          updatedAt: trialStartAt,
        },
      } as any);
      // Allocate immutable, unique 5-digit public business id at signup time.
      await ensureBusinessPublicIdForUser(insert.insertedId as ObjectId).catch(
        async (e) => {
          // Avoid leaving a partially created user without a stable public id.
          await c.users
            .deleteOne({ _id: insert.insertedId as ObjectId })
            .catch(() => null);
          throw e;
        }
      );

      userId = insert.insertedId.toHexString();
      onboardingCompleted = false;
      fullNameOut = fullName || null;
    }

    const token = await signAuthToken({ sub: userId, onboardingCompleted });

    const res = NextResponse.json({
      ok: true,
      onboardingCompleted,
      redirectTo: onboardingCompleted ? "/dashboard" : "/onboarding",
      user: {
        id: userId,
        email,
        full_name: fullNameOut,
        onboardingCompleted,
      },
    });
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
