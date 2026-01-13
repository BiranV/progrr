import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import path from "path";
import fs from "fs/promises";

import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function safeFilename(ext: string) {
  const cleanExt = ext.replace(/[^a-z0-9.]/gi, "").toLowerCase();
  const stamp = Date.now();
  const rand = crypto.randomUUID().slice(0, 8);
  return `logo-${stamp}-${rand}${cleanExt ? `.${cleanExt}` : ""}`;
}

function extensionFromMime(mime: string): string {
  const t = String(mime || "").toLowerCase();
  if (t === "image/png") return "png";
  if (t === "image/jpeg") return "jpg";
  if (t === "image/webp") return "webp";
  if (t === "image/gif") return "gif";
  return "";
}

export async function POST(req: Request) {
  try {
    const appUser = await requireAppUser();

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (!String(file.type || "").startsWith("image/")) {
      return NextResponse.json(
        { error: "Logo must be an image" },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Logo is too large (max 5MB)" },
        { status: 400 }
      );
    }

    const userId = String(appUser.id);
    const dir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "business-branding",
      userId
    );
    await fs.mkdir(dir, { recursive: true });

    const ext = extensionFromMime(file.type);
    const filename = safeFilename(ext);
    const abs = path.join(dir, filename);

    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(abs, buf);

    const url = `/uploads/business-branding/${encodeURIComponent(
      userId
    )}/${encodeURIComponent(filename)}`;

    const c = await collections();
    await c.users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          "onboarding.branding.logoUrl": url,
          "onboarding.updatedAt": new Date(),
        },
      }
    );

    return NextResponse.json({ ok: true, url });
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
    const current = String(
      (user as any)?.onboarding?.branding?.logoUrl ?? ""
    ).trim();

    await c.users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $unset: { "onboarding.branding.logoUrl": "" },
        $set: { "onboarding.updatedAt": new Date() },
      }
    );

    if (
      current.startsWith(
        `/uploads/business-branding/${encodeURIComponent(userId)}/`
      )
    ) {
      const prefix = `/uploads/business-branding/${encodeURIComponent(
        userId
      )}/`;
      const filename = decodeURIComponent(current.slice(prefix.length));
      const abs = path.join(
        process.cwd(),
        "public",
        "uploads",
        "business-branding",
        userId,
        filename
      );
      await fs.unlink(abs).catch(() => null);
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
