import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { ensureIndexes, collections } from "@/server/collections";
import { requireAppUser } from "@/server/auth";
import {
    isoDateOnlySchema,
    toPublicEntityDoc,
    getMyClientEntityIdOrThrow,
    normalizeIdList,
} from "@/app/api/daily-logs/_utils";

export const runtime = "nodejs";

function todayKeyLocal() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

const bodySchema = z
    .object({
        date: isoDateOnlySchema,
        complianceStatus: z.enum([
            "FOLLOWED",
            "PARTIALLY_FOLLOWED",
            "NOT_FOLLOWED",
        ]),
        mealPlanId: z.string().trim().min(1).optional(),
        clientNote: z.string().max(2000).optional(),
    })
    .strict();

export async function POST(req: Request) {
    try {
        const user = await requireAppUser();
        if (user.role !== "client") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await ensureIndexes();

        const adminId = new ObjectId(user.adminId);
        const c = await collections();
        const mine = await getMyClientEntityIdOrThrow({ adminId, userId: user.id });

        const payload = bodySchema.parse(await req.json().catch(() => ({})));

        // Reject future reporting attempts (date-only, local timezone)
        if (payload.date > todayKeyLocal()) {
            return NextResponse.json(
                { error: "Reporting is available after the day is completed." },
                { status: 400 }
            );
        }

        const allowedMealPlanIds = normalizeIdList(
            mine.clientEntityData?.assignedMealPlanIds,
            mine.clientEntityData?.assignedMealPlanId
        );

        const chosenPlanId = String(payload.mealPlanId ?? "").trim();
        const mealPlanId =
            chosenPlanId && allowedMealPlanIds.includes(chosenPlanId)
                ? chosenPlanId
                : !chosenPlanId
                    ? allowedMealPlanIds[0]
                    : null;

        if (chosenPlanId && mealPlanId === null) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const now = new Date();
        const filter = {
            entity: "DailyNutritionLog",
            adminId,
            "data.clientId": mine.clientEntityId,
            "data.date": payload.date,
        } as any;

        const update = {
            $setOnInsert: {
                entity: "DailyNutritionLog",
                adminId,
                createdAt: now,
            },
            $set: {
                data: {
                    clientId: mine.clientEntityId,
                    date: payload.date,
                    mealPlanId: mealPlanId ?? undefined,
                    complianceStatus: payload.complianceStatus,
                    clientNote: payload.clientNote?.trim() ? payload.clientNote.trim() : undefined,
                },
                updatedAt: now,
            },
        };

        const result = await c.entities.findOneAndUpdate(filter, update, {
            upsert: true,
            returnDocument: "after",
        });

        if (!result) {
            return NextResponse.json(
                { error: "Internal Server Error" },
                { status: 500 }
            );
        }

        return NextResponse.json({ ok: true, log: toPublicEntityDoc(result as any) });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: status === 401 ? "Unauthorized" : error?.message || "Internal Server Error" },
            { status }
        );
    }
}
