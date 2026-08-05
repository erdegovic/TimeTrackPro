import { addDays, addMonths, format, isValid, parseISO } from "date-fns";

export type DueDateMode = "calendar_month" | "days" | "manual";

export function toInvoiceDateInput(value?: string | null) {
  if (!value) return format(new Date(), "yyyy-MM-dd");
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return isValid(parsed) ? format(parsed, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
}

export function calculateDueDate(issueDate: string, mode: Exclude<DueDateMode, "manual">, days = 30) {
  const issue = parseISO(issueDate);
  if (!isValid(issue)) return issueDate;
  return format(mode === "calendar_month" ? addMonths(issue, 1) : addDays(issue, Math.max(1, days)), "yyyy-MM-dd");
}

export function formatInvoiceDate(value: string) {
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, "MMMM d, yyyy") : value;
}
