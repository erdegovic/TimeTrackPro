import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";

export type ReportDatePreset = "previous_month" | "last_3_months" | "last_6_months" | "last_12_months" | "custom";

export function getCompleteReportMonthRange(monthCount: number, today = new Date()) {
  if (!Number.isInteger(monthCount) || monthCount < 1 || monthCount > 12) {
    throw new Error("Report month count must be between 1 and 12.");
  }

  const previousMonth = subMonths(today, 1);
  return {
    startDate: format(startOfMonth(subMonths(previousMonth, monthCount - 1)), "yyyy-MM-dd"),
    endDate: format(endOfMonth(previousMonth), "yyyy-MM-dd"),
  };
}
