import assert from "node:assert/strict";
import test from "node:test";
import {
  isRegistrationPlan,
  isSubscriptionPlan,
  subscriptionPlanRank,
} from "../shared/subscriptions";

test("registration accepts available plans and rejects coming-soon plans", () => {
  assert.equal(isRegistrationPlan("free"), true);
  assert.equal(isRegistrationPlan("pro"), true);
  assert.equal(isRegistrationPlan("ultimate"), false);
});

test("subscription plans preserve a stable downgrade order", () => {
  assert.equal(isSubscriptionPlan("ultimate"), true);
  assert.equal(isSubscriptionPlan("enterprise"), false);
  assert.ok(subscriptionPlanRank.ultimate > subscriptionPlanRank.pro);
  assert.ok(subscriptionPlanRank.pro > subscriptionPlanRank.free);
});
