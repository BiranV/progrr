import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/prisma";
import { requireAppUser } from "@/server/auth";

export const runtime = "nodejs";

const filterBodySchema = z.record(z.string(), z.any());

function toPublicRecord(row: {
  id: string;
  data: any;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  const data = (row.data ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    created_date: row.createdAt.toISOString(),
    updated_date: row.updatedAt.toISOString(),
    ...data,
  };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ entity: string }> }
) {
  try {
    const user = await requireAppUser();

    const { entity } = await ctx.params;
    const criteria = filterBodySchema.parse(await req.json());

    // CLIENT ACCESS CONTROL
    if (user.role === "client") {
      if (entity !== "Message") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const clientRows = await prisma.entity.findMany({
        where: { entity: "Client" },
        orderBy: { updatedAt: "desc" },
      });
      const myClient = clientRows.find(
        (r) => ((r.data ?? {}) as any).userId === user.id
      );
      if (!myClient) return NextResponse.json([]);

      // Must match the caller's own clientId
      if (criteria.clientId !== myClient.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const rows = await prisma.entity.findMany({
        where: { entity: "Message" },
        orderBy: { updatedAt: "desc" },
      });

      const records = rows.map(toPublicRecord);
      const mine = records.filter((r: any) => r.clientId === myClient.id);

      return NextResponse.json(mine);
    }

    const where: any = { entity };
    if (user.role === "admin") {
      where.ownerId = user.id;
    }

    const rows = await prisma.entity.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    const records = rows.map(toPublicRecord);

    const filtered = records.filter((record: Record<string, unknown>) => {
      for (const key of Object.keys(criteria)) {
        if (record?.[key] !== criteria[key]) return false;
      }
      return true;
    });

    return NextResponse.json(filtered);
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message =
      error?.name === "ZodError" ? "Invalid request body" : undefined;
    return NextResponse.json(
      {
        error:
          status === 401 ? "Unauthorized" : message || "Internal Server Error",
      },
      { status }
    );
  }
}
