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
  isCustom?: boolean;
};

export type InvoiceAutomationProfile = {
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
  roundHoursUp: boolean;
  percentageIncreaseEnabled: boolean;
  percentageIncrease: number;
  replyToEmail: string;
  replyToName: string;
};

export const DEFAULT_INVOICE_EMAIL_SUBJECT = "Invoice for {periodStart} to {periodEnd}";
export const DEFAULT_INVOICE_EMAIL_BODY = "Hello {clientName},\n\nPlease find the attached invoice for work completed from {periodStart} to {periodEnd}.\n\nThank you.";

export function renderAutomationTemplate(
  template: string,
  values: Record<string, string>,
) {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (match, key) => values[key] ?? match);
}

export function applyInvoiceAutomationAdjustments(
  items: AutomationLineItem[],
  options: { roundHoursUp?: boolean; percentageIncreaseEnabled?: boolean; percentageIncrease?: number },
) {
  const percentage = options.percentageIncreaseEnabled
    ? Math.min(500, Math.max(0, Number(options.percentageIncrease || 0)))
    : 0;

  return items.map((item) => {
    const increasedHours = Math.max(0, item.hours) * (1 + percentage / 100);
    const hours = options.roundHoursUp
      ? Math.ceil((increasedHours - Number.EPSILON) * 10) / 10
      : Number(increasedHours.toFixed(6));
    return {
      ...item,
      hours,
      amount: Number((hours * Math.max(0, item.rate)).toFixed(2)),
    };
  });
}

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

const getZonedFormatter = (timeZone: string) => new Intl.DateTimeFormat("en-US", {
  timeZone,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

const getZonedParts = (date: Date, timeZone: string) => Object.fromEntries(
  getZonedFormatter(timeZone)
    .formatToParts(date)
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)]),
) as Record<string, number>;

const zonedDateTimeToUtc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
) => {
  const target = Date.UTC(year, month - 1, day, hour, 0, 0);
  let candidate = new Date(target);

  // Two passes account for an offset change close to a DST transition.
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = getZonedParts(candidate, timeZone);
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

export function getZonedDateRunAt(
  dateString: string,
  sendHour: number,
  timeZone = "UTC",
) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) throw new Error("Choose a valid preparation date.");
  const hour = Math.min(23, Math.max(0, Math.trunc(sendHour)));
  return zonedDateTimeToUtc(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    hour,
    timeZone,
  );
}

export function getNextMonthlyRun(
  after: Date,
  billingDay: number,
  sendHour: number,
  timeZone = "UTC",
): Date {
  const day = Math.min(28, Math.max(1, Math.trunc(billingDay)));
  const hour = Math.min(23, Math.max(0, Math.trunc(sendHour)));
  const current = getZonedParts(after, timeZone);
  let year = current.year;
  let month = current.month;
  let candidate = zonedDateTimeToUtc(year, month, day, hour, timeZone);
  if (candidate <= after) {
    const followingMonth = new Date(Date.UTC(year, month, 1));
    year = followingMonth.getUTCFullYear();
    month = followingMonth.getUTCMonth() + 1;
    candidate = zonedDateTimeToUtc(year, month, day, hour, timeZone);
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
