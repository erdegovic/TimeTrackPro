import { initializePaddle, type Paddle, type PaddleEventData } from "@paddle/paddle-js";

export type PaddleBillingConfig = {
  enabled: boolean;
  environment: "sandbox" | "production";
  clientToken: string | null;
  proPriceId: string | null;
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

export const openProCheckout = async (onCompleted: () => void) => {
  const config = await getPaddleBillingConfig();
  if (!config.enabled || !config.proPriceId || !config.checkoutToken) {
    throw new Error("Secure checkout is not available yet.");
  }

  const paddle = await loadPaddle(config);
  if (!paddle) throw new Error("Paddle checkout could not be loaded.");

  checkoutCompletedListeners.add(onCompleted);
  paddle.Checkout.open({
    items: [{ priceId: config.proPriceId, quantity: 1 }],
    customer: { email: config.email },
    customData: { tickd_checkout_token: config.checkoutToken, tickd_plan: "pro" },
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

export const openBillingPortal = async () => {
  const response = await fetch("/api/billing/portal", {
    method: "POST",
    credentials: "include",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Billing management could not be opened.");
  window.location.assign(result.url);
};
