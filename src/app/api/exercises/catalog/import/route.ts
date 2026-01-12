import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";
import { canUseExternalCatalogApi, normalizeAdminPlan } from "@/server/plan-guards";
import { PLAN_CONFIG } from "@/config/plans";

export const runtime = "nodejs";

const bodySchema = z.object({
    items: z.array(z.any()).min(1),
});

export async function POST(req: Request) {
    try {
        const user = await requireAppUser();
        if (user.role !== "admin") {
            return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }

        const adminPlan = normalizeAdminPlan((user as any).plan);
        if (adminPlan === "starter") {
            const limit = PLAN_CONFIG.starter.maxExercisesTotal;
            if (typeof limit === "number" && Number.isFinite(limit)) {
                const c = await collections();
                const adminId = new ObjectId(user.id);
                const used = await c.entities.countDocuments({ entity: "ExerciseLibrary", adminId });
                if (used >= limit) {
                    return NextResponse.json(
                        {
                            ok: false,
                            error:
                                "You’ve reached the exercise limit for the Starter plan. Upgrade your plan to add more exercises.",
                            code: "PLAN_LIMIT_REACHED",
                        },
                        { status: 403 }
                    );
                }
            }
        }

        const guard = await canUseExternalCatalogApi({ id: user.id, plan: adminPlan });
        if (!guard.allowed) {
            return NextResponse.json(
                { ok: false, error: guard.reason || "Upgrade required", code: "PLAN_UPGRADE_REQUIRED" },
                { status: 403 }
            );
        }

        const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
        }

        const items = parsed.data.items as any[];
        const adminId = new ObjectId(user.id);

        const externalIds = items
            .map((i) => String(i?.externalId ?? "").trim())
            .filter(Boolean);

        const c = await collections();

        // Skip already-imported exercises by externalId.
        const existingDocs = await c.entities
            .find({
                entity: "ExerciseLibrary",
                adminId,
                "data.source": "RapidAPI - ExerciseDB",
                "data.externalId": { $in: externalIds },
            })
            .toArray();

        const existingByExternalId = new Set<string>();
        for (const doc of existingDocs as any[]) {
            const id = String(doc?.data?.externalId ?? "").trim();
            if (id) existingByExternalId.add(id);
        }

        const toInsert: any[] = [];

        for (const item of items) {
            const externalId = String(item?.externalId ?? "").trim();
            if (!externalId) continue;
            if (existingByExternalId.has(externalId)) continue;

            const name = String(item?.name ?? "").trim();
            if (!name) continue;

            const payload = {
                name,
                bodyPart: String(item?.bodyPart ?? "").trim() || undefined,
                targetMuscle: String(item?.targetMuscle ?? "").trim() || undefined,
                equipment: String(item?.equipment ?? "").trim() || undefined,
                gifUrl: String(item?.gifUrl ?? "").trim() || undefined,
                source: "RapidAPI - ExerciseDB" as const,
                externalId,
                rawSource: item,
            };

            const now = new Date();
            toInsert.push({
                entity: "ExerciseLibrary",
                adminId,
                data: payload,
                createdAt: now,
                updatedAt: now,
            });
        }

        if (!toInsert.length) {
            return NextResponse.json({
                ok: true,
                inserted: 0,
                skippedExisting: existingByExternalId.size,
            });
        }

        if (adminPlan === "starter") {
            const limit = PLAN_CONFIG.starter.maxExercisesTotal;
            if (typeof limit === "number" && Number.isFinite(limit)) {
                const used = await c.entities.countDocuments({ entity: "ExerciseLibrary", adminId });
                if (used + toInsert.length > limit) {
                    return NextResponse.json(
                        {
                            ok: false,
                            error:
                                "You’ve reached the exercise limit for the Starter plan. Upgrade your plan to add more exercises.",
                            code: "PLAN_LIMIT_REACHED",
                        },
                        { status: 403 }
                    );
                }
            }
        }

        const result = await c.entities.insertMany(toInsert);

        return NextResponse.json({
            ok: true,
            inserted: result.insertedCount,
            skippedExisting: existingByExternalId.size,
        });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err?.message || "Failed to import exercises" },
            { status: 500 }
        );
    }
}
