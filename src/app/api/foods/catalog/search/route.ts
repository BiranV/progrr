import { NextResponse } from "next/server";

import { requireAppUser } from "@/server/auth";
import { canUseExternalCatalogApi } from "@/server/plan-guards";
import { searchFoods } from "@/services/usdaFoodService";

export const runtime = "nodejs";

export async function GET(req: Request) {
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

        const url = new URL(req.url);
        const q = String(url.searchParams.get("q") ?? "").trim();
        if (!q) {
            return NextResponse.json(
                { ok: false, error: "Missing query parameter: q" },
                { status: 400 }
            );
        }

        const apiKey = String(process.env.USDA_API_KEY ?? "").trim();
        if (!apiKey) {
            return NextResponse.json(
                { ok: false, error: "Missing USDA_API_KEY" },
                { status: 500 }
            );
        }

        const { totalHits, foods } = await searchFoods({ query: q, apiKey, pageSize: 25 });

        // Return only what UI needs + include nutrient list for import mapping.
        const results = foods
            .map((f: any) => ({
                fdcId: Number(f?.fdcId),
                description: String(f?.description ?? "").trim(),
                brandName: String(f?.brandName ?? "").trim() || undefined,
                brandOwner: String(f?.brandOwner ?? "").trim() || undefined,
                dataType: String(f?.dataType ?? "").trim() || undefined,
                servingSize: typeof f?.servingSize === "number" ? f.servingSize : undefined,
                servingSizeUnit: String(f?.servingSizeUnit ?? "").trim() || undefined,
                foodNutrients: Array.isArray(f?.foodNutrients) ? f.foodNutrients : [],
            }))
            .filter((r: any) => Number.isFinite(r.fdcId) && r.fdcId > 0 && r.description);

        return NextResponse.json({ ok: true, totalHits, results });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err?.message || "Failed to search USDA catalog" },
            { status: err?.status || 500 }
        );
    }
}
