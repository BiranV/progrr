import { NextResponse } from "next/server";
import { requireAppUser } from "@/server/auth";
import { getPlanGuardsForAdmin } from "@/server/plan-guards";

export const runtime = "nodejs";

export async function GET() {
    try {
        const user = await requireAppUser();
        if (user.role !== "admin") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const payload = await getPlanGuardsForAdmin({
            adminId: user.id,
            plan: (user as any).plan,
        });

        return NextResponse.json(payload);
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: status === 401 ? "Unauthorized" : "Internal Server Error" },
            { status }
        );
    }
}
