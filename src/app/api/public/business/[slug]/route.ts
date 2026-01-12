import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { collections, ensureIndexes } from "@/server/collections";

export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ slug: string }> }
) {
    try {
        await ensureIndexes();

        const { slug } = await ctx.params; // כן, await – בשביל הטייפ
        const normalizedSlug = String(slug ?? "").trim();

        if (!normalizedSlug) {
            return NextResponse.json({ error: "Business not found" }, { status: 404 });
        }

        const c = await collections();

        const user = await c.users.findOne({
            "onboarding.business.slug": normalizedSlug,
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
                slug: normalizedSlug,
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
