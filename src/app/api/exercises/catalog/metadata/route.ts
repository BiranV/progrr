import { NextResponse } from "next/server";

import { requireAppUser } from "@/server/auth";
import { canUseExternalCatalogApi } from "@/server/plan-guards";
import {
    getBodyPartList,
    getEquipmentList,
    getTargetList,
} from "@/services/exercisesService";

export const runtime = "nodejs";

export async function GET() {
    try {
        const user = await requireAppUser();
        if (user.role !== "admin") {
            return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }

        const guard = await canUseExternalCatalogApi({ id: user.id, plan: (user as any).plan });
        if (!guard.allowed) {
            return NextResponse.json(
                { ok: false, error: guard.reason || "Upgrade required", code: "PLAN_UPGRADE_REQUIRED" },
                { status: 403 }
            );
        }

        const apiKey = String(process.env.RAPIDAPI_KEY ?? "").trim();
        const host = String(
            process.env.RAPIDAPI_HOST ?? "exercisedb.p.rapidapi.com"
        ).trim();
        if (!apiKey) {
            return NextResponse.json(
                { ok: false, error: "Missing RAPIDAPI_KEY" },
                { status: 500 }
            );
        }

        const baseUrl = "https://exercisedb.p.rapidapi.com";

        const [bodyParts, targets, equipment] = await Promise.all([
            getBodyPartList({ apiKey, host, baseUrl }),
            getTargetList({ apiKey, host, baseUrl }),
            getEquipmentList({ apiKey, host, baseUrl }),
        ]);

        return NextResponse.json({
            ok: true,
            bodyParts,
            targets,
            equipment,
        });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err?.message || "Failed to load ExerciseDB metadata" },
            { status: err?.status || 500 }
        );
    }
}
