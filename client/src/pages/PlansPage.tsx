import { useAuth } from "@/hooks/useAuth";
import PricingSection from "@/components/marketing/PricingSection";
import type { BillingInterval, SubscriptionPlan } from "@shared/subscriptions";
import type { PaddlePaidPlan, PaddlePriceSelection } from "@shared/paddle-billing";

export default function PlansPage() {
  const { user } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const checkout = params.get("checkout");
  const billingInterval: BillingInterval = params.get("billing") === "annual" ? "annual" : "monthly";
  const checkoutPlan: PaddlePriceSelection | null = checkout === "pro" || checkout === "ultimate"
    ? { plan: checkout as PaddlePaidPlan, billingInterval }
    : null;
  return <div className="mx-auto max-w-7xl py-3"><div className="mb-7"><p className="text-sm font-semibold text-blue-600">Your plan</p><h1 className="mt-2 text-3xl font-bold">Choose the Tickd that fits your work</h1><p className="mt-2 text-sm text-gray-600">Upgrade securely with Paddle. Taxes and local payment methods are handled in checkout.</p></div><PricingSection compact currentPlan={(user?.subscriptionPlan || "free") as SubscriptionPlan} currentBillingInterval={user?.subscriptionBillingInterval || "monthly"} paddleSubscriptionId={user?.paddleSubscriptionId} autoCheckout={checkoutPlan} /></div>;
}
