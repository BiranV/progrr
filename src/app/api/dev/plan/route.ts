import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";
import { normalizeAdminPlan } from "@/server/plan-guards";

export const runtime = "nodejs";

const bodySchema = z.object({
    plan: z.string(),
});

function devOverrideEnabled(): boolean {
    // Default: enabled in development, disabled in production.
    if (process.env.NODE_ENV === "development") return true;
    // Allow explicit opt-in for preview environments if needed.
    return String(process.env.ALLOW_DEV_PLAN_OVERRIDE ?? "") === "1";
}

export async function POST(req: Request) {
    try {
        if (!devOverrideEnabled()) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const user = await requireAppUser();
        if (user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const parsed = bodySchema.parse(await req.json().catch(() => ({})));
        const nextPlan = normalizeAdminPlan(parsed.plan);

        const c = await collections();
        await c.admins.updateOne(
            { _id: new ObjectId(user.id) },
            { $set: { plan: nextPlan } }
        );

        return NextResponse.json({ ok: true, plan: nextPlan });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        const message = error?.name === "ZodError" ? "Invalid request" : undefined;
        return NextResponse.json(
            { error: status === 401 ? "Unauthorized" : message || "Request failed" },
            { status }
        );
    }
}
