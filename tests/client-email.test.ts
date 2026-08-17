import assert from "node:assert/strict";
import test from "node:test";
import { clientContactEmailSchema, insertClientSchema } from "../shared/schema";

test("client emails accept private and custom domains", () => {
  assert.equal(clientContactEmailSchema.parse("billing@studio"), "billing@studio");
  assert.equal(clientContactEmailSchema.parse(" invoices@client.corp "), "invoices@client.corp");
  assert.equal(insertClientSchema.parse({ name: "Custom client", email: "hello@brand.local" }).email, "hello@brand.local");
});

test("client emails still reject malformed addresses", () => {
  for (const email of ["missing-at.example", "@example.com", "name@", "name @example.com", "name@example .com"]) {
    assert.equal(clientContactEmailSchema.safeParse(email).success, false);
  }
});

test("client email remains optional", () => {
  assert.equal(insertClientSchema.parse({ name: "No email" }).email, undefined);
  assert.equal(insertClientSchema.parse({ name: "Empty email", email: "" }).email, "");
});
