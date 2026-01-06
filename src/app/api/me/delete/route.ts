import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import path from "path";
import { promises as fs } from "fs";

import { collections } from "@/server/collections";
import { clearAuthCookie, readAuthCookie } from "@/server/auth-cookie";
import { verifyAuthToken } from "@/server/jwt";

export const runtime = "nodejs";

const bodySchema = z.object({
  confirm: z.string().optional(),
});

async function safeRmDir(absDir: string, baseDir: string) {
  const base = path.resolve(baseDir);
  const target = path.resolve(absDir);
  if (!target.startsWith(base + path.sep) && target !== base) {
    throw Object.assign(new Error("Refusing to delete outside base dir"), {
      status: 500,
    });
  }

  try {
    await fs.rm(target, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export async function POST(req: Request) {
  try {
    const token = await readAuthCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims = await verifyAuthToken(token);
    if (claims.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Recent authentication requirement (10 minutes)
    const nowSec = Math.floor(Date.now() / 1000);
    const iat = claims.iat;
    const recentWindowSec = 10 * 60;
    if (!iat || nowSec - iat > recentWindowSec) {
      return NextResponse.json(
        {
          error:
            "Recent authentication required. Please log in again and retry within 10 minutes.",
        },
        { status: 403 }
      );
    }

    const parsed = bodySchema.parse(await req.json().catch(() => ({})));
    if (
      String(parsed.confirm || "")
        .trim()
        .toUpperCase() !== "DELETE"
    ) {
      return NextResponse.json(
        { error: "Type DELETE to confirm account deletion." },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(claims.sub)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminId = new ObjectId(claims.sub);
    const c = await collections();

    const admin = await c.admins.findOne({ _id: adminId });
    if (!admin) {
      // Already deleted: ensure cookie is cleared.
      const res = NextResponse.json({ ok: true });
      clearAuthCookie(res);
      return res;
    }

    // Delete associated data
    await c.entities.deleteMany({ adminId });
    // Important: do NOT delete global Client auth accounts when an admin deletes themselves.
    // Only remove relations and admin-scoped data.
    await c.clientAdminRelations.deleteMany({ adminId });
    await c.invites.deleteMany({ adminId });
    await c.clients.updateMany({ adminId }, { $unset: { adminId: "" } });
    await c.admins.deleteOne({ _id: adminId });

    // Delete uploaded exercise videos for this admin
    const baseUploads = path.join(
      process.cwd(),
      "public",
      "uploads",
      "exercise-videos"
    );
    const adminUploads = path.join(baseUploads, adminId.toHexString());
    await safeRmDir(adminUploads, baseUploads);

    const res = NextResponse.json({ ok: true });
    clearAuthCookie(res);
    return res;
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message = error?.name === "ZodError" ? "Invalid request" : undefined;

    return NextResponse.json(
      { error: message || error?.message || "Request failed" },
      { status }
    );
  }
}
