import assert from "node:assert/strict";
import test from "node:test";
import { buildTimeSummary, dateInTimeZone, entryHours, type EnrichedTimeEntry } from "../shared/time-summary";

const entry = (overrides: Partial<EnrichedTimeEntry>): EnrichedTimeEntry => ({
  id: 1,
  description: "work",
  projectId: 10,
  projectName: "Website",
  clientId: 100,
  clientName: "Acme",
  startTime: "2026-08-10T08:00:00.000Z",
  endTime: "2026-08-10T10:00:00.000Z",
  hours: 2,
  billable: true,
  hourlyRate: 50,
  amount: 100,
  currency: "EUR",
  date: "2026-08-10",
  invoiceId: null,
  running: false,
  ...overrides,
});

test("entryHours prefers the stored duration, then start/end", () => {
  assert.equal(entryHours({ duration: "1.5", startTime: "2026-08-10T08:00:00Z", endTime: "2026-08-10T12:00:00Z" }), 1.5);
  assert.equal(entryHours({ duration: null, startTime: "2026-08-10T08:00:00Z", endTime: "2026-08-10T10:30:00Z" }), 2.5);
  assert.equal(entryHours({ duration: null, startTime: "2026-08-10T08:00:00Z", endTime: null }), 0);
});

test("summary totals, billable split and per-currency amounts", () => {
  const entries = [
    entry({ id: 1 }),
    entry({ id: 2, hours: 1, amount: 50, billable: false }),
    entry({ id: 3, projectId: 11, projectName: "App", clientId: 101, clientName: "Globex", hours: 2.5, amount: 200, hourlyRate: 80, currency: "USD", date: "2026-08-11" }),
    entry({ id: 4, running: true, hours: 0, amount: 0 }),
  ];
  const summary = buildTimeSummary(entries, "project", { from: "2026-08-10", to: "2026-08-11" });
  assert.equal(summary.hours, 5.5);
  assert.equal(summary.billableHours, 4.5);
  assert.deepEqual(summary.amountByCurrency, { EUR: 100, USD: 200 });
  assert.equal(summary.entryCount, 3);
  assert.equal(summary.groups.length, 2);
  const website = summary.groups.find((group) => group.key === "10")!;
  assert.equal(website.name, "Website");
  assert.equal(website.hours, 3);
  assert.equal(website.billableHours, 2);
  assert.equal(website.amount, 100);
  assert.equal(website.currency, "EUR");
  assert.equal(summary.groups[0].key, "10"); // most hours first
});

test("summary groups by client and by day", () => {
  const entries = [
    entry({ id: 1 }),
    entry({ id: 2, projectId: 12, projectName: "Other", hours: 1, amount: 50, date: "2026-08-12" }),
    entry({ id: 3, projectId: null, projectName: null, clientId: null, clientName: null, hours: 0.5, amount: 0, hourlyRate: 0 }),
  ];
  const byClient = buildTimeSummary(entries, "client");
  assert.deepEqual(byClient.groups.map((group) => [group.key, group.hours]), [["100", 3], ["none", 0.5]]);
  assert.equal(byClient.groups[1].name, "No client");

  const byDay = buildTimeSummary(entries, "day");
  assert.deepEqual(byDay.groups.map((group) => group.key), ["2026-08-10", "2026-08-12"]);
  assert.equal(byDay.groups[0].hours, 2.5);
});

test("a day mixing currencies exposes amountByCurrency", () => {
  const entries = [entry({ id: 1 }), entry({ id: 2, currency: "USD", amount: 80, hours: 1 })];
  const byDay = buildTimeSummary(entries, "day");
  assert.deepEqual(byDay.groups[0].amountByCurrency, { EUR: 100, USD: 80 });
});

test("dateInTimeZone resolves the local calendar day", () => {
  const lateEvening = new Date("2026-08-10T22:30:00.000Z");
  assert.equal(dateInTimeZone(lateEvening, "UTC"), "2026-08-10");
  assert.equal(dateInTimeZone(lateEvening, "Europe/Belgrade"), "2026-08-11");
  assert.equal(dateInTimeZone(lateEvening, "Not/AZone"), "2026-08-10");
});
