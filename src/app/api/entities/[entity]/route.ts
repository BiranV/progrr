import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/prisma";
import { requireAppUser } from "@/server/auth";

export const runtime = "nodejs";

const createBodySchema = z.record(z.string(), z.any());

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

function sortRecords(records: any[], sort?: string | null) {
  if (!sort) return records;
  const sortKey = sort.startsWith("-") ? sort.slice(1) : sort;
  const desc = sort.startsWith("-");

  return [...records].sort((a, b) => {
    const av = a?.[sortKey];
    const bv = b?.[sortKey];

    if (av == null && bv == null) return 0;
    if (av == null) return desc ? 1 : -1;
    if (bv == null) return desc ? -1 : 1;

    // try date compare if ISO-ish
    const ad = typeof av === "string" ? Date.parse(av) : NaN;
    const bd = typeof bv === "string" ? Date.parse(bv) : NaN;
    if (!Number.isNaN(ad) && !Number.isNaN(bd)) {
      return desc ? bd - ad : ad - bd;
    }

    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ entity: string }> }
) {
  try {
    const user = await requireAppUser();

    // Privacy: Owner sees nothing
    if (user.role === "owner") {
      return NextResponse.json([]);
    }

    const { entity } = await ctx.params;
    const url = new URL(req.url);
    const sort = url.searchParams.get("sort");

    // CLIENT ACCESS CONTROL
    if (user.role === "client") {
      // 1) Client profile: only their own record
      if (entity === "Client") {
        const rows = await prisma.entity.findMany({
          where: { entity: "Client" },
          orderBy: { updatedAt: "desc" },
        });
        const mine = rows
          .filter((r) => ((r.data ?? {}) as any).userId === user.id)
          .map(toPublicRecord);
        return NextResponse.json(sortRecords(mine, sort));
      }

      // 2) Messages: only messages for their own clientId
      if (entity === "Message") {
        const clientRows = await prisma.entity.findMany({
          where: { entity: "Client" },
          orderBy: { updatedAt: "desc" },
        });
        const myClient = clientRows.find(
          (r) => ((r.data ?? {}) as any).userId === user.id
        );
        if (!myClient) return NextResponse.json([]);

        const messageRows = await prisma.entity.findMany({
          where: { entity: "Message" },
          orderBy: { updatedAt: "desc" },
        });

        const mine = messageRows
          .filter((r) => ((r.data ?? {}) as any).clientId === myClient.id)
          .map(toPublicRecord);

        return NextResponse.json(sortRecords(mine, sort));
      }

      // Everything else is admin-only
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    return NextResponse.json(sortRecords(records, sort));
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : "Internal Server Error" },
      { status }
    );
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ entity: string }> }
) {
  try {
    const user = await requireAppUser();

    if (user.role === "owner") {
      return NextResponse.json(
        { error: "Owner cannot create entities" },
        { status: 403 }
      );
    }

    const { entity } = await ctx.params;
    const body = createBodySchema.parse(await req.json());

    // CLIENT ACCESS CONTROL
    if (user.role === "client") {
      if (entity !== "Message") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Ensure the message is stored under the coach (admin) ownerId so the coach can read it.
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { coachId: true },
      });
      const ownerId = dbUser?.coachId ?? null;
      if (!ownerId) {
        return NextResponse.json(
          { error: "Client is not assigned to a coach" },
          { status: 403 }
        );
      }

      const row = await prisma.entity.create({
        data: {
          entity,
          ownerId,
          data: body,
        },
      });

      return NextResponse.json(toPublicRecord(row));
    }

    const row = await prisma.entity.create({
      data: {
        entity,
        ownerId: user.id,
        data: body,
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
