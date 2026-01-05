import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ensureIndexes, collections } from "@/server/collections";
import { readAuthCookie, setAuthCookie } from "@/server/auth-cookie";
import { verifyAuthToken, signAuthToken } from "@/server/jwt";
import { setLastActiveAdmin } from "@/server/client-relations";

export const runtime = "nodejs";

function isRelationBlocked(rel: {
  status: string;
  blockedUntil?: Date | null;
}) {
  const status = String((rel as any)?.status ?? "ACTIVE")
    .trim()
    .toUpperCase();
  if (status !== "BLOCKED") return false;
  const until = rel.blockedUntil ?? null;
  if (until instanceof Date && until.getTime() <= Date.now()) {
    return false;
  }
  return true;
}

export async function POST(req: Request) {
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
        { ok: false, error: "Only clients can select a coach" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const adminIdStr = String(body?.adminId ?? "").trim();
    if (!ObjectId.isValid(adminIdStr)) {
      return NextResponse.json(
        { ok: false, error: "Invalid coach" },
        { status: 400 }
      );
    }

    const c = await collections();
    const userId = new ObjectId(claims.sub);
    const adminId = new ObjectId(adminIdStr);

    const rel = await c.clientAdminRelations.findOne({ userId, adminId });
    if (!rel) {
      return NextResponse.json(
        { ok: false, error: "Coach not available" },
        { status: 404 }
      );
    }

    if (isRelationBlocked(rel)) {
      return NextResponse.json(
        {
          ok: false,
          code: "CLIENT_BLOCKED",
          error:
            "Your account no longer has access to this platform. Please contact your coach.",
        },
        { status: 403 }
      );
    }

    // Auto-clear expired blocks.
    const relStatus = String((rel as any)?.status ?? "ACTIVE")
      .trim()
      .toUpperCase();
    if (relStatus === "BLOCKED" && rel.blockedUntil instanceof Date) {
      if (rel.blockedUntil.getTime() <= Date.now()) {
        await c.clientAdminRelations.updateOne(
          { _id: rel._id },
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
    }

    await setLastActiveAdmin({ c, userId, adminId });

    const clientId = userId.toHexString();
    const newToken = await signAuthToken({
      sub: clientId,
      role: "client",
      clientId,
      adminId: adminId.toHexString(),
    });

    const res = NextResponse.json({ ok: true });
    setAuthCookie(res, newToken);
    return res;
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
