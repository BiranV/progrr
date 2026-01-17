import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";
import {
  ensureBusinessPublicIdForUser,
  isValidBusinessPublicId,
} from "@/server/business-public-id";
import { isMobilePhoneE164, normalizePhone } from "@/server/phone";

function asString(v: unknown, maxLen = 250): string | undefined {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function normalizeInstagram(v: unknown): string | undefined {
  const raw = asString(v, 200);
  if (!raw) return undefined;
  // Accept full URL or handle.
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, "").trim();
  if (!handle) return undefined;
  return `https://instagram.com/${encodeURIComponent(handle)}`;
}

function normalizeWhatsApp(v: unknown): string | undefined {
  const raw = asString(v, 40);
  if (!raw) return undefined;

  const e164 = normalizePhone(raw);
  if (!e164) return undefined;
  if (!isMobilePhoneE164(e164)) return undefined;
  return e164;
}

const ALLOWED_CURRENCY_CODES = new Set([
  "ILS",
  "NIS",
  "USD",
  "EUR",
  "GBP",
  "AUD",
  "CAD",
  "CHF",
]);

function normalizeCurrencyCode(v: unknown): string | undefined {
  const raw = String(v ?? "")
    .trim()
    .toUpperCase();
  if (!raw) return undefined;
  if (!ALLOWED_CURRENCY_CODES.has(raw)) return undefined;
  // Normalize legacy/alt spelling.
  if (raw === "NIS") return "ILS";
  return raw;
}

export async function GET() {
  try {
    const appUser = await requireAppUser();
    const c = await collections();

    const user = await c.users.findOne({ _id: new ObjectId(appUser.id) });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = (user as any)?.onboarding?.business;
    if (!business || typeof business !== "object") {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // Ensure stable publicId exists.
    let publicId = String((business as any).publicId ?? "").trim();
    if (!isValidBusinessPublicId(publicId)) {
      publicId = await ensureBusinessPublicIdForUser(new ObjectId(appUser.id));
    }

    const name = asString((business as any).name, 120);
    const phone = normalizePhone((business as any).phone) || asString((business as any).phone, 40);
    const address = asString((business as any).address, 200);
    const slug = asString((business as any).slug, 120);
    const description = asString((business as any).description, 250);
    const instagram = normalizeInstagram((business as any).instagram);
    const whatsapp = normalizeWhatsApp((business as any).whatsapp);
    const currency =
      normalizeCurrencyCode((business as any).currency) ??
      normalizeCurrencyCode((user as any)?.onboarding?.currency) ??
      "ILS";

    if (!name || !phone || !publicId) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      publicId,
      name,
      phone,
      address: address ?? "",
      // slug is kept for internal/admin usage, but MUST NOT be used for public booking links.
      slug: slug ?? "",
      description: description ?? "",
      instagram: instagram ?? "",
      whatsapp: whatsapp ?? "",
      currency,
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const appUser = await requireAppUser();
    const c = await collections();

    const user = await c.users.findOne({ _id: new ObjectId(appUser.id) });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = (user as any)?.onboarding?.business;
    if (!business || typeof business !== "object") {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // Ensure stable publicId exists (do not allow PATCH to overwrite it).
    try {
      const currentPublicId = String((business as any).publicId ?? "").trim();
      if (!isValidBusinessPublicId(currentPublicId)) {
        await ensureBusinessPublicIdForUser(new ObjectId(appUser.id));
      }
    } catch {
      // Ignore; PATCH can proceed.
    }

    const body = await req.json().catch(() => ({}));

    const currentName = asString((business as any).name, 120);
    const currentPhone =
      normalizePhone((business as any).phone) || asString((business as any).phone, 40);
    const currentAddress = asString((business as any).address, 200) ?? "";
    const currentDescription =
      asString((business as any).description, 250) ?? "";
    const currentCurrency =
      normalizeCurrencyCode((business as any).currency) ??
      normalizeCurrencyCode((user as any)?.onboarding?.currency) ??
      "ILS";

    const name = asString((body as any)?.name, 120) ?? currentName;
    const requestedPhoneRaw =
      Object.prototype.hasOwnProperty.call(body as any, "phone")
        ? asString((body as any)?.phone, 40) ?? ""
        : undefined;
    const phone =
      (requestedPhoneRaw !== undefined
        ? normalizePhone(requestedPhoneRaw)
        : normalizePhone(currentPhone)) || currentPhone;
    const address =
      (Object.prototype.hasOwnProperty.call(body as any, "address")
        ? asString((body as any)?.address, 200) ?? ""
        : currentAddress) ?? "";
    const description =
      (Object.prototype.hasOwnProperty.call(body as any, "description")
        ? asString((body as any)?.description, 250) ?? ""
        : currentDescription) ?? "";

    const currentInstagram =
      normalizeInstagram((business as any).instagram) ?? "";
    const currentWhatsApp = normalizeWhatsApp((business as any).whatsapp) ?? "";

    const instagram =
      (Object.prototype.hasOwnProperty.call(body as any, "instagram")
        ? normalizeInstagram((body as any)?.instagram) ?? ""
        : currentInstagram) ?? "";

    const requestedWhatsAppRaw = Object.prototype.hasOwnProperty.call(
      body as any,
      "whatsapp"
    )
      ? asString((body as any)?.whatsapp, 40) ?? ""
      : undefined;

    const whatsapp =
      (requestedWhatsAppRaw !== undefined
        ? requestedWhatsAppRaw
          ? normalizeWhatsApp(requestedWhatsAppRaw) ?? "__INVALID__"
          : ""
        : currentWhatsApp) ?? "";

    const requestedCurrency = normalizeCurrencyCode((body as any)?.currency);
    if (
      Object.prototype.hasOwnProperty.call(body as any, "currency") &&
      !requestedCurrency
    ) {
      return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
    }
    const currency = requestedCurrency ?? currentCurrency;

    if (!name) {
      return NextResponse.json(
        { error: "Business name cannot be empty" },
        { status: 400 }
      );
    }

    if (!phone || !normalizePhone(phone)) {
      return NextResponse.json(
        { error: "Please enter a valid phone number" },
        { status: 400 }
      );
    }

    if (whatsapp === "__INVALID__") {
      return NextResponse.json(
        { error: "WhatsApp number must be a valid mobile number" },
        { status: 400 }
      );
    }

    if (!address.trim()) {
      return NextResponse.json(
        { error: "Address cannot be empty" },
        { status: 400 }
      );
    }

    const result = await c.users.updateOne(
      { _id: new ObjectId(appUser.id) },
      {
        $set: {
          "onboarding.business.name": name,
          "onboarding.business.phone": phone,
          "onboarding.business.address": address,
          "onboarding.business.description": description,
          "onboarding.business.instagram": instagram,
          "onboarding.business.whatsapp": whatsapp,
          "onboarding.business.currency": currency,
          "onboarding.updatedAt": new Date(),
        },
      }
    );

    if (!result.matchedCount) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
