import { NextResponse } from "next/server";
import { collections, ensureIndexes } from "@/server/collections";
import { verifyOtp } from "@/server/otp";
import { signAuthToken } from "@/server/jwt";
import { setAuthCookie } from "@/server/auth-cookie";
import { getDb } from "@/server/mongo";
import { checkRateLimit } from "@/server/rate-limit";
import {
  resolveClientAdminContext,
  setLastActiveAdmin,
} from "@/server/client-relations";
import { tryAcquireActiveClientSlot } from "@/server/active-client-quota";

export async function POST(req: Request) {
  try {
    await ensureIndexes();

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "")
      .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
      .trim()
      .toLowerCase();
    const code = String(body?.code ?? "").trim();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json(
        { error: "Verification code is required" },
        { status: 400 }
      );
    }

    const c = await collections();
    const db = await getDb();

    await checkRateLimit({
      db,
      req,
      purpose: "otp_verify_client",
      email,
      perIp: { windowMs: 60_000, limit: 30 },
      perEmail: { windowMs: 600_000, limit: 10 },
    });

    const client = await c.clients.findOne({ email });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const otp = await c.otps.findOne({ key: email, purpose: "client_login" });
    if (!otp) {
      return NextResponse.json(
        { error: "Code expired or not requested" },
        { status: 400 }
      );
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      await c.otps.deleteOne({ key: email, purpose: "client_login" });
      return NextResponse.json({ error: "Code expired" }, { status: 400 });
    }

    if (otp.attempts >= 5) {
      await c.otps.deleteOne({ key: email, purpose: "client_login" });
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
    }

    const ok = verifyOtp(code, otp.codeHash);
    if (!ok) {
      await c.otps.updateOne(
        { key: email, purpose: "client_login" },
        { $inc: { attempts: 1 } }
      );
      return NextResponse.json({ error: "Invalid code" }, { status: 401 });
    }

    await c.otps.deleteOne({ key: email, purpose: "client_login" });

    const clientId = client._id.toHexString();

    const resolved = await resolveClientAdminContext({
      c,
      user: client,
      claimedAdminId:
        typeof body?.adminId === "string" ? String(body.adminId) : undefined,
    });

    if (resolved.needsSelection) {
      const message =
        resolved.reason === "NO_RELATIONS" ||
        resolved.reason === "NO_ACTIVE_RELATIONS"
          ? "Your account is not connected to any coach."
          : "Your account no longer has access to this platform. Please contact your coach.";
      return NextResponse.json(
        {
          error: message,
          code: "CLIENT_BLOCKED",
        },
        { status: 403 }
      );
    }

    const adminId = resolved.activeAdminId.toHexString();

    await setLastActiveAdmin({
      c,
      userId: client._id,
      adminId: resolved.activeAdminId,
    });

    const token = await signAuthToken({
      sub: clientId,
      role: "client",
      clientId,
      adminId,
    });

    const res = NextResponse.json({ ok: true });
    setAuthCookie(res, token);

    // Promote only when quota allows.
    // Do NOT reactivate BLOCKED/DELETED/ARCHIVED/INACTIVE via login.
    const now = new Date();
    const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // First, check the current status to avoid unblocking/undeleting
    const clientEntity = await c.entities.findOne({
      entity: "Client",
      adminId: resolved.activeAdminId,
      $or: [
        { "data.userId": clientId },
        { "data.clientAuthId": clientId },
        { "data.email": { $regex: new RegExp(`^${escaped}$`, "i") } },
      ],
    });

    if (clientEntity) {
      const currentStatus = String((clientEntity.data as any).status || "PENDING")
        .trim()
        .toUpperCase();

      const isEligible = currentStatus === "PENDING" || currentStatus === "PENDING_LIMIT";
      if (isEligible) {
        const slot = await tryAcquireActiveClientSlot({
          adminId: resolved.activeAdminId,
        });

        const nextStatus = slot.allowed ? "ACTIVE" : "PENDING_LIMIT";

        await c.entities.updateOne(
          { _id: clientEntity._id },
          {
            $set: {
              "data.status": nextStatus,
              updatedAt: now,
            },
          }
        );

        await c.clientAdminRelations.updateOne(
          { userId: client._id, adminId: resolved.activeAdminId },
          { $set: { status: nextStatus, updatedAt: now } }
        );
      }
    }

    return res;
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
