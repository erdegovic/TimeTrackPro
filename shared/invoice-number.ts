export type InvoiceNumberOptions = {
  prefix?: string | null;
  suffix?: string | null;
  padding?: number | string | null;
};

export function formatInvoiceNumber(
  nextNumber: number | string | null | undefined,
  options: InvoiceNumberOptions = {}
) {
  const numericValue = Number(nextNumber) || 1;
  const padding = Math.max(0, Number(options.padding ?? 4) || 0);
  const numberPart = numericValue.toString().padStart(padding, "0");
  const prefix = options.prefix ?? "INV-";
  const suffix = options.suffix ?? "";

  return `${prefix}${numberPart}${suffix}`;
}
