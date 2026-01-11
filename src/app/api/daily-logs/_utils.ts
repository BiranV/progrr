import { ObjectId } from "mongodb";
import { z } from "zod";
import { collections } from "@/server/collections";

export const runtime = "nodejs";

export const isoDateOnlySchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/i, "Invalid date (expected YYYY-MM-DD)");

export function toPublicEntityDoc(doc: {
    _id: ObjectId;
    data: any;
    createdAt: Date;
    updatedAt: Date;
}) {
    const data = (doc.data ?? {}) as Record<string, unknown>;
    return {
        id: doc._id.toHexString(),
        created_date: doc.createdAt.toISOString(),
        updated_date: doc.updatedAt.toISOString(),
        ...data,
    };
}

export async function getMyClientEntityIdOrThrow(opts: {
    adminId: ObjectId;
    userId: string;
}) {
    const c = await collections();
    const myClient = await c.entities.findOne({
        entity: "Client",
        adminId: opts.adminId,
        $or: [{ "data.userId": opts.userId }, { "data.clientAuthId": opts.userId }],
    });
    if (!myClient) {
        const err: any = new Error("Forbidden");
        err.status = 403;
        throw err;
    }

    return {
        clientEntityId: myClient._id.toHexString(),
        clientEntityData: (myClient.data ?? {}) as any,
    };
}

export function normalizeIdList(value: any, fallbackSingle?: any): string[] {
    const arr = Array.isArray(value) ? value : [];
    const fallback = String(fallbackSingle ?? "").trim();
    const merged = [
        ...arr.map((v: any) => String(v ?? "").trim()),
        ...(fallback ? [fallback] : []),
    ]
        .map((v) => String(v).trim())
        .filter((v) => v && v !== "none");
    return Array.from(new Set(merged));
}
