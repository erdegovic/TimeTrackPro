export const subscriptionPlans = ["free", "pro", "ultimate"] as const;

export type SubscriptionPlan = (typeof subscriptionPlans)[number];

export const registrationPlans = ["free", "pro"] as const;

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
