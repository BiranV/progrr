import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/prisma";
import { requireAppUser } from "@/server/auth";

export const runtime = "nodejs";

const patchBodySchema = z.record(z.string(), z.any());

function toPublicRecord(row: {
  id: string;
  data: any;
  createdAt: Date;
  updatedAt: Date;
}) {
  const data = (row.data ?? {}) as Record<string, any>;
  return {
    id: row.id,
    created_date: row.createdAt.toISOString(),
    updated_date: row.updatedAt.toISOString(),
    ...data,
  };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ entity: string; id: string }> }
) {
  try {
    const user = await requireAppUser();
    const { entity, id } = await ctx.params;

    const where: any = { id, entity };
    if (user.role === "admin") {
      where.ownerId = user.id;
    }

    const row = await prisma.entity.findFirst({ where });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(toPublicRecord(row));
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : "Internal Server Error" },
      { status }
    );
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ entity: string; id: string }> }
) {
  try {
    const user = await requireAppUser();
    const { entity, id } = await ctx.params;

    const patch = patchBodySchema.parse(await req.json());

    const where: any = { id, entity };
    if (user.role === "admin") {
      where.ownerId = user.id;
    }

    const existing = await prisma.entity.findFirst({ where });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const row = await prisma.entity.update({
      where: { id },
      data: {
        data: {
          ...(existing.data as any),
          ...patch,
        },
      },
    });

    return NextResponse.json(toPublicRecord(row));
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

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ entity: string; id: string }> }
) {
  try {
    const user = await requireAppUser();
    const { entity, id } = await ctx.params;

    const where: any = { id, entity };
    if (user.role === "admin") {
      where.ownerId = user.id;
    }

    const existing = await prisma.entity.findFirst({ where });
    if (!existing) {
      return NextResponse.json({ ok: true });
    }

    await prisma.entity.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : "Internal Server Error" },
      { status }
    );
  }
}
