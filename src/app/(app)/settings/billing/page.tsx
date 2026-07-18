import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { auth } from "@/lib/auth";
import { isStripeConfigured, TIERS } from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BillingButton } from "./billing-button";

export const metadata: Metadata = { title: "Billing & plans" };

export default async function BillingPage() {
  const session = await auth();
  const currentTier = session!.user.tier;
  const stripeOn = isStripeConfigured();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
          ← Settings
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Billing &amp; plans</h1>
        <p className="mt-1 text-muted-foreground">
          {stripeOn
            ? "Manage your subscription through Stripe."
            : "Stripe isn't configured, so a mock billing provider is active — switch plans instantly to explore every tier."}
        </p>
      </div>

      {!stripeOn && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Dev mode:</strong> mock billing. Add <code>STRIPE_SECRET_KEY</code> and price IDs
          to <code>.env</code> to enable real Stripe Checkout, the Customer Portal, and webhooks.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {TIERS.map((t) => {
          const isCurrent = t.tier === currentTier;
          const highlighted = t.tier === "PLUS";
          return (
            <Card
              key={t.tier}
              className={
                isCurrent
                  ? "border-2 border-primary"
                  : highlighted
                    ? "border-primary/50 shadow-md shadow-primary/5"
                    : ""
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{t.name}</CardTitle>
                  {isCurrent && <Badge>Current</Badge>}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{t.price}</span>
                  <span className="text-sm text-muted-foreground">{t.period}</span>
                </div>
                <p className="text-sm text-muted-foreground">{t.tagline}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <BillingButton
                  tier={t.tier}
                  isCurrent={isCurrent}
                  stripeOn={stripeOn}
                  highlighted={highlighted}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
