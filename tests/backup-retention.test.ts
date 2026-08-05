import assert from "node:assert/strict";
import test from "node:test";
import { selectSnapshotsToDelete } from "../server/backups/retention";

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
