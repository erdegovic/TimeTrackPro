import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminGrantedSubscriptionStatus,
  getInvoiceCapabilities,
  getUltimateCapabilities,
  isRegistrationPlan,
  isSubscriptionPlan,
  subscriptionPlanRank,
} from "../shared/subscriptions";

test("registration accepts available plans and rejects coming-soon plans", () => {
  assert.equal(isRegistrationPlan("free"), true);
  assert.equal(isRegistrationPlan("pro"), true);
  assert.equal(isRegistrationPlan("ultimate"), false);
});

test("invoice access keeps Free previews visible but watermarked", () => {
  assert.deepEqual(getInvoiceCapabilities("free", "active"), {
    canPreview: true,
    canSave: false,
    canExport: false,
    watermarkPreview: true,
  });
});

test("active and complimentary paid plans can save and export invoices", () => {
  assert.equal(getInvoiceCapabilities("pro", "active").canExport, true);
  assert.equal(getInvoiceCapabilities("pro", "complimentary").canSave, true);
  assert.equal(getInvoiceCapabilities("ultimate", "active").watermarkPreview, false);
});

test("inactive paid subscriptions fall back to Free invoice access", () => {
  assert.equal(getInvoiceCapabilities("pro", "canceled").canExport, false);
  assert.equal(getInvoiceCapabilities("pro", "expired").watermarkPreview, true);
  assert.equal(getInvoiceCapabilities("ultimate", "unpaid").canSave, false);
  assert.equal(getInvoiceCapabilities("pro", "pending").canSave, false);
  assert.equal(getInvoiceCapabilities("pro", "paused").canSave, false);
});

test("past-due subscriptions retain access while Paddle retries payment", () => {
  assert.equal(getInvoiceCapabilities("pro", "past_due").canExport, true);
});

test("subscription plans preserve a stable downgrade order", () => {
  assert.equal(isSubscriptionPlan("ultimate"), true);
  assert.equal(isSubscriptionPlan("enterprise"), false);
  assert.ok(subscriptionPlanRank.ultimate > subscriptionPlanRank.pro);
  assert.ok(subscriptionPlanRank.pro > subscriptionPlanRank.free);
});

test("admin grants distinguish complimentary access from the free plan", () => {
  assert.equal(getAdminGrantedSubscriptionStatus("free"), "active");
  assert.equal(getAdminGrantedSubscriptionStatus("pro"), "complimentary");
  assert.equal(getAdminGrantedSubscriptionStatus("ultimate"), "complimentary");
});

test("Ultimate tools require an active or complimentary Ultimate plan", () => {
  assert.equal(getUltimateCapabilities("ultimate", "active").canUseAi, true);
  assert.equal(getUltimateCapabilities("ultimate", "complimentary").canAutomateInvoices, true);
  assert.equal(getUltimateCapabilities("pro", "active").canUseAi, false);
  assert.equal(getUltimateCapabilities("ultimate", "canceled").canAutomateInvoices, false);
});
