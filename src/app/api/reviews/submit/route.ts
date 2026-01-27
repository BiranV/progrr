import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { hashReviewToken } from "@/server/review-tokens";

function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "").trim();
    const rating = Number(body?.rating ?? 0);
    const comment = String(body?.comment ?? "").trim();

    if (!token) {
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

    const c = await collections();
    const tokenHash = hashReviewToken(token);

    const tokenDoc = await c.reviewTokens.findOne({ tokenHash } as any);
    if (!tokenDoc) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (tokenDoc.expiresAt?.getTime?.() < Date.now()) {
      await c.reviewTokens.deleteOne({ _id: tokenDoc._id } as any);
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }

    if (tokenDoc.usedAt) {
      return NextResponse.json({ error: "Token already used" }, { status: 409 });
    }

    const appointmentId = String(tokenDoc.appointmentId ?? "").trim();
    if (!appointmentId || !isValidObjectId(appointmentId)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const appointment = await c.appointments.findOne(
      {
        _id: new ObjectId(appointmentId),
        businessUserId: tokenDoc.businessUserId,
      } as any,
      {
        projection: {
          status: 1,
          reviewSubmitted: 1,
          serviceName: 1,
          date: 1,
          startTime: 1,
          endTime: 1,
          "customer.fullName": 1,
        },
      },
    );

    if (!appointment) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
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

    const update = await c.appointments.updateOne(
      {
        _id: new ObjectId(appointmentId),
        businessUserId: tokenDoc.businessUserId,
        reviewSubmitted: { $ne: true },
      } as any,
      {
        $set: {
          reviewSubmitted: true,
          reviewSubmittedAt: new Date(),
          reviewRating: Math.round(rating),
          reviewComment: comment || null,
        },
      } as any,
    );

    if (!update.matchedCount) {
      return NextResponse.json(
        { error: "Review already submitted" },
        { status: 409 },
      );
    }

    await c.reviewTokens.updateOne(
      { _id: tokenDoc._id } as any,
      { $set: { usedAt: new Date() } } as any,
    );
    await c.reviewTokens.deleteOne({ _id: tokenDoc._id } as any);

    return NextResponse.json({
      ok: true,
      review: {
        appointmentId,
        serviceName: String((appointment as any)?.serviceName ?? "").trim(),
        date: String((appointment as any)?.date ?? "").trim(),
        startTime: String((appointment as any)?.startTime ?? "").trim(),
        endTime: String((appointment as any)?.endTime ?? "").trim(),
        customerName: String((appointment as any)?.customer?.fullName ?? "").trim(),
        rating: Math.round(rating),
        comment: comment || "",
      },
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
}
