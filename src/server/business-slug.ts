import { ObjectId } from "mongodb";

import { collections } from "@/server/collections";

function normalizeBusinessSlug(input: string): string {
    return String(input ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
}

export async function ensureBusinessSlugForUser(args: {
    userId: ObjectId;
    businessName: string;
}): Promise<string> {
    const c = await collections();

    const existing = await c.users.findOne(
        { _id: args.userId },
        { projection: { "onboarding.business.slug": 1 } }
    );

    const existingSlug = String((existing as any)?.onboarding?.business?.slug ?? "").trim();
    if (existingSlug) return existingSlug;

    const baseRaw = normalizeBusinessSlug(args.businessName);
    const base = baseRaw || "business";

    const now = new Date();

    for (let suffix = 0; suffix < 500; suffix++) {
        const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;

        try {
            const res = await c.users.updateOne(
                {
                    _id: args.userId,
                    $or: [
                        { "onboarding.business.slug": { $exists: false } },
                        { "onboarding.business.slug": null },
                        { "onboarding.business.slug": "" },
                    ],
                } as any,
                {
                    $set: {
                        "onboarding.business.slug": candidate,
                        "onboarding.updatedAt": now,
                    },
                }
            );

            if (res.modifiedCount === 1) {
                return candidate;
            }

            // Someone else set it between our read and update.
            const reread = await c.users.findOne(
                { _id: args.userId },
                { projection: { "onboarding.business.slug": 1 } }
            );
            const rereadSlug = String((reread as any)?.onboarding?.business?.slug ?? "").trim();
            if (rereadSlug) return rereadSlug;
        } catch (e: any) {
            // Duplicate slug; try the next suffix.
            if (e?.code === 11000) continue;
            throw e;
        }
    }

    // Extremely unlikely fallback.
    const fallback = `${base}-${Math.random().toString(36).slice(2, 8)}`;
    await c.users.updateOne(
        { _id: args.userId } as any,
        {
            $set: {
                "onboarding.business.slug": fallback,
                "onboarding.updatedAt": new Date(),
            },
        }
    );
    return fallback;
}
