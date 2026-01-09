import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { collections } from "@/server/collections";
import { requireAppUser } from "@/server/auth";

export const runtime = "nodejs";

function clampDays(raw: string | null): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 7;
    return Math.max(1, Math.min(90, Math.floor(n)));
}

export async function GET(req: Request) {
    try {
        const user = await requireAppUser();
        const url = new URL(req.url);

        const days = clampDays(url.searchParams.get("days"));

        const c = await collections();

        if (user.role === "admin") {
            const adminId = new ObjectId(user.id);
            const clientId = String(url.searchParams.get("clientId") ?? "").trim();

            if (!clientId || !ObjectId.isValid(clientId)) {
                return NextResponse.json(
                    { error: "clientId is required" },
                    { status: 400 }
                );
            }

            const client = await c.entities.findOne({
                entity: "Client",
                adminId,
                _id: new ObjectId(clientId),
            });
            if (!client) {
                return NextResponse.json({ error: "Not found" }, { status: 404 });
            }

            const clientData = (client.data ?? {}) as any;
            if (clientData?.stepsEnabledByAdmin === false) {
                return NextResponse.json({ ok: true, days: [] });
            }
            if (clientData?.stepsSharingEnabled !== true) {
                // Privacy by default: if the client has not opted in, don't return step data.
                return NextResponse.json({ ok: true, days: [] });
            }

            const docs = await c.entities
                .find({ entity: "ClientSteps", adminId, "data.clientId": clientId })
                .sort({ "data.date": -1, updatedAt: -1 })
                .limit(days)
                .toArray();

            const out = docs.map((d) => {
                const data = (d.data ?? {}) as any;
                return {
                    date: String(data.date ?? ""),
                    steps: Number(data.steps ?? 0) || 0,
                    source: typeof data.source === "string" ? data.source : undefined,
                };
            });

            return NextResponse.json({ ok: true, days: out });
        }

        if (user.role === "client") {
            const adminId = new ObjectId(user.adminId);

            const myClient = await c.entities.findOne({
                entity: "Client",
                adminId,
                $or: [{ "data.userId": user.id }, { "data.clientAuthId": user.id }],
            });
            if (!myClient) {
                return NextResponse.json({ ok: true, days: [] });
            }

            const myClientId = myClient._id.toHexString();
            const myClientData = (myClient.data ?? {}) as any;

            if (myClientData?.stepsEnabledByAdmin === false) {
                return NextResponse.json({ ok: true, days: [] });
            }

            const docs = await c.entities
                .find({ entity: "ClientSteps", adminId, "data.clientId": myClientId })
                .sort({ "data.date": -1, updatedAt: -1 })
                .limit(days)
                .toArray();

            const out = docs.map((d) => {
                const data = (d.data ?? {}) as any;
                return {
                    date: String(data.date ?? ""),
                    steps: Number(data.steps ?? 0) || 0,
                    source: typeof data.source === "string" ? data.source : undefined,
                };
            });

            return NextResponse.json({ ok: true, days: out });
        }

        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: status === 401 ? "Unauthorized" : "Internal Server Error" },
            { status }
        );
    }
}
