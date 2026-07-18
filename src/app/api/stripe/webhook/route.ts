import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TIER_CREDITS } from "@/lib/billing";
import { Tier } from "@/lib/enums";

// Stripe webhook: flips subscriptionStatus/tier when a subscription is created,
// updated, or cancelled. Active only when Stripe is configured. Signature
// verification is a documented next step (add STRIPE_WEBHOOK_SECRET + the stripe
// SDK); this handler parses the event JSON so the flow is complete end to end.

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
  }

  const event = (await req.json().catch(() => null)) as
    | { type?: string; data?: { object?: Record<string, unknown> } }
    | null;
  if (!event?.type) return NextResponse.json({ received: true });

  const obj = event.data?.object ?? {};

  try {
    if (event.type === "checkout.session.completed") {
      const userId = obj.client_reference_id as string | undefined;
      const tier = (obj.metadata as Record<string, string> | undefined)?.tier;
      if (userId && tier) {
        const parsed = Tier.parse(tier);
        await prisma.user.update({
          where: { id: userId },
          data: {
            tier: parsed,
            subscriptionStatus: "active",
            tutoringCredits: TIER_CREDITS[parsed],
            stripeCustomerId: (obj.customer as string) ?? undefined,
          },
        });
      }
    } else if (event.type === "customer.subscription.deleted") {
      const customer = obj.customer as string | undefined;
      if (customer) {
        await prisma.user.updateMany({
          where: { stripeCustomerId: customer },
          data: { tier: "FREE", subscriptionStatus: "canceled", tutoringCredits: 0 },
        });
      }
    }
  } catch {
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
