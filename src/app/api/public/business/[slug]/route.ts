import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { collections, ensureIndexes } from "@/server/collections";
import { isValidBusinessPublicId } from "@/server/business-public-id";
import { normalizePhone } from "@/server/phone";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    await ensureIndexes();

    const { slug } = await ctx.params; // כן, await – בשביל הטייפ
    const raw = String(slug ?? "").trim();

    if (!raw) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // Hard rule: public booking API is keyed by stable 5-digit publicId.
    // If a legacy slug hits this endpoint, redirect to the publicId form.
    if (!isValidBusinessPublicId(raw)) {
      const c = await collections();
      const legacy = await c.users.findOne(
        {
          "onboarding.business.slug": raw,
          onboardingCompleted: true,
        } as any,
        { projection: { "onboarding.business.publicId": 1 } }
      );

      const publicId = String(
        (legacy as any)?.onboarding?.business?.publicId ?? ""
      ).trim();

      if (isValidBusinessPublicId(publicId)) {
        const url = new URL(req.url);
        url.pathname = `/api/public/business/${publicId}`;
        return NextResponse.redirect(url, 308);
      }

      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    const c = await collections();

    const user = await c.users.findOne({
      "onboarding.business.publicId": raw,
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
    const reviewRequestsEnabled =
      typeof (business as any)?.reviewRequestsEnabled === "boolean"
        ? Boolean((business as any)?.reviewRequestsEnabled)
        : true;

    const currencySymbol = (code: string): string => {
      const normalized = String(code || "")
        .trim()
        .toUpperCase();
      const canonical = normalized === "NIS" ? "ILS" : normalized;
      return canonical === "ILS" ? "₪" : "";
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

    const currencyCodeRaw =
      String(business.currency ?? "").trim() ||
      String(onboarding.currency ?? "").trim() ||
      "ILS";
    const currencyCode =
      currencyCodeRaw.toUpperCase() === "NIS" ? "ILS" : currencyCodeRaw;
    const customCurrency = onboarding.customCurrency ?? undefined;

    const reviews = reviewRequestsEnabled
      ? await c.appointments
          .find(
            {
              businessUserId: (user as any)?._id,
              reviewSubmitted: true,
            } as any,
            {
              projection: {
                _id: 1,
                serviceName: 1,
                date: 1,
                startTime: 1,
                endTime: 1,
                "customer.fullName": 1,
                reviewRating: 1,
                reviewComment: 1,
                reviewSubmittedAt: 1,
              },
            },
          )
          .sort({ reviewSubmittedAt: -1, createdAt: -1 })
          .limit(50)
          .toArray()
      : [];

    return NextResponse.json({
      ok: true,
      business: {
        publicId: raw,
        name: String(business.name ?? "").trim(),
        phone:
          normalizePhone((business as any)?.phone) ||
          String(business.phone ?? "").trim(),
        address: String(business.address ?? "").trim(),
        description: String(business.description ?? "").trim(),
        instagram: String(business.instagram ?? "").trim(),
        whatsapp:
          normalizePhone((business as any)?.whatsapp) ||
          String(business.whatsapp ?? "").trim(),
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
      bookingRules: {
        limitCustomerToOneUpcomingAppointment: Boolean(
          (business as any)?.limitCustomerToOneUpcomingAppointment
        ),
      },
      reviewRequestsEnabled,
      reviews: reviews.map((review: any) => ({
        id: String(review._id),
        serviceName: String(review.serviceName ?? "").trim(),
        date: String(review.date ?? "").trim(),
        startTime: String(review.startTime ?? "").trim(),
        endTime: String(review.endTime ?? "").trim(),
        customerName: String(review.customer?.fullName ?? "").trim(),
        rating: Number(review.reviewRating ?? 0),
        comment: String(review.reviewComment ?? "").trim(),
        submittedAt:
          review.reviewSubmittedAt instanceof Date
            ? review.reviewSubmittedAt.toISOString()
            : null,
      })),
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
