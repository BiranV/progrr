import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { isValidBusinessPublicId } from "@/server/business-public-id";

function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

export async function GET(req: Request) {
  try {
    await ensureIndexes();

    const url = new URL(req.url);
    const businessPublicId = String(
      url.searchParams.get("businessPublicId") ?? "",
    ).trim();
    const appointmentId = String(
      url.searchParams.get("appointmentId") ?? "",
    ).trim();

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
    const owner = await c.users.findOne(
      { "onboarding.business.publicId": businessPublicId } as any,
      {
        projection: {
          _id: 1,
          "onboarding.business.name": 1,
        },
      },
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
          serviceName: 1,
          date: 1,
          startTime: 1,
          endTime: 1,
          reviewSubmitted: 1,
        },
      },
    );

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 },
      );
    }

    const businessName =
      String((owner as any)?.onboarding?.business?.name ?? "").trim() ||
      "Progrr";

    const status = String((appointment as any).status ?? "");
    const reviewSubmitted = Boolean((appointment as any).reviewSubmitted);

    return NextResponse.json({
      ok: true,
      businessName,
      appointment: {
        serviceName: String((appointment as any).serviceName ?? "").trim(),
        date: String((appointment as any).date ?? "").trim(),
        startTime: String((appointment as any).startTime ?? "").trim(),
        endTime: String((appointment as any).endTime ?? "").trim(),
        status,
        reviewSubmitted,
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
