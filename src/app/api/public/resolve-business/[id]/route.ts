import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { collections, ensureIndexes } from "@/server/collections";
import { isValidBusinessPublicId } from "@/server/business-public-id";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await ensureIndexes();

    const { id } = await ctx.params;
    const raw = String(id ?? "").trim();
    if (!raw) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const c = await collections();

    // If already a valid publicId, just confirm it exists.
    if (isValidBusinessPublicId(raw)) {
      const user = await c.users.findOne(
        {
          "onboarding.business.publicId": raw,
          onboardingCompleted: true,
        } as any,
        { projection: { _id: 1 } }
      );
      if (!user) {
        return NextResponse.json(
          { error: "Business not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, publicId: raw });
    }

    // Legacy slug resolution is only used to redirect old links.
    const legacy = await c.users.findOne(
      {
        "onboarding.business.slug": raw,
        onboardingCompleted: true,
      } as any,
      { projection: { "onboarding.business.publicId": 1 } }
    );

    const publicId = String(
      (legacy as any)?.onboarding?.business?.publicId ?? ""
    ).trim();

    if (!isValidBusinessPublicId(publicId)) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, publicId });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
