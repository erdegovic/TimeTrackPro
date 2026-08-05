import { useAuth } from "@/hooks/useAuth";
import PricingSection from "@/components/marketing/PricingSection";
import type { SubscriptionPlan } from "@shared/subscriptions";

export default function PlansPage() {
  const { user } = useAuth();
  return <div className="mx-auto max-w-7xl py-3"><div className="mb-7"><p className="text-sm font-semibold text-blue-600">Your plan</p><h1 className="mt-2 text-3xl font-bold">Choose the Tickd that fits your work</h1><p className="mt-2 text-sm text-gray-600">You can review all plans here. Secure billing will be connected in the next step.</p></div><PricingSection compact currentPlan={(user?.subscriptionPlan || "free") as SubscriptionPlan} /></div>;
}
