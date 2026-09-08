import assert from "node:assert/strict";
import test from "node:test";
import { getCompleteReportMonthRange } from "../shared/report-periods";

const mayReferenceDate = new Date(2026, 4, 15, 12, 0, 0);

test("report periods default to the complete previous calendar month", () => {
  assert.deepEqual(getCompleteReportMonthRange(1, mayReferenceDate), {
    startDate: "2026-04-01",
    endDate: "2026-04-30",
  });
});

test("multi-month report periods include complete months and exclude the current partial month", () => {
  assert.deepEqual(getCompleteReportMonthRange(3, mayReferenceDate), {
    startDate: "2026-02-01",
    endDate: "2026-04-30",
  });
  assert.deepEqual(getCompleteReportMonthRange(12, mayReferenceDate), {
    startDate: "2025-05-01",
    endDate: "2026-04-30",
  });
});
