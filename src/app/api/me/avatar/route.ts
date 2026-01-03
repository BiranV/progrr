import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { collections } from "@/server/collections";
import { requireAppUser } from "@/server/auth";

export const runtime = "nodejs";

const bodySchema = z.object({
  dataUrl: z.union([z.string(), z.null()]).optional(),
});

function isAllowedImageDataUrl(value: string): boolean {
  return (
    value.startsWith("data:image/png;base64,") ||
    value.startsWith("data:image/jpeg;base64,") ||
    value.startsWith("data:image/webp;base64,")
  );
}

export async function POST(req: Request) {
  try {
    const user = await requireAppUser();
    if (user.role !== "client") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = bodySchema.parse(await req.json().catch(() => ({})));
    const raw = typeof parsed.dataUrl === "string" ? parsed.dataUrl.trim() : "";

    // Allow clearing the avatar by sending null/empty.
    const dataUrl = raw || null;

    if (dataUrl) {
      if (!isAllowedImageDataUrl(dataUrl)) {
        return NextResponse.json(
          { error: "Invalid image format" },
          { status: 400 }
        );
      }

      // Basic payload size guard (data URLs grow ~33% over binary).
      // This keeps the DB safe from accidental huge uploads.
      if (dataUrl.length > 350_000) {
        return NextResponse.json(
          { error: "Image is too large" },
          { status: 400 }
        );
      }
    }

    const c = await collections();
    const adminId = new ObjectId(user.adminId);

    const myClient = await c.entities.findOne({
      entity: "Client",
      adminId,
      $or: [{ "data.userId": user.id }, { "data.clientAuthId": user.id }],
    });

    if (!myClient) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await c.entities.updateOne(
      { _id: myClient._id },
      {
        $set: {
          data: {
            ...(myClient.data as any),
            avatarDataUrl: dataUrl,
          },
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message =
      error?.name === "ZodError" ? "Invalid request body" : undefined;

    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : message || "Request failed" },
      { status }
    );
  }
}
