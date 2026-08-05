import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { planDetails } from "@/lib/plans";
import type { SubscriptionPlan } from "@shared/subscriptions";
import { openProCheckout } from "@/lib/paddle";
import { queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

type PricingSectionProps = {
  currentPlan?: SubscriptionPlan;
  compact?: boolean;
  autoCheckout?: boolean;
};

export default function PricingSection({ currentPlan, compact = false, autoCheckout = false }: PricingSectionProps) {
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false);
  const autoCheckoutStarted = useRef(false);

  const refreshSubscription = async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 400 : 1200));
      const response = await fetch("/api/auth/user", { credentials: "include" });
      if (!response.ok) continue;
      const user = await response.json();
      queryClient.setQueryData(["/api/auth/user"], user);
      if (user.subscriptionPlan === "pro" && ["active", "trialing", "past_due"].includes(user.subscriptionStatus)) {
        toast({ title: "Welcome to Tickd Pro", description: "Invoice exports and Pro billing tools are now unlocked." });
        setIsOpeningCheckout(false);
        return;
      }
    }
    setIsOpeningCheckout(false);
    toast({ title: "Payment received", description: "Paddle is still confirming your subscription. Refresh this page in a moment." });
  };

  const startProCheckout = async () => {
    if (isOpeningCheckout) return;
    setIsOpeningCheckout(true);
    let removeListener: () => void = () => {};
    try {
      removeListener = await openProCheckout(() => {
        removeListener();
        void refreshSubscription();
      });
      setIsOpeningCheckout(false);
    } catch (error) {
      setIsOpeningCheckout(false);
      toast({
        variant: "destructive",
        title: "Checkout unavailable",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  useEffect(() => {
    if (autoCheckout && currentPlan === "free" && !autoCheckoutStarted.current) {
      autoCheckoutStarted.current = true;
      void startProCheckout();
    }
  }, [autoCheckout, currentPlan]);

  return (
    <section className={compact ? "py-4" : "bg-[#f8fafc] py-20 sm:py-28"} id="pricing">
      <div className={compact ? "" : "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"}>
        {!compact && (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-20">
            <div>
              <p className="text-sm font-bold text-[#096cfb]">Simple pricing</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight text-[#071127] sm:text-5xl">Start free. Upgrade when billing saves you time.</h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-[#667085] lg:pb-1">No crowded bundles and no hidden extras. Choose the plan that matches the work you do today.</p>
          </div>
        )}
        <div className={`grid gap-4 ${compact ? "lg:grid-cols-3" : "mt-12 lg:grid-cols-3 lg:items-stretch"}`}>
          {planDetails.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            const isHighlighted = !compact && plan.id === "pro";
            const mutedText = isHighlighted ? "text-[#aebbd0]" : "text-[#667085]";
            return (
              <article key={plan.id} className={`relative flex min-h-[420px] flex-col rounded-md border p-7 ${isHighlighted ? "border-[#071127] bg-[#071127] text-white shadow-[0_24px_70px_rgba(7,17,39,0.2)]" : "border-[#d8e0ea] bg-white text-[#101828]"}`}>
                {plan.emphasis && <span className={`absolute right-5 top-5 rounded-md px-2.5 py-1 text-xs font-bold ${isHighlighted ? "bg-[#1473ff] text-white" : plan.available ? "bg-[#edf4ff] text-[#096cfb]" : "bg-[#f0f2f5] text-[#667085]"}`}>{plan.emphasis}</span>}
                <div className="pr-24">
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  <div className="mt-7 flex items-end gap-1"><span className="text-4xl font-semibold tracking-tight">{plan.price}</span><span className={`pb-1 text-sm ${mutedText}`}>/ month</span></div>
                  <p className={`mt-5 min-h-[48px] text-sm leading-6 ${mutedText}`}>{plan.description}</p>
                </div>
                <ul className="mt-7 flex-1 space-y-3.5 border-t border-current/10 pt-7">
                  {plan.features.map((feature) => <li key={feature} className={`flex gap-2.5 text-sm ${isHighlighted ? "text-[#d7deea]" : "text-[#475467]"}`}><Check className={`mt-0.5 h-4 w-4 shrink-0 ${isHighlighted ? "text-[#6ee7b7]" : "text-[#199473]"}`} />{feature}</li>)}
                </ul>
                {isCurrent ? (
                  <Button className="mt-7" variant="outline" disabled>Current plan</Button>
                ) : currentPlan ? (
                  plan.id === "free" ? <Button className="mt-7" variant="outline" asChild><Link href="/account?tab=subscription">Manage current plan</Link></Button> : plan.id === "pro" ? <Button className="mt-7" onClick={startProCheckout} disabled={isOpeningCheckout}>{isOpeningCheckout ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening checkout</> : "Upgrade to Pro"}</Button> : <Button className="mt-7" disabled>Coming soon</Button>
                ) : (
                  plan.available ? <Button className={`mt-7 rounded-md ${isHighlighted ? "bg-white text-[#071127] hover:bg-[#edf4ff]" : ""}`} variant={plan.id === "pro" ? "default" : "outline"} asChild><Link href={`/register?plan=${plan.id}`}>{plan.id === "free" ? "Start free" : "Choose Pro"}</Link></Button> : <Button className="mt-7 rounded-md" variant="outline" disabled>Coming soon</Button>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
