/**
 * Pure helpers shared by the `/api/v1` time endpoints. No database access here so
 * the aggregation can be unit-tested and reused.
 */

export type SummaryGroupBy = "project" | "client" | "day";

/** A time entry after joining project / client / settings. Hours are decimal. */
export type EnrichedTimeEntry = {
  id: number;
  description: string;
  projectId: number | null;
  projectName: string | null;
  clientId: number | null;
  clientName: string | null;
  startTime: string;
  endTime: string | null;
  hours: number;
  billable: boolean;
  hourlyRate: number;
  amount: number;
  currency: string;
  date: string;
  invoiceId: number | null;
  running: boolean;
};

export type SummaryGroup = {
  key: string;
  name: string;
  hours: number;
  billableHours: number;
  amount: number;
  currency: string;
  /** present when a group mixes currencies (only possible for groupBy=day) */
  amountByCurrency?: Record<string, number>;
};

export type TimeSummary = {
  from: string | null;
  to: string | null;
  groupBy: SummaryGroupBy;
  hours: number;
  billableHours: number;
  amountByCurrency: Record<string, number>;
  entryCount: number;
  groups: SummaryGroup[];
};

const round = (value: number, digits = 4) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Hours for a stored entry: stored duration wins, else start/end difference, else 0. */
export function entryHours(entry: { duration: string | number | null; startTime: Date | string; endTime: Date | string | null }): number {
  if (entry.duration !== null && entry.duration !== undefined && entry.duration !== "") {
    const parsed = Number(entry.duration);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (entry.startTime && entry.endTime) {
    const start = new Date(entry.startTime).getTime();
    const end = new Date(entry.endTime).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) return (end - start) / 3_600_000;
  }
  return 0;
}

export function buildTimeSummary(
  entries: EnrichedTimeEntry[],
  groupBy: SummaryGroupBy,
  range: { from?: string | null; to?: string | null } = {},
): TimeSummary {
  const amountByCurrency: Record<string, number> = {};
  const groups = new Map<string, SummaryGroup>();
  let hours = 0;
  let billableHours = 0;

  for (const entry of entries) {
    if (entry.running) continue;
    hours += entry.hours;
    if (entry.billable) {
      billableHours += entry.hours;
      amountByCurrency[entry.currency] = (amountByCurrency[entry.currency] ?? 0) + entry.amount;
    }

    let key: string;
    let name: string;
    if (groupBy === "project") {
      key = entry.projectId ? String(entry.projectId) : "none";
      name = entry.projectName ?? (entry.clientName ? `${entry.clientName} (no project)` : "No project");
    } else if (groupBy === "client") {
      key = entry.clientId ? String(entry.clientId) : "none";
      name = entry.clientName ?? "No client";
    } else {
      key = entry.date;
      name = entry.date;
    }

    let group = groups.get(key);
    if (!group) {
      group = { key, name, hours: 0, billableHours: 0, amount: 0, currency: entry.currency };
      groups.set(key, group);
    }
    group.hours += entry.hours;
    if (entry.billable) {
      group.billableHours += entry.hours;
      group.amount += entry.amount;
      if (group.currency !== entry.currency) {
        group.amountByCurrency = group.amountByCurrency ?? { [group.currency]: group.amount - entry.amount };
      }
      if (group.amountByCurrency) {
        group.amountByCurrency[entry.currency] = (group.amountByCurrency[entry.currency] ?? 0) + entry.amount;
      }
    }
  }

  const ordered = [...groups.values()].map((group) => ({
    ...group,
    hours: round(group.hours),
    billableHours: round(group.billableHours),
    amount: round(group.amount, 2),
    amountByCurrency: group.amountByCurrency
      ? Object.fromEntries(Object.entries(group.amountByCurrency).map(([currency, amount]) => [currency, round(amount, 2)]))
      : undefined,
  }));
  if (groupBy === "day") ordered.sort((a, b) => a.key.localeCompare(b.key));
  else ordered.sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));

  return {
    from: range.from ?? null,
    to: range.to ?? null,
    groupBy,
    hours: round(hours),
    billableHours: round(billableHours),
    amountByCurrency: Object.fromEntries(Object.entries(amountByCurrency).map(([currency, amount]) => [currency, round(amount, 2)])),
    entryCount: entries.filter((entry) => !entry.running).length,
    groups: ordered,
  };
}

/** YYYY-MM-DD for `date` in an IANA time zone (falls back to UTC on bad zones). */
export function dateInTimeZone(date: Date, timeZone: string | undefined | null): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
