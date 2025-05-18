import { format, getWeekOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { TimeEntry, Invoice } from "@shared/schema";

/**
 * Generates a unique invoice number based on the next invoice number
 * @param nextNumber - The next invoice number
 * @returns Formatted invoice number string
 */
export function generateInvoiceNumber(nextNumber: number): string {
  return `INV-${nextNumber}`;
}

/**
 * Generates the invoice due date based on the issue date and payment terms
 * @param issueDate - The issue date
 * @param dueDays - Number of days until the invoice is due
 * @returns Due date string in YYYY-MM-DD format
 */
export function generateDueDate(issueDate: string, dueDays: number): string {
  const date = new Date(issueDate);
  date.setDate(date.getDate() + dueDays);
  return format(date, 'yyyy-MM-dd');
}

/**
 * Categorizes time entries by week of the month
 * @param timeEntries - Array of time entries
 * @returns Grouped entries by week
 */
export function groupEntriesByWeek(timeEntries: TimeEntry[]): Record<string, TimeEntry[]> {
  const groupedEntries: Record<string, TimeEntry[]> = {};
  
  timeEntries.forEach(entry => {
    const date = new Date(entry.date);
    const weekOfMonth = getWeekOfMonth(date);
    const weekStart = format(startOfWeek(date), 'MMM d');
    const weekEnd = format(endOfWeek(date), 'MMM d');
    const weekKey = `Week ${weekOfMonth} (${weekStart} - ${weekEnd})`;
    
    if (!groupedEntries[weekKey]) {
      groupedEntries[weekKey] = [];
    }
    
    groupedEntries[weekKey].push(entry);
  });
  
  return groupedEntries;
}

/**
 * Calculates subtotal for a set of time entries
 * @param timeEntries - Array of time entries with hourly rates
 * @returns Total amount
 */
export function calculateSubtotal(timeEntries: (TimeEntry & { hourlyRate?: string | number })[]): number {
  return timeEntries.reduce((total, entry) => {
    const duration = Number(entry.duration || 0);
    const rate = Number(entry.hourlyRate || 0);
    return total + (duration * rate);
  }, 0);
}

/**
 * Calculates tax amount based on subtotal and tax rate
 * @param subtotal - Subtotal amount
 * @param taxRate - Tax rate percentage
 * @returns Tax amount
 */
export function calculateTax(subtotal: number, taxRate: number): number {
  return subtotal * (taxRate / 100);
}

/**
 * Calculates invoice total (subtotal + tax)
 * @param subtotal - Subtotal amount
 * @param tax - Tax amount
 * @returns Total amount
 */
export function calculateTotal(subtotal: number, tax: number): number {
  return subtotal + tax;
}

/**
 * Formats a currency amount according to the specified currency
 * @param amount - Numeric amount
 * @param currency - Currency code (e.g., USD, EUR)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}
