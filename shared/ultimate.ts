import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";

export type AutomationSourceEntry = {
  id: number;
  date: string;
  description: string;
  duration: string | number | null;
  projectId?: number | null;
  projectName?: string | null;
  hourlyRate?: string | number | null;
};

export type AutomationLineItem = {
  key: string;
  description: string;
  projectId: number | null;
  projectName: string;
  hours: number;
  rate: number;
  amount: number;
  dates: string[];
  timeEntryIds: number[];
  weekLabel?: string;
};

const normalizedDescription = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

const getMondayWeek = (dateString: string) => {
  const date = new Date(`${dateString}T12:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    key: format(date, "yyyy-MM-dd"),
    label: `${format(date, "MMM d")} - ${format(end, "MMM d")}`,
  };
};

export function buildAutomationLineItems(
  entries: AutomationSourceEntry[],
  groupByWeek: boolean,
): AutomationLineItem[] {
  const grouped = new Map<string, AutomationLineItem>();

  for (const entry of entries) {
    const week = groupByWeek ? getMondayWeek(entry.date) : null;
    const projectId = entry.projectId || null;
    const description = entry.description.trim() || "Tracked work";
    const key = [
      week?.key || "period",
      normalizedDescription(description),
      projectId || "no-project",
    ].join(":");
    const hours = Math.max(0, Number(entry.duration || 0));
    const rate = Math.max(0, Number(entry.hourlyRate || 0));
    const current = grouped.get(key);

    if (current) {
      current.hours += hours;
      current.amount += hours * rate;
      current.timeEntryIds.push(entry.id);
      if (!current.dates.includes(entry.date)) current.dates.push(entry.date);
      continue;
    }

    grouped.set(key, {
      key,
      description,
      projectId,
      projectName: entry.projectName || "",
      hours,
      rate,
      amount: hours * rate,
      dates: [entry.date],
      timeEntryIds: [entry.id],
      weekLabel: week?.label,
    });
  }

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      hours: Number(item.hours.toFixed(6)),
      amount: Number(item.amount.toFixed(2)),
      dates: item.dates.sort(),
    }))
    .sort((a, b) => (a.dates[0] || "").localeCompare(b.dates[0] || ""));
}

export function getPreviousMonthPeriod(anchor = new Date()) {
  const previous = subMonths(anchor, 1);
  return {
    startDate: format(startOfMonth(previous), "yyyy-MM-dd"),
    endDate: format(endOfMonth(previous), "yyyy-MM-dd"),
  };
}

export function getNextMonthlyRun(
  after: Date,
  billingDay: number,
  sendHour: number,
  timeZone = "UTC",
): Date {
  const day = Math.min(28, Math.max(1, Math.trunc(billingDay)));
  const hour = Math.min(23, Math.max(0, Math.trunc(sendHour)));

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });
  const partsFor = (date: Date) => Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  const zonedToUtc = (year: number, month: number, targetDay: number) => {
    const target = Date.UTC(year, month - 1, targetDay, hour, 0, 0);
    let candidate = new Date(target);

    // Two passes account for an offset change close to a DST transition.
    for (let pass = 0; pass < 2; pass += 1) {
      const parts = partsFor(candidate);
      const represented = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      );
      candidate = new Date(candidate.getTime() + target - represented);
    }
    return candidate;
  };

  const current = partsFor(after);
  let year = current.year;
  let month = current.month;
  let candidate = zonedToUtc(year, month, day);
  if (candidate <= after) {
    const followingMonth = new Date(Date.UTC(year, month, 1));
    year = followingMonth.getUTCFullYear();
    month = followingMonth.getUTCMonth() + 1;
    candidate = zonedToUtc(year, month, day);
  }
  return candidate;
}

export const estimateAiCostMicros = (
  model: string,
  inputTokens: number,
  outputTokens: number,
) => {
  const isMini = model.includes("mini");
  const inputPerMillion = isMini ? 0.75 : 0.2;
  const outputPerMillion = isMini ? 4.5 : 1.25;
  return Math.ceil(
    ((Math.max(0, inputTokens) * inputPerMillion) +
      (Math.max(0, outputTokens) * outputPerMillion)),
  );
};
