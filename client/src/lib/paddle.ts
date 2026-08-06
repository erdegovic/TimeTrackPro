import { initializePaddle, type Paddle, type PaddleEventData } from "@paddle/paddle-js";
import type { PaddlePaidPlan } from "@shared/paddle-billing";

export type PaddleBillingConfig = {
  enabled: boolean;
  environment: "sandbox" | "production";
  clientToken: string | null;
  priceIds: Record<PaddlePaidPlan, string | null>;
  proPriceId: string | null;
  ultimatePriceId: string | null;
  customerId: string | null;
  checkoutToken: string | null;
  email: string;
};

let paddlePromise: Promise<Paddle | undefined> | null = null;
const checkoutCompletedListeners = new Set<() => void>();

const notifyCheckoutEvent = (event: PaddleEventData) => {
  if (event.name === "checkout.completed") {
    checkoutCompletedListeners.forEach((listener) => listener());
  }
};

const loadPaddle = (config: PaddleBillingConfig) => {
  if (!config.clientToken) throw new Error("Paddle checkout is not configured.");
  if (!paddlePromise) {
    paddlePromise = initializePaddle({
      token: config.clientToken,
      environment: config.environment,
      ...(config.customerId ? { pwCustomer: { id: config.customerId } } : {}),
      eventCallback: notifyCheckoutEvent,
    });
  }
  return paddlePromise;
};

export const getPaddleBillingConfig = async (): Promise<PaddleBillingConfig> => {
  const response = await fetch("/api/billing/config", { credentials: "include" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Billing could not be loaded.");
  return result;
};

export const openPlanCheckout = async (plan: PaddlePaidPlan, onCompleted: () => void) => {
  const config = await getPaddleBillingConfig();
  const priceId = config.priceIds?.[plan]
    || (plan === "pro" ? config.proPriceId : config.ultimatePriceId);
  if (!config.enabled || !priceId || !config.checkoutToken) {
    throw new Error("Secure checkout is not available yet.");
  }

  const paddle = await loadPaddle(config);
  if (!paddle) throw new Error("Paddle checkout could not be loaded.");

  checkoutCompletedListeners.add(onCompleted);
  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customer: { email: config.email },
    customData: { tickd_checkout_token: config.checkoutToken, tickd_plan: plan },
    settings: {
      displayMode: "overlay",
      theme: "light",
      locale: "en",
      allowLogout: false,
      successUrl: `${window.location.origin}/plans?checkout=complete`,
    },
  });

  return () => checkoutCompletedListeners.delete(onCompleted);
};

export const changePaddlePlan = async (plan: PaddlePaidPlan) => {
  const response = await fetch("/api/billing/change-plan", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "The subscription could not be changed.");
  return result as { plan: PaddlePaidPlan; status: string; effective: "immediate" | "next_billing_period" };
};

export const openBillingPortal = async () => {
  const response = await fetch("/api/billing/portal", {
    method: "POST",
    credentials: "include",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Billing management could not be opened.");
  window.location.assign(result.url);
};
