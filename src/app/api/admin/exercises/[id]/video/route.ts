import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { collections } from "@/server/collections";
import { requireAppUser } from "@/server/auth";

export const runtime = "nodejs";

const maxVideoBytes = 25 * 1024 * 1024; // 25MB

function extFromMime(mime: string): string {
  const m = String(mime || "").toLowerCase();
  if (m.includes("mp4")) return "mp4";
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  return "mp4";
}

async function safeUnlink(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAppUser();
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("video");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing video file" },
        { status: 400 }
      );
    }

    if (!String(file.type || "").startsWith("video/")) {
      return NextResponse.json(
        { error: "Invalid video type" },
        { status: 400 }
      );
    }

    if (file.size > maxVideoBytes) {
      return NextResponse.json(
        { error: "Video is too large (max 25MB)" },
        { status: 400 }
      );
    }

    const c = await collections();
    const adminId = new ObjectId(user.id);

    const existing = await c.entities.findOne({
      _id: new ObjectId(id),
      entity: "Exercise",
      adminId,
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ext = extFromMime(file.type);
    const filename = `exercise-${id}-${Date.now()}.${ext}`;

    const relDir = path.posix.join(
      "uploads",
      "exercise-videos",
      adminId.toHexString()
    );
    const relUrl = `/${relDir}/${filename}`;

    const absDir = path.join(process.cwd(), "public", ...relDir.split("/"));
    await fs.mkdir(absDir, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const absPath = path.join(absDir, filename);
    await fs.writeFile(absPath, buffer);

    // If replacing an existing uploaded video, delete the old file.
    const prevData = (existing.data ?? {}) as any;
    if (
      prevData.videoKind === "upload" &&
      typeof prevData.videoUrl === "string"
    ) {
      const prevUrl = String(prevData.videoUrl).trim();
      if (prevUrl.startsWith(`/${relDir}/`)) {
        const prevAbs = path.join(
          process.cwd(),
          "public",
          prevUrl.replace(/^\//, "")
        );
        await safeUnlink(prevAbs);
      }
    }

    await c.entities.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          data: {
            ...prevData,
            videoKind: "upload",
            videoUrl: relUrl,
          },
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ videoKind: "upload", videoUrl: relUrl });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message = error?.name === "ZodError" ? "Invalid request" : undefined;

    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : message || "Request failed" },
      { status }
    );
  }
}

const deleteBodySchema = z
  .object({
    deleteFile: z.boolean().optional(),
  })
  .optional();

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAppUser();
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = deleteBodySchema.parse(
      await req.json().catch(() => undefined)
    );
    const shouldDeleteFile = parsed?.deleteFile !== false;

    const c = await collections();
    const adminId = new ObjectId(user.id);

    const existing = await c.entities.findOne({
      _id: new ObjectId(id),
      entity: "Exercise",
      adminId,
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const prevData = (existing.data ?? {}) as any;
    if (
      shouldDeleteFile &&
      prevData.videoKind === "upload" &&
      typeof prevData.videoUrl === "string"
    ) {
      const prevUrl = String(prevData.videoUrl).trim();
      if (prevUrl.startsWith("/uploads/exercise-videos/")) {
        const prevAbs = path.join(
          process.cwd(),
          "public",
          prevUrl.replace(/^\//, "")
        );
        await safeUnlink(prevAbs);
      }
    }

    await c.entities.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          data: {
            ...prevData,
            videoKind: null,
            videoUrl: null,
          },
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message = error?.name === "ZodError" ? "Invalid request" : undefined;

    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : message || "Request failed" },
      { status }
    );
  }
}
