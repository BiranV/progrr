import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { collections } from "@/server/collections";
import { requireAppUser } from "@/server/auth";
import { getMessageHub } from "@/server/realtime/messageHub";

export const runtime = "nodejs";

const patchBodySchema = z.record(z.string(), z.any());

function parseNumber(value: unknown): number {
  const n = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

async function recomputeMealPlanTotalsForFoodLibrary(args: {
  c: Awaited<ReturnType<typeof collections>>;
  adminId: ObjectId;
  foodLibraryId: string;
}) {
  const { c, adminId, foodLibraryId } = args;
  if (!foodLibraryId) return;

  const planFoodDocs = await c.entities
    .find({
      entity: "PlanFood",
      adminId,
      "data.foodLibraryId": foodLibraryId,
    })
    .project({ _id: 1, "data.mealId": 1 })
    .toArray();

  const mealIds = Array.from(
    new Set(
      planFoodDocs
        .map((d) => String((d as any)?.data?.mealId ?? "").trim())
        .filter((id) => id && ObjectId.isValid(id))
    )
  );
  if (!mealIds.length) return;

  const mealDocs = await c.entities
    .find({
      entity: "Meal",
      adminId,
      _id: { $in: mealIds.map((id) => new ObjectId(id)) },
    })
    .project({ _id: 1, "data.mealPlanId": 1 })
    .toArray();

  const mealPlanIds = Array.from(
    new Set(
      mealDocs
        .map((d) => String((d as any)?.data?.mealPlanId ?? "").trim())
        .filter((id) => id && ObjectId.isValid(id))
    )
  );
  if (!mealPlanIds.length) return;

  for (const mealPlanId of mealPlanIds) {
    const mealsInPlan = await c.entities
      .find({
        entity: "Meal",
        adminId,
        "data.mealPlanId": mealPlanId,
      })
      .project({ _id: 1 })
      .toArray();
    const mealIdsInPlan = mealsInPlan.map((m) => m._id);
    if (!mealIdsInPlan.length) continue;

    const planFoodsInPlan = await c.entities
      .find({
        entity: "PlanFood",
        adminId,
        "data.mealId": { $in: mealIdsInPlan.map((x) => x.toHexString()) },
      })
      .project({ _id: 1, data: 1 })
      .toArray();

    const uniqueFoodLibraryIds = Array.from(
      new Set(
        planFoodsInPlan
          .map((pf) => String((pf as any)?.data?.foodLibraryId ?? "").trim())
          .filter((id) => id && ObjectId.isValid(id))
      )
    );

    const foodDocs = uniqueFoodLibraryIds.length
      ? await c.entities
          .find({
            entity: "FoodLibrary",
            adminId,
            _id: { $in: uniqueFoodLibraryIds.map((id) => new ObjectId(id)) },
          })
          .project({ _id: 1, data: 1 })
          .toArray()
      : [];

    const foodById = new Map<string, any>();
    for (const fd of foodDocs) {
      foodById.set(fd._id.toHexString(), (fd as any).data ?? {});
    }

    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    for (const pf of planFoodsInPlan) {
      const data = (pf as any).data ?? {};
      const fid = String(data.foodLibraryId ?? "").trim();
      const grams = parseNumber(data.amount);
      if (!fid || grams <= 0) continue;

      const f = foodById.get(fid);
      if (!f) continue;

      const factor = grams / 100;
      calories += parseNumber(f.calories) * factor;
      protein += parseNumber(f.protein) * factor;
      carbs += parseNumber(f.carbs) * factor;
      fat += parseNumber(f.fat) * factor;
    }

    const next = {
      dailyCalories: String(Math.round(calories)),
      dailyProtein: String(Number(protein.toFixed(1))),
      dailyCarbs: String(Number(carbs.toFixed(1))),
      dailyFat: String(Number(fat.toFixed(1))),
    };

    await c.entities.updateOne(
      { _id: new ObjectId(mealPlanId), entity: "MealPlan", adminId },
      {
        $set: {
          "data.dailyCalories": next.dailyCalories,
          "data.dailyProtein": next.dailyProtein,
          "data.dailyCarbs": next.dailyCarbs,
          "data.dailyFat": next.dailyFat,
          updatedAt: new Date(),
        },
      }
    );
  }
}

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

      const normalizeIdList = (value: any, fallbackSingle?: any): string[] => {
        const arr = Array.isArray(value) ? value : [];
        const fallback = String(fallbackSingle ?? "").trim();
        const merged = [
          ...arr.map((v: any) => String(v ?? "").trim()),
          ...(fallback ? [fallback] : []),
        ]
          .map((v) => String(v).trim())
          .filter((v) => v && v !== "none");
        return Array.from(new Set(merged));
      };

      const myClientData = (myClient?.data ?? {}) as any;
      const allowedWorkoutPlanIds = normalizeIdList(
        myClientData.assignedPlanIds,
        myClientData.assignedPlanId
      );
      const allowedMealPlanIds = normalizeIdList(
        myClientData.assignedMealPlanIds,
        myClientData.assignedMealPlanId
      );

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

      if (entity === "ClientWeeklySchedule") {
        if (!myClient) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (!ObjectId.isValid(id)) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const row = await c.entities.findOne({
          _id: new ObjectId(id),
          entity: "ClientWeeklySchedule",
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
        const allowedIds =
          entity === "WorkoutPlan" ? allowedWorkoutPlanIds : allowedMealPlanIds;

        if (!allowedIds.length || !allowedIds.includes(id)) {
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

      if (entity === "PlanExercise") {
        if (!myClient) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (!ObjectId.isValid(id)) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        const row = await c.entities.findOne({
          _id: new ObjectId(id),
          entity: "PlanExercise",
          adminId,
        });
        if (!row) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        const workoutPlanId = String(
          (row.data ?? {})?.workoutPlanId ?? ""
        ).trim();
        if (!workoutPlanId || !allowedWorkoutPlanIds.includes(workoutPlanId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        return NextResponse.json(toPublicEntityDoc(row));
      }

      if (entity === "PlanFood") {
        if (!myClient) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (!ObjectId.isValid(id)) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        const row = await c.entities.findOne({
          _id: new ObjectId(id),
          entity: "PlanFood",
          adminId,
        });
        if (!row) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const mealId = String((row.data ?? {})?.mealId ?? "").trim();
        if (!mealId || !ObjectId.isValid(mealId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const mealDoc = await c.entities.findOne({
          _id: new ObjectId(mealId),
          entity: "Meal",
          adminId,
        });
        const mealData = (mealDoc?.data ?? {}) as any;
        const mealPlanId = String(mealData.mealPlanId ?? "").trim();
        if (!mealPlanId || !allowedMealPlanIds.includes(mealPlanId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json(toPublicEntityDoc(row));
      }

      if (entity === "ExerciseLibrary") {
        if (!myClient) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (!ObjectId.isValid(id)) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Allow only if the library exercise is referenced by at least one
        // PlanExercise within the client's assigned workout plan(s).
        if (!allowedWorkoutPlanIds.length) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const isReferenced = await c.entities.findOne({
          entity: "PlanExercise",
          adminId,
          "data.exerciseLibraryId": id,
          "data.workoutPlanId": { $in: allowedWorkoutPlanIds },
        });
        if (!isReferenced) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const row = await c.entities.findOne({
          _id: new ObjectId(id),
          entity: "ExerciseLibrary",
          adminId,
        });
        if (!row) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json(toPublicEntityDoc(row));
      }

      if (entity === "FoodLibrary") {
        if (!myClient) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (!ObjectId.isValid(id)) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Allow only if the library food is referenced by at least one
        // PlanFood within the client's assigned meal plan(s).
        if (!allowedMealPlanIds.length) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const mealDocs = await c.entities
          .find({
            entity: "Meal",
            adminId,
            "data.mealPlanId": { $in: allowedMealPlanIds },
          })
          .project({ _id: 1 })
          .toArray();

        const allowedMealIds = mealDocs.map((d) => d._id.toHexString());
        if (!allowedMealIds.length) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const isReferenced = await c.entities.findOne({
          entity: "PlanFood",
          adminId,
          "data.foodLibraryId": id,
          "data.mealId": { $in: allowedMealIds },
        });
        if (!isReferenced) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const row = await c.entities.findOne({
          _id: new ObjectId(id),
          entity: "FoodLibrary",
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

    const hub = getMessageHub();

    const c = await collections();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

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
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const existing = await c.entities.findOne({
        _id: new ObjectId(id),
        entity,
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

      if (entity === "ClientWeeklySchedule") {
        if (Object.prototype.hasOwnProperty.call(patch, "clientId")) {
          if (
            String((patch as any).clientId ?? "").trim() !==
            myClient._id.toHexString()
          ) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

      if (entity === "Message") {
        const data = (row.data ?? {}) as any;
        const clientId = String(data.clientId ?? "").trim();
        if (clientId) {
          hub.publishMessageChanged({
            adminId: adminId.toHexString(),
            clientId,
            messageId: id,
          });
        }
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

    if (entity === "FoodLibrary") {
      // Keep dependent meal plan totals in sync when a library food changes.
      await recomputeMealPlanTotalsForFoodLibrary({
        c,
        adminId,
        foodLibraryId: id,
      });
    }

    const row = await c.entities.findOne({ _id: new ObjectId(id) });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (entity === "Message") {
      const data = (row.data ?? {}) as any;
      const clientId = String(data.clientId ?? "").trim();
      if (clientId) {
        hub.publishMessageChanged({
          adminId: adminId.toHexString(),
          clientId,
          messageId: id,
        });
      }
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

    const hub = getMessageHub();

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

    if (entity === "Message") {
      const data = (existing.data ?? {}) as any;
      const clientId = String(data.clientId ?? "").trim();
      if (clientId) {
        hub.publishMessageChanged({
          adminId: adminId.toHexString(),
          clientId,
          messageId: id,
        });
      }
    }

    await c.entities.deleteOne({ _id: new ObjectId(id) });

    // If a coach deletes a Client entity, also delete the login record so the
    // client can no longer authenticate by phone.
    if (entity === "Client") {
      const d = (existing.data ?? {}) as any;
      const authId = String(d.clientAuthId ?? d.userId ?? "");
      const email = String(d.email ?? "")
        .trim()
        .toLowerCase();

      let userId: ObjectId | null = null;
      if (ObjectId.isValid(authId)) {
        userId = new ObjectId(authId);
      } else if (email) {
        const client = await c.clients.findOne({ email });
        if (client?._id) userId = client._id;
      }

      if (userId) {
        await c.clientAdminRelations.deleteOne({ userId, adminId });
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
