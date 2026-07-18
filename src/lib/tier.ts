import { requireUser } from "@/lib/auth";
import type { Tier } from "@/lib/enums";

// Tiers in ascending order of access.
const TIER_RANK: Record<Tier, number> = { FREE: 0, PLUS: 1, PREMIUM: 2 };

export function tierMeets(userTier: Tier, minimum: Tier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[minimum];
}

/**
 * Authorize a server action/route by subscription tier. Throws "UPGRADE" when
 * the signed-in user's tier is below the minimum, so callers can surface a
 * clear upgrade prompt.
 */
export async function requireTier(minimum: Tier) {
  const user = await requireUser();
  if (!tierMeets(user.tier, minimum)) throw new Error("UPGRADE");
  return user;
}
