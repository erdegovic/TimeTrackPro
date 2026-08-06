import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

const isProduction = process.env.NODE_ENV === "production";

export const SESSION_COOKIE_NAME = isProduction ? "__Host-tickd.sid" : "tickd.sid";

export const sessionCookieOptions = {
  maxAge: 24 * 60 * 60 * 1000,
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
};

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: [
        "'self'",
        "https://*.paddle.com",
        "https://paddle.com",
        "https://www.google.com",
        "https://www.gstatic.com",
        "https://www.recaptcha.net",
      ],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      formAction: ["'self'", "https://*.paddle.com", "https://paddle.com"],
      frameAncestors: ["'none'"],
      frameSrc: [
        "'self'",
        "https://*.paddle.com",
        "https://paddle.com",
        "https://www.google.com",
        "https://recaptcha.google.com",
        "https://www.recaptcha.net",
      ],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      objectSrc: ["'none'"],
      scriptSrc: [
        "'self'",
        "https://cdn.paddle.com",
        "https://*.paddle.com",
        "https://www.google.com",
        "https://www.gstatic.com",
      ],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: isProduction
    ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
    : false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xFrameOptions: { action: "deny" },
});

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function allowedOrigins(): Set<string> {
  const configured = [
    process.env.PUBLIC_APP_URL,
    process.env.APP_BASE_URL,
    ...(process.env.ALLOWED_ORIGINS || "").split(","),
  ];

  return new Set(
    ["https://tickd.me", "https://www.tickd.me", ...configured]
      .map((value) => normalizeOrigin(value?.trim()))
      .filter((value): value is string => Boolean(value)),
  );
}

type RequestTrustInput = {
  method: string;
  fetchSite?: string;
  origin?: string;
  referer?: string;
};

export function isTrustedStateChangingRequest(
  input: RequestTrustInput,
  origins: Set<string>,
) {
  if (["GET", "HEAD", "OPTIONS"].includes(input.method.toUpperCase())) return true;
  if (input.fetchSite?.toLowerCase() === "cross-site") return false;

  const requestOrigin = normalizeOrigin(input.origin);
  if (requestOrigin) return origins.has(requestOrigin);

  const refererOrigin = normalizeOrigin(input.referer);
  if (refererOrigin) return origins.has(refererOrigin);

  const fetchSite = input.fetchSite?.toLowerCase();
  return fetchSite === "same-origin" || fetchSite === "same-site";
}

export function protectStateChangingApiRequests(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!isProduction || ["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const origins = allowedOrigins();
  const trusted = isTrustedStateChangingRequest({
    method: req.method,
    fetchSite: req.get("Sec-Fetch-Site"),
    origin: req.get("Origin"),
    referer: req.get("Referer"),
  }, origins);

  return trusted
    ? next()
    : res.status(403).json({ message: "Request origin could not be verified" });
}

function createLimiter(windowMs: number, limit: number, message: string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message },
  });
}

export const apiLimiter = createLimiter(
  15 * 60 * 1000,
  600,
  "Too many requests. Please wait a moment and try again.",
);

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
});

export const registrationLimiter = createLimiter(
  60 * 60 * 1000,
  10,
  "Too many registration attempts. Please try again later.",
);

export const accountRecoveryLimiter = createLimiter(
  15 * 60 * 1000,
  5,
  "Too many account recovery attempts. Please try again in 15 minutes.",
);

export const emailVerificationLimiter = createLimiter(
  15 * 60 * 1000,
  10,
  "Too many verification attempts. Please wait before trying again.",
);

export const contactLimiter = createLimiter(
  60 * 60 * 1000,
  5,
  "Too many contact requests. Please try again later.",
);

export const adminLimiter = createLimiter(
  15 * 60 * 1000,
  180,
  "Too many admin requests. Please wait a moment and try again.",
);
