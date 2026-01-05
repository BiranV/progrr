import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { collections } from "@/server/collections";
import { clearAuthCookie, readAuthCookie } from "@/server/auth-cookie";
import { verifyAuthToken } from "@/server/jwt";
import { ensureLegacySingleRelation } from "@/server/client-relations";

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

    const c = await collections();

    const clientAuth = await c.clients.findOne({ _id: clientAuthId });
    if (!clientAuth) {
      const res = NextResponse.json({ ok: true });
      clearAuthCookie(res);
      return res;
    }

    // Ensure legacy relation exists so we can delete/notify ALL admins.
    await ensureLegacySingleRelation({ c, user: clientAuth });

    const relations = await c.clientAdminRelations
      .find({ userId: clientAuthId })
      .toArray();

    const globalEmail = String(clientAuth.email ?? "")
      .trim()
      .toLowerCase();
    const globalName = String((clientAuth as any)?.name ?? "").trim();

    // Delete/anonymize PER ADMIN so no coach retains client data.
    for (const rel of relations) {
      const adminId = rel.adminId;

      // Locate the client profile entity used by the app UI for this admin
      let clientEntity = await c.entities.findOne({
        entity: "Client",
        adminId,
        $or: [
          { "data.userId": clientAuthId.toHexString() },
          { "data.clientAuthId": clientAuthId.toHexString() },
          globalEmail
            ? {
                "data.email": {
                  $regex: new RegExp(
                    `^${globalEmail.replace(
                      /[.*+?^${}()|[\\]\\\\]/g,
                      "\\$&"
                    )}$`,
                    "i"
                  ),
                },
              }
            : { "data.email": "__never__" },
        ],
      });

      const now = new Date();

      if (!clientEntity) {
        // Create a minimal placeholder client so the admin can see the system message.
        const insert = await c.entities.insertOne({
          entity: "Client",
          adminId,
          data: {
            name: "Deleted client",
            email: "",
            phone: "",
            status: "INACTIVE",
            isDeleted: true,
            deletedAt: now.toISOString(),
          },
          createdAt: now,
          updatedAt: now,
        });
        clientEntity = await c.entities.findOne({ _id: insert.insertedId });
      }

      const clientEntityId = clientEntity?._id?.toHexString();
      if (!clientEntity || !clientEntityId) continue;

      const clientData = (clientEntity?.data ?? {}) as any;
      const clientName = String(clientData?.name ?? "").trim() || globalName;

      // Remove all messages first (privacy), then insert a system notification.
      await c.entities.deleteMany({
        adminId,
        entity: "Message",
        "data.clientId": clientEntityId,
      });

      // Remove other client-scoped entities (meetings, schedules, etc).
      await c.entities.deleteMany({ adminId, "data.clientId": clientEntityId });

      // Anonymize client profile record while keeping a placeholder.
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
              deletedAt: now.toISOString(),
            },
            updatedAt: now,
          },
        }
      );

      const labelParts = [
        clientName ? `Client ${clientName}` : "Client",
        globalEmail ? `(${globalEmail})` : "",
      ].filter(Boolean);
      const text = `${labelParts.join(
        " "
      )} has permanently deleted their account.`;

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

    // Remove all relations and the global auth user.
    await c.clientAdminRelations.deleteMany({ userId: clientAuthId });

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
