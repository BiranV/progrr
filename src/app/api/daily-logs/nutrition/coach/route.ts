import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { ensureIndexes, collections } from "@/server/collections";
import { requireAppUser } from "@/server/auth";
import { isoDateOnlySchema, toPublicEntityDoc } from "@/app/api/daily-logs/_utils";

export const runtime = "nodejs";

const bodySchema = z
    .object({
        clientId: z.string().trim().min(1),
        date: isoDateOnlySchema,
        coachNote: z.string().max(2000).optional(),
    })
    .strict();

export async function POST(req: Request) {
    try {
        const user = await requireAppUser();
        if (user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await ensureIndexes();

        const payload = bodySchema.parse(await req.json().catch(() => ({})));
        if (!ObjectId.isValid(payload.clientId)) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const adminId = new ObjectId(user.id);
        const clientEntityId = payload.clientId;

        const c = await collections();
        const exists = await c.entities.findOne({
            _id: new ObjectId(clientEntityId),
            entity: "Client",
            adminId,
        });
        if (!exists) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const now = new Date();
        const trimmed = payload.coachNote?.trim() ? payload.coachNote.trim() : "";

        const filter = {
            entity: "DailyNutritionLog",
            adminId,
            "data.clientId": clientEntityId,
            "data.date": payload.date,
        } as any;

        const set: Record<string, any> = {
            "data.clientId": clientEntityId,
            "data.date": payload.date,
            updatedAt: now,
        };
        const unset: Record<string, ""> = {};

        if (trimmed) {
            set["data.coachNote"] = trimmed;
            set["data.coachNoteAt"] = now;
        } else {
            unset["data.coachNote"] = "";
            unset["data.coachNoteAt"] = "";
        }

        const update: any = {
            $setOnInsert: {
                entity: "DailyNutritionLog",
                adminId,
                createdAt: now,
            },
            $set: set,
        };
        if (Object.keys(unset).length) update.$unset = unset;

        const result = await c.entities.findOneAndUpdate(filter, update, {
            upsert: true,
            returnDocument: "after",
        });

        if (!result) {
            return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
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
