import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";
import {
    mapUsdaFoodToFoodModel,
    type UsdaFoodSearchResult,
} from "@/services/usdaFoodService";

export const runtime = "nodejs";

const bodySchema = z.object({
    items: z.array(z.any()).min(1),
});

const isFiniteNumber = (v: any) => typeof v === "number" && Number.isFinite(v);

export async function POST(req: Request) {
    try {
        const user = await requireAppUser();
        if (user.role !== "admin") {
            return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }

        const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json(
                { ok: false, error: "Invalid request body" },
                { status: 400 }
            );
        }

        const items = parsed.data.items as UsdaFoodSearchResult[];
        const adminId = new ObjectId(user.id);

        const fdcIds = items
            .map((i: any) => Number(i?.fdcId))
            .filter((n) => Number.isFinite(n) && n > 0);

        const c = await collections();

        // Skip already-imported foods by externalId.
        const existingDocs = await c.entities
            .find({
                entity: "FoodLibrary",
                adminId,
                "data.source": "USDA",
                "data.externalId": { $in: fdcIds },
            })
            .toArray();

        const existingByExternalId = new Set<number>();
        for (const doc of existingDocs as any[]) {
            const id = Number(doc?.data?.externalId);
            if (Number.isFinite(id)) existingByExternalId.add(id);
        }

        const toInsert = [] as any[];
        const warnings: Array<{ externalId?: number; message: string }> = [];

        for (const item of items) {
            const externalId = Number((item as any)?.fdcId);
            if (!Number.isFinite(externalId) || externalId <= 0) continue;
            if (existingByExternalId.has(externalId)) continue;

            const payload = mapUsdaFoodToFoodModel(item, item);

            // Validation + warnings (never block save)
            const name = String(payload?.name ?? "").trim();
            if (!name) {
                warnings.push({ externalId, message: "Missing food name" });
            }

            const coreFields: Array<keyof typeof payload> = [
                "calories",
                "protein",
                "carbs",
                "fat",
            ];
            for (const f of coreFields) {
                const v = (payload as any)[f];
                if (v === undefined) {
                    warnings.push({ externalId, message: `Missing ${String(f)}` });
                } else if (!isFiniteNumber(v)) {
                    warnings.push({ externalId, message: `Malformed ${String(f)}` });
                    delete (payload as any)[f];
                }
            }

            // Sanitize numeric optional fields
            const numericFields = [
                "fiber",
                "sugars",
                "saturatedFat",
                "transFat",
                "cholesterol",
                "sodium",
                "potassium",
                "calcium",
                "iron",
                "vitaminA",
                "vitaminC",
                "vitaminD",
                "vitaminB12",
                "servingSize",
            ];
            for (const f of numericFields) {
                const v = (payload as any)[f];
                if (v === undefined) continue;
                if (!isFiniteNumber(v)) {
                    warnings.push({ externalId, message: `Malformed ${String(f)}` });
                    delete (payload as any)[f];
                }
            }

            const now = new Date();
            toInsert.push({
                entity: "FoodLibrary",
                adminId,
                data: {
                    ...payload,
                    // Ensure required base fields exist but remain optional values.
                    name,
                    source: "USDA",
                    externalId,
                    rawSource: payload.rawSource ?? item,
                },
                createdAt: now,
                updatedAt: now,
            });
        }

        if (warnings.length) {
            console.warn("[USDA import warnings]", warnings);
        }

        if (!toInsert.length) {
            return NextResponse.json({
                ok: true,
                inserted: 0,
                skippedExisting: existingByExternalId.size,
                warnings,
            });
        }

        const result = await c.entities.insertMany(toInsert);

        return NextResponse.json({
            ok: true,
            inserted: result.insertedCount,
            skippedExisting: existingByExternalId.size,
            warnings,
        });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err?.message || "Failed to import foods" },
            { status: 500 }
        );
    }
}
