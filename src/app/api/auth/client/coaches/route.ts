import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ensureIndexes, collections } from "@/server/collections";
import { readAuthCookie } from "@/server/auth-cookie";
import { verifyAuthToken } from "@/server/jwt";
import { ensureLegacySingleRelation } from "@/server/client-relations";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureIndexes();

    const token = await readAuthCookie();
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const claims = await verifyAuthToken(token);
    if (claims.role !== "client") {
      return NextResponse.json(
        { ok: false, error: "Only clients can choose a coach" },
        { status: 403 }
      );
    }

    const c = await collections();
    const userId = new ObjectId(claims.sub);

    const user = await c.clients.findOne({ _id: userId });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    await ensureLegacySingleRelation({ c, user });

    const now = new Date();
    const isBlocked = (rel: any) => {
      const status = String(rel?.status ?? "ACTIVE")
        .trim()
        .toUpperCase();
      if (status !== "BLOCKED") return false;
      const until = rel?.blockedUntil ?? null;
      if (until instanceof Date && until.getTime() <= now.getTime()) {
        return false;
      }
      return true;
    };

    const relations = (
      await c.clientAdminRelations
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray()
    )
      // Hide blocked coaches from the switcher.
      .filter((r) => !isBlocked(r));

    const adminIds = relations.map((r) => r.adminId);
    const admins = adminIds.length
      ? await c.admins
          .find({ _id: { $in: adminIds } })
          .project({ _id: 1, email: 1, fullName: 1 })
          .toArray()
      : [];

    const byId = new Map(admins.map((a) => [a._id!.toHexString(), a]));

    const coaches = relations
      .map((r) => {
        const id = r.adminId.toHexString();
        const admin = byId.get(id);
        const label =
          (admin?.fullName && String(admin.fullName).trim()) ||
          (admin?.email ? String(admin.email) : id);
        return { adminId: id, label };
      })
      .filter((x) => !!x.adminId);

    return NextResponse.json({ ok: true, coaches });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
