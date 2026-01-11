import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { ensureIndexes, collections } from "@/server/collections";
import { requireAppUser } from "@/server/auth";
import {
    isoDateOnlySchema,
    toPublicEntityDoc,
    getMyClientEntityIdOrThrow,
} from "@/app/api/daily-logs/_utils";

export const runtime = "nodejs";

const querySchema = z
    .object({
        start: isoDateOnlySchema,
        end: isoDateOnlySchema,
        clientId: z.string().optional(),
    })
    .strict();

export async function GET(req: Request) {
    try {
        const user = await requireAppUser();
        await ensureIndexes();

        const url = new URL(req.url);
        const parsed = querySchema.parse({
            start: url.searchParams.get("start"),
            end: url.searchParams.get("end"),
            clientId: url.searchParams.get("clientId") ?? undefined,
        });

        const start = parsed.start;
        const end = parsed.end;
        if (start > end) {
            return NextResponse.json(
                { error: "Invalid range (start must be <= end)" },
                { status: 400 }
            );
        }

        const c = await collections();

        let adminId: ObjectId;
        let clientEntityId: string;

        if (user.role === "client") {
            adminId = new ObjectId(user.adminId);
            const mine = await getMyClientEntityIdOrThrow({
                adminId,
                userId: user.id,
            });
            clientEntityId = mine.clientEntityId;
        } else if (user.role === "admin") {
            adminId = new ObjectId(user.id);
            const clientId = String(parsed.clientId ?? "").trim();
            if (!clientId || !ObjectId.isValid(clientId)) {
                return NextResponse.json(
                    { error: "clientId is required" },
                    { status: 400 }
                );
            }
            const exists = await c.entities.findOne({
                _id: new ObjectId(clientId),
                entity: "Client",
                adminId,
            });
            if (!exists) {
                return NextResponse.json({ error: "Not found" }, { status: 404 });
            }
            clientEntityId = clientId;
        } else {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const docs = await c.entities
            .find({
                adminId,
                entity: { $in: ["DailyWorkoutLog", "DailyNutritionLog"] },
                "data.clientId": clientEntityId,
                "data.date": { $gte: start, $lte: end },
            })
            .sort({ "data.date": 1, updatedAt: -1 })
            .toArray();

        const byDate = new Map<
            string,
            {
                date: string;
                workout?: any;
                nutrition?: any;
                flagged?: boolean;
            }
        >();

        const ensureDay = (date: string) => {
            const existing = byDate.get(date);
            if (existing) return existing;
            const next = { date } as any;
            byDate.set(date, next);
            return next;
        };

        for (const doc of docs) {
            const entity = String((doc as any).entity ?? "").trim();
            const publicDoc = toPublicEntityDoc(doc as any);
            const date = String((publicDoc as any).date ?? "").trim();
            if (!date) continue;

            const day = ensureDay(date);
            if (entity === "DailyWorkoutLog") day.workout = publicDoc;
            if (entity === "DailyNutritionLog") day.nutrition = publicDoc;
        }

        // Fill missing days for stable UI rendering
        const days: Array<{ date: string; workout?: any; nutrition?: any; flagged?: boolean }> = [];
        {
            const [sy, sm, sd] = start.split("-").map((n) => Number(n));
            const [ey, em, ed] = end.split("-").map((n) => Number(n));
            const cursor = new Date(sy, sm - 1, sd);
            const endDate = new Date(ey, em - 1, ed);

            while (cursor.getTime() <= endDate.getTime()) {
                const yyyy = cursor.getFullYear();
                const mm = String(cursor.getMonth() + 1).padStart(2, "0");
                const dd = String(cursor.getDate()).padStart(2, "0");
                const key = `${yyyy}-${mm}-${dd}`;
                const entry = byDate.get(key) ?? { date: key };

                const w = (entry as any).workout;
                const n = (entry as any).nutrition;
                const flagged =
                    String(w?.status ?? "").toUpperCase() === "SKIPPED" ||
                    ["PARTIALLY_FOLLOWED", "NOT_FOLLOWED"].includes(
                        String(n?.complianceStatus ?? "").toUpperCase()
                    );

                days.push({ ...entry, flagged });
                cursor.setDate(cursor.getDate() + 1);
            }
        }

        return NextResponse.json({ ok: true, clientId: clientEntityId, start, end, days });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: status === 401 ? "Unauthorized" : error?.message || "Internal Server Error" },
            { status }
        );
    }
}
