import assert from "node:assert/strict";
import test from "node:test";
import {
  applyInvoiceAutomationAdjustments,
  buildAutomationLineItems,
  estimateAiCostMicros,
  getNextMonthlyRun,
  getPreviousMonthPeriod,
  getZonedDateRunAt,
  renderAutomationTemplate,
} from "../shared/ultimate";

test("invoice automation groups matching entries across a month", () => {
  const rows = buildAutomationLineItems([
    { id: 1, date: "2026-07-02", description: "Design", duration: "0.64", projectId: 3, projectName: "Website", hourlyRate: "50" },
    { id: 2, date: "2026-07-18", description: " design ", duration: "1.36", projectId: 3, projectName: "Website", hourlyRate: "50" },
  ], false);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].hours, 2);
  assert.equal(rows[0].amount, 100);
  assert.deepEqual(rows[0].timeEntryIds, [1, 2]);
});

test("weekly invoice automation keeps matching work in separate weeks", () => {
  const rows = buildAutomationLineItems([
    { id: 1, date: "2026-07-02", description: "Design", duration: "1", projectId: 3, hourlyRate: "50" },
    { id: 2, date: "2026-07-18", description: "Design", duration: "1", projectId: 3, hourlyRate: "50" },
  ], true);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].weekLabel, rows[1].weekLabel);
});

test("previous-month range and next run are deterministic", () => {
  assert.deepEqual(getPreviousMonthPeriod(new Date("2026-08-06T12:00:00Z")), { startDate: "2026-07-01", endDate: "2026-07-31" });
  assert.equal(getNextMonthlyRun(new Date("2026-08-06T12:00:00Z"), 10, 9, "UTC").toISOString(), "2026-08-10T09:00:00.000Z");
  assert.equal(getNextMonthlyRun(new Date("2026-08-16T12:00:00Z"), 10, 9, "UTC").toISOString(), "2026-09-10T09:00:00.000Z");
  assert.equal(getNextMonthlyRun(new Date("2026-08-06T12:00:00Z"), 10, 9, "Europe/Belgrade").toISOString(), "2026-08-10T07:00:00.000Z");
});

test("one-time preparation dates honor the user's timezone", () => {
  assert.equal(getZonedDateRunAt("2026-08-10", 9, "UTC").toISOString(), "2026-08-10T09:00:00.000Z");
  assert.equal(getZonedDateRunAt("2026-08-10", 9, "Europe/Belgrade").toISOString(), "2026-08-10T07:00:00.000Z");
});

test("invoice automation applies percentage before rounding hours upward", () => {
  const [adjusted] = applyInvoiceAutomationAdjustments([{
    key: "design",
    description: "Design",
    projectId: 1,
    projectName: "Website",
    hours: 0.64,
    rate: 50,
    amount: 32,
    dates: ["2026-07-02"],
    timeEntryIds: [1],
  }], { percentageIncreaseEnabled: true, percentageIncrease: 10, roundHoursUp: true });
  assert.equal(adjusted.hours, 0.8);
  assert.equal(adjusted.amount, 40);
});

test("saved invoice email templates preserve unknown placeholders", () => {
  assert.equal(
    renderAutomationTemplate("Hello {clientName}: {periodStart} {futureField}", { clientName: "Alex", periodStart: "2026-07-01" }),
    "Hello Alex: 2026-07-01 {futureField}",
  );
});

test("AI cost estimation uses micro-dollars", () => {
  assert.equal(estimateAiCostMicros("gpt-5.4-nano", 20_000, 2_000), 6_500);
  assert.equal(estimateAiCostMicros("gpt-5.4-mini", 20_000, 2_000), 24_000);
});
