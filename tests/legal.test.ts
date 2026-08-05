import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  legalAcceptanceSchema,
} from "../shared/legal";

test("current legal acceptance is valid", () => {
  const result = legalAcceptanceSchema.safeParse({
    acceptedTerms: true,
    termsVersion: CURRENT_TERMS_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
  });

  assert.equal(result.success, true);
});

test("legal acceptance rejects unchecked and stale versions", () => {
  assert.equal(legalAcceptanceSchema.safeParse({
    acceptedTerms: false,
    termsVersion: CURRENT_TERMS_VERSION,
    privacyVersion: CURRENT_PRIVACY_VERSION,
  }).success, false);

  assert.equal(legalAcceptanceSchema.safeParse({
    acceptedTerms: true,
    termsVersion: "2025-01-01",
    privacyVersion: CURRENT_PRIVACY_VERSION,
  }).success, false);
});
