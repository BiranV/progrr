import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";
import { signAuthToken } from "@/server/jwt";
import { setAuthCookie } from "@/server/auth-cookie";

export async function POST() {
    try {
        const appUser = await requireAppUser();
        const c = await collections();

        const OTHER_CURRENCY_CODE = "OTHER";
        const ALLOWED_CURRENCIES = new Set([
            "NIS",
            "USD",
            "EUR",
            "GBP",
            "AUD",
            "CAD",
            "CHF",
            OTHER_CURRENCY_CODE,
        ]);

        const firstServiceError = (services: any[]): string | null => {
            if (!Array.isArray(services) || services.length === 0) return "Service is required";

            const multi = services.length > 1;
            for (let i = 0; i < services.length; i++) {
                const s = services[i];
                const prefix = multi ? `Service ${i + 1} ` : "Service ";

                if (!String(s?.name ?? "").trim()) return `${prefix}name is required`;

                const durationMinutes = Number(s?.durationMinutes);
                if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
                    return `${prefix}duration is required`;
                }

                const price = Number(s?.price);
                if (!Number.isFinite(price)) return `${prefix}price is required`;
                if (price < 0 || price > 1_000_000) return `${prefix}price is invalid`;
            }

            return null;
        };

        const user = await c.users.findOne({ _id: new ObjectId(appUser.id) });
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const onboarding = (user as any).onboarding ?? {};
        const business = onboarding.business ?? {};

        const currency = String(onboarding.currency ?? "").trim().toUpperCase();
        if (currency && !ALLOWED_CURRENCIES.has(currency)) {
            return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
        }
        if (currency === OTHER_CURRENCY_CODE) {
            const name = String(onboarding.customCurrency?.name ?? "").trim();
            const symbol = String(onboarding.customCurrency?.symbol ?? "").trim();
            if (!name) {
                return NextResponse.json(
                    { error: "Currency name is required" },
                    { status: 400 }
                );
            }
            if (!symbol) {
                return NextResponse.json(
                    { error: "Currency symbol is required" },
                    { status: 400 }
                );
            }
        }

        const name = String(business.name ?? "").trim();
        const phone = String(business.phone ?? "").trim();
        const address = String(business.address ?? "").trim();

        const missing: string[] = [];
        if (!name) missing.push("Name");
        if (!phone) missing.push("Phone");
        if (!address) missing.push("Address");

        if (missing.length > 0) {
            return NextResponse.json(
                { error: `${missing[0]} is required` },
                { status: 400 }
            );
        }

        const servicesErr = firstServiceError(onboarding.services ?? []);
        if (servicesErr) {
            return NextResponse.json({ error: servicesErr }, { status: 400 });
        }

        await c.users.updateOne(
            { _id: new ObjectId(appUser.id) },
            {
                $set: {
                    onboardingCompleted: true,
                    onboardingCompletedAt: new Date(),
                    "onboarding.updatedAt": new Date(),
                },
            }
        );

        const token = await signAuthToken({
            sub: appUser.id,
            onboardingCompleted: true,
        });

        const res = NextResponse.json({ ok: true });
        setAuthCookie(res, token);
        return res;
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
