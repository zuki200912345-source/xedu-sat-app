import type { Tier } from "@/lib/enums";

// Billing abstraction. When Stripe keys are absent, the app uses a mock
// provider so every tier is selectable via a dev-only toggle and the whole app
// stays usable without a Stripe account.

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export const TIERS: {
  tier: Tier;
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  priceEnv?: string;
}[] = [
  {
    tier: "FREE",
    name: "Free",
    price: "$0",
    period: "forever",
    tagline: "See where you stand",
    features: ["Adaptive diagnostic + study plan", "10 drill questions per day", "1 sample module", "Basic progress stats", "All lessons"],
  },
  {
    tier: "PLUS",
    name: "Plus",
    price: "$19",
    period: "/month",
    tagline: "Everything you need to climb",
    features: ["All 10 full adaptive tests", "Unlimited drills + Weakness Conqueror", "Vocabulary flashcards (SM-2)", "Full analytics + predicted score"],
    priceEnv: "STRIPE_PRICE_PLUS",
  },
  {
    tier: "PREMIUM",
    name: "Premium",
    price: "$49",
    period: "/month",
    tagline: "Plus, with a coach in your corner",
    features: ["Everything in Plus", "4 tutoring credits per month", "1-on-1 sessions with video", "Priority new features"],
    priceEnv: "STRIPE_PRICE_PREMIUM",
  },
];

export const TIER_CREDITS: Record<Tier, number> = { FREE: 0, PLUS: 0, PREMIUM: 4 };
