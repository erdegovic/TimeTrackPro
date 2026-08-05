export type RetentionCandidate = {
  id: string;
  createdAt: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isoWeekKey(date: Date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((value.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Keeps every snapshot for seven days, then one per day for thirty days,
 * one per week for ninety days, and one per month for a year.
 */
export function selectSnapshotsToDelete(
  candidates: RetentionCandidate[],
  now = new Date(),
): RetentionCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const retainedBuckets = new Set<string>();

  return sorted.filter((candidate) => {
    const ageDays = Math.max(0, (now.getTime() - candidate.createdAt.getTime()) / DAY_MS);
    if (ageDays <= 7) return false;
    if (ageDays > 365) return true;

    let bucket: string;
    if (ageDays <= 30) {
      bucket = `day:${candidate.createdAt.toISOString().slice(0, 10)}`;
    } else if (ageDays <= 90) {
      bucket = `week:${isoWeekKey(candidate.createdAt)}`;
    } else {
      bucket = `month:${candidate.createdAt.toISOString().slice(0, 7)}`;
    }

    if (retainedBuckets.has(bucket)) return true;
    retainedBuckets.add(bucket);
    return false;
  });
}
