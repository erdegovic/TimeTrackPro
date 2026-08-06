import type { BillingInterval, SubscriptionPlan } from "./subscriptions";

export type PaddlePaidPlan = Exclude<SubscriptionPlan, "free">;
export type PaddlePriceMap = Partial<
  Record<PaddlePaidPlan, Partial<Record<BillingInterval, string>>>
>;

export type PaddlePriceSelection = {
  plan: PaddlePaidPlan;
  billingInterval: BillingInterval;
};

export const extractTickdCheckoutToken = (customData: unknown): string | null => {
  if (!customData || typeof customData !== "object") return null;
  const value = (customData as Record<string, unknown>).tickd_checkout_token;
  if (typeof value !== "string") return null;
  return /^[A-Za-z0-9_-]{32,128}$/.test(value) ? value : null;
};

export const hasPaidPaddleStatus = (status: string) =>
  ["active", "trialing", "past_due"].includes(status.toLowerCase());

export const resolvePaddlePrice = (
  items: Array<{ price?: { id?: string } | null }>,
  priceIds: PaddlePriceMap,
): PaddlePriceSelection | null => {
  const matches = new Map<string, PaddlePriceSelection>();

  for (const item of items) {
    const itemPriceId = item.price?.id;
    if (!itemPriceId) continue;

    for (const plan of ["pro", "ultimate"] as const) {
      for (const billingInterval of ["monthly", "annual"] as const) {
        if (priceIds[plan]?.[billingInterval] === itemPriceId) {
          matches.set(`${plan}:${billingInterval}`, { plan, billingInterval });
        }
      }
    }
  }

  return matches.size === 1 ? matches.values().next().value || null : null;
};

export const resolvePaddlePlan = (
  items: Array<{ price?: { id?: string } | null }>,
  priceIds: Partial<Record<PaddlePaidPlan, string>>,
): PaddlePaidPlan | null => resolvePaddlePrice(items, {
  pro: { monthly: priceIds.pro },
  ultimate: { monthly: priceIds.ultimate },
})?.plan || null;
