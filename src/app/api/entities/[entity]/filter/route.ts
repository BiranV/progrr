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

    const filterRecords = (
      records: Record<string, unknown>[],
      crit: Record<string, any>
    ) => {
      return records.filter((record) => {
        for (const key of Object.keys(crit)) {
          if (record?.[key] !== crit[key]) return false;
        }
        return true;
      });
    };

    // CLIENT ACCESS CONTROL
    if (user.role === "client") {
      const adminId = new ObjectId(user.adminId);
      const myClient = await c.entities.findOne({
        entity: "Client",
        adminId,
        $or: [{ "data.userId": user.id }, { "data.clientAuthId": user.id }],
      });
      if (!myClient) return NextResponse.json([]);

      const myClientId = myClient._id.toHexString();
      const myClientData = (myClient.data ?? {}) as any;

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

      const allowedWorkoutPlanIds = normalizeIdList(
        myClientData.assignedPlanIds,
        myClientData.assignedPlanId
      );
      const allowedMealPlanIds = normalizeIdList(
        myClientData.assignedMealPlanIds,
        myClientData.assignedMealPlanId
      );

      // Messages: only messages for their own clientId
      if (entity === "Message") {
        if (criteria.clientId !== myClientId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const docs = await c.entities
          .find({ entity: "Message", adminId, "data.clientId": myClientId })
          .sort({ updatedAt: -1 })
          .toArray();

        return NextResponse.json(docs.map(toPublicEntityDoc));
      }

      // Meetings: only meetings for their own clientId
      if (entity === "Meeting") {
        if (criteria.clientId !== myClientId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const docs = await c.entities
          .find({ entity: "Meeting", adminId, "data.clientId": myClientId })
          .sort({ "data.scheduledAt": -1, updatedAt: -1 })
          .toArray();

        const records = docs.map(toPublicEntityDoc);
        return NextResponse.json(filterRecords(records, criteria));
      }

      // Exercises: only those belonging to the client's assigned workout plan
      if (entity === "Exercise") {
        const workoutPlanId = String(criteria.workoutPlanId ?? "").trim();
        if (!workoutPlanId || !allowedWorkoutPlanIds.includes(workoutPlanId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const docs = await c.entities
          .find({
            entity: "Exercise",
            adminId,
            "data.workoutPlanId": workoutPlanId,
          })
          .sort({ "data.order": 1, updatedAt: -1 })
          .toArray();

        const records = docs.map(toPublicEntityDoc);
        return NextResponse.json(filterRecords(records, criteria));
      }

      // PlanExercises: only those belonging to the client's assigned workout plan
      if (entity === "PlanExercise") {
        const workoutPlanId = String(criteria.workoutPlanId ?? "").trim();
        if (!workoutPlanId || !allowedWorkoutPlanIds.includes(workoutPlanId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const docs = await c.entities
          .find({
            entity: "PlanExercise",
            adminId,
            "data.workoutPlanId": workoutPlanId,
          })
          .sort({ "data.order": 1, updatedAt: -1 })
          .toArray();

        const records = docs.map(toPublicEntityDoc);
        return NextResponse.json(filterRecords(records, criteria));
      }

      // Meals: only those belonging to the client's assigned meal plan
      if (entity === "Meal") {
        const mealPlanId = String(criteria.mealPlanId ?? "").trim();
        if (!mealPlanId || !allowedMealPlanIds.includes(mealPlanId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const docs = await c.entities
          .find({ entity: "Meal", adminId, "data.mealPlanId": mealPlanId })
          .sort({ "data.order": 1, updatedAt: -1 })
          .toArray();

        const records = docs.map(toPublicEntityDoc);
        return NextResponse.json(filterRecords(records, criteria));
      }

      // Foods: only those belonging to meals inside the client's assigned meal plan
      if (entity === "Food") {
        const mealId = String(criteria.mealId ?? "").trim();
        if (!mealId || !ObjectId.isValid(mealId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const mealDoc = await c.entities.findOne({
          _id: new ObjectId(mealId),
          entity: "Meal",
          adminId,
        });

        const mealData = (mealDoc?.data ?? {}) as any;
        if (!mealDoc) return NextResponse.json([]);
        if (!allowedMealPlanIds.length) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (
          !allowedMealPlanIds.includes(String(mealData.mealPlanId ?? "").trim())
        ) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const docs = await c.entities
          .find({ entity: "Food", adminId, "data.mealId": mealId })
          .sort({ "data.order": 1, updatedAt: -1 })
          .toArray();

        const records = docs.map(toPublicEntityDoc);
        return NextResponse.json(filterRecords(records, criteria));
      }

      // PlanFoods: only those belonging to meals inside the client's assigned meal plan
      if (entity === "PlanFood") {
        const mealId = String(criteria.mealId ?? "").trim();
        if (!mealId || !ObjectId.isValid(mealId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const mealDoc = await c.entities.findOne({
          _id: new ObjectId(mealId),
          entity: "Meal",
          adminId,
        });

        const mealData = (mealDoc?.data ?? {}) as any;
        if (!mealDoc) return NextResponse.json([]);
        if (!allowedMealPlanIds.length) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (
          !allowedMealPlanIds.includes(String(mealData.mealPlanId ?? "").trim())
        ) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const docs = await c.entities
          .find({ entity: "PlanFood", adminId, "data.mealId": mealId })
          .sort({ "data.order": 1, updatedAt: -1 })
          .toArray();

        const records = docs.map(toPublicEntityDoc);
        return NextResponse.json(filterRecords(records, criteria));
      }

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

    return NextResponse.json(filterRecords(records, criteria));
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
