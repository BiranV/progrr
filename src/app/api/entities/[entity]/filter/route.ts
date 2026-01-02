import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { collections } from "@/server/collections";
import { requireAppUser } from "@/server/auth";

export const runtime = "nodejs";

const filterBodySchema = z.record(z.string(), z.any());

function toPublicRecord(row: {
  id: string;
  data: any;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  const data = (row.data ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    created_date: row.createdAt.toISOString(),
    updated_date: row.updatedAt.toISOString(),
    ...data,
  };
}

function toPublicEntityDoc(doc: {
  _id: ObjectId;
  data: any;
  createdAt: Date;
  updatedAt: Date;
}) {
  return toPublicRecord({
    id: doc._id.toHexString(),
    data: doc.data,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ entity: string }> }
) {
  try {
    const user = await requireAppUser();

    const c = await collections();

    const { entity } = await ctx.params;
    const criteria = filterBodySchema.parse(await req.json());

    // CLIENT ACCESS CONTROL
    if (user.role === "client") {
      if (entity !== "Message") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const adminId = new ObjectId(user.adminId);
      const myClient = await c.entities.findOne({
        entity: "Client",
        adminId,
        $or: [{ "data.userId": user.id }, { "data.clientAuthId": user.id }],
      });
      if (!myClient) return NextResponse.json([]);
      const myClientId = myClient._id.toHexString();

      // Must match the caller's own clientId
      if (criteria.clientId !== myClientId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const docs = await c.entities
        .find({ entity: "Message", adminId, "data.clientId": myClientId })
        .sort({ updatedAt: -1 })
        .toArray();

      return NextResponse.json(docs.map(toPublicEntityDoc));
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminId = new ObjectId(user.id);
    const docs = await c.entities
      .find({ entity, adminId })
      .sort({ updatedAt: -1 })
      .toArray();

    const records = docs.map(toPublicEntityDoc);

    const filtered = records.filter((record: Record<string, unknown>) => {
      for (const key of Object.keys(criteria)) {
        if (record?.[key] !== criteria[key]) return false;
      }
      return true;
    });

    return NextResponse.json(filtered);
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message =
      error?.name === "ZodError" ? "Invalid request body" : undefined;
    return NextResponse.json(
      {
        error:
          status === 401 ? "Unauthorized" : message || "Internal Server Error",
      },
      { status }
    );
  }
}
