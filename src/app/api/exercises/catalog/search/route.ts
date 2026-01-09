import { NextResponse } from "next/server";

import { requireAppUser } from "@/server/auth";
import { searchExercises } from "@/services/exercisesService";

export const runtime = "nodejs";

export async function GET(req: Request) {
    try {
        const user = await requireAppUser();
        if (user.role !== "admin") {
            return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
        }

        const url = new URL(req.url);
        const q = String(url.searchParams.get("q") ?? "").trim();
        if (!q) {
            return NextResponse.json(
                { ok: false, error: "Missing query parameter: q" },
                { status: 400 }
            );
        }

        const apiKey = String(process.env.RAPIDAPI_KEY ?? "").trim();
        const host = String(process.env.RAPIDAPI_HOST ?? "exercisedb.p.rapidapi.com").trim();
        if (!apiKey) {
            return NextResponse.json(
                { ok: false, error: "Missing RAPIDAPI_KEY" },
                { status: 500 }
            );
        }

        const results = await searchExercises(q, {
            apiKey,
            host,
            baseUrl: "https://exercisedb.p.rapidapi.com",
        });

        // Return only what UI needs.
        return NextResponse.json({
            ok: true,
            totalHits: results.length,
            results: results.map((r) => ({
                externalId: r.externalId,
                name: r.name,
                bodyPart: r.bodyPart,
                targetMuscle: r.targetMuscle,
                equipment: r.equipment,
                gifUrl: r.gifUrl,
            })),
        });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err?.message || "Failed to search ExerciseDB" },
            { status: err?.status || 500 }
        );
    }
}
