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

        if (!name || !phone || !slug) {
            return NextResponse.json({ error: "Business not found" }, { status: 404 });
        }

        return NextResponse.json({
            name,
            phone,
            address: address ?? "",
            slug,
            description: description ?? "",
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

        const name = asString((body as any)?.name, 120);
        const phone = asString((body as any)?.phone, 40);
        const address = asString((body as any)?.address, 200) ?? "";
        const description = asString((body as any)?.description, 250) ?? "";

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
