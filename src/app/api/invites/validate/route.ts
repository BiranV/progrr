import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { verifyClientInviteToken } from "@/server/invite-token";

export const runtime = "nodejs";

function normalizeEmail(input: unknown): string {
  return String(input ?? "")
    .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

export async function GET(req: Request) {
  try {
    await ensureIndexes();

    const url = new URL(req.url);
    const token = String(url.searchParams.get("token") ?? "").trim();
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Invite token is required" },
        { status: 400 }
      );
    }

    const claims = await verifyClientInviteToken(token);
    if (!ObjectId.isValid(claims.inviteId)) {
      return NextResponse.json(
        { ok: false, error: "Invalid invite" },
        { status: 400 }
      );
    }

    const c = await collections();
    const invite = await c.invites.findOne({
      _id: new ObjectId(claims.inviteId),
    });

    if (!invite) {
      return NextResponse.json(
        { ok: false, error: "This invitation link is invalid or has expired." },
        { status: 404 }
      );
    }

    const email = normalizeEmail(invite.email);
    if (email !== normalizeEmail(claims.email)) {
      return NextResponse.json(
        { ok: false, error: "This invitation link is invalid or has expired." },
        { status: 400 }
      );
    }

    if (String(invite.status).toUpperCase() !== "PENDING") {
      return NextResponse.json(
        { ok: false, error: "This invitation has already been used." },
        { status: 400 }
      );
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { ok: false, error: "This invitation link has expired." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, email });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
