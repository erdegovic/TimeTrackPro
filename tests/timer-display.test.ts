import assert from "node:assert/strict";
import test from "node:test";
import { formatTime, formatTimerTitle } from "../client/src/lib/utils/timeUtils";

test("timer durations use HH:MM:SS", () => {
  assert.equal(formatTime(5), "00:00:05");
  assert.equal(formatTime(4_502), "01:15:02");
});

test("running timer title includes the elapsed duration", () => {
  assert.equal(formatTimerTitle(4_502.9), "01:15:02 · Tickd");
  assert.equal(formatTimerTitle(-2), "00:00:00 · Tickd");
});
