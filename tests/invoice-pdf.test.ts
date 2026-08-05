import assert from "node:assert/strict";
import test from "node:test";
import { createInvoicePdf } from "../client/src/lib/invoice-pdf";
import type { InvoiceTemplateData } from "../client/src/lib/invoice-html-generator";

const sampleInvoice: InvoiceTemplateData = {
  template: "professional",
  businessName: "Northstar Studio",
  businessMeta: "Design services",
  businessAddress: "1 Main Street",
  businessEmail: "hello@example.com",
  businessPhone: "",
  invoiceNumber: "INV-1042",
  issueDate: "August 5, 2026",
  dueDate: "September 5, 2026",
  clientName: "Alex Morgan",
  clientAddress: "42 Market Road",
  clientCity: "London",
  clientState: "",
  clientZip: "SW1",
  clientEmail: "alex@example.com",
  lineItems: [
    {
      description: "Product design",
      subDescription: "Website refresh",
      qty: "12.50 h",
      rate: "GBP 75.00",
      amount: "GBP 937.50",
    },
  ],
  subtotalFormatted: "937.50",
  taxFormatted: "0.00",
  taxLabel: "Tax",
  totalFormatted: "937.50",
  notes: "Thank you for your business.",
  showNotes: true,
  currency: "GBP",
  paymentDetails: "IBAN: GB00 TEST",
  showPaymentDetails: true,
};

test("invoice PDF contains selectable text instead of a flattened page image", () => {
  const pdf = createInvoicePdf(sampleInvoice);
  const bytes = Buffer.from(pdf.output("arraybuffer"));

  assert.ok(bytes.length > 5_000);
  assert.equal(bytes.includes(Buffer.from("Northstar Studio")), true);
  assert.equal(bytes.includes(Buffer.from("Product design")), true);
  assert.equal(bytes.includes(Buffer.from("GBP 937.50")), true);
  assert.equal(bytes.includes(Buffer.from("/Subtype /Image")), false);
});

test("free invoice PDF carries a native preview watermark", () => {
  const pdf = createInvoicePdf({ ...sampleInvoice, watermarkPreview: true });
  const bytes = Buffer.from(pdf.output("arraybuffer"));

  assert.equal(bytes.includes(Buffer.from("TICKD FREE PREVIEW")), true);
});
