import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { collections } from "@/server/collections";
import { requireAppUser } from "@/server/auth";
import { getMessageHub } from "@/server/realtime/messageHub";

export const runtime = "nodejs";

const createBodySchema = z.record(z.string(), z.any());

function parseDate(value: unknown): Date | null {
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  return null;
}

function validateMeetingScheduledAtOrThrow(data: Record<string, any>) {
  const scheduledAt = parseDate(data?.scheduledAt);
  if (!scheduledAt) {
    const err: any = new Error("Meeting date & time is required");
    err.status = 400;
    throw err;
  }
  if (scheduledAt.getTime() < Date.now()) {
    const err: any = new Error("Meeting date & time cannot be in the past");
    err.status = 400;
    throw err;
  }
}

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

function sanitizeMeetingForClient(record: any) {
  if (!record || typeof record !== "object") return record;
  const share = Boolean(
    (record as any).shareNotesWithClient ??
    (record as any).shareNotes ??
    (record as any).notesSharedWithClient ??
    (record as any).notesShared
  );
  if (share) return record;
  const { notes, ...rest } = record as any;
  return rest;
}

function sanitizeClientForClient(record: any) {
  if (!record || typeof record !== "object") return record;
  const { notes, ...rest } = record as any;
  return rest;
}

function shouldAutoCompleteMeeting(data: Record<string, any> | null | undefined) {
  const scheduledAt = parseDate(data?.scheduledAt);
  if (!scheduledAt) return false;

  const status = String(data?.status ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");

  if (status && status !== "scheduled") return false;
  return scheduledAt.getTime() < Date.now();
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

      // 0) App settings (read-only): allow clients to see their coach branding (logo, business name, etc.)
      if (entity === "AppSettings") {
        const docs = await c.entities
          .find({ entity: "AppSettings", adminId })
          .sort({ updatedAt: -1 })
          .toArray();
        const records = docs.map(toPublicEntityDoc);
        return NextResponse.json(sortRecords(records, sort));
      }

      // 1) Client profile: only their own record
      if (entity === "Client") {
        const myClient = await c.entities.findOne({
          entity: "Client",
          adminId,
          $or: [{ "data.userId": user.id }, { "data.clientAuthId": user.id }],
        });

        if (!myClient) return NextResponse.json([]);
        const mine = [toPublicEntityDoc(myClient)].map(sanitizeClientForClient);
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

      // 3) Meetings: only meetings for their own clientId
      if (entity === "Meeting") {
        const myClient = await c.entities.findOne({
          entity: "Client",
          adminId,
          $or: [{ "data.userId": user.id }, { "data.clientAuthId": user.id }],
        });
        if (!myClient) return NextResponse.json([]);

        const clientEntityId = myClient._id.toHexString();
        const meetingDocs = await c.entities
          .find({ entity: "Meeting", adminId, "data.clientId": clientEntityId })
          .sort({ "data.scheduledAt": -1, updatedAt: -1 })
          .toArray();

        const toAutoComplete = meetingDocs.filter((d) =>
          shouldAutoCompleteMeeting((d as any)?.data ?? null)
        );
        for (const doc of toAutoComplete) {
          await c.entities.updateOne(
            { _id: doc._id, entity: "Meeting", adminId },
            { $set: { "data.status": "completed", updatedAt: new Date() } }
          );
          (doc as any).data = { ...((doc as any).data ?? {}), status: "completed" };
        }

        const mine = meetingDocs.map(toPublicEntityDoc);
        const sanitized = mine.map(sanitizeMeetingForClient);
        return NextResponse.json(sortRecords(sanitized, sort));
      }

      // 4) Weekly schedule: only their own schedule
      if (entity === "ClientWeeklySchedule") {
        const myClient = await c.entities.findOne({
          entity: "Client",
          adminId,
          $or: [{ "data.userId": user.id }, { "data.clientAuthId": user.id }],
        });
        if (!myClient) return NextResponse.json([]);

        const clientEntityId = myClient._id.toHexString();
        const docs = await c.entities
          .find({
            entity: "ClientWeeklySchedule",
            adminId,
            "data.clientId": clientEntityId,
          })
          .sort({ updatedAt: -1 })
          .toArray();

        const mine = docs.map(toPublicEntityDoc);
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

    if (entity === "Meeting") {
      const toAutoComplete = docs.filter((d) =>
        shouldAutoCompleteMeeting((d as any)?.data ?? null)
      );
      for (const doc of toAutoComplete) {
        await c.entities.updateOne(
          { _id: doc._id, entity: "Meeting", adminId },
          { $set: { "data.status": "completed", updatedAt: new Date() } }
        );
        (doc as any).data = { ...((doc as any).data ?? {}), status: "completed" };
      }
    }

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

    const hub = getMessageHub();

    const c = await collections();

    const { entity } = await ctx.params;
    const body = createBodySchema.parse(await req.json());

    // CLIENT ACCESS CONTROL
    if (user.role === "client") {
      if (entity !== "Message" && entity !== "ClientWeeklySchedule") {
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

      if (entity === "Message") {
        if (body?.clientId && body.clientId !== clientEntityId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      if (entity === "ClientWeeklySchedule") {
        if (String(body?.clientId ?? "").trim() !== clientEntityId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      const now = new Date();
      const insert = await c.entities.insertOne({
        entity,
        adminId,
        data:
          entity === "ClientWeeklySchedule"
            ? { ...body, clientId: clientEntityId }
            : { ...body, clientId: clientEntityId },
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

      if (entity === "Message") {
        hub.publishMessageChanged({
          adminId: adminId.toHexString(),
          clientId: clientEntityId,
          messageId: insert.insertedId.toHexString(),
        });
      }

      return NextResponse.json(toPublicEntityDoc(created));
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prevent replying to deleted clients (server-side enforcement)
    if (entity === "Message") {
      const targetClientId = String((body as any)?.clientId ?? "").trim();
      if (!ObjectId.isValid(targetClientId)) {
        return NextResponse.json(
          { error: "Client is required" },
          { status: 400 }
        );
      }

      const adminId = new ObjectId(user.id);
      const clientDoc = await c.entities.findOne({
        _id: new ObjectId(targetClientId),
        entity: "Client",
        adminId,
      });

      const clientData = (clientDoc?.data ?? {}) as any;
      if (clientDoc && clientData?.isDeleted) {
        return NextResponse.json(
          {
            error:
              "This client has deleted their account. Replies are disabled.",
          },
          { status: 403 }
        );
      }
    }

    if (entity === "Meeting") {
      validateMeetingScheduledAtOrThrow(body);
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

    if (entity === "Message") {
      const clientId = String((body as any)?.clientId ?? "").trim();
      if (clientId) {
        hub.publishMessageChanged({
          adminId: adminId.toHexString(),
          clientId,
          messageId: insert.insertedId.toHexString(),
        });
      }
    }

    return NextResponse.json(toPublicEntityDoc(created));
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message =
      error?.name === "ZodError" ? "Invalid request body" : undefined;
    return NextResponse.json(
      {
        error:
          status === 401
            ? "Unauthorized"
            : error?.message || message || "Internal Server Error",
      },
      { status }
    );
  }
}
