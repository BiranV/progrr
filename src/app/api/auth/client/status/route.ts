import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ensureIndexes, collections } from "@/server/collections";
import { readAuthCookie } from "@/server/auth-cookie";
import { verifyAuthToken } from "@/server/jwt";
import {
  ensureLegacySingleRelation,
  resolveClientAdminContext,
} from "@/server/client-relations";

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
      return NextResponse.json({ ok: true, role: claims.role });
    }

    const c = await collections();
    const client = await c.clients.findOne({ _id: new ObjectId(claims.sub) });
    if (!client) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    await ensureLegacySingleRelation({ c, user: client });

    const resolved = await resolveClientAdminContext({
      c,
      user: client,
      claimedAdminId: claims.adminId,
    });

    if (resolved.needsSelection) {
      return NextResponse.json(
        {
          ok: false,
          blocked: true,
          code: "CLIENT_BLOCKED",
          error:
            "Your account no longer has access to this platform. Please contact your coach.",
        },
        { status: 403 }
      );
    }

    // Auto-clear expired blocks for the active relation.
    if (
      resolved.activeRelation.status === "BLOCKED" &&
      resolved.activeRelation.blockedUntil instanceof Date &&
      resolved.activeRelation.blockedUntil.getTime() <= Date.now()
    ) {
      await c.clientAdminRelations.updateOne(
        { _id: resolved.activeRelation._id },
        {
          $set: {
            status: "ACTIVE",
            blockedUntil: null,
            blockReason: null,
            updatedAt: new Date(),
          },
        }
      );
    }

    return NextResponse.json({ ok: true, blocked: false });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
