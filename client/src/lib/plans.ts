import type { SubscriptionPlan } from "@shared/subscriptions";

export type PlanDetails = {
  id: SubscriptionPlan;
  name: string;
  price: string;
  description: string;
  features: string[];
  available: boolean;
  emphasis?: string;
};

export const planDetails: PlanDetails[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    description: "A focused timer for independent work.",
    features: ["Unlimited time tracking", "Clients and projects", "Weekly activity dashboard", "Manual time editing"],
    available: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$3.99",
    description: "Turn tracked work into polished client billing.",
    features: ["Everything in Free", "Detailed reports and exports", "Custom invoice generation", "Currencies and client templates", "Business and invoice settings"],
    available: true,
    emphasis: "Best for freelancers",
  },
  {
    id: "ultimate",
    name: "Ultimate",
    price: "$8.99",
    description: "Let Tickd prepare the admin around your work.",
    features: ["Everything in Pro", "AI time-entry polish", "Work reviews and client summaries", "Client-specific language and tone", "Smart recurring invoices", "Approval queue and automatic delivery"],
    available: false,
    emphasis: "Coming soon",
  },
];

export const getPlanDetails = (plan?: string | null) =>
  planDetails.find((item) => item.id === plan) || planDetails[0];
