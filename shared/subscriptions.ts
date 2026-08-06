export const subscriptionPlans = ["free", "pro", "ultimate"] as const;

export type SubscriptionPlan = (typeof subscriptionPlans)[number];

export const billingIntervals = ["monthly", "annual"] as const;
export type BillingInterval = (typeof billingIntervals)[number];

export const isBillingInterval = (value: unknown): value is BillingInterval =>
  typeof value === "string" && billingIntervals.includes(value as BillingInterval);

export const registrationPlans = ["free", "pro", "ultimate"] as const;

export const isSubscriptionPlan = (value: unknown): value is SubscriptionPlan =>
  typeof value === "string" && subscriptionPlans.includes(value as SubscriptionPlan);

export const isRegistrationPlan = (value: unknown): value is (typeof registrationPlans)[number] =>
  typeof value === "string" && registrationPlans.includes(value as (typeof registrationPlans)[number]);

export const subscriptionPlanRank: Record<SubscriptionPlan, number> = {
  free: 0,
  pro: 1,
  ultimate: 2,
};

export const getAdminGrantedSubscriptionStatus = (
  plan: SubscriptionPlan,
): "active" | "complimentary" => plan === "free" ? "active" : "complimentary";

export type InvoiceCapabilities = {
  canPreview: true;
  canSave: boolean;
  canExport: boolean;
  watermarkPreview: boolean;
};

export type UltimateCapabilities = {
  canUseAi: boolean;
  canAutomateInvoices: boolean;
};

export const ULTIMATE_MONTHLY_AI_ACTIONS = 100;

const paidSubscriptionStatuses = new Set(["active", "trialing", "past_due", "complimentary"]);

export const getInvoiceCapabilities = (
  plan: unknown,
  status?: unknown,
): InvoiceCapabilities => {
  const normalizedPlan = isSubscriptionPlan(plan) ? plan : "free";
  const normalizedStatus = typeof status === "string" ? status.toLowerCase() : "active";
  const hasPaidAccess =
    subscriptionPlanRank[normalizedPlan] >= subscriptionPlanRank.pro &&
    paidSubscriptionStatuses.has(normalizedStatus);

  return {
    canPreview: true,
    canSave: hasPaidAccess,
    canExport: hasPaidAccess,
    watermarkPreview: !hasPaidAccess,
  };
};

export const getUltimateCapabilities = (
  plan: unknown,
  status?: unknown,
): UltimateCapabilities => {
  const normalizedPlan = isSubscriptionPlan(plan) ? plan : "free";
  const normalizedStatus = typeof status === "string" ? status.toLowerCase() : "active";
  const hasUltimateAccess =
    subscriptionPlanRank[normalizedPlan] >= subscriptionPlanRank.ultimate &&
    paidSubscriptionStatuses.has(normalizedStatus);

  return {
    canUseAi: hasUltimateAccess,
    canAutomateInvoices: hasUltimateAccess,
  };
};
