export const extractTickdCheckoutToken = (customData: unknown): string | null => {
  if (!customData || typeof customData !== "object") return null;
  const value = (customData as Record<string, unknown>).tickd_checkout_token;
  if (typeof value !== "string") return null;
  return /^[A-Za-z0-9_-]{32,128}$/.test(value) ? value : null;
};

export const hasPaidPaddleStatus = (status: string) =>
  ["active", "trialing", "past_due"].includes(status.toLowerCase());
