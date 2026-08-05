import assert from "node:assert/strict";
import test from "node:test";
import {
  selectRedundantScheduledSnapshotsToDelete,
  selectSnapshotsToDelete,
} from "../server/backups/retention";

const now = new Date("2026-08-05T12:00:00.000Z");
const candidate = (id: string, timestamp: string) => ({ id, createdAt: new Date(timestamp) });

test("retention keeps every snapshot from the last seven days", () => {
  const snapshots = [
    candidate("recent-1", "2026-08-05T00:00:00.000Z"),
    candidate("recent-2", "2026-08-04T12:00:00.000Z"),
    candidate("recent-3", "2026-07-30T13:00:00.000Z"),
  ];
  assert.deepEqual(selectSnapshotsToDelete(snapshots, now), []);
});

test("retention keeps one daily snapshot after seven days", () => {
  const snapshots = [
    candidate("newer", "2026-07-25T18:00:00.000Z"),
    candidate("older", "2026-07-25T06:00:00.000Z"),
  ];
  assert.deepEqual(selectSnapshotsToDelete(snapshots, now).map((item) => item.id), ["older"]);
});

test("retention removes snapshots older than a year", () => {
  const snapshots = [candidate("expired", "2025-07-01T00:00:00.000Z")];
  assert.deepEqual(selectSnapshotsToDelete(snapshots, now).map((item) => item.id), ["expired"]);
});

test("scheduled retention removes overlapping instance snapshots", () => {
  const snapshots = [
    { id: "newest", reason: "scheduled", createdAt: new Date("2026-08-05T10:02:00Z") },
    { id: "duplicate", reason: "scheduled", createdAt: new Date("2026-08-05T10:00:00Z") },
    { id: "manual", reason: "manual", createdAt: new Date("2026-08-05T09:59:00Z") },
    { id: "previous", reason: "scheduled", createdAt: new Date("2026-08-04T22:00:00Z") },
  ];

  assert.deepEqual(
    selectRedundantScheduledSnapshotsToDelete(snapshots, 9 * 60 * 60 * 1000).map((item) => item.id),
    ["duplicate"],
  );
});
