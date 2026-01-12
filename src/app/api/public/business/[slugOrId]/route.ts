import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { collections, ensureIndexes } from "@/server/collections";

function isObjectIdLike(s: string): boolean {
    return /^[a-f0-9]{24}$/i.test(s);
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

        if (!isObjectIdLike(raw)) {
            return NextResponse.json({ error: "Business not found" }, { status: 404 });
        }

        const c = await collections();

        const user = await c.users.findOne({
            _id: new ObjectId(raw),
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
                id: user._id!.toHexString(),
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
