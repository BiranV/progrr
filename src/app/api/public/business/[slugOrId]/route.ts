import { NextResponse } from "next/server";

import { collections, ensureIndexes } from "@/server/collections";

function normalizeSlug(input: string): string {
    return String(input ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function GET(
    _req: Request,
    ctx: { params: Promise<{ slugOrId: string }> }
) {
    try {
        await ensureIndexes();
        const { slugOrId } = await ctx.params;
        const raw = String(slugOrId ?? "").trim();
        if (!raw) {
            return NextResponse.json({ error: "Business not found" }, { status: 404 });
        }

        const slug = normalizeSlug(raw);
        if (!slug) {
            return NextResponse.json({ error: "Business not found" }, { status: 404 });
        }

        const c = await collections();

        const user = await c.users.findOne({
            "onboarding.business.slug": slug,
            onboardingCompleted: true,
        } as any);

        if (!user) {
            return NextResponse.json({ error: "Business not found" }, { status: 404 });
        }

        const onboarding = (user as any).onboarding ?? {};
        const business = onboarding.business ?? {};

        const currencyCode = String(onboarding.currency ?? "").trim() || "USD";
        const customCurrency = onboarding.customCurrency ?? undefined;

        return NextResponse.json({
            ok: true,
            business: {
                slug,
                name: String(business.name ?? "").trim(),
                phone: String(business.phone ?? "").trim(),
                address: String(business.address ?? "").trim(),
            },
            services: Array.isArray(onboarding.services) ? onboarding.services : [],
            availability: onboarding.availability ?? {},
            currency: {
                code: currencyCode,
                ...(currencyCode === "OTHER"
                    ? {
                        name: String(customCurrency?.name ?? "").trim(),
                        symbol: String(customCurrency?.symbol ?? "").trim(),
                    }
                    : {}),
            },
        });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
