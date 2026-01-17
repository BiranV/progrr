import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";

function isYmd(v: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "").trim());
}

function normalizeEmail(input: unknown): string {
    return String(input ?? "")
        .replace(/[\s\u200B\u200C\u200D\uFEFF]/g, "")
        .trim()
        .toLowerCase();
}

export async function GET(req: Request) {
    try {
        const user = await requireAppUser();
        await ensureIndexes();

        const url = new URL(req.url);
        const date = String(url.searchParams.get("date") ?? "").trim();
        if (!isYmd(date)) {
            return NextResponse.json(
                { error: "Missing or invalid date (expected YYYY-MM-DD)" },
                { status: 400 }
            );
        }

        const c = await collections();
        const businessUserId = new ObjectId(user.id);

        const appts = await c.appointments
            .find(
                { businessUserId, date } as any,
                {
                    projection: {
                        serviceName: 1,
                        startTime: 1,
                        endTime: 1,
                        status: 1,
                        cancelledBy: 1,
                        customer: 1,
                        notes: 1,
                    },
                }
            )
            .sort({ startTime: 1 })
            .limit(500)
            .toArray();

        const payload = appts.map((a: any) => ({
            id: a?._id?.toHexString?.() ?? "",
            date: String(a?.date ?? ""),
            startTime: String(a?.startTime ?? ""),
            endTime: String(a?.endTime ?? ""),
            serviceName: String(a?.serviceName ?? ""),
            status: String(a?.status ?? ""),
            cancelledBy: typeof a?.cancelledBy === "string" ? a.cancelledBy : undefined,
            bookedByYou: normalizeEmail(a?.customer?.email) === normalizeEmail(user.email),
            customer: {
                fullName: String(a?.customer?.fullName ?? ""),
                phone: String(a?.customer?.phone ?? ""),
                email: String(a?.customer?.email ?? "") || undefined,
            },
            notes: String(a?.notes ?? "") || undefined,
        }));

        return NextResponse.json({ ok: true, appointments: payload });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
