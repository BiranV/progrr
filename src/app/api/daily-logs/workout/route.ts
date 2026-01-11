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

const bodySchema = z
    .object({
        date: isoDateOnlySchema,
        status: z.enum(["COMPLETED", "SKIPPED"]),
        workoutPlanId: z.string().trim().min(1).optional(),
        clientNote: z.string().max(2000).optional(),
    })
    .strict();

function todayKeyLocal() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

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

        const allowedWorkoutPlanIds = normalizeIdList(
            mine.clientEntityData?.assignedPlanIds,
            mine.clientEntityData?.assignedPlanId
        );

        const chosenPlanId = String(payload.workoutPlanId ?? "").trim();
        const workoutPlanId =
            chosenPlanId && allowedWorkoutPlanIds.includes(chosenPlanId)
                ? chosenPlanId
                : !chosenPlanId
                    ? allowedWorkoutPlanIds[0]
                    : null;

        if (chosenPlanId && workoutPlanId === null) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const now = new Date();
        const filter = {
            entity: "DailyWorkoutLog",
            adminId,
            "data.clientId": mine.clientEntityId,
            "data.date": payload.date,
        } as any;

        const update = {
            $setOnInsert: {
                entity: "DailyWorkoutLog",
                adminId,
                createdAt: now,
            },
            $set: {
                data: {
                    clientId: mine.clientEntityId,
                    date: payload.date,
                    workoutPlanId: workoutPlanId ?? undefined,
                    status: payload.status,
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
