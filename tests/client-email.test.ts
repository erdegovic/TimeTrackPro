import assert from "node:assert/strict";
import test from "node:test";
import { clientContactEmailSchema, insertClientSchema, insertProjectSchema } from "../shared/schema";

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

test("project invoice email accepts custom domains when the override is enabled", () => {
  const project = insertProjectSchema.parse({
    name: "Website",
    clientId: 4,
    customInvoiceEmailEnabled: true,
    customInvoiceEmail: " invoices@website.internal ",
  });
  assert.equal(project.customInvoiceEmail, "invoices@website.internal");
});

test("project invoice email is required only while the override is enabled", () => {
  assert.equal(insertProjectSchema.safeParse({
    name: "Website",
    clientId: 4,
    customInvoiceEmailEnabled: true,
    customInvoiceEmail: "",
  }).success, false);
  assert.equal(insertProjectSchema.safeParse({
    name: "Website",
    clientId: 4,
    customInvoiceEmailEnabled: false,
    customInvoiceEmail: "",
  }).success, true);
});
