import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";
import { verifyClientInviteToken } from "@/server/invite-token";
import { verifyOtp } from "@/server/otp";
import { signAuthToken } from "@/server/jwt";
import { setAuthCookie } from "@/server/auth-cookie";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";
import { setLastActiveAdmin } from "@/server/client-relations";
import { tryAcquireActiveClientSlot } from "@/server/active-client-quota";

export const runtime = "nodejs";

function normalizeEmail(input: unknown): string {
  return String(input ?? "")
    .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "").trim();
    const code = String(body?.code ?? "").trim();

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Invite token is required" },
        { status: 400 }
      );
    }
    if (!code) {
      return NextResponse.json(
        { ok: false, error: "Verification code is required" },
        { status: 400 }
      );
    }

    const claims = await verifyClientInviteToken(token);
    if (
      !ObjectId.isValid(claims.inviteId) ||
      !ObjectId.isValid(claims.adminId)
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid invite" },
        { status: 400 }
      );
    }

    const c = await collections();

    const inviteId = new ObjectId(claims.inviteId);
    const invite = await c.invites.findOne({ _id: inviteId });

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

    const db = await getDb();
    await checkRateLimit({
      db,
      req,
      purpose: "invite_otp_verify",
      email,
      perIp: { windowMs: 60_000, limit: 30 },
      perEmail: { windowMs: 600_000, limit: 10 },
    });

    const otp = await c.otps.findOne({
      key: email,
      purpose: "client_onboarding",
    });
    if (!otp) {
      return NextResponse.json(
        { ok: false, error: "Code expired or not requested" },
        { status: 400 }
      );
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      await c.otps.deleteOne({ key: email, purpose: "client_onboarding" });
      return NextResponse.json(
        { ok: false, error: "Code expired" },
        { status: 400 }
      );
    }

    if (otp.attempts >= 5) {
      await c.otps.deleteOne({ key: email, purpose: "client_onboarding" });
      return NextResponse.json(
        { ok: false, error: "Too many attempts" },
        { status: 429 }
      );
    }

    const ok = verifyOtp(code, otp.codeHash);
    if (!ok) {
      await c.otps.updateOne(
        { key: email, purpose: "client_onboarding" },
        { $inc: { attempts: 1 } }
      );
      return NextResponse.json(
        { ok: false, error: "Invalid code" },
        { status: 401 }
      );
    }

    await c.otps.deleteOne({ key: email, purpose: "client_onboarding" });

    const adminId = new ObjectId(claims.adminId);

    // Create (or reuse) the global client auth record.
    let client = await c.clients.findOne({ email });

    if (!client) {
      // Try to pull profile data from the admin-scoped Client entity, if present.
      let name = "";
      let phone = "";

      if (invite.clientEntityId instanceof ObjectId) {
        const entity = await c.entities.findOne({
          _id: invite.clientEntityId,
          entity: "Client",
          adminId,
        });
        const d = (entity?.data ?? {}) as any;
        if (typeof d?.name === "string" && String(d.name).trim()) {
          name = String(d.name).trim();
        }
        if (typeof d?.phone === "string" && String(d.phone).trim()) {
          phone = String(d.phone).trim();
        }
      }

      const insert = await c.clients.insertOne({
        email,
        name: name || email.split("@")[0] || "Client",
        phone,
        theme: "light",
        role: "client",
      } as any);

      client = await c.clients.findOne({ _id: insert.insertedId });
    }

    if (!client?._id) {
      return NextResponse.json(
        { ok: false, error: "Failed to create account" },
        { status: 500 }
      );
    }

    // Ensure relation is allowed.
    const existingRel = await c.clientAdminRelations.findOne({
      userId: client._id,
      adminId,
    });
    if (existingRel && isRelationBlocked(existingRel as any)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This coach has blocked your access. Please contact your coach to regain access.",
          code: "CLIENT_BLOCKED",
        },
        { status: 403 }
      );
    }

    const existingRelStatus = String((existingRel as any)?.status ?? "")
      .trim()
      .toUpperCase();
    let entityStatus = "";
    if (invite.clientEntityId instanceof ObjectId) {
      const entity = await c.entities.findOne({
        _id: invite.clientEntityId,
        entity: "Client",
        adminId,
      });
      entityStatus = String((entity as any)?.data?.status ?? "")
        .trim()
        .toUpperCase();
    }

    const isAlreadyActiveUnderAdmin =
      existingRelStatus === "ACTIVE" || entityStatus === "ACTIVE";

    const slot = isAlreadyActiveUnderAdmin
      ? { allowed: true, plan: "starter" as const, limit: Infinity }
      : await tryAcquireActiveClientSlot({ adminId });

    const now = new Date();
    await c.clientAdminRelations.updateOne(
      { userId: client._id, adminId },
      {
        $setOnInsert: {
          userId: client._id,
          adminId,
          createdAt: now,
        },
        $set: {
          status: slot.allowed ? "ACTIVE" : "PENDING_LIMIT",
          blockedUntil: null,
          blockReason: null,
          updatedAt: now,
        },
      },
      { upsert: true }
    );

    // Mark invite as accepted.
    await c.invites.updateOne(
      { _id: inviteId, status: "PENDING" },
      {
        $set: {
          status: "ACCEPTED",
          acceptedAt: now,
          acceptedUserId: client._id,
        },
      }
    );

    // Keep admin-facing Client entity status in sync.
    const clientIdStr = client._id.toHexString();
    if (invite.clientEntityId instanceof ObjectId) {
      await c.entities.updateOne(
        { _id: invite.clientEntityId, entity: "Client", adminId },
        {
          $set: {
            "data.status": slot.allowed ? "ACTIVE" : "PENDING_LIMIT",
            "data.userId": clientIdStr,
            "data.clientAuthId": clientIdStr,
            updatedAt: now,
          },
        }
      );
    } else {
      // Best-effort by email
      await c.entities.updateMany(
        {
          adminId,
          entity: "Client",
          "data.email": { $regex: new RegExp(`^${escapeRegExp(email)}$`, "i") },
        },
        {
          $set: {
            "data.status": slot.allowed ? "ACTIVE" : "PENDING_LIMIT",
            "data.userId": clientIdStr,
            "data.clientAuthId": clientIdStr,
            updatedAt: now,
          },
        }
      );
    }

    await setLastActiveAdmin({ c, userId: client._id, adminId });

    const clientId = client._id.toHexString();
    const jwt = await signAuthToken({
      sub: clientId,
      role: "client",
      clientId,
      adminId: adminId.toHexString(),
    });

    const res = NextResponse.json({ ok: true });
    setAuthCookie(res, jwt);
    return res;
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { ok: false, error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
