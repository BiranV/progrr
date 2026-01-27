import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";

function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

export async function GET() {
  try {
    const user = await requireAppUser();
    await ensureIndexes();

    const c = await collections();
    const businessUserId = new ObjectId(user.id);

    const reviews = await c.appointments
      .find(
        {
          businessUserId,
          reviewSubmitted: true,
        } as any,
        {
          projection: {
            _id: 1,
            serviceName: 1,
            date: 1,
            startTime: 1,
            endTime: 1,
            "customer.fullName": 1,
            "customer.email": 1,
            reviewRating: 1,
            reviewComment: 1,
            reviewSubmittedAt: 1,
          },
        },
      )
      .sort({ reviewSubmittedAt: -1, createdAt: -1 })
      .limit(200)
      .toArray();

    return NextResponse.json({
      ok: true,
      reviews: reviews.map((review: any) => ({
        id: String(review._id),
        serviceName: String(review.serviceName ?? "").trim(),
        date: String(review.date ?? "").trim(),
        startTime: String(review.startTime ?? "").trim(),
        endTime: String(review.endTime ?? "").trim(),
        customerName: String(review.customer?.fullName ?? "").trim(),
        customerEmail: String(review.customer?.email ?? "").trim(),
        rating: Number(review.reviewRating ?? 0),
        comment: String(review.reviewComment ?? "").trim(),
        submittedAt:
          review.reviewSubmittedAt instanceof Date
            ? review.reviewSubmittedAt.toISOString()
            : null,
      })),
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireAppUser();
    await ensureIndexes();

    const url = new URL(req.url);
    const id = String(url.searchParams.get("id") ?? "").trim();
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid review id" }, { status: 400 });
    }

    const c = await collections();
    const businessUserId = new ObjectId(user.id);

    const result = await c.appointments.updateOne(
      { _id: new ObjectId(id), businessUserId } as any,
      {
        $set: {
          reviewSubmitted: false,
          reviewSubmittedAt: null,
          reviewRating: null,
          reviewComment: null,
        },
      } as any,
    );

    if (!result.matchedCount) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status },
    );
  }
}
