import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";

function asString(v: unknown, maxLen = 250): string | undefined {
    const s = String(v ?? "").trim();
    if (!s) return undefined;
    return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function digitsOnly(value: string) {
    return value.replace(/\D/g, "");
}

const ALLOWED_CURRENCY_CODES = new Set([
    "ILS",
    "NIS",
    "USD",
    "EUR",
    "GBP",
    "AUD",
    "CAD",
    "CHF",
]);

function normalizeCurrencyCode(v: unknown): string | undefined {
    const raw = String(v ?? "").trim().toUpperCase();
    if (!raw) return undefined;
    if (!ALLOWED_CURRENCY_CODES.has(raw)) return undefined;
    // Normalize legacy/alt spelling.
    if (raw === "NIS") return "ILS";
    return raw;
}

export async function GET() {
    try {
        const appUser = await requireAppUser();
        const c = await collections();

        const user = await c.users.findOne({ _id: new ObjectId(appUser.id) });
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const business = (user as any)?.onboarding?.business;
        if (!business || typeof business !== "object") {
            return NextResponse.json({ error: "Business not found" }, { status: 404 });
        }

        const name = asString((business as any).name, 120);
        const phone = asString((business as any).phone, 40);
        const address = asString((business as any).address, 200);
        const slug = asString((business as any).slug, 120);
        const description = asString((business as any).description, 250);
        const currency =
            normalizeCurrencyCode((business as any).currency) ??
            normalizeCurrencyCode((user as any)?.onboarding?.currency) ??
            "ILS";

        if (!name || !phone || !slug) {
            return NextResponse.json({ error: "Business not found" }, { status: 404 });
        }

        return NextResponse.json({
            name,
            phone,
            address: address ?? "",
            slug,
            description: description ?? "",
            currency,
        });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}

export async function PATCH(req: Request) {
    try {
        const appUser = await requireAppUser();
        const c = await collections();

        const user = await c.users.findOne({ _id: new ObjectId(appUser.id) });
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const business = (user as any)?.onboarding?.business;
        if (!business || typeof business !== "object") {
            return NextResponse.json({ error: "Business not found" }, { status: 404 });
        }

        const body = await req.json().catch(() => ({}));

        const currentName = asString((business as any).name, 120);
        const currentPhone = asString((business as any).phone, 40);
        const currentAddress = asString((business as any).address, 200) ?? "";
        const currentDescription = asString((business as any).description, 250) ?? "";
        const currentCurrency =
            normalizeCurrencyCode((business as any).currency) ??
            normalizeCurrencyCode((user as any)?.onboarding?.currency) ??
            "ILS";

        const name = asString((body as any)?.name, 120) ?? currentName;
        const phone = asString((body as any)?.phone, 40) ?? currentPhone;
        const address =
            (Object.prototype.hasOwnProperty.call(body as any, "address")
                ? asString((body as any)?.address, 200) ?? ""
                : currentAddress) ??
            "";
        const description =
            (Object.prototype.hasOwnProperty.call(body as any, "description")
                ? asString((body as any)?.description, 250) ?? ""
                : currentDescription) ??
            "";

        const requestedCurrency = normalizeCurrencyCode((body as any)?.currency);
        if (Object.prototype.hasOwnProperty.call(body as any, "currency") && !requestedCurrency) {
            return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
        }
        const currency = requestedCurrency ?? currentCurrency;

        if (!name) {
            return NextResponse.json(
                { error: "Business name cannot be empty" },
                { status: 400 }
            );
        }

        if (!phone || digitsOnly(phone).length < 9) {
            return NextResponse.json(
                { error: "Phone number must have at least 9 digits" },
                { status: 400 }
            );
        }

        const result = await c.users.updateOne(
            { _id: new ObjectId(appUser.id) },
            {
                $set: {
                    "onboarding.business.name": name,
                    "onboarding.business.phone": phone,
                    "onboarding.business.address": address,
                    "onboarding.business.description": description,
                    "onboarding.business.currency": currency,
                    "onboarding.updatedAt": new Date(),
                },
            }
        );

        if (!result.matchedCount) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        const status = typeof error?.status === "number" ? error.status : 500;
        return NextResponse.json(
            { error: error?.message || "Internal Server Error" },
            { status }
        );
    }
}
