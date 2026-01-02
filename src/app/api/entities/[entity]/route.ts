import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { collections } from "@/server/collections";
import { requireAppUser } from "@/server/auth";

export const runtime = "nodejs";

const createBodySchema = z.record(z.string(), z.any());

function toPublicRecord(row: {
  id: string;
  data: any;
  createdAt: Date;
  updatedAt: Date;
}) {
  const data = (row.data ?? {}) as Record<string, any>;
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

function sortRecords(records: any[], sort?: string | null) {
  if (!sort) return records;
  const sortKey = sort.startsWith("-") ? sort.slice(1) : sort;
  const desc = sort.startsWith("-");

  return [...records].sort((a, b) => {
    const av = a?.[sortKey];
    const bv = b?.[sortKey];

    if (av == null && bv == null) return 0;
    if (av == null) return desc ? 1 : -1;
    if (bv == null) return desc ? -1 : 1;

    // try date compare if ISO-ish
    const ad = typeof av === "string" ? Date.parse(av) : NaN;
    const bd = typeof bv === "string" ? Date.parse(bv) : NaN;
    if (!Number.isNaN(ad) && !Number.isNaN(bd)) {
      return desc ? bd - ad : ad - bd;
    }

    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ entity: string }> }
) {
  try {
    const user = await requireAppUser();

    const c = await collections();

    const { entity } = await ctx.params;
    const url = new URL(req.url);
    const sort = url.searchParams.get("sort");

    // CLIENT ACCESS CONTROL
    if (user.role === "client") {
      const adminId = new ObjectId(user.adminId);

      // 1) Client profile: only their own record
      if (entity === "Client") {
        const myClient = await c.entities.findOne({
          entity: "Client",
          adminId,
          $or: [{ "data.userId": user.id }, { "data.clientAuthId": user.id }],
        });

        if (!myClient) return NextResponse.json([]);
        const mine = [toPublicEntityDoc(myClient)];
        return NextResponse.json(sortRecords(mine, sort));
      }

      // 2) Messages: only messages for their own clientId
      if (entity === "Message") {
        const myClient = await c.entities.findOne({
          entity: "Client",
          adminId,
          $or: [{ "data.userId": user.id }, { "data.clientAuthId": user.id }],
        });
        if (!myClient) return NextResponse.json([]);

        const clientEntityId = myClient._id.toHexString();
        const messageDocs = await c.entities
          .find({ entity: "Message", adminId, "data.clientId": clientEntityId })
          .sort({ updatedAt: -1 })
          .toArray();

        const mine = messageDocs.map(toPublicEntityDoc);
        return NextResponse.json(sortRecords(mine, sort));
      }

      // Everything else is admin-only
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    return NextResponse.json(sortRecords(records, sort));
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : "Internal Server Error" },
      { status }
    );
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ entity: string }> }
) {
  try {
    const user = await requireAppUser();

    const c = await collections();

    const { entity } = await ctx.params;
    const body = createBodySchema.parse(await req.json());

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
      if (!myClient) {
        return NextResponse.json(
          { error: "Client profile not found" },
          { status: 403 }
        );
      }

      const clientEntityId = myClient._id.toHexString();
      if (body?.clientId && body.clientId !== clientEntityId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const now = new Date();
      const insert = await c.entities.insertOne({
        entity,
        adminId,
        data: { ...body, clientId: clientEntityId },
        createdAt: now,
        updatedAt: now,
      });

      const created = await c.entities.findOne({ _id: insert.insertedId });
      if (!created) {
        return NextResponse.json(
          { error: "Internal Server Error" },
          { status: 500 }
        );
      }

      return NextResponse.json(toPublicEntityDoc(created));
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminId = new ObjectId(user.id);
    const now = new Date();
    const insert = await c.entities.insertOne({
      entity,
      adminId,
      data: body,
      createdAt: now,
      updatedAt: now,
    });

    const created = await c.entities.findOne({ _id: insert.insertedId });
    if (!created) {
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
      );
    }

    return NextResponse.json(toPublicEntityDoc(created));
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
