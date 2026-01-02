import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { collections } from "@/server/collections";
import { ObjectId } from "mongodb";
import Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("Stripe-Signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const subscription = event.data.object as Stripe.Subscription;

  try {
    // Handle Checkout Session Completed
    // This is where we link the Stripe Customer ID to our User
    if (event.type === "checkout.session.completed") {
      const userId = session.metadata?.userId || session.client_reference_id;
      const subscriptionId = session.subscription as string;

      if (userId) {
        const c = await collections();
        if (ObjectId.isValid(userId)) {
          await c.admins.updateOne(
            { _id: new ObjectId(userId) },
            {
              $set: {
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: subscriptionId,
              },
            }
          );
        }
      }
    }

    // Handle Subscription Updates
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const customerId = subscription.customer as string;
      const status = subscription.status;
      // Cast to any to avoid TS issues with specific Stripe SDK versions
      const endDate = new Date((subscription as any).current_period_end * 1000);

      // Map Stripe status to our Enum
      let userStatus:
        | "ACTIVE"
        | "TRIALING"
        | "PAST_DUE"
        | "CANCELED"
        | "UNPAID" = "ACTIVE";

      if (status === "active") userStatus = "ACTIVE";
      else if (status === "trialing") userStatus = "TRIALING";
      else if (status === "past_due") userStatus = "PAST_DUE";
      else if (status === "canceled") userStatus = "CANCELED";
      else if (status === "unpaid") userStatus = "UNPAID";
      else userStatus = "CANCELED"; // Default fallback

      // Find user by Stripe Customer ID
      // We might need to find by email if customer ID isn't linked yet (race condition with checkout)
      const c = await collections();
      const admin = await c.admins.findOne({ stripeCustomerId: customerId });

      if (admin) {
        await c.admins.updateOne(
          { _id: admin._id },
          {
            $set: {
              subscriptionStatus: userStatus,
              subscriptionEndDate: endDate,
              stripeSubscriptionId: subscription.id,
            },
          }
        );
      } else {
        console.warn(
          `Webhook: No user found for Stripe Customer ${customerId}`
        );
      }
    }
  } catch (error: any) {
    console.error("Webhook handler failed:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
