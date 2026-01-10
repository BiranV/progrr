import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ensureIndexes, collections } from "@/server/collections";
import { readAuthCookie } from "@/server/auth-cookie";
import { verifyAuthToken } from "@/server/jwt";
import { ensureLegacySingleRelation } from "@/server/client-relations";

export const runtime = "nodejs";

type PlanSummary = {
    id: string;
    name: string;
    goal?: string;
    notes?: string;
    dailyCalories?: string;
    dailyProtein?: string;
    dailyCarbs?: string;
    dailyFat?: string;
    dailyFiber?: string;
    dailySugars?: string;
    dailySaturatedFat?: string;
    dailyTransFat?: string;
    dailyCholesterol?: string;
    dailySodium?: string;
    dailyPotassium?: string;
    dailyCalcium?: string;
    dailyIron?: string;
    dailyVitaminA?: string;
    dailyVitaminC?: string;
    dailyVitaminD?: string;
    dailyVitaminB12?: string;
    difficulty?: string;
    duration?: string;
};

type MealSummary = {
    id: string;
    type?: string;
    name?: string;
    order?: number;
    foods: Array<{
        id: string;
        name?: string;
        amount?: string;
        calories?: string | number;
        protein?: string | number;
        carbs?: string | number;
        fat?: string | number;
    }>;
};

type ExerciseSummary = {
    id: string;
    name?: string;
    videoKind?: string | null;
    videoUrl?: string | null;
    sets?: string;
    reps?: string;
    restSeconds?: number;
    order?: number;
};

type AdminPlansBlock = {
    adminId: string;
    label: string;
    mealPlans: Array<PlanSummary & { meals: MealSummary[] }>;
    workoutPlans: Array<PlanSummary & { exercises: ExerciseSummary[] }>;
};

function normalizeIdList(value: any, fallbackSingle?: any): string[] {
    const arr = Array.isArray(value) ? value : [];
    const fallback = String(fallbackSingle ?? "").trim();
    const merged = [
        ...arr.map((v: any) => String(v ?? "").trim()),
        ...(fallback ? [fallback] : []),
    ]
        .map((v) => String(v).trim())
        .filter((v) => v && v !== "none");
    return Array.from(new Set(merged));
}

function isBlocked(rel: any, now = new Date()) {
    const status = String(rel?.status ?? "ACTIVE")
        .trim()
        .toUpperCase();
    if (status !== "BLOCKED") return false;
    const until = rel?.blockedUntil ?? null;
    if (until instanceof Date && until.getTime() <= now.getTime()) {
        return false;
    }
    return true;
}

function shouldIncludeRelation(rel: any, now = new Date()) {
    const status = String(rel?.status ?? "ACTIVE")
        .trim()
        .toUpperCase();

    if (status === "DELETED" || status === "INACTIVE") return false;
    if (status === "BLOCKED") return !isBlocked(rel, now);
    // ACTIVE or PENDING
    return true;
}

export async function GET() {
    try {
        await ensureIndexes();

        const token = await readAuthCookie();
        if (!token) {
            return NextResponse.json(
                { ok: false, error: "Not authenticated" },
                { status: 401 }
            );
        }

        const claims = await verifyAuthToken(token);
        if (claims.role !== "client") {
            return NextResponse.json(
                { ok: false, error: "Only clients can access plans" },
                { status: 403 }
            );
        }

        if (!ObjectId.isValid(claims.sub)) {
            return NextResponse.json(
                { ok: false, error: "Not authenticated" },
                { status: 401 }
            );
        }

        const c = await collections();
        const userId = new ObjectId(claims.sub);

        const user = await c.clients.findOne({ _id: userId });
        if (!user) {
            return NextResponse.json(
                { ok: false, error: "Not authenticated" },
                { status: 401 }
            );
        }

        await ensureLegacySingleRelation({ c, user });

        const relationsAll = await c.clientAdminRelations
            .find({ userId })
            .sort({ createdAt: -1 })
            .toArray();

        const now = new Date();
        const relations = relationsAll.filter((r) => shouldIncludeRelation(r, now));

        const adminIds = relations.map((r) => r.adminId);
        const admins = adminIds.length
            ? await c.admins
                .find({ _id: { $in: adminIds } })
                .project({ _id: 1, email: 1, fullName: 1 })
                .toArray()
            : [];

        const adminById = new Map(admins.map((a) => [a._id!.toHexString(), a]));

        const appSettingsDocs = adminIds.length
            ? await c.entities
                .find({ entity: "AppSettings", adminId: { $in: adminIds } })
                .sort({ updatedAt: -1 })
                .toArray()
            : [];

        const businessNameByAdminId = new Map<string, string>();
        for (const doc of appSettingsDocs as any[]) {
            const aId = doc?.adminId?.toHexString?.() ?? "";
            if (!aId || businessNameByAdminId.has(aId)) continue;
            const name = String(doc?.data?.businessName ?? "").trim();
            if (name) businessNameByAdminId.set(aId, name);
        }

        const results: AdminPlansBlock[] = [];

        for (const rel of relations as any[]) {
            const adminIdObj: ObjectId = rel.adminId;
            const adminId = adminIdObj.toHexString();

            const admin = adminById.get(adminId);
            const label =
                businessNameByAdminId.get(adminId) ||
                (admin?.fullName ? String(admin.fullName).trim() : "") ||
                (admin?.email ? String(admin.email).trim() : "") ||
                adminId;

            const clientEntity = await c.entities.findOne({
                entity: "Client",
                adminId: adminIdObj,
                $or: [
                    { "data.userId": claims.sub },
                    { "data.clientAuthId": claims.sub },
                ],
            });

            const clientData = (clientEntity?.data ?? {}) as any;

            const workoutPlanIds = normalizeIdList(
                clientData.assignedPlanIds,
                clientData.assignedPlanId
            ).filter((id) => ObjectId.isValid(id));

            const mealPlanIds = normalizeIdList(
                clientData.assignedMealPlanIds,
                clientData.assignedMealPlanId
            ).filter((id) => ObjectId.isValid(id));

            const workoutPlanObjectIds = workoutPlanIds.map((id) => new ObjectId(id));
            const mealPlanObjectIds = mealPlanIds.map((id) => new ObjectId(id));

            const workoutPlanDocs = workoutPlanObjectIds.length
                ? await c.entities
                    .find({
                        entity: "WorkoutPlan",
                        adminId: adminIdObj,
                        _id: { $in: workoutPlanObjectIds },
                    })
                    .sort({ updatedAt: -1 })
                    .toArray()
                : [];

            const mealPlanDocs = mealPlanObjectIds.length
                ? await c.entities
                    .find({
                        entity: "MealPlan",
                        adminId: adminIdObj,
                        _id: { $in: mealPlanObjectIds },
                    })
                    .sort({ updatedAt: -1 })
                    .toArray()
                : [];

            const workoutPlans: Array<PlanSummary & { exercises: ExerciseSummary[] }> =
                [];

            for (const doc of workoutPlanDocs as any[]) {
                const planId = doc._id.toHexString();
                const data = (doc.data ?? {}) as any;

                const planExerciseDocs = await c.entities
                    .find({
                        entity: "PlanExercise",
                        adminId: adminIdObj,
                        "data.workoutPlanId": planId,
                    })
                    .sort({ "data.order": 1, updatedAt: -1 })
                    .toArray();

                let exercises: ExerciseSummary[] = [];

                if (planExerciseDocs.length) {
                    const libIds = Array.from(
                        new Set(
                            planExerciseDocs
                                .map((r: any) => String(r?.data?.exerciseLibraryId ?? "").trim())
                                .filter((id) => ObjectId.isValid(id))
                        )
                    );

                    const libObjectIds = libIds.map((id) => new ObjectId(id));
                    const libs = libObjectIds.length
                        ? await c.entities
                            .find({
                                entity: "ExerciseLibrary",
                                adminId: adminIdObj,
                                _id: { $in: libObjectIds },
                            })
                            .toArray()
                        : [];

                    const libById = new Map(
                        (libs as any[]).map((l) => [l._id.toHexString(), l.data ?? {}])
                    );

                    exercises = (planExerciseDocs as any[]).map((row) => {
                        const rowData = (row.data ?? {}) as any;
                        const libId = String(rowData.exerciseLibraryId ?? "").trim();
                        const lib = libById.get(libId) ?? {};
                        return {
                            id: row._id.toHexString(),
                            name: lib?.name ?? "-",
                            videoKind: lib?.videoKind ?? null,
                            videoUrl: lib?.videoUrl ?? null,
                            sets: rowData?.sets,
                            reps: rowData?.reps,
                            restSeconds: rowData?.restSeconds,
                            order: rowData?.order,
                        } satisfies ExerciseSummary;
                    });
                } else {
                    // Legacy fallback
                    const legacy = await c.entities
                        .find({
                            entity: "Exercise",
                            adminId: adminIdObj,
                            "data.workoutPlanId": planId,
                        })
                        .sort({ "data.order": 1, updatedAt: -1 })
                        .toArray();

                    exercises = (legacy as any[]).map((row) => {
                        const rowData = (row.data ?? {}) as any;
                        return {
                            id: row._id.toHexString(),
                            name: rowData?.name ?? "-",
                            videoKind: rowData?.videoKind ?? null,
                            videoUrl: rowData?.videoUrl ?? null,
                            sets: rowData?.sets,
                            reps: rowData?.reps,
                            restSeconds: rowData?.restSeconds,
                            order: rowData?.order,
                        } satisfies ExerciseSummary;
                    });
                }

                workoutPlans.push({
                    id: planId,
                    name: String(data?.name ?? "").trim() || "Workout Plan",
                    goal: String(data?.goal ?? "").trim() || undefined,
                    notes: String(data?.notes ?? "").trim() || undefined,
                    difficulty: String(data?.difficulty ?? "").trim() || undefined,
                    duration: String(data?.duration ?? "").trim() || undefined,
                    exercises,
                });
            }

            const mealPlans: Array<PlanSummary & { meals: MealSummary[] }> = [];

            for (const doc of mealPlanDocs as any[]) {
                const planId = doc._id.toHexString();
                const data = (doc.data ?? {}) as any;

                const mealDocs = await c.entities
                    .find({
                        entity: "Meal",
                        adminId: adminIdObj,
                        "data.mealPlanId": planId,
                    })
                    .sort({ "data.order": 1, updatedAt: -1 })
                    .toArray();

                const meals: MealSummary[] = [];

                for (const mealDoc of mealDocs as any[]) {
                    const mealId = mealDoc._id.toHexString();
                    const mealData = (mealDoc.data ?? {}) as any;

                    const planFoodDocs = await c.entities
                        .find({
                            entity: "PlanFood",
                            adminId: adminIdObj,
                            "data.mealId": mealId,
                        })
                        .sort({ "data.order": 1, updatedAt: -1 })
                        .toArray();

                    let foods: MealSummary["foods"] = [];

                    if (planFoodDocs.length) {
                        const libIds = Array.from(
                            new Set(
                                (planFoodDocs as any[])
                                    .map((r) => String(r?.data?.foodLibraryId ?? "").trim())
                                    .filter((id) => ObjectId.isValid(id))
                            )
                        );

                        const libObjectIds = libIds.map((id) => new ObjectId(id));
                        const libs = libObjectIds.length
                            ? await c.entities
                                .find({
                                    entity: "FoodLibrary",
                                    adminId: adminIdObj,
                                    _id: { $in: libObjectIds },
                                })
                                .toArray()
                            : [];

                        const libById = new Map(
                            (libs as any[]).map((l) => [l._id.toHexString(), l.data ?? {}])
                        );

                        foods = (planFoodDocs as any[]).map((row) => {
                            const rowData = (row.data ?? {}) as any;
                            const libId = String(rowData.foodLibraryId ?? "").trim();
                            const lib = libById.get(libId) ?? {};
                            return {
                                id: row._id.toHexString(),
                                name: lib?.name ?? "-",
                                amount: String(rowData?.amount ?? "").trim() || undefined,
                                calories: lib?.calories ?? undefined,
                                protein: lib?.protein ?? undefined,
                                carbs: lib?.carbs ?? undefined,
                                fat: lib?.fat ?? undefined,
                            };
                        });
                    } else {
                        // Legacy fallback
                        const legacy = await c.entities
                            .find({
                                entity: "Food",
                                adminId: adminIdObj,
                                "data.mealId": mealId,
                            })
                            .sort({ "data.order": 1, updatedAt: -1 })
                            .toArray();

                        foods = (legacy as any[]).map((row) => {
                            const rowData = (row.data ?? {}) as any;
                            return {
                                id: row._id.toHexString(),
                                name: rowData?.name ?? "-",
                                amount: String(rowData?.amount ?? "").trim() || undefined,
                                calories: rowData?.calories ?? undefined,
                                protein: rowData?.protein ?? undefined,
                                carbs: rowData?.carbs ?? undefined,
                                fat: rowData?.fat ?? undefined,
                            };
                        });
                    }

                    meals.push({
                        id: mealId,
                        type: String(mealData?.type ?? "").trim() || undefined,
                        name: String(mealData?.name ?? "").trim() || undefined,
                        order: Number.isFinite(Number(mealData?.order))
                            ? Number(mealData.order)
                            : undefined,
                        foods,
                    });
                }

                mealPlans.push({
                    id: planId,
                    name: String(data?.name ?? "").trim() || "Meal Plan",
                    goal: String(data?.goal ?? "").trim() || undefined,
                    notes: String(data?.notes ?? "").trim() || undefined,
                    dailyCalories: String(data?.dailyCalories ?? "").trim() || undefined,
                    dailyProtein: String(data?.dailyProtein ?? "").trim() || undefined,
                    dailyCarbs: String(data?.dailyCarbs ?? "").trim() || undefined,
                    dailyFat: String(data?.dailyFat ?? "").trim() || undefined,
                    dailyFiber: String(data?.dailyFiber ?? "").trim() || undefined,
                    dailySugars: String(data?.dailySugars ?? "").trim() || undefined,
                    dailySaturatedFat: String(data?.dailySaturatedFat ?? "").trim() || undefined,
                    dailyTransFat: String(data?.dailyTransFat ?? "").trim() || undefined,
                    dailyCholesterol: String(data?.dailyCholesterol ?? "").trim() || undefined,
                    dailySodium: String(data?.dailySodium ?? "").trim() || undefined,
                    dailyPotassium: String(data?.dailyPotassium ?? "").trim() || undefined,
                    dailyCalcium: String(data?.dailyCalcium ?? "").trim() || undefined,
                    dailyIron: String(data?.dailyIron ?? "").trim() || undefined,
                    dailyVitaminA: String(data?.dailyVitaminA ?? "").trim() || undefined,
                    dailyVitaminC: String(data?.dailyVitaminC ?? "").trim() || undefined,
                    dailyVitaminD: String(data?.dailyVitaminD ?? "").trim() || undefined,
                    dailyVitaminB12: String(data?.dailyVitaminB12 ?? "").trim() || undefined,
                    meals,
                });
            }

            results.push({
                adminId,
                label,
                mealPlans,
                workoutPlans,
            });
        }

        return NextResponse.json({ ok: true, blocks: results });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { ok: false, error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
