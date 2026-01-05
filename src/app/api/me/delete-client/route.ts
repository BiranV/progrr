import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { collections } from "@/server/collections";
import { clearAuthCookie, readAuthCookie } from "@/server/auth-cookie";
import { verifyAuthToken } from "@/server/jwt";

export const runtime = "nodejs";

const bodySchema = z.object({
  confirm: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const token = await readAuthCookie();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims = await verifyAuthToken(token);
    if (claims.role !== "client") {
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

    const clientAuthId = new ObjectId(claims.sub);
    const adminIdStr = String(claims.adminId || "").trim();
    if (!ObjectId.isValid(adminIdStr)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const adminId = new ObjectId(adminIdStr);

    const c = await collections();

    const clientAuth = await c.clients.findOne({ _id: clientAuthId });
    if (!clientAuth) {
      const res = NextResponse.json({ ok: true });
      clearAuthCookie(res);
      return res;
    }

    // Locate the client profile entity used by the app UI
    const clientEntity = await c.entities.findOne({
      entity: "Client",
      adminId,
      $or: [
        { "data.userId": clientAuthId.toHexString() },
        { "data.clientAuthId": clientAuthId.toHexString() },
      ],
    });

    const clientEntityId = clientEntity?._id?.toHexString();
    const clientData = (clientEntity?.data ?? {}) as any;
    const clientName = String(clientData?.name ?? "").trim();
    const clientEmail = String(clientData?.email ?? clientAuth.email ?? "")
      .trim()
      .toLowerCase();

    // Delete client-linked data (progress/logs/etc) by clientId field when present.
    if (clientEntity && clientEntityId) {
      // Remove all messages first (privacy), then we will insert a system notification.
      await c.entities.deleteMany({
        adminId,
        entity: "Message",
        "data.clientId": clientEntityId,
      });

      // Remove other client-scoped entities (meetings, schedules, etc).
      await c.entities.deleteMany({ adminId, "data.clientId": clientEntityId });

      // Anonymize client profile record while keeping a placeholder so admins
      // can still see the notification thread.
      await c.entities.updateOne(
        { _id: clientEntity._id, entity: "Client", adminId },
        {
          $set: {
            data: {
              ...clientData,
              name: "Deleted client",
              email: "",
              phone: "",
              avatarDataUrl: null,
              userId: null,
              clientAuthId: null,
              isDeleted: true,
              deletedAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          },
        }
      );

      // Send system-generated notification to admin
      const labelParts = [
        clientName ? `Client ${clientName}` : "Client",
        clientEmail ? `(${clientEmail})` : "",
      ].filter(Boolean);
      const text = `${labelParts.join(
        " "
      )} has permanently deleted their account.`;

      const now = new Date();
      await c.entities.insertOne({
        entity: "Message",
        adminId,
        data: {
          clientId: clientEntityId,
          text,
          senderRole: "admin",
          readByAdmin: false,
          readByClient: false,
          isSystemMessage: true,
          replyDisabled: true,
          source: "system",
          systemNotice:
            "This message is system-generated and cannot be replied to.",
        },
        createdAt: now,
        updatedAt: now,
      });

      // Audit log entry (server-side, admin-scoped)
      await c.entities.insertOne({
        entity: "AuditLog",
        adminId,
        data: {
          action: "client_self_delete",
          clientAuthId: clientAuthId.toHexString(),
          clientEntityId,
          occurredAt: now.toISOString(),
        },
        createdAt: now,
        updatedAt: now,
      });
    }

    // Remove auth client profile and invalidate session
    await c.clients.deleteOne({ _id: clientAuthId });

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
