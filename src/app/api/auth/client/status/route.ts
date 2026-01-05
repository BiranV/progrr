import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ensureIndexes, collections } from "@/server/collections";
import { readAuthCookie } from "@/server/auth-cookie";
import { verifyAuthToken } from "@/server/jwt";
import {
  clearExpiredClientBlock,
  CLIENT_BLOCKED_CODE,
  CLIENT_BLOCKED_MESSAGE,
  computeClientBlockState,
} from "@/server/client-block";

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

    const blockState = computeClientBlockState(client);
    if (!blockState.blocked && blockState.shouldClear && client._id) {
      await clearExpiredClientBlock({ c, clientId: client._id });
      return NextResponse.json({ ok: true, blocked: false });
    }

    if (blockState.blocked) {
      return NextResponse.json(
        {
          ok: false,
          blocked: true,
          code: CLIENT_BLOCKED_CODE,
          blockType: blockState.blockType,
          blockedUntil: blockState.blockedUntil,
          error: CLIENT_BLOCKED_MESSAGE,
        },
        { status: 403 }
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
