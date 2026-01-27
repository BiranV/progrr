import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { verifyOtp } from "@/server/otp";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";
import { isValidBusinessPublicId } from "@/server/business-public-id";
import { isValidEmail, normalizeEmail } from "@/lib/email";
import { signReviewAccessToken } from "@/server/jwt";

function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const businessPublicId = String(body?.businessPublicId ?? "").trim();
    const appointmentId = String(body?.appointmentId ?? "").trim();
    const verifyToken = String(body?.verifyToken ?? "").trim();
    const code = String(body?.otp ?? body?.code ?? "").trim();

    if (!verifyToken) {
      return NextResponse.json(
        { error: "Invalid token", code: "invalid_token" },
        { status: 400 },
      );
    }
    if (!code) {
      return NextResponse.json(
        { error: "Code is required", code: "invalid_code" },
        { status: 400 },
      );
    }
    if (!businessPublicId || !isValidBusinessPublicId(businessPublicId)) {
      return NextResponse.json(
        { error: "Invalid businessPublicId" },
        { status: 400 },
      );
    }
    if (!appointmentId || !isValidObjectId(appointmentId)) {
      return NextResponse.json(
        { error: "Invalid appointmentId" },
        { status: 400 },
      );
    }

    const c = await collections();
    const db = await getDb();

    await checkRateLimit({
      db,
      req,
      purpose: "review_otp_verify",
      email: verifyToken,
      perIp: { windowMs: 60_000, limit: 60 },
      perEmail: { windowMs: 10 * 60_000, limit: 10 },
    });

    const purpose = "review" as const;
    const otp = await c.customerOtps.findOne({ verifyToken, purpose });
    if (!otp) {
      return NextResponse.json(
        { error: "Invalid token", code: "invalid_token" },
        { status: 400 },
      );
    }

    if (otp.businessPublicId && otp.businessPublicId !== businessPublicId) {
      return NextResponse.json(
        { error: "Invalid token", code: "invalid_token" },
        { status: 400 },
      );
    }

    if (otp.appointmentId && otp.appointmentId !== appointmentId) {
      return NextResponse.json(
        { error: "Invalid token", code: "invalid_token" },
        { status: 400 },
      );
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      await c.customerOtps.deleteOne({ _id: otp._id });
      return NextResponse.json(
        { error: "Code expired", code: "expired_code" },
        { status: 400 },
      );
    }

    if (otp.attempts >= 5) {
      await c.customerOtps.deleteOne({ _id: otp._id });
      return NextResponse.json(
        { error: "Invalid code", code: "invalid_code" },
        { status: 401 },
      );
    }

    const ok = verifyOtp(code, otp.codeHash);
    if (!ok) {
      await c.customerOtps.updateOne(
        { _id: otp._id },
        { $inc: { attempts: 1 } },
      );
      return NextResponse.json(
        { error: "Invalid code", code: "invalid_code" },
        { status: 401 },
      );
    }

    const email = normalizeEmail(otp.key);
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid token", code: "invalid_token" },
        { status: 400 },
      );
    }

    await c.customerOtps.deleteOne({ _id: otp._id });

    const owner = await c.users.findOne(
      { "onboarding.business.publicId": businessPublicId } as any,
      { projection: { _id: 1 } },
    );

    if (!owner?._id) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }

    const appointment = await c.appointments.findOne(
      {
        _id: new ObjectId(appointmentId),
        businessUserId: owner._id,
      } as any,
      {
        projection: {
          status: 1,
          reviewSubmitted: 1,
          "customer.email": 1,
        },
      },
    );

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 },
      );
    }

    if (String((appointment as any).status ?? "") !== "COMPLETED") {
      return NextResponse.json(
        { error: "Review is not available for this appointment" },
        { status: 400 },
      );
    }

    if (Boolean((appointment as any).reviewSubmitted)) {
      return NextResponse.json(
        { error: "Review already submitted" },
        { status: 409 },
      );
    }

    const appointmentEmail = normalizeEmail(
      (appointment as any)?.customer?.email,
    );
    if (!appointmentEmail || appointmentEmail !== email) {
      return NextResponse.json(
        { error: "Email does not match this appointment" },
        { status: 400 },
      );
    }

    const reviewAccessToken = await signReviewAccessToken({
      email,
      appointmentId,
      businessPublicId,
    });

    return NextResponse.json({ ok: true, reviewAccessToken });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
}
