import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateManualItemAmount,
  normalizeManualInvoiceItem,
} from "../shared/invoice-line-items";

test("legacy flat invoice items remain compatible as one quantity at the stored amount", () => {
  const item = normalizeManualInvoiceItem({
    id: 1,
    description: "Print proofs",
    amount: 48,
  }, 1);

  assert.equal(item.billingType, "quantity");
  assert.equal(item.quantity, 1);
  assert.equal(item.rate, 48);
  assert.equal(item.amount, 48);
});

test("hourly invoice items calculate hours multiplied by hourly rate", () => {
  const item = normalizeManualInvoiceItem({
    billingType: "hourly",
    description: "Consulting",
    hours: 2.5,
    rate: 80,
  }, "hourly");

  assert.equal(item.hours, 2.5);
  assert.equal(item.quantity, undefined);
  assert.equal(calculateManualItemAmount(item), 200);
});

test("quantity invoice items calculate quantity multiplied by unit price", () => {
  const item = normalizeManualInvoiceItem({
    billingType: "quantity",
    description: "Licences",
    quantity: 3,
    rate: 19.99,
  }, "quantity");

  assert.equal(item.quantity, 3);
  assert.equal(item.hours, undefined);
  assert.equal(calculateManualItemAmount(item), 59.97);
});
