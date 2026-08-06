import type { SubscriptionPlan } from "./subscriptions";

export type PaddlePaidPlan = Exclude<SubscriptionPlan, "free">;

export const extractTickdCheckoutToken = (customData: unknown): string | null => {
  if (!customData || typeof customData !== "object") return null;
  const value = (customData as Record<string, unknown>).tickd_checkout_token;
  if (typeof value !== "string") return null;
  return /^[A-Za-z0-9_-]{32,128}$/.test(value) ? value : null;
};

export const hasPaidPaddleStatus = (status: string) =>
  ["active", "trialing", "past_due"].includes(status.toLowerCase());

export const resolvePaddlePlan = (
  items: Array<{ price?: { id?: string } | null }>,
  priceIds: Partial<Record<PaddlePaidPlan, string>>,
): PaddlePaidPlan | null => {
  const matchedPlans = new Set<PaddlePaidPlan>();

  for (const item of items) {
    const itemPriceId = item.price?.id;
    if (!itemPriceId) continue;

    for (const plan of ["pro", "ultimate"] as const) {
      if (priceIds[plan] && itemPriceId === priceIds[plan]) matchedPlans.add(plan);
    }
  }

  return matchedPlans.size === 1 ? matchedPlans.values().next().value || null : null;
};
