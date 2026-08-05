import { z } from "zod";

export const CURRENT_TERMS_VERSION = "2026-08-05";
export const CURRENT_PRIVACY_VERSION = "2026-08-05";

export const legalAcceptanceSchema = z.object({
  acceptedTerms: z.literal(true),
  termsVersion: z.literal(CURRENT_TERMS_VERSION),
  privacyVersion: z.literal(CURRENT_PRIVACY_VERSION),
});

