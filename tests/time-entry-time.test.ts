import assert from "node:assert/strict";
import test from "node:test";
import { resolveTimeRange } from "../client/src/lib/time-entry-time";

const at = (hours: number, minutes: number, day = 10) => new Date(2026, 4, day, hours, minutes);

test("parses compact 24-hour values", () => {
  const result = resolveTimeRange("1430", "1600", at(14, 0), at(16, 0));
  assert.equal(result?.start.getHours(), 14);
  assert.equal(result?.start.getMinutes(), 30);
  assert.equal(result?.end.getHours(), 16);
});

test("uses existing afternoon context for ambiguous compact values", () => {
  const result = resolveTimeRange("0230", "4:00", at(14, 0), at(16, 0));
  assert.equal(result?.start.getHours(), 14);
  assert.equal(result?.end.getHours(), 16);
});

test("supports spaced meridiem input", () => {
  const result = resolveTimeRange("2:30 pm", "3:45pm", at(14, 0), at(15, 30));
  assert.equal(result?.start.getHours(), 14);
  assert.equal(result?.end.getMinutes(), 45);
});

test("allows a logical interval that crosses midnight", () => {
  const result = resolveTimeRange("11:30pm", "1:00am", at(23, 15), at(1, 0, 11));
  assert.equal(result?.end.getDate(), 11);
  assert.equal((result!.end.getTime() - result!.start.getTime()) / 3_600_000, 1.5);
});

test("rejects invalid clock text", () => {
  assert.equal(resolveTimeRange("25:10", "26:00", at(10, 0), at(11, 0)), null);
});
