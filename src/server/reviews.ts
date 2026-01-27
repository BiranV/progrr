import { ObjectId } from "mongodb";

import { collections } from "@/server/collections";
import { sendEmail } from "@/server/email";
import { createReviewToken } from "@/server/review-tokens";

const DEFAULT_REVIEW_MESSAGE =
  "Hi {{customerName}},\n" +
  "thanks for visiting {{businessName}} today!\n\n" +
  "We’d really appreciate it if you could leave us a quick review:\n" +
  "{{reviewLink}}";

function getCustomerName(raw: string | undefined): string {
  const name = String(raw ?? "").trim();
  return name || "there";
}

function applyTemplate(args: {
  customerName: string;
  businessName: string;
  reviewLink: string;
}): string {
  return DEFAULT_REVIEW_MESSAGE
    .replace(/\{\{\s*customerName\s*\}\}/g, args.customerName)
    .replace(/\{\{\s*businessName\s*\}\}/g, args.businessName)
    .replace(/\{\{\s*reviewLink\s*\}\}/g, args.reviewLink);
}

function pickPublicAppOrigin(): string {
  const emailOrigin = String(process.env.EMAIL_PUBLIC_ORIGIN || "").trim();
  if (emailOrigin) return emailOrigin.replace(/\/+$/, "");

  const explicit = String(
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "",
  ).trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = String(process.env.VERCEL_URL || "").trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return "";
}

function buildReviewLink(args: {
  businessPath: string;
  reviewToken: string;
}): string {
  const origin = pickPublicAppOrigin();
  if (!origin) return "";
  const params = new URLSearchParams({ reviewToken: args.reviewToken });
  return `${origin}/b/${encodeURIComponent(args.businessPath)}?${params.toString()}`;
}

async function sendReviewEmail(args: {
  to: string;
  subject: string;
  message: string;
}) {
  await sendEmail({
    to: args.to,
    subject: args.subject,
    text: args.message,
    html: `<div style=\"white-space: pre-wrap; font-family: ui-sans-serif, system-ui;\">${args.message.replace(
      /</g,
      "&lt;",
    )}</div>`,
  });
}

export async function processReviewRequestsForBusiness(args: {
  businessUserId: ObjectId;
  appointmentId?: ObjectId;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const c = await collections();

  const owner = await c.users.findOne(
    { _id: args.businessUserId },
    {
      projection: {
        "onboarding.business.reviewRequestsEnabled": 1,
        "onboarding.business.reviewDelayMinutes": 1,
        "onboarding.business.name": 1,
        "onboarding.business.publicId": 1,
        "onboarding.business.slug": 1,
      },
    },
  );

  const business = (owner as any)?.onboarding?.business ?? {};
  const reviewRequestsEnabled =
    typeof business.reviewRequestsEnabled === "boolean"
      ? Boolean(business.reviewRequestsEnabled)
      : true;
  if (!reviewRequestsEnabled) return;

  const reviewDelayMinutes = Number(business.reviewDelayMinutes ?? 15) || 0;
  const businessName = String(business.name ?? "").trim() || "Progrr";
  const businessPublicId = String(business.publicId ?? "").trim();
  const businessSlug = String(business.slug ?? "").trim();
  if (!businessPublicId) return;
  const businessPath = businessSlug || businessPublicId;

  const match: any = {
    businessUserId: args.businessUserId,
    status: "COMPLETED",
    paymentStatus: "PAID",
    reviewRequestSent: { $ne: true },
    reviewSubmitted: { $ne: true },
  };
  if (args.appointmentId) {
    match._id = args.appointmentId;
  }

  const candidates = await c.appointments
    .find(match)
    .sort({ completedAt: 1, createdAt: 1 })
    .limit(50)
    .toArray();

  for (const appt of candidates as any[]) {
    const paymentPaidAt =
      appt.paymentPaidAt instanceof Date ? appt.paymentPaidAt : null;
    if (!paymentPaidAt) continue;

    const scheduledAt =
      appt.reviewEmailScheduledAt instanceof Date
        ? appt.reviewEmailScheduledAt
        : null;

    if (!scheduledAt) {
      const nextScheduledAt = new Date(
        paymentPaidAt.getTime() + reviewDelayMinutes * 60_000,
      );
      await c.appointments.updateOne(
        { _id: appt._id } as any,
        {
          $set: {
            reviewEmailScheduled: true,
            reviewEmailScheduledAt: nextScheduledAt,
          },
        } as any,
      );
      if (nextScheduledAt.getTime() > now.getTime()) continue;
    } else if (scheduledAt.getTime() > now.getTime()) {
      continue;
    }

    const customerEmail = String(appt.customer?.email ?? "").trim();
    if (!customerEmail) continue;

    const { token, tokenHash } = createReviewToken();
    const appointmentId = String(appt._id);
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    try {
      await c.reviewTokens.deleteMany({ appointmentId } as any);
      await c.reviewTokens.insertOne({
        tokenHash,
        appointmentId,
        businessUserId: args.businessUserId,
        customerId: appt.customerId ?? undefined,
        customerEmail: customerEmail || undefined,
        expiresAt,
        createdAt: now,
      } as any);
    } catch (err) {
      console.error("Review token create failed", err);
      continue;
    }

    const reviewLink = buildReviewLink({
      businessPath,
      reviewToken: token,
    });
    if (!reviewLink) continue;

    const message = applyTemplate({
      customerName: getCustomerName(appt.customer?.fullName),
      businessName,
      reviewLink,
    });

    try {
      await sendReviewEmail({
        to: customerEmail,
        subject: `${businessName} review request`,
        message,
      });

      await c.appointments.updateOne(
        { _id: appt._id } as any,
        {
          $set: {
            reviewRequestSent: true,
            reviewSentAt: now,
            reviewEmailScheduled: true,
            reviewEmailScheduledAt:
              scheduledAt ??
              new Date(paymentPaidAt.getTime() + reviewDelayMinutes * 60_000),
          },
        } as any,
      );
    } catch (err) {
      console.error("Review request send failed", err);
    }
  }
}
