import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { collections, ensureIndexes } from "@/server/collections";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    await ensureIndexes();

    const { slug } = await ctx.params; // כן, await – בשביל הטייפ
    const normalizedSlug = String(slug ?? "").trim();

    if (!normalizedSlug) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const c = await collections();

    const user = await c.users.findOne({
      "onboarding.business.slug": normalizedSlug,
      onboardingCompleted: true,
    } as any);

    if (!user) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const onboarding = (user as any).onboarding ?? {};
    const business = onboarding.business ?? {};
    const branding = onboarding.branding ?? {};

    const currencySymbol = (code: string): string => {
      switch (
        String(code || "")
          .trim()
          .toUpperCase()
      ) {
        case "ILS":
        case "NIS":
          return "₪";
        case "USD":
          return "$";
        case "EUR":
          return "€";
        case "GBP":
          return "£";
        case "AUD":
        case "CAD":
          return "$";
        case "CHF":
          return "CHF";
        default:
          return "";
      }
    };

    const servicesRaw: any[] = Array.isArray(onboarding.services)
      ? onboarding.services
      : [];
    const services = servicesRaw
      .filter((s) => (s as any)?.isActive !== false)
      .map((s) => ({
        id: String((s as any)?.id ?? "").trim(),
        name: String((s as any)?.name ?? "").trim(),
        durationMinutes: Number((s as any)?.durationMinutes),
        price: Number.isFinite(Number((s as any)?.price))
          ? Number((s as any)?.price)
          : 0,
        description: String((s as any)?.description ?? "").trim(),
      }))
      .filter(
        (s) =>
          s.id &&
          s.name &&
          Number.isFinite(s.durationMinutes) &&
          s.durationMinutes > 0
      );

    const currencyCode =
      String(business.currency ?? "").trim() ||
      String(onboarding.currency ?? "").trim() ||
      "ILS";
    const customCurrency = onboarding.customCurrency ?? undefined;

    return NextResponse.json({
      ok: true,
      business: {
        slug: normalizedSlug,
        name: String(business.name ?? "").trim(),
        phone: String(business.phone ?? "").trim(),
        address: String(business.address ?? "").trim(),
      },
      branding: {
        // New shape (Cloudinary)
        logo: branding.logo ?? undefined,
        banner: branding.banner ?? undefined,
        galleryItems: Array.isArray(branding.gallery)
          ? branding.gallery.slice(0, 10)
          : [],

        // Legacy shape (string urls) for backwards compatibility
        logoUrl:
          (String(branding.logoUrl ?? "").trim() ||
            String(branding.logo?.url ?? "").trim() ||
            undefined) ??
          undefined,
        bannerUrl:
          (String(branding.bannerUrl ?? "").trim() ||
            String(branding.banner?.url ?? "").trim() ||
            undefined) ??
          undefined,
        gallery: Array.isArray(branding.gallery)
          ? branding.gallery
              .map((x: any) =>
                typeof x === "string"
                  ? String(x ?? "").trim()
                  : String(x?.url ?? "").trim()
              )
              .filter(Boolean)
              .slice(0, 10)
          : [],
      },
      services,
      availability: onboarding.availability ?? {},
      currency: {
        code: currencyCode,
        symbol: currencySymbol(currencyCode),
        ...(currencyCode === "OTHER"
          ? {
              name: String(customCurrency?.name ?? "").trim(),
              symbol: String(customCurrency?.symbol ?? "").trim(),
            }
          : {}),
      },
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status }
    );
  }
}
