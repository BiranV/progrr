import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";
import {
  cloudinaryUrl,
  destroyImage,
  uploadImageBuffer,
} from "@/server/cloudinary-upload";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB (logo)

function isAllowedImageMime(mime: string) {
  const t = String(mime || "").toLowerCase();
  return t === "image/png" || t === "image/jpeg" || t === "image/webp";
}

export async function POST(req: Request) {
  try {
    const appUser = await requireAppUser();

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (!isAllowedImageMime(file.type)) {
      return NextResponse.json(
        { error: "Logo must be a PNG, JPG, or WEBP image" },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Logo is too large (max 2MB)" },
        { status: 400 }
      );
    }

    const userId = String(appUser.id);
    const c = await collections();

    const existingUser = await c.users.findOne({ _id: new ObjectId(userId) });
    const existingPublicId = String(
      (existingUser as any)?.onboarding?.branding?.logo?.publicId ??
        (existingUser as any)?.onboarding?.branding?.logoPublicId ??
        ""
    ).trim();

    const buffer = Buffer.from(await file.arrayBuffer());
    const folder = `progrr/businesses/${userId}/logo`;
    const uploaded = await uploadImageBuffer(buffer, {
      folder,
      overwrite: true,
      unique_filename: true,
      resource_type: "image",
    });

    const publicId = String(uploaded.public_id ?? "").trim();
    const url = cloudinaryUrl(publicId, {
      width: 512,
      height: 512,
      crop: "fill",
    });

    if (existingPublicId && existingPublicId !== publicId) {
      await destroyImage(existingPublicId).catch(() => null);
    }

    await c.users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "onboarding.branding.logo": {
            url,
            publicId,
            width: uploaded.width,
            height: uploaded.height,
            bytes: uploaded.bytes,
            format: uploaded.format,
          },
          "onboarding.updatedAt": new Date(),
        },
        $unset: {
          "onboarding.branding.logoUrl": "",
          "onboarding.branding.logoPublicId": "",
        },
      }
    );

    return NextResponse.json({ ok: true, logo: { url, publicId } });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}

export async function DELETE() {
  try {
    const appUser = await requireAppUser();
    const userId = String(appUser.id);

    const c = await collections();
    const user = await c.users.findOne({ _id: new ObjectId(userId) });
    const currentPublicId = String(
      (user as any)?.onboarding?.branding?.logo?.publicId ??
        (user as any)?.onboarding?.branding?.logoPublicId ??
        ""
    ).trim();

    await c.users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $unset: {
          "onboarding.branding.logo": "",
          "onboarding.branding.logoUrl": "",
          "onboarding.branding.logoPublicId": "",
        },
        $set: { "onboarding.updatedAt": new Date() },
      }
    );

    if (currentPublicId) {
      await destroyImage(currentPublicId).catch(() => null);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
