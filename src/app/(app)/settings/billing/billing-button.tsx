"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setMockTier, createCheckout } from "./actions";

export function BillingButton({
  tier,
  isCurrent,
  stripeOn,
  highlighted,
}: {
  tier: "FREE" | "PLUS" | "PREMIUM";
  isCurrent: boolean;
  stripeOn: boolean;
  highlighted: boolean;
}) {
  const router = useRouter();
  const { update } = useSession();
  const [busy, setBusy] = useState(false);

  async function act() {
    setBusy(true);
    if (stripeOn) {
      if (tier === "FREE") {
        toast.info("Manage cancellation from the Stripe customer portal.");
        setBusy(false);
        return;
      }
      const res = await createCheckout({ tier });
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      toast.error(res.error ?? "Could not start checkout");
      setBusy(false);
    } else {
      const res = await setMockTier(tier);
      if (res.ok) {
        // Refresh the JWT so the new tier takes effect on gated routes.
        await update();
        toast.success(`Switched to ${tier}`);
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not switch plan");
      }
      setBusy(false);
    }
  }

  if (isCurrent) {
    return (
      <Button variant="outline" className="w-full" disabled>
        Current plan
      </Button>
    );
  }

  return (
    <Button
      className="w-full"
      variant={highlighted ? "default" : "outline"}
      onClick={act}
      disabled={busy}
    >
      {busy ? "Working…" : stripeOn ? (tier === "FREE" ? "Downgrade" : `Upgrade to ${tier}`) : `Switch to ${tier}`}
    </Button>
  );
}
