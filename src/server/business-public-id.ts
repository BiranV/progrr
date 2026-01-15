import type { ObjectId } from "mongodb";

import { collections } from "@/server/collections";

export function isValidBusinessPublicId(input: unknown): input is string {
  const s = String(input ?? "").trim();
  return /^\d{5}$/.test(s);
}

function randomFiveDigits(): string {
  // 10000-99999 => always 5 digits, avoids leading zeros.
  const n = Math.floor(10000 + Math.random() * 90000);
  return String(n);
}

export async function ensureBusinessPublicIdForUser(
  userId: ObjectId
): Promise<string> {
  const c = await collections();

  const current = await c.users.findOne(
    { _id: userId },
    { projection: { "onboarding.business.publicId": 1 } }
  );

  const existing = String(
    (current as any)?.onboarding?.business?.publicId ?? ""
  ).trim();
  if (isValidBusinessPublicId(existing)) return existing;

  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = randomFiveDigits();

    try {
      const result = await c.users.updateOne(
        {
          _id: userId,
          $or: [
            { "onboarding.business.publicId": { $exists: false } },
            { "onboarding.business.publicId": null },
            { "onboarding.business.publicId": "" },
            { "onboarding.business.publicId": { $not: /^\d{5}$/ } },
          ],
        } as any,
        {
          $set: {
            "onboarding.business.publicId": candidate,
            "onboarding.updatedAt": new Date(),
          },
        }
      );

      if (result.modifiedCount > 0) return candidate;

      const after = await c.users.findOne(
        { _id: userId },
        { projection: { "onboarding.business.publicId": 1 } }
      );
      const now = String(
        (after as any)?.onboarding?.business?.publicId ?? ""
      ).trim();
      if (isValidBusinessPublicId(now)) return now;
    } catch (e: any) {
      // Duplicate key => retry with another candidate.
      if (e?.code === 11000) continue;
      throw e;
    }
  }

  throw new Error("Failed to allocate business publicId");
}
