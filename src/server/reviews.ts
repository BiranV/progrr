import { ObjectId } from "mongodb";

import { collections } from "@/server/collections";
import { sendEmail } from "@/server/email";

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
  businessPublicId: string;
  appointmentId: string;
}): string {
  const origin = pickPublicAppOrigin();
  if (!origin) return "";
  const params = new URLSearchParams({ appointmentId: args.appointmentId });
  return `${origin}/review/${encodeURIComponent(
    args.businessPublicId,
  )}?${params.toString()}`;
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
      },
    },
  );

  const business = (owner as any)?.onboarding?.business ?? {};
  const reviewRequestsEnabled =
    typeof business.reviewRequestsEnabled === "boolean"
      ? Boolean(business.reviewRequestsEnabled)
      : true;
  if (!reviewRequestsEnabled) return;

  const reviewDelayMinutes = Number(business.reviewDelayMinutes ?? 120) || 0;
  const businessName = String(business.name ?? "").trim() || "Progrr";
  const businessPublicId = String(business.publicId ?? "").trim();
  if (!businessPublicId) return;

  const match: any = {
    businessUserId: args.businessUserId,
    status: "COMPLETED",
    reviewRequestSent: { $ne: true },
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
    const completedAt =
      appt.completedAt instanceof Date
        ? appt.completedAt
        : appt.createdAt instanceof Date
          ? appt.createdAt
          : null;

    if (!completedAt) continue;

    const readyAt = new Date(
      completedAt.getTime() + reviewDelayMinutes * 60_000,
    );
    if (readyAt.getTime() > now.getTime()) continue;

    const customerEmail = String(appt.customer?.email ?? "").trim();
    if (!customerEmail) continue;

    const reviewLink = buildReviewLink({
      businessPublicId,
      appointmentId: String(appt._id),
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
          },
        } as any,
      );
    } catch (err) {
      console.error("Review request send failed", err);
    }
  }
}
