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

const MAX_FILES = 10;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB each

function isAllowedImageMime(mime: string) {
  const t = String(mime || "").toLowerCase();
  return t === "image/png" || t === "image/jpeg" || t === "image/webp";
}

type GalleryItem = {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
};

function normalizeGallery(v: any): GalleryItem[] {
  if (!Array.isArray(v)) return [];
  const out: GalleryItem[] = [];
  for (const item of v) {
    if (typeof item === "string") {
      const s = String(item ?? "").trim();
      if (!s) continue;
      out.push({ url: s, publicId: "" });
      continue;
    }

    const url = String(item?.url ?? "").trim();
    const publicId = String(item?.publicId ?? item?.public_id ?? "").trim();
    if (!url) continue;
    out.push({
      url,
      publicId,
      width: typeof item?.width === "number" ? item.width : undefined,
      height: typeof item?.height === "number" ? item.height : undefined,
      bytes: typeof item?.bytes === "number" ? item.bytes : undefined,
      format: typeof item?.format === "string" ? item.format : undefined,
    });
  }

  // Dedup by publicId if present, otherwise by url.
  const seen = new Set<string>();
  const deduped: GalleryItem[] = [];
  for (const x of out) {
    const key = x.publicId ? `pid:${x.publicId}` : `url:${x.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(x);
  }
  return deduped.slice(0, MAX_FILES);
}

export async function POST(req: Request) {
  try {
    const appUser = await requireAppUser();
    const userId = String(appUser.id);

    const form = await req.formData();
    const files = form
      .getAll("images")
      .filter((f) => f instanceof File) as File[];

    if (!files.length) {
      return NextResponse.json({ error: "Missing images" }, { status: 400 });
    }

    for (const f of files) {
      if (!isAllowedImageMime(f.type)) {
        return NextResponse.json(
          { error: "Gallery files must be PNG, JPG, or WEBP images" },
          { status: 400 }
        );
      }
      if (f.size > MAX_BYTES) {
        return NextResponse.json(
          { error: "An image is too large (max 5MB)" },
          { status: 400 }
        );
      }
    }

    const c = await collections();
    const user = await c.users.findOne({ _id: new ObjectId(userId) });
    const existing = normalizeGallery(
      (user as any)?.onboarding?.branding?.gallery ?? []
    ).map((x) => {
      if (!x.publicId) return x;
      return {
        ...x,
        url: cloudinaryUrl(x.publicId, { width: 1400, crop: "limit" }),
      };
    });

    if (existing.length >= MAX_FILES) {
      return NextResponse.json(
        { error: "Gallery limit reached (max 10 images)" },
        { status: 400 }
      );
    }

    const remaining = MAX_FILES - existing.length;
    const toSave = files.slice(0, remaining);

    const folder = `progrr/businesses/${userId}/gallery`;
    const added: GalleryItem[] = [];
    for (const file of toSave) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploaded = await uploadImageBuffer(buffer, {
        folder,
        overwrite: false,
        unique_filename: true,
        resource_type: "image",
      });

      const publicId = String(uploaded.public_id ?? "").trim();
      const url = cloudinaryUrl(publicId, { width: 1400, crop: "limit" });
      added.push({
        url,
        publicId,
        width: uploaded.width,
        height: uploaded.height,
        bytes: uploaded.bytes,
        format: uploaded.format,
      });
    }

    const next = normalizeGallery([...existing, ...added]).slice(0, MAX_FILES);

    await c.users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "onboarding.branding.gallery": next,
          "onboarding.updatedAt": new Date(),
        },
      }
    );

    return NextResponse.json({ ok: true, gallery: next, added });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const appUser = await requireAppUser();
    const userId = String(appUser.id);

    const body = await req.json().catch(() => ({}));
    const url = String((body as any)?.url ?? "").trim();
    const publicId = String((body as any)?.publicId ?? "").trim();
    if (!url && !publicId) {
      return NextResponse.json(
        { error: "Missing url or publicId" },
        { status: 400 }
      );
    }

    const c = await collections();
    const user = await c.users.findOne({ _id: new ObjectId(userId) });
    const existing = normalizeGallery(
      (user as any)?.onboarding?.branding?.gallery ?? []
    ).map((x) => {
      if (!x.publicId) return x;
      return {
        ...x,
        url: cloudinaryUrl(x.publicId, { width: 1400, crop: "limit" }),
      };
    });
    const toRemove =
      existing.find((x) =>
        publicId ? x.publicId === publicId : x.url === url
      ) ?? null;
    if (!toRemove) {
      return NextResponse.json({ ok: true, gallery: existing });
    }

    const next = existing.filter((x) => x !== toRemove);

    await c.users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "onboarding.branding.gallery": next,
          "onboarding.updatedAt": new Date(),
        },
      }
    );

    if (toRemove.publicId) {
      await destroyImage(toRemove.publicId).catch(() => null);
    }

    return NextResponse.json({ ok: true, gallery: next });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
