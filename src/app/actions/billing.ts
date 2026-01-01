"use server";

import { stripe } from "@/lib/stripe";
import { requireAppUser } from "@/server/auth";
import { prisma } from "@/server/prisma";
import { redirect } from "next/navigation";

export async function createPortalSession() {
  const user = await requireAppUser({ skipSubscriptionCheck: true });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      stripeCustomerId: true,
    },
  });

  if (!dbUser?.stripeCustomerId) {
    throw new Error("No billing account found");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: dbUser.stripeCustomerId,
    return_url: `${
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    }/dashboard`,
  });

  redirect(session.url);
}
