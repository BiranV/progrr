import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { hashReviewToken } from "@/server/review-tokens";

function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

export async function GET(req: Request) {
  try {
    await ensureIndexes();

    const url = new URL(req.url);
    const token = String(url.searchParams.get("token") ?? "").trim();
    const businessPublicId = String(
      url.searchParams.get("businessPublicId") ?? "",
    ).trim();

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    const c = await collections();
    const tokenHash = hashReviewToken(token);

    const tokenDoc = await c.reviewTokens.findOne({ tokenHash } as any);
    if (!tokenDoc) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    if (tokenDoc.expiresAt?.getTime?.() < Date.now()) {
      await c.reviewTokens.deleteOne({ _id: tokenDoc._id } as any);
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    if (tokenDoc.usedAt) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    const appointmentId = String(tokenDoc.appointmentId ?? "").trim();
    if (!appointmentId || !isValidObjectId(appointmentId)) {
      return NextResponse.json({ valid: false }, { status: 200 });
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
          customerId: 1,
        },
      },
    );

    if (!appointment) {
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    if (businessPublicId) {
      const owner = await c.users.findOne(
        { _id: tokenDoc.businessUserId } as any,
        { projection: { "onboarding.business.publicId": 1 } },
      );
      const ownerPublicId = String(
        (owner as any)?.onboarding?.business?.publicId ?? "",
      ).trim();
      if (ownerPublicId && ownerPublicId !== businessPublicId) {
        return NextResponse.json({ valid: false }, { status: 200 });
      }
    }

    const status = String((appointment as any).status ?? "");
    const reviewSubmitted = Boolean((appointment as any).reviewSubmitted);
    const reviewAllowed = status === "COMPLETED" && !reviewSubmitted;

    return NextResponse.json({
      valid: true,
      reviewAllowed,
      appointmentId,
      reviewSubmitted,
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
}
