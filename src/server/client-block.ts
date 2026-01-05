import { ObjectId } from "mongodb";
import type { ClientDoc } from "@/server/collections";
import type { collections } from "@/server/collections";

export const CLIENT_BLOCKED_CODE = "CLIENT_BLOCKED" as const;

export const CLIENT_BLOCKED_MESSAGE =
  "Your account has been temporarily restricted. Please contact support or your administrator.";

export type ClientBlockType = "temporary" | "permanent";

export type ClientBlockState =
  | {
      blocked: false;
      shouldClear: boolean;
    }
  | {
      blocked: true;
      blockType: ClientBlockType;
      blockedUntil: Date | null;
      blockReason: string | null;
    };

export function computeClientBlockState(
  client: Pick<ClientDoc, "isBlocked" | "blockedUntil" | "blockReason">,
  now = new Date()
): ClientBlockState {
  const isBlocked = Boolean((client as any)?.isBlocked);
  const blockedUntil = (client as any)?.blockedUntil ?? null;
  const blockReason =
    typeof (client as any)?.blockReason === "string"
      ? String((client as any).blockReason)
      : null;

  if (!isBlocked) {
    return { blocked: false, shouldClear: false };
  }

  // Temporary block that has expired.
  if (blockedUntil instanceof Date && blockedUntil.getTime() <= now.getTime()) {
    return { blocked: false, shouldClear: true };
  }

  const isTemporary = blockedUntil instanceof Date;
  return {
    blocked: true,
    blockType: isTemporary ? "temporary" : "permanent",
    blockedUntil: isTemporary ? blockedUntil : null,
    blockReason,
  };
}

export async function clearExpiredClientBlock(args: {
  c: Awaited<ReturnType<typeof collections>>;
  clientId: ObjectId;
}) {
  const { c, clientId } = args;
  await c.clients.updateOne(
    { _id: clientId },
    {
      $set: {
        isBlocked: false,
        blockedUntil: null,
        blockReason: null,
      },
    }
  );
}
