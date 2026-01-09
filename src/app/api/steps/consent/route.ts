import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { collections } from "@/server/collections";
import { requireAppUser } from "@/server/auth";

export const runtime = "nodejs";

const bodySchema = z.object({
    enabled: z.boolean(),
});

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

        const { enabled } = bodySchema.parse(await req.json());

        // Clients can opt-in/out of sharing step summaries with their coach.
        await c.entities.updateOne(
            { _id: myClient._id, entity: "Client", adminId },
            {
                $set: {
                    "data.stepsSharingEnabled": enabled,
                    "data.stepsSharingUpdatedAt": new Date().toISOString(),
                    updatedAt: new Date(),
                },
            }
        );

        return NextResponse.json({ ok: true, enabled });
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
