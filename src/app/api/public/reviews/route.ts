import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { collections, ensureIndexes } from "@/server/collections";
import { isValidBusinessPublicId } from "@/server/business-public-id";

export async function GET(req: NextRequest) {
  try {
    await ensureIndexes();

    const url = new URL(req.url);
    const publicId = String(
      url.searchParams.get("businessPublicId") ?? "",
    ).trim();
    const pageRaw = Number(url.searchParams.get("page") ?? "1");
    const limitRaw = Number(url.searchParams.get("limit") ?? "10");
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(50, Math.round(limitRaw))
        : 10;

    if (!isValidBusinessPublicId(publicId)) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }

    const c = await collections();
    const user = await c.users.findOne({
      "onboarding.business.publicId": publicId,
      onboardingCompleted: true,
    } as any);

    if (!user) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }

    const skip = (page - 1) * limit;
    const businessUserId = (user as any)?._id;

    const total = await c.appointments.countDocuments({
      businessUserId,
      reviewSubmitted: true,
    } as any);

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
            reviewRating: 1,
            reviewComment: 1,
            reviewSubmittedAt: 1,
          },
        },
      )
      .sort({ reviewSubmittedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
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
