export type InvoiceBillingType = "hourly" | "quantity";

export type ManualInvoiceItem = {
  id: number | string;
  description: string;
  billingType: InvoiceBillingType;
  hours?: number;
  quantity?: number;
  rate: number;
  amount: number;
  isTimeEntry?: boolean;
  timeEntryId?: number;
  timeEntryIds?: number[];
  [key: string]: unknown;
};

function nonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getManualItemUnits(item: Partial<ManualInvoiceItem>): number {
  return item.billingType === "quantity"
    ? nonNegativeNumber(item.quantity)
    : nonNegativeNumber(item.hours);
}

export function calculateManualItemAmount(item: Partial<ManualInvoiceItem>): number {
  return Number((getManualItemUnits(item) * nonNegativeNumber(item.rate)).toFixed(2));
}

export function normalizeManualInvoiceItem(
  input: Record<string, unknown>,
  fallbackId: number | string,
): ManualInvoiceItem {
  const billingType: InvoiceBillingType = input.billingType === "quantity"
    ? "quantity"
    : input.billingType === "hourly" || input.isTimeEntry === true || input.hours !== undefined
      ? "hourly"
      : "quantity";
  const legacyAmount = nonNegativeNumber(input.amount);
  const suppliedRate = nonNegativeNumber(input.rate, Number.NaN);
  const rawUnits = billingType === "hourly" ? input.hours ?? input.quantity : input.quantity ?? input.hours;
  const units = nonNegativeNumber(rawUnits, legacyAmount > 0 ? 1 : 0);
  const rate = Number.isFinite(suppliedRate)
    ? suppliedRate
    : units > 0
      ? Number((legacyAmount / units).toFixed(2))
      : legacyAmount;

  const normalized: ManualInvoiceItem = {
    ...input,
    id: (input.id as number | string | undefined) ?? fallbackId,
    description: String(input.description || (billingType === "hourly" ? "Additional service" : "Additional item")),
    billingType,
    rate,
    amount: Number((units * rate).toFixed(2)),
  };

  if (billingType === "hourly") {
    normalized.hours = units;
    delete normalized.quantity;
  } else {
    normalized.quantity = units;
    delete normalized.hours;
  }

  return normalized;
}

export function createManualInvoiceItem(
  billingType: InvoiceBillingType,
  id: number | string = Date.now(),
): ManualInvoiceItem {
  return normalizeManualInvoiceItem({
    id,
    billingType,
    description: billingType === "hourly" ? "Additional service" : "Additional item",
    [billingType === "hourly" ? "hours" : "quantity"]: 1,
    rate: 0,
  }, id);
}
