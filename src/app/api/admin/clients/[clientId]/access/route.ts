import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { collections, ensureIndexes } from "@/server/collections";
import { requireAppUser } from "@/server/auth";

export const runtime = "nodejs";

const postSchema = z
  .object({
    action: z.enum(["block", "unblock"]),
    duration: z.enum(["24h", "unlimited"]).optional(),
    reason: z.string().max(500).optional(),
  })
  .strict();

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeIso(d: Date | null) {
  return d ? d.toISOString() : null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = await requireAppUser();
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ensureIndexes();
    const { clientId } = await ctx.params;
    if (!ObjectId.isValid(clientId)) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const c = await collections();
    const adminId = new ObjectId(user.id);

    const userId = new ObjectId(clientId);

    const client = await c.clients.findOne({ _id: userId });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const rel = await c.clientAdminRelations.findOne({ userId, adminId });
    if (!rel) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (rel.status === "BLOCKED") {
      const until = rel.blockedUntil ?? null;
      if (until instanceof Date && until.getTime() <= Date.now()) {
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
        return NextResponse.json({
          ok: true,
          blocked: false,
          blockType: null,
          blockedUntil: null,
          blockReason: null,
        });
      }

      return NextResponse.json({
        ok: true,
        blocked: true,
        blockType: until ? "temporary" : "permanent",
        blockedUntil: until ? safeIso(until) : null,
        blockReason: rel.blockReason ?? null,
      });
    }

    return NextResponse.json({
      ok: true,
      blocked: false,
      blockType: null,
      blockedUntil: null,
      blockReason: null,
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ clientId: string }> }
) {
  try {
    const user = await requireAppUser();
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ensureIndexes();

    const body = postSchema.parse(await req.json().catch(() => ({})));

    const { clientId } = await ctx.params;
    if (!ObjectId.isValid(clientId)) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const c = await collections();
    const adminId = new ObjectId(user.id);
    const userId = new ObjectId(clientId);

    const existingUser = await c.clients.findOne({ _id: userId });
    if (!existingUser) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const existingRel = await c.clientAdminRelations.findOne({
      userId,
      adminId,
    });
    if (!existingRel) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (body.action === "unblock") {
      await c.clientAdminRelations.updateOne(
        { userId, adminId },
        {
          $set: {
            status: "ACTIVE",
            blockedUntil: null,
            blockReason: null,
            updatedAt: new Date(),
          },
        }
      );

      // Keep admin-facing entity status in sync.
      const clientIdStr = userId.toHexString();
      await c.entities.updateMany(
        {
          adminId,
          entity: "Client",
          "data.status": "BLOCKED",
          $or: [
            { "data.clientAuthId": clientIdStr },
            { "data.userId": clientIdStr },
            {
              "data.email": {
                $regex: new RegExp(
                  `^${escapeRegExp(existingUser.email)}$`,
                  "i"
                ),
              },
            },
          ],
        },
        {
          $set: {
            "data.status": "ACTIVE",
            "data.blockReason": null,
            "data.blockedUntil": null,
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json({ ok: true, blocked: false });
    }

    // action === "block"
    const duration = body.duration ?? "24h";
    const blockedUntil =
      duration === "24h" ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    await c.clientAdminRelations.updateOne(
      { userId, adminId },
      {
        $set: {
          status: "BLOCKED",
          blockedUntil,
          blockReason: reason || null,
          updatedAt: new Date(),
        },
      }
    );

    // Keep admin-facing entity status in sync.
    const clientIdStr = userId.toHexString();
    await c.entities.updateMany(
      {
        adminId,
        entity: "Client",
        $or: [
          { "data.clientAuthId": clientIdStr },
          { "data.userId": clientIdStr },
          {
            "data.email": {
              $regex: new RegExp(`^${escapeRegExp(existingUser.email)}$`, "i"),
            },
          },
        ],
      },
      {
        $set: {
          "data.status": "BLOCKED",
          "data.blockReason": reason || null,
          "data.blockedUntil": safeIso(blockedUntil),
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      ok: true,
      blocked: true,
      blockType: blockedUntil ? "temporary" : "permanent",
      blockedUntil: safeIso(blockedUntil),
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
