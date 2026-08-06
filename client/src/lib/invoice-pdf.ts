import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import {
  getInvoiceLabels,
  getInvoiceUnitsLabel,
  InvoiceTemplateData,
  TEMPLATE_COLOR_DEFAULTS,
} from "./invoice-html-generator";

type Rgb = [number, number, number];

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 18;

function hexToRgb(value: string | undefined, fallback: Rgb): Rgb {
  if (!value) return fallback;
  const hex = value.trim().replace(/^#/, "");
  const normalized = hex.length === 3
    ? hex.split("").map((character) => character + character).join("")
    : hex;
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return fallback;
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
}

function mix(color: Rgb, target: Rgb, amount: number): Rgb {
  return color.map((channel, index) =>
    Math.round(channel + (target[index] - channel) * amount),
  ) as Rgb;
}

function contrastText(color: Rgb): Rgb {
  const luminance = (0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]) / 255;
  return luminance > 0.62 ? [20, 28, 39] : [255, 255, 255];
}

function plainText(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fitText(doc: jsPDF, text: string, maxWidth: number, initialSize: number, minimumSize = 8): number {
  let size = initialSize;
  doc.setFontSize(size);
  while (size > minimumSize && doc.getTextWidth(text) > maxWidth) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  return size;
}

function drawTextBlock(
  doc: jsPDF,
  title: string,
  content: string,
  x: number,
  y: number,
  width: number,
  primary: Rgb,
): number {
  const body = plainText(content);
  if (!body) return y;
  const lines = doc.splitTextToSize(body, width - 8) as string[];
  const height = Math.max(22, 12 + lines.length * 4.1);

  doc.setFillColor(...mix(primary, [255, 255, 255], 0.95));
  doc.setDrawColor(...mix(primary, [255, 255, 255], 0.7));
  doc.roundedRect(x, y, width, height, 2, 2, "FD");
  doc.setFillColor(...primary);
  doc.rect(x, y, 2, height, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...primary);
  doc.text(title.toUpperCase(), x + 6, y + 6.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(72, 82, 96);
  doc.text(lines, x + 6, y + 12, { lineHeightFactor: 1.25 });
  return y + height;
}

function drawPageDecoration(
  doc: jsPDF,
  data: InvoiceTemplateData,
  primary: Rgb,
  accent: Rgb,
  background: Rgb,
): void {
  doc.setFillColor(...background);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  switch (data.template) {
    case "professional":
      doc.setFillColor(...primary);
      doc.rect(0, 0, 13, PAGE_HEIGHT, "F");
      break;
    case "graphic":
      doc.setFillColor(...primary);
      doc.rect(0, 0, 22, PAGE_HEIGHT, "F");
      doc.setFillColor(...accent);
      doc.rect(17, 0, 5, PAGE_HEIGHT, "F");
      break;
    case "media":
      doc.setFillColor(...primary);
      doc.rect(0, 0, PAGE_WIDTH, 31, "F");
      doc.setFillColor(...accent);
      doc.rect(0, 31, PAGE_WIDTH, 2.5, "F");
      break;
    case "avant":
      doc.setFillColor(...primary);
      doc.rect(0, 0, PAGE_WIDTH * 0.55, 6, "F");
      doc.setFillColor(...accent);
      doc.rect(PAGE_WIDTH * 0.55, 0, PAGE_WIDTH * 0.45, 6, "F");
      break;
    case "classic":
      doc.setDrawColor(...primary);
      doc.setLineWidth(0.7);
      doc.rect(8, 8, PAGE_WIDTH - 16, PAGE_HEIGHT - 16);
      doc.setDrawColor(...accent);
      doc.setLineWidth(0.2);
      doc.rect(10.5, 10.5, PAGE_WIDTH - 21, PAGE_HEIGHT - 21);
      break;
    case "luxe":
      doc.setFillColor(...primary);
      doc.rect(0, 0, PAGE_WIDTH, 25, "F");
      doc.setFillColor(...accent);
      doc.rect(0, 25, PAGE_WIDTH, 3, "F");
      break;
  }
}

function drawPreviewWatermark(doc: jsPDF): void {
  doc.setTextColor(71, 135, 245);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(33);
  doc.text("TICKD FREE PREVIEW", PAGE_WIDTH / 2, PAGE_HEIGHT / 2, {
    align: "center",
    angle: 45,
  });
}

export function createInvoicePdf(data: InvoiceTemplateData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: false });
  const labels = getInvoiceLabels(data.language, data.customLabels);
  const defaults = TEMPLATE_COLOR_DEFAULTS[data.template] || TEMPLATE_COLOR_DEFAULTS.professional;
  const primary = hexToRgb(data.primaryColor || defaults.primary, [18, 40, 61]);
  const accent = hexToRgb(data.accentColor || defaults.accent, mix(primary, [255, 255, 255], 0.35));
  const ink = hexToRgb(data.textColor, [23, 32, 42]);
  const background = hexToRgb(data.bgColor, [255, 255, 255]);
  const contentLeft = data.template === "graphic" ? 29 : data.template === "professional" ? 20 : MARGIN;
  const contentRight = MARGIN;
  const contentWidth = PAGE_WIDTH - contentLeft - contentRight;
  const darkHeader = data.template === "media" || data.template === "luxe";

  drawPageDecoration(doc, data, primary, accent, background);

  const headerY = darkHeader ? 13 : data.template === "avant" ? 17 : 20;
  const headerColor: Rgb = darkHeader ? contrastText(primary) : ink;
  doc.setTextColor(...headerColor);
  doc.setFont("helvetica", "bold");
  fitText(doc, data.businessName || "Your Business", contentWidth * 0.58, 18, 10);
  doc.text(data.businessName || "Your Business", contentLeft, headerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const businessLines = [data.businessMeta, data.businessAddress, data.businessEmail, data.businessPhone]
    .filter(Boolean)
    .join("\n");
  if (businessLines) doc.text(businessLines, contentLeft, headerY + 5, { lineHeightFactor: 1.25 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(27);
  doc.text(labels.invoice, PAGE_WIDTH - contentRight, headerY, { align: "right" });
  doc.setFontSize(9);
  doc.text(data.invoiceNumber, PAGE_WIDTH - contentRight, headerY + 6, { align: "right" });

  let y = darkHeader ? 42 : 48;
  const metaGap = 3;
  const metaItems = [
    [labels.issueDate, data.issueDate],
    ...(data.dueDate ? [[labels.dueDate, data.dueDate]] : []),
    [labels.balanceDue, `${data.currency} ${data.totalFormatted}`],
  ];
  const metaWidth = (contentWidth - metaGap * (metaItems.length - 1)) / metaItems.length;
  metaItems.forEach(([label, value], index) => {
    const x = contentLeft + index * (metaWidth + metaGap);
    doc.setFillColor(...mix(primary, [255, 255, 255], 0.95));
    doc.setDrawColor(...mix(primary, [255, 255, 255], 0.77));
    doc.roundedRect(x, y, metaWidth, 19, 1.5, 1.5, "FD");
    doc.setTextColor(98, 108, 121);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x + 4, y + 6);
    doc.setTextColor(...ink);
    doc.setFontSize(10);
    fitText(doc, value, metaWidth - 8, 10, 7);
    doc.text(value, x + 4, y + 13.5);
  });

  y += 29;
  doc.setTextColor(...primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(labels.billTo.toUpperCase(), contentLeft, y);
  doc.setTextColor(...ink);
  doc.setFontSize(11);
  doc.text(data.clientName || labels.noClient, contentLeft, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.7);
  doc.setTextColor(91, 101, 115);
  const clientLines = [
    data.clientAddress,
    [data.clientCity, data.clientState, data.clientZip].filter(Boolean).join(", "),
    data.clientEmail,
  ].filter(Boolean).join("\n");
  if (clientLines) doc.text(clientLines, contentLeft, y + 11, { lineHeightFactor: 1.3 });

  const tableStartY = y + (clientLines ? 25 : 15);
  const showDate = data.showDateColumn === true;
  const showRate = data.showHourlyRate !== false;
  const columns = [labels.description, ...(showDate ? [labels.date] : []), getInvoiceUnitsLabel(labels, data.lineItems), ...(showRate ? [labels.rate] : []), labels.amount];
  const columnCount = columns.length;
  const body = data.lineItems.map((item) => {
    if (item.isGroupHeader) {
      return [
        { content: item.description, colSpan: columnCount - 1, styles: { fontStyle: "bold", fillColor: mix(primary, [255, 255, 255], 0.9), textColor: ink } },
        { content: item.amount, styles: { fontStyle: "bold", halign: "right", fillColor: mix(primary, [255, 255, 255], 0.9), textColor: ink } },
      ];
    }
    const description = data.showProjectName !== false && item.subDescription
      ? `${item.description}\n${item.subDescription}`
      : item.description;
    return [description, ...(showDate ? [item.date || ""] : []), item.qty, ...(showRate ? [item.rate] : []), item.amount];
  });

  let tableFinalY = tableStartY;
  autoTable(doc, {
    startY: tableStartY,
    margin: { left: contentLeft, right: contentRight, top: 18, bottom: 18 },
    head: [columns],
    body: body as any,
    theme: "plain",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 8.8,
      textColor: ink,
      lineColor: [222, 227, 233],
      lineWidth: { bottom: 0.2 },
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: primary,
      textColor: contrastText(primary),
      fontStyle: "bold",
      fontSize: 8,
      minCellHeight: 12,
      cellPadding: { top: 3.5, right: 3, bottom: 3.5, left: 3 },
      valign: "middle",
      halign: "left",
      lineWidth: 0,
    },
    columnStyles: {
      0: { cellWidth: "auto", halign: "left" },
      ...(showDate ? { 1: { cellWidth: 23, halign: "right" } } : {}),
      [showDate ? 2 : 1]: { cellWidth: 21, halign: "right" },
      ...(showRate ? { [showDate ? 3 : 2]: { cellWidth: 27, halign: "right" } } : {}),
      [columnCount - 1]: { cellWidth: 29, halign: "right" },
    },
    didParseCell: ({ cell, column, section }) => {
      if (section === "head" && column.index > 0) cell.styles.halign = "right";
      if (section === "body" && cell.text.length > 1 && column.index === 0) {
        cell.styles.minCellHeight = 13;
      }
    },
    didDrawPage: ({ cursor }) => {
      if (cursor?.y) tableFinalY = cursor.y;
    },
  });

  const ensureRoom = (height: number) => {
    if (tableFinalY + height <= PAGE_HEIGHT - 18) return;
    doc.addPage();
    drawPageDecoration(doc, data, primary, accent, background);
    tableFinalY = 22;
  };

  ensureRoom(48);
  y = tableFinalY + 9;
  const totalsWidth = 70;
  const totalsX = PAGE_WIDTH - contentRight - totalsWidth;
  const drawTotalRow = (label: string, value: string) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(91, 101, 115);
    doc.text(label, totalsX, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...ink);
    doc.text(value, PAGE_WIDTH - contentRight, y, { align: "right" });
    doc.setDrawColor(222, 227, 233);
    doc.line(totalsX, y + 3, PAGE_WIDTH - contentRight, y + 3);
    y += 8;
  };
  drawTotalRow(labels.subtotal, `${data.currency} ${data.subtotalFormatted}`);
  if (Number.parseFloat(data.taxFormatted) > 0) {
    drawTotalRow(data.taxLabel || labels.tax, `${data.currency} ${data.taxFormatted}`);
  }

  const totalHeight = 15;
  doc.setFillColor(...primary);
  doc.roundedRect(totalsX, y, totalsWidth, totalHeight, 2, 2, "F");
  doc.setTextColor(...contrastText(primary));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const totalBaseline = y + totalHeight / 2 + 1.5;
  doc.text(labels.total, totalsX + 5, totalBaseline);
  doc.text(`${data.currency} ${data.totalFormatted}`, PAGE_WIDTH - contentRight - 5, totalBaseline, { align: "right" });
  y += totalHeight + 10;

  const blocks = [
    data.showPaymentDetails !== false && data.paymentDetails ? [labels.paymentDetails, data.paymentDetails] : null,
    data.showPaymentTerms !== false && data.paymentTerms ? [labels.paymentTerms, data.paymentTerms] : null,
    data.showNotes !== false ? [labels.notes, data.notes || labels.defaultNotes] : null,
  ].filter(Boolean) as Array<[string, string]>;

  for (const [title, content] of blocks) {
    const lines = doc.splitTextToSize(plainText(content), contentWidth - 8) as string[];
    const blockHeight = Math.max(22, 12 + lines.length * 4.1);
    if (y + blockHeight > PAGE_HEIGHT - 22) {
      doc.addPage();
      drawPageDecoration(doc, data, primary, accent, background);
      y = 22;
    }
    y = drawTextBlock(doc, title, content, contentLeft, y, contentWidth, primary) + 4;
  }

  if (data.showFooterNotes !== false && plainText(data.footerNotes)) {
    const footer = plainText(data.footerNotes);
    doc.setDrawColor(220, 225, 231);
    doc.line(contentLeft, PAGE_HEIGHT - 17, PAGE_WIDTH - contentRight, PAGE_HEIGHT - 17);
    doc.setTextColor(105, 115, 128);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(footer, contentWidth), contentLeft, PAGE_HEIGHT - 12, { lineHeightFactor: 1.15 });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    if (data.watermarkPreview) drawPreviewWatermark(doc);
    doc.setTextColor(145, 153, 164);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`${page} / ${pageCount}`, PAGE_WIDTH - contentRight, PAGE_HEIGHT - 7, { align: "right" });
  }

  return doc;
}

export async function exportInvoicePdf(data: InvoiceTemplateData, filename: string): Promise<void> {
  createInvoicePdf(data).save(filename);
}
