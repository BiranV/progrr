import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { collections } from "@/server/collections";
import { requireAppUser } from "@/server/auth";

export const runtime = "nodejs";

const daySchema = z.object({
    date: z.string().min(1),
    steps: z.number().int().min(0).max(200_000),
});

const bodySchema = z.object({
    days: z.array(daySchema).min(1).max(31),
    source: z.string().trim().min(1).max(64).optional(),
});

function normalizeDateToYmd(input: string): string | null {
    const raw = String(input ?? "").trim();
    if (!raw) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
    try {
        const user = await requireAppUser();
        if (user.role !== "client") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const adminId = new ObjectId(user.adminId);
        const c = await collections();

        const myClient = await c.entities.findOne({
            entity: "Client",
            adminId,
            $or: [{ "data.userId": user.id }, { "data.clientAuthId": user.id }],
        });
        if (!myClient) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const myClientId = myClient._id.toHexString();
        const myClientData = (myClient.data ?? {}) as any;

        if (myClientData?.stepsEnabledByAdmin === false) {
            return NextResponse.json(
                { error: "Steps tracking is disabled by your coach" },
                { status: 403 }
            );
        }

        if (myClientData?.stepsSharingEnabled !== true) {
            return NextResponse.json(
                { error: "Please enable steps sharing first" },
                { status: 403 }
            );
        }

        const { days, source } = bodySchema.parse(await req.json());

        const now = new Date();
        let upserted = 0;

        for (const day of days) {
            const ymd = normalizeDateToYmd(day.date);
            if (!ymd) {
                return NextResponse.json(
                    { error: "Invalid date format" },
                    { status: 400 }
                );
            }

            await c.entities.updateOne(
                {
                    entity: "ClientSteps",
                    adminId,
                    "data.clientId": myClientId,
                    "data.date": ymd,
                },
                {
                    $setOnInsert: {
                        entity: "ClientSteps",
                        adminId,
                        createdAt: now,
                    },
                    $set: {
                        data: {
                            clientId: myClientId,
                            date: ymd,
                            steps: day.steps,
                            ...(source ? { source } : {}),
                        },
                        updatedAt: now,
                    },
                },
                { upsert: true }
            );

            upserted += 1;
        }

        return NextResponse.json({ ok: true, upserted });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        const message = error?.name === "ZodError" ? "Invalid request body" : null;

        return NextResponse.json(
            {
                error:
                    status === 401
                        ? "Unauthorized"
                        : message || "Internal Server Error",
            },
            { status }
        );
    }
}
