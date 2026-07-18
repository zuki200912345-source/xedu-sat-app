"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Tier } from "@/lib/enums";
import { isStripeConfigured, TIER_CREDITS } from "@/lib/billing";

/**
 * Mock billing: switch the current user's tier directly. Available only when
 * Stripe is not configured, so the whole app is usable without a Stripe account.
 */
export async function setMockTier(tier: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (isStripeConfigured()) {
    return { ok: false, error: "Stripe is configured — use checkout instead." };
  }
  const parsed = Tier.parse(tier);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      tier: parsed,
      subscriptionStatus: parsed === "FREE" ? "inactive" : "active",
      tutoringCredits: TIER_CREDITS[parsed],
    },
  });

  // Tier lives on the JWT; force a refresh across gated routes.
  revalidatePath("/", "layout");
  return { ok: true };
}

const checkoutSchema = z.object({ tier: z.enum(["PLUS", "PREMIUM"]) });

/**
 * Real Stripe Checkout (only when configured). Returns a redirect URL. This is
 * intentionally minimal; the webhook flips subscriptionStatus/tier on payment.
 */
export async function createCheckout(input: { tier: "PLUS" | "PREMIUM" }): Promise<{ url?: string; error?: string }> {
  const user = await requireUser();
  const { tier } = checkoutSchema.parse(input);
  if (!isStripeConfigured()) return { error: "Stripe is not configured." };

  const priceId = tier === "PLUS" ? process.env.STRIPE_PRICE_PLUS : process.env.STRIPE_PRICE_PREMIUM;
  if (!priceId) return { error: "Price is not configured for this tier." };

  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${process.env.NEXTAUTH_URL}/settings/billing?success=1`,
    cancel_url: `${process.env.NEXTAUTH_URL}/settings/billing`,
    client_reference_id: user.id,
    "metadata[tier]": tier,
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  if (!res.ok) return { error: "Could not start checkout." };
  const data = (await res.json()) as { url?: string };
  return { url: data.url };
}
