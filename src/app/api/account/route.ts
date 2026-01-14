import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { clearAuthCookie } from "@/server/auth-cookie";
import { collections, ensureIndexes } from "@/server/collections";
import { destroyImage } from "@/server/cloudinary-upload";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    await ensureIndexes();

    const appUser = await requireAppUser();
    const userId = String(appUser.id);
    const userObjectId = new ObjectId(userId);

    const c = await collections();

    const user = await c.users.findOne({ _id: userObjectId });
    if (!user) {
      const res = NextResponse.json({ ok: true });
      clearAuthCookie(res);
      return res;
    }

    const email = String((user as any)?.email ?? appUser.email ?? "")
      .trim()
      .toLowerCase();

    const logoPublicId = String(
      (user as any)?.onboarding?.branding?.logo?.publicId ??
        (user as any)?.onboarding?.branding?.logoPublicId ??
        ""
    ).trim();

    const gallery = Array.isArray((user as any)?.onboarding?.branding?.gallery)
      ? ((user as any).onboarding.branding.gallery as any[])
      : [];

    const galleryPublicIds = gallery
      .map((x) => String(x?.publicId ?? x?.public_id ?? "").trim())
      .filter(Boolean);

    // Delete related data first (best-effort). These collections are owned by this user.
    await c.appointments.deleteMany({ businessUserId: userObjectId });

    if (email) {
      await c.otps.deleteMany({ key: email } as any);
    }

    // Delete the user itself.
    await c.users.deleteOne({ _id: userObjectId });

    // Cleanup branding assets (best-effort; do not fail the request).
    const assets = [logoPublicId, ...galleryPublicIds].filter(Boolean);
    await Promise.allSettled(assets.map((pid) => destroyImage(pid)));

    const res = NextResponse.json({ ok: true });
    clearAuthCookie(res);
    return res;
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
