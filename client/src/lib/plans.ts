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
    description: "Automated billing for a growing client list.",
    features: ["Everything in Pro", "Scheduled invoice generation", "Automatic client delivery", "Recurring billing workflows", "Priority support"],
    available: false,
    emphasis: "Coming soon",
  },
];

export const getPlanDetails = (plan?: string | null) =>
  planDetails.find((item) => item.id === plan) || planDetails[0];
