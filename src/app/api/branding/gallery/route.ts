import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import path from "path";
import fs from "fs/promises";

import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";

export const runtime = "nodejs";

const MAX_FILES = 10;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB each

function extensionFromMime(mime: string): string {
  const t = String(mime || "").toLowerCase();
  if (t === "image/png") return "png";
  if (t === "image/jpeg") return "jpg";
  if (t === "image/webp") return "webp";
  if (t === "image/gif") return "gif";
  return "";
}

function safeFilename(ext: string) {
  const stamp = Date.now();
  const rand = crypto.randomUUID().slice(0, 8);
  const cleanExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `gallery-${stamp}-${rand}${cleanExt ? `.${cleanExt}` : ""}`;
}

function normalizeGallery(v: any): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = String(item ?? "").trim();
    if (!s) continue;
    if (s.length > 500) continue;
    out.push(s);
  }
  return Array.from(new Set(out));
}

export async function POST(req: Request) {
  try {
    const appUser = await requireAppUser();
    const userId = String(appUser.id);

    const form = await req.formData();
    const files = form
      .getAll("files")
      .filter((f) => f instanceof File) as File[];

    if (!files.length) {
      return NextResponse.json({ error: "Missing files" }, { status: 400 });
    }

    for (const f of files) {
      if (!String(f.type || "").startsWith("image/")) {
        return NextResponse.json(
          { error: "Gallery files must be images" },
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
    );

    if (existing.length >= MAX_FILES) {
      return NextResponse.json(
        { error: "Gallery limit reached (max 10 images)" },
        { status: 400 }
      );
    }

    const remaining = MAX_FILES - existing.length;
    const toSave = files.slice(0, remaining);

    const dir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "business-branding",
      userId
    );
    await fs.mkdir(dir, { recursive: true });

    const newUrls: string[] = [];

    for (const file of toSave) {
      const ext = extensionFromMime(file.type);
      const filename = safeFilename(ext);
      const abs = path.join(dir, filename);

      const buf = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(abs, buf);

      const url = `/uploads/business-branding/${encodeURIComponent(
        userId
      )}/${encodeURIComponent(filename)}`;
      newUrls.push(url);
    }

    const next = [...existing, ...newUrls].slice(0, MAX_FILES);

    await c.users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "onboarding.branding.gallery": next,
          "onboarding.updatedAt": new Date(),
        },
      }
    );

    return NextResponse.json({ ok: true, gallery: next, added: newUrls });
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
    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const prefix = `/uploads/business-branding/${encodeURIComponent(userId)}/`;
    if (!url.startsWith(prefix)) {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }

    const c = await collections();
    const user = await c.users.findOne({ _id: new ObjectId(userId) });
    const existing = normalizeGallery(
      (user as any)?.onboarding?.branding?.gallery ?? []
    );
    const next = existing.filter((x) => x !== url);

    await c.users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "onboarding.branding.gallery": next,
          "onboarding.updatedAt": new Date(),
        },
      }
    );

    const filename = decodeURIComponent(url.slice(prefix.length));
    const abs = path.join(
      process.cwd(),
      "public",
      "uploads",
      "business-branding",
      userId,
      filename
    );
    await fs.unlink(abs).catch(() => null);

    return NextResponse.json({ ok: true, gallery: next });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
