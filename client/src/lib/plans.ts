import type { SubscriptionPlan } from "@shared/subscriptions";

export type PlanDetails = {
  id: SubscriptionPlan;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  annualDiscount: number;
  description: string;
  features: string[];
  available: boolean;
  emphasis?: string;
};

export const planDetails: PlanDetails[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    annualDiscount: 0,
    description: "A focused timer for independent work.",
    features: ["Unlimited time tracking", "Clients and projects", "Weekly activity dashboard", "Manual time editing"],
    available: true,
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 3.99,
    annualPrice: 35.99,
    annualDiscount: 25,
    description: "Turn tracked work into polished client billing.",
    features: ["Everything in Free", "Detailed reports and exports", "Custom invoice generation", "Currencies and client templates", "Business and invoice settings"],
    available: true,
    emphasis: "Best for freelancers",
  },
  {
    id: "ultimate",
    name: "Ultimate",
    monthlyPrice: 8.99,
    annualPrice: 74.99,
    annualDiscount: 30,
    description: "Let Tickd prepare the admin around your work.",
    features: ["Everything in Pro", "AI time-entry polish", "Work reviews and client summaries", "Client-specific language and tone", "Smart recurring invoices", "Approval queue and automatic delivery"],
    available: true,
    emphasis: "AI + automation",
  },
];

export const getPlanDetails = (plan?: string | null) =>
  planDetails.find((item) => item.id === plan) || planDetails[0];
