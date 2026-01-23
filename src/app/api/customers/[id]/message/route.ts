import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections, ensureIndexes } from "@/server/collections";
import { sendEmail } from "@/server/email";

function asString(v: unknown, maxLen: number): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAppUser();
    await ensureIndexes();

    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid customer id" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const subject = asString(body?.subject, 140);
    const message = asString(body?.message, 5000);

    if (!subject) {
      return NextResponse.json(
        { error: "Subject is required" },
        { status: 400 }
      );
    }
    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const c = await collections();
    const businessUserId = new ObjectId(user.id);

    const customerObjectId = new ObjectId(id);
    const businessCustomer = await c.businessCustomers.findOne({
      businessUserId,
      customerId: customerObjectId,
    } as any);

    if (!businessCustomer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const customer = await c.customers.findOne({ _id: customerObjectId } as any);
    if (!customer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const to = String((customer as any)?.email ?? "").trim();
    if (!to) {
      return NextResponse.json(
        { error: "Customer does not have an email" },
        { status: 400 }
      );
    }

    await sendEmail({
      to,
      subject,
      text: message,
      html: `<div style="white-space: pre-wrap; font-family: ui-sans-serif, system-ui;">${message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</div>`,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
