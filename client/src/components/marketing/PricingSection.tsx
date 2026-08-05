import { Check } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { planDetails } from "@/lib/plans";
import type { SubscriptionPlan } from "@shared/subscriptions";

type PricingSectionProps = {
  currentPlan?: SubscriptionPlan;
  compact?: boolean;
};

export default function PricingSection({ currentPlan, compact = false }: PricingSectionProps) {
  return (
    <section className={compact ? "py-4" : "bg-[#f7f9fc] py-20 sm:py-24"} id="pricing">
      <div className={compact ? "" : "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"}>
        {!compact && (
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-blue-600">Simple pricing</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Start free. Upgrade when billing saves you time.</h2>
            <p className="mt-4 text-base leading-7 text-gray-600">No crowded bundles. Choose the plan that matches the work you do today.</p>
          </div>
        )}
        <div className={`grid gap-4 ${compact ? "lg:grid-cols-3" : "mt-12 lg:grid-cols-3"}`}>
          {planDetails.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            return (
              <article key={plan.id} className={`relative flex min-h-[410px] flex-col rounded-lg border bg-white p-6 ${plan.id === "pro" ? "border-blue-500 shadow-[0_10px_35px_rgba(36,116,245,0.12)]" : "border-gray-200"}`}>
                {plan.emphasis && <span className={`absolute right-4 top-4 rounded-full px-2.5 py-1 text-xs font-semibold ${plan.available ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{plan.emphasis}</span>}
                <div className="pr-24">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <div className="mt-5 flex items-end gap-1"><span className="text-4xl font-bold">{plan.price}</span><span className="pb-1 text-sm text-gray-500">/ month</span></div>
                  <p className="mt-4 min-h-[48px] text-sm leading-6 text-gray-600">{plan.description}</p>
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => <li key={feature} className="flex gap-2.5 text-sm text-gray-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />{feature}</li>)}
                </ul>
                {isCurrent ? (
                  <Button className="mt-7" variant="outline" disabled>Current plan</Button>
                ) : currentPlan ? (
                  plan.id === "free" ? <Button className="mt-7" variant="outline" asChild><Link href="/account?tab=subscription">Downgrade to Free</Link></Button> : <Button className="mt-7" disabled>{plan.available ? "Billing coming next" : "Coming soon"}</Button>
                ) : (
                  plan.available ? <Button className="mt-7" variant={plan.id === "pro" ? "default" : "outline"} asChild><Link href={`/register?plan=${plan.id}`}>{plan.id === "free" ? "Start free" : "Choose Pro"}</Link></Button> : <Button className="mt-7" variant="outline" disabled>Coming soon</Button>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
