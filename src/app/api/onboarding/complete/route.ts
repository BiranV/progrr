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
