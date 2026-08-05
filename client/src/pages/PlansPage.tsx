import { useAuth } from "@/hooks/useAuth";
import PricingSection from "@/components/marketing/PricingSection";
import type { SubscriptionPlan } from "@shared/subscriptions";

export default function PlansPage() {
  const { user } = useAuth();
  const checkout = new URLSearchParams(window.location.search).get("checkout");
  return <div className="mx-auto max-w-7xl py-3"><div className="mb-7"><p className="text-sm font-semibold text-blue-600">Your plan</p><h1 className="mt-2 text-3xl font-bold">Choose the Tickd that fits your work</h1><p className="mt-2 text-sm text-gray-600">Upgrade securely with Paddle. Taxes and local payment methods are handled in checkout.</p></div><PricingSection compact currentPlan={(user?.subscriptionPlan || "free") as SubscriptionPlan} autoCheckout={checkout === "pro"} /></div>;
}
