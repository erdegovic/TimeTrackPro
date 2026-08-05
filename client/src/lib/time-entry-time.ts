export type ResolvedTimeRange = { start: Date; end: Date };

function withClock(baseDate: Date, hours: number, minutes: number) {
  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function clockCandidates(input: string, baseDate: Date): Date[] {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, "");
  const match = normalized.match(/^(\d{1,2})(?::?(\d{2}))?(am|pm)?$/);
  if (!match) return [];

  const rawHours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3];
  if (!Number.isInteger(rawHours) || !Number.isInteger(minutes) || minutes > 59) return [];

  if (meridiem) {
    if (rawHours < 1 || rawHours > 12) return [];
    const hours = (rawHours % 12) + (meridiem === "pm" ? 12 : 0);
    return [withClock(baseDate, hours, minutes)];
  }

  if (rawHours > 23) return [];
  if (rawHours >= 13 || rawHours === 0) return [withClock(baseDate, rawHours, minutes)];

  return [
    withClock(baseDate, rawHours, minutes),
    withClock(baseDate, rawHours + 12, minutes),
  ];
}

/** Resolve ambiguous clock text by choosing the valid range closest to the entry being edited. */
export function resolveTimeRange(
  startInput: string,
  endInput: string,
  existingStart: Date,
  existingEnd: Date,
): ResolvedTimeRange | null {
  const startCandidates = clockCandidates(startInput, existingStart);
  const endCandidates = clockCandidates(endInput, existingStart);
  if (!startCandidates.length || !endCandidates.length) return null;

  const existingDuration = existingEnd.getTime() - existingStart.getTime();
  const existingCrossesMidnight = existingEnd.getDate() !== existingStart.getDate();
  let best: { range: ResolvedTimeRange; score: number } | null = null;

  for (const start of startCandidates) {
    for (const sameDayEnd of endCandidates) {
      const endings = [sameDayEnd];
      const nextDayEnd = new Date(sameDayEnd);
      nextDayEnd.setDate(nextDayEnd.getDate() + 1);
      endings.push(nextDayEnd);

      for (const end of endings) {
        const duration = end.getTime() - start.getTime();
        if (duration <= 0 || duration > 24 * 60 * 60 * 1000) continue;

        const crossesMidnight = end.getDate() !== start.getDate();
        const distance = Math.abs(start.getTime() - existingStart.getTime())
          + Math.abs(end.getTime() - existingEnd.getTime());
        const durationDistance = Math.abs(duration - existingDuration) * 1.5;
        const midnightPenalty = crossesMidnight && !existingCrossesMidnight ? 6 * 60 * 60 * 1000 : 0;
        const score = distance + durationDistance + midnightPenalty;

        if (!best || score < best.score) best = { range: { start, end }, score };
      }
    }
  }

  return best?.range || null;
}
