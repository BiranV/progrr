import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { collections } from "@/server/collections";
import { requireAppUser } from "@/server/auth";

export const runtime = "nodejs";

const patchBodySchema = z.record(z.string(), z.any());

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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ entity: string; id: string }> }
) {
  try {
    const user = await requireAppUser();
    const { entity, id } = await ctx.params;

    const c = await collections();

    // CLIENT ACCESS CONTROL
    if (user.role === "client") {
      const adminId = new ObjectId(user.adminId);
      const myClient = await c.entities.findOne({
        entity: "Client",
        adminId,
        $or: [{ "data.userId": user.id }, { "data.clientAuthId": user.id }],
      });

      if (entity === "Client") {
        if (!myClient || myClient._id.toHexString() !== id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        return NextResponse.json(toPublicEntityDoc(myClient));
      }

      if (entity === "Message") {
        if (!myClient) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (!ObjectId.isValid(id)) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const row = await c.entities.findOne({
          _id: new ObjectId(id),
          entity: "Message",
          adminId,
        });
        if (!row) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (((row.data ?? {}) as any).clientId !== myClient._id.toHexString()) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        return NextResponse.json(toPublicEntityDoc(row));
      }

      if (entity === "Meeting") {
        if (!myClient) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (!ObjectId.isValid(id)) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const row = await c.entities.findOne({
          _id: new ObjectId(id),
          entity: "Meeting",
          adminId,
        });
        if (!row) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (((row.data ?? {}) as any).clientId !== myClient._id.toHexString()) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json(toPublicEntityDoc(row));
      }

      if (entity === "WorkoutPlan" || entity === "MealPlan") {
        if (!myClient) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const d = (myClient.data ?? {}) as any;
        const allowedId =
          entity === "WorkoutPlan" ? d.assignedPlanId : d.assignedMealPlanId;
        if (!allowedId || allowedId !== id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!ObjectId.isValid(id)) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const row = await c.entities.findOne({
          _id: new ObjectId(id),
          entity,
          adminId,
        });
        if (!row) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json(toPublicEntityDoc(row));
      }

      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const adminId = new ObjectId(user.id);
    const row = await c.entities.findOne({
      _id: new ObjectId(id),
      entity,
      adminId,
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(toPublicEntityDoc(row));
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : "Internal Server Error" },
      { status }
    );
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ entity: string; id: string }> }
) {
  try {
    const user = await requireAppUser();
    const { entity, id } = await ctx.params;

    const c = await collections();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

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
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const existing = await c.entities.findOne({
        _id: new ObjectId(id),
        entity: "Message",
        adminId,
      });
      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (
        ((existing.data ?? {}) as any).clientId !== myClient._id.toHexString()
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const patch = patchBodySchema.parse(await req.json());

      await c.entities.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            data: {
              ...(existing.data as any),
              ...patch,
            },
            updatedAt: new Date(),
          },
        }
      );

      const row = await c.entities.findOne({ _id: new ObjectId(id) });
      if (!row) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      return NextResponse.json(toPublicEntityDoc(row));
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminId = new ObjectId(user.id);

    const existing = await c.entities.findOne({
      _id: new ObjectId(id),
      entity,
      adminId,
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const patch = patchBodySchema.parse(await req.json());

    if (
      entity === "Meeting" &&
      Object.prototype.hasOwnProperty.call(patch, "scheduledAt")
    ) {
      const nextScheduledAt = parseDate((patch as any).scheduledAt);
      if (!nextScheduledAt) {
        return NextResponse.json(
          { error: "Meeting date & time is required" },
          { status: 400 }
        );
      }

      if (nextScheduledAt.getTime() < Date.now()) {
        const prevScheduledAt = parseDate(
          ((existing.data ?? {}) as any)?.scheduledAt
        );
        const unchanged =
          prevScheduledAt &&
          prevScheduledAt.getTime() === nextScheduledAt.getTime();

        if (!unchanged) {
          return NextResponse.json(
            { error: "Meeting date & time cannot be in the past" },
            { status: 400 }
          );
        }
      }
    }

    await c.entities.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          data: {
            ...(existing.data as any),
            ...patch,
          },
          updatedAt: new Date(),
        },
      }
    );

    const row = await c.entities.findOne({ _id: new ObjectId(id) });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(toPublicEntityDoc(row));
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

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ entity: string; id: string }> }
) {
  try {
    const user = await requireAppUser();
    const { entity, id } = await ctx.params;

    const c = await collections();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ ok: true });
    }

    if (user.role === "client") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminId = new ObjectId(user.id);
    const existing = await c.entities.findOne({
      _id: new ObjectId(id),
      entity,
      adminId,
    });
    if (!existing) return NextResponse.json({ ok: true });

    await c.entities.deleteOne({ _id: new ObjectId(id) });

    // If a coach deletes a Client entity, also delete the login record so the
    // client can no longer authenticate by phone.
    if (entity === "Client") {
      const d = (existing.data ?? {}) as any;
      const authId = String(d.clientAuthId ?? d.userId ?? "");
      if (ObjectId.isValid(authId)) {
        await c.clients.deleteOne({ _id: new ObjectId(authId), adminId });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : "Internal Server Error" },
      { status }
    );
  }
}
