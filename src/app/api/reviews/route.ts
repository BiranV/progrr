import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

export async function GET(req: Request) {
  try {
    const user = await requireAppUser();
    await ensureIndexes();

    const url = new URL(req.url);
    const pageRaw = Number(url.searchParams.get("page") ?? "1");
    const limitRaw = Number(url.searchParams.get("limit") ?? "10");
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(50, Math.round(limitRaw))
        : 10;
    const skip = (page - 1) * limit;
    const queryRaw = String(url.searchParams.get("q") ?? "").trim();
    const range = String(url.searchParams.get("range") ?? "").trim();

    const c = await collections();
    const businessUserId = new ObjectId(user.id);

    const filters: Record<string, any> = {
      businessUserId,
      reviewSubmitted: true,
    };

    if (queryRaw) {
      const safe = queryRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      filters.$or = [
        { serviceName: { $regex: regex } },
        { "customer.fullName": { $regex: regex } },
        { "customer.email": { $regex: regex } },
        { reviewComment: { $regex: regex } },
      ];
    }

    if (range === "last7days") {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      filters.reviewSubmittedAt = { $gte: since };
    }

    const total = await c.appointments.countDocuments(filters as any);

    const reviews = await c.appointments
      .find(filters as any, {
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
      })
      .sort({ reviewSubmittedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json(
      {
        ok: true,
        page,
        pageSize: limit,
        total,
        totalPages,
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
      },
      { headers: noStoreHeaders },
    );
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status, headers: noStoreHeaders },
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
      return NextResponse.json(
        { error: "Invalid review id" },
        { status: 400, headers: noStoreHeaders },
      );
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
      return NextResponse.json(
        { error: "Review not found" },
        { status: 404, headers: noStoreHeaders },
      );
    }

    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status, headers: noStoreHeaders },
    );
  }
}
