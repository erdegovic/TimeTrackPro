import assert from "node:assert/strict";
import test from "node:test";
import { extractTickdCheckoutToken, hasPaidPaddleStatus, resolvePaddlePlan, resolvePaddlePrice } from "../shared/paddle-billing";

test("Paddle custom data accepts only opaque Tickd checkout tokens", () => {
  const token = "UjM3NGRpV3RKT2QxSXNLNVE3OUc0VlJvNWVxSmpmOXc";
  assert.equal(extractTickdCheckoutToken({ tickd_checkout_token: token }), token);
  assert.equal(extractTickdCheckoutToken({ tickd_checkout_token: "short" }), null);
  assert.equal(extractTickdCheckoutToken({ tickd_checkout_token: "invalid token with spaces" }), null);
  assert.equal(extractTickdCheckoutToken({ tickd_checkout_token: 42 }), null);
  assert.equal(extractTickdCheckoutToken(null), null);
});

test("Paddle access statuses preserve retry grace but reject inactive plans", () => {
  assert.equal(hasPaidPaddleStatus("active"), true);
  assert.equal(hasPaidPaddleStatus("trialing"), true);
  assert.equal(hasPaidPaddleStatus("past_due"), true);
  assert.equal(hasPaidPaddleStatus("paused"), false);
  assert.equal(hasPaidPaddleStatus("canceled"), false);
});

test("Paddle line items resolve paid plans from configured price IDs", () => {
  const prices = { pro: "pri_pro", ultimate: "pri_ultimate" };

  assert.equal(resolvePaddlePlan([{ price: { id: "pri_pro" } }], prices), "pro");
  assert.equal(resolvePaddlePlan([{ price: { id: "pri_ultimate" } }], prices), "ultimate");
  assert.equal(resolvePaddlePlan([{ price: { id: "pri_unknown" } }], prices), null);
  assert.equal(resolvePaddlePlan([
    { price: { id: "pri_pro" } },
    { price: { id: "pri_ultimate" } },
  ], prices), null);
});

test("Paddle line items resolve both plan and billing interval", () => {
  const prices = {
    pro: { monthly: "pri_pro_monthly", annual: "pri_pro_annual" },
    ultimate: { monthly: "pri_ultimate_monthly", annual: "pri_ultimate_annual" },
  };

  assert.deepEqual(resolvePaddlePrice([{ price: { id: "pri_pro_annual" } }], prices), {
    plan: "pro",
    billingInterval: "annual",
  });
  assert.deepEqual(resolvePaddlePrice([{ price: { id: "pri_ultimate_monthly" } }], prices), {
    plan: "ultimate",
    billingInterval: "monthly",
  });
  assert.equal(resolvePaddlePrice([{ price: { id: "pri_unknown" } }], prices), null);
  assert.equal(resolvePaddlePrice([
    { price: { id: "pri_pro_monthly" } },
    { price: { id: "pri_pro_annual" } },
  ], prices), null);
});
