import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";

export async function GET() {
  try {
    const appUser = await requireAppUser();
    const c = await collections();
    const user = await c.users.findOne({ _id: new ObjectId(appUser.id) });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = (user as any)?.onboarding?.business ?? {};
    const now = new Date();

    const parsedStart = business.trialStartAt ? new Date(business.trialStartAt) : null;
    const parsedEnd = business.trialEndAt ? new Date(business.trialEndAt) : null;

    const trialStartAt = parsedStart && !Number.isNaN(parsedStart.getTime())
      ? parsedStart
      : new Date((user as any)?.createdAt ?? now);

    const trialEndAt = parsedEnd && !Number.isNaN(parsedEnd.getTime())
      ? parsedEnd
      : new Date(trialStartAt.getTime() + 14 * 24 * 60 * 60 * 1000);

    let subscriptionStatus = String(business.subscriptionStatus ?? "trial").trim();
    if (now.getTime() > trialEndAt.getTime() && subscriptionStatus !== "active") {
      subscriptionStatus = "expired";
    }

    const shouldPersist =
      !business.trialStartAt ||
      !business.trialEndAt ||
      business.subscriptionStatus !== subscriptionStatus;

    if (shouldPersist) {
      await c.users.updateOne(
        { _id: new ObjectId(appUser.id) },
        {
          $set: {
            "onboarding.business.trialStartAt": trialStartAt,
            "onboarding.business.trialEndAt": trialEndAt,
            "onboarding.business.subscriptionStatus": subscriptionStatus,
            "onboarding.updatedAt": new Date(),
          },
        }
      );
    }

    return NextResponse.json({
      user: appUser,
      business: {
        trialStartAt: trialStartAt.toISOString(),
        trialEndAt: trialEndAt.toISOString(),
        subscriptionStatus: subscriptionStatus as "trial" | "active" | "expired",
      },
    });
  } catch (error: any) {
    console.error("API /me error:", error);
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      {
        error: status === 401 ? "Unauthorized" : "Internal Server Error",
        detail: error?.message || String(error),
        code: error?.code,
        stack:
          process.env.NODE_ENV === "development" ? error?.stack : undefined,
      },
      { status }
    );
  }
}
