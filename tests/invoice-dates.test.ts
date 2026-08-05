import assert from "node:assert/strict";
import test from "node:test";
import { calculateDueDate } from "../client/src/lib/invoice-dates";

test("defaults to one calendar month", () => {
  assert.equal(calculateDueDate("2026-01-31", "calendar_month"), "2026-02-28");
});

test("supports exact payment-day terms", () => {
  assert.equal(calculateDueDate("2026-05-10", "days", 45), "2026-06-24");
});
