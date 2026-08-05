import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmailVerificationChallenge,
  isEmailVerificationChallengeToken,
  verifyEmailVerificationCode,
} from "../server/utils/email-verification-code";
import { getRegistrationEmailContent } from "../server/utils/email-service";

test("email verification challenges store a hash instead of the six-digit code", () => {
  const challenge = createEmailVerificationChallenge();

  assert.match(challenge.code, /^\d{6}$/);
  assert.equal(isEmailVerificationChallengeToken(challenge.token), true);
  assert.equal(challenge.token.includes(challenge.code), false);
  assert.equal(verifyEmailVerificationCode(challenge.token, challenge.code), true);
  assert.equal(verifyEmailVerificationCode(challenge.token, "000000"), false);
});

test("verification challenges reject malformed tokens and codes", () => {
  const challenge = createEmailVerificationChallenge();

  assert.equal(verifyEmailVerificationCode(challenge.token, "12345"), false);
  assert.equal(verifyEmailVerificationCode("legacy-token", challenge.code), false);
  assert.equal(isEmailVerificationChallengeToken(`${challenge.token}.extra`), false);
});

test("registration email presents the code and opens the code-entry page", () => {
  const html = getRegistrationEmailContent(
    "stored-token",
    "https://tickd.me",
    "482731",
    "new.user@example.com",
  );

  assert.match(html, /482731/);
  assert.match(html, /Enter verification code/);
  assert.match(html, /registration-success\?email=new\.user%40example\.com/);
  assert.doesNotMatch(html, /verify-email\?token=stored-token/);
});
