import crypto from "crypto";

const TOKEN_PREFIX = "email-code-v1";
const CODE_PATTERN = /^\d{6}$/;

const verificationSecret = () => process.env.EMAIL_VERIFICATION_SECRET
  || process.env.SESSION_SECRET
  || "tickd-local-email-verification-secret";

const hashCode = (nonce: string, code: string) => crypto
  .createHmac("sha256", verificationSecret())
  .update(`${nonce}:${code}`)
  .digest("hex");

export function createEmailVerificationChallenge(): { code: string; token: string } {
  const code = crypto.randomInt(100_000, 1_000_000).toString();
  const nonce = crypto.randomBytes(32).toString("hex");
  return {
    code,
    token: `${TOKEN_PREFIX}.${nonce}.${hashCode(nonce, code)}`,
  };
}

export function isEmailVerificationChallengeToken(token: string): boolean {
  const [prefix, nonce, digest, ...rest] = token.split(".");
  return prefix === TOKEN_PREFIX
    && /^[a-f0-9]{64}$/i.test(nonce || "")
    && /^[a-f0-9]{64}$/i.test(digest || "")
    && rest.length === 0;
}

export function verifyEmailVerificationCode(token: string, candidate: string): boolean {
  const normalizedCandidate = candidate.trim();
  if (!CODE_PATTERN.test(normalizedCandidate) || !isEmailVerificationChallengeToken(token)) {
    return false;
  }

  const [, nonce, storedDigest] = token.split(".");
  const candidateDigest = hashCode(nonce, normalizedCandidate);
  return crypto.timingSafeEqual(Buffer.from(storedDigest, "hex"), Buffer.from(candidateDigest, "hex"));
}
