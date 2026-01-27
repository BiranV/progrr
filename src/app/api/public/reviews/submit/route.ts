import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { verifyReviewAccessToken } from "@/server/jwt";
import { isValidBusinessPublicId } from "@/server/business-public-id";
import { normalizeEmail } from "@/lib/email";

function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const reviewAccessToken = String(body?.reviewAccessToken ?? "").trim();
    const rating = Number(body?.rating ?? 0);
    const comment = String(body?.comment ?? "").trim();

    if (!reviewAccessToken) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 },
      );
    }

    if (comment.length > 1000) {
      return NextResponse.json(
        { error: "Comment is too long" },
        { status: 400 },
      );
    }

    const claims = await verifyReviewAccessToken(reviewAccessToken);

    const businessPublicId = claims.businessPublicId;
    const appointmentId = claims.appointmentId;
    const email = normalizeEmail(claims.email);

    if (!businessPublicId || !isValidBusinessPublicId(businessPublicId)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    if (!appointmentId || !isValidObjectId(appointmentId)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const c = await collections();
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

    await c.appointments.updateOne(
      { _id: new ObjectId(appointmentId) } as any,
      {
        $set: {
          reviewSubmitted: true,
          reviewSubmittedAt: new Date(),
          reviewRating: Math.round(rating),
          reviewComment: comment || null,
        },
      } as any,
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
}
