import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import JSZip from "jszip";

import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";

export const runtime = "nodejs";

function safeFilenameSegment(input: string) {
  return String(input || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : value instanceof Date
      ? value.toISOString()
      : JSON.stringify(value);

  // RFC4180-ish escaping
  const mustQuote = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return mustQuote ? `"${escaped}"` : escaped;
}

function toCsv(rows: Record<string, any>[], headers: string[]) {
  const lines: string[] = [];
  lines.push(headers.map((h) => toCsvValue(h)).join(","));
  for (const row of rows) {
    lines.push(headers.map((h) => toCsvValue(row?.[h])).join(","));
  }
  return lines.join("\n") + "\n";
}

export async function GET() {
  try {
    const user = await requireAppUser();
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const c = await collections();
    const adminId = new ObjectId(user.id);

    const admin = await c.admins.findOne({ _id: adminId });
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clients = await c.clients
      .find({ adminId })
      .project({ passwordHash: 0 })
      .toArray();

    const entityDocs = await c.entities.find({ adminId }).toArray();

    const zip = new JSZip();

    // JSON
    zip.file(
      "json/admin.json",
      JSON.stringify(
        {
          id: admin._id?.toHexString(),
          email: admin.email,
          fullName: admin.fullName ?? null,
          createdAt: admin.createdAt,
          role: admin.role,
        },
        null,
        2
      )
    );

    zip.file(
      "json/clients.json",
      JSON.stringify(
        clients.map((cl) => ({
          id: cl._id?.toHexString(),
          adminId: undefined,
          email: cl.email,
          name: cl.name,
          theme: cl.theme,
          phone: cl.phone ?? null,
          isBlocked: cl.isBlocked ?? false,
          blockedUntil: cl.blockedUntil ?? null,
          blockReason: cl.blockReason ?? null,
          role: cl.role,
        })),
        null,
        2
      )
    );

    const entitiesByType = new Map<string, any[]>();
    for (const doc of entityDocs) {
      const key = String(doc.entity || "Unknown");
      const arr = entitiesByType.get(key) ?? [];
      arr.push({
        id: doc._id?.toHexString(),
        entity: doc.entity,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        data: doc.data ?? null,
      });
      entitiesByType.set(key, arr);
    }

    for (const [entityType, rows] of entitiesByType) {
      const seg = safeFilenameSegment(entityType) || "Unknown";
      zip.file(`json/entities/${seg}.json`, JSON.stringify(rows, null, 2));
    }

    // CSV
    const clientCsvRows = clients.map((cl) => ({
      id: cl._id?.toHexString(),
      email: cl.email,
      name: cl.name,
      theme: cl.theme,
      phone: cl.phone ?? "",
      isBlocked: cl.isBlocked ?? false,
      blockedUntil: cl.blockedUntil ? cl.blockedUntil.toISOString() : "",
      blockReason: cl.blockReason ?? "",
      role: cl.role,
    }));
    zip.file(
      "csv/clients.csv",
      toCsv(clientCsvRows, [
        "id",
        "email",
        "name",
        "theme",
        "phone",
        "isBlocked",
        "blockedUntil",
        "blockReason",
        "role",
      ])
    );

    for (const [entityType, rows] of entitiesByType) {
      const seg = safeFilenameSegment(entityType) || "Unknown";
      const csvRows = rows.map((r) => ({
        id: r.id,
        entity: r.entity,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "",
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : "",
        data: JSON.stringify(r.data ?? null),
      }));
      zip.file(
        `csv/entities/${seg}.csv`,
        toCsv(csvRows, ["id", "entity", "createdAt", "updatedAt", "data"])
      );
    }

    const exportedAt = new Date().toISOString();
    zip.file(
      "json/export-metadata.json",
      JSON.stringify(
        {
          exportedAt,
          scope: {
            includes: [
              "admin_profile",
              "clients",
              "entities (programs/plans/logs/notes/messages/etc)",
            ],
            excludes: ["passwords", "otp_secrets", "auth_tokens"],
          },
        },
        null,
        2
      )
    );

    const blob = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    const bytes = new Uint8Array(blob);

    const filename = `progrr-export-${exportedAt.slice(0, 10)}.zip`;

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : "Request failed" },
      { status }
    );
  }
}
