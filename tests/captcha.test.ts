import assert from "node:assert/strict";
import test from "node:test";
import { validateCaptcha } from "../server/utils/captcha";

const response = (success: boolean, ok = true) => ({
  ok,
  json: async () => ({ success }),
}) as Response;

test("production CAPTCHA validation fails closed without a secret", async () => {
  assert.equal(await validateCaptcha("token", { isProduction: true, secretKey: "" }), false);
});

test("development can run without CAPTCHA credentials", async () => {
  assert.equal(await validateCaptcha("token", { isProduction: false, secretKey: "" }), true);
});

test("CAPTCHA tokens are verified with Google's Siteverify endpoint", async () => {
  let submittedBody = "";
  const fetchImpl: typeof fetch = async (_input, init) => {
    submittedBody = String(init?.body);
    return response(true);
  };

  assert.equal(await validateCaptcha("verified-token", {
    fetchImpl,
    isProduction: true,
    secretKey: "private-key",
  }), true);
  assert.match(submittedBody, /secret=private-key/);
  assert.match(submittedBody, /response=verified-token/);
});

test("CAPTCHA validation rejects failed and unavailable verification", async () => {
  const rejectedFetch: typeof fetch = async () => response(false);
  const unavailableFetch: typeof fetch = async () => response(false, false);

  assert.equal(await validateCaptcha("bad-token", {
    fetchImpl: rejectedFetch,
    isProduction: true,
    secretKey: "private-key",
  }), false);
  assert.equal(await validateCaptcha("token", {
    fetchImpl: unavailableFetch,
    isProduction: true,
    secretKey: "private-key",
  }), false);
});
