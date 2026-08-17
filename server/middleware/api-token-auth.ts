import type { NextFunction, Request, Response } from "express";
import { resolveApiToken, touchApiToken } from "../api-tokens";
import { extractBearerToken, looksLikeApiToken } from "@shared/api-tokens";

declare global {
  namespace Express {
    interface Request {
      /** Set by `apiTokenAuth` when a valid `Authorization: Bearer tk_…` header is present. */
      apiUser?: { id: number; tokenId: number };
    }
  }
}

/**
 * Token authentication for `/api/v1`. Never consults the session cookie, so it is
 * not CSRF-prone and can be mounted outside `protectStateChangingApiRequests`.
 */
export async function apiTokenAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.get("authorization"));
  if (!token || !looksLikeApiToken(token)) {
    res.setHeader("WWW-Authenticate", 'Bearer realm="tickd-api"');
    return res.status(401).json({ message: "Missing or malformed API token" });
  }

  try {
    const resolved = await resolveApiToken(token);
    if (!resolved) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="tickd-api", error="invalid_token"');
      return res.status(401).json({ message: "Invalid, expired, or revoked API token" });
    }
    req.apiUser = { id: resolved.userId, tokenId: resolved.tokenId };
    touchApiToken(resolved.tokenId);
    return next();
  } catch (error) {
    console.error("[api-token-auth] lookup failed", error);
    return res.status(500).json({ message: "Token verification failed" });
  }
}
