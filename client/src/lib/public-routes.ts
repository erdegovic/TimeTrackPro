const publicRoutePrefixes = [
  "/login",
  "/register",
  "/verify-email",
  "/verify-email-change",
  "/forgot-password",
  "/reset-password",
  "/registration-success",
  "/unverified-email",
  "/pricing",
  "/how-it-works",
  "/faq",
  "/help",
  "/contact",
  "/terms",
  "/privacy",
];

export function isPublicRoute(location: string) {
  if (location === "/") return true;
  return publicRoutePrefixes.some((path) => location === path || location.startsWith(`${path}/`));
}
