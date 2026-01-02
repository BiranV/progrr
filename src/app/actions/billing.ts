"use server";

import { stripe } from "@/lib/stripe";
import { requireAppUser } from "@/server/auth";
import { collections } from "@/server/collections";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";

export async function createPortalSession() {
  const user = await requireAppUser();

  if (user.role !== "admin") {
    throw new Error("Only admins can manage billing");
  }

  const c = await collections();

  const admin = await c.admins.findOne({ _id: new ObjectId(user.id) });

  if (!admin?.stripeCustomerId) {
    throw new Error("No billing account found");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: admin.stripeCustomerId,
    return_url: `${
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    }/dashboard`,
  });

  redirect(session.url);
}
