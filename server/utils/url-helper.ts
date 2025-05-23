import { Request } from 'express';

// The production domain to use
const PRODUCTION_DOMAIN = 'https://tickd.me';

/**
 * Gets the base URL for verification links and other external-facing URLs
 * Uses the production domain in production, and the request's hostname in development
 */
export function getBaseUrl(req: Request): string {
  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_DOMAIN;
  } else {
    // For development environment, use the request's protocol and hostname
    return `${req.protocol}://${req.hostname}`;
  }
}