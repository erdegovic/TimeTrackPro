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
  accentSide: "left" | "right" = "left",
): number {
  const body = plainText(content);
  if (!body) return y;
  const lines = doc.splitTextToSize(body, width - 8) as string[];
  const height = Math.max(22, 12 + lines.length * 4.1);

  doc.setFillColor(...mix(primary, [255, 255, 255], 0.95));
  doc.setDrawColor(...mix(primary, [255, 255, 255], 0.7));
  doc.roundedRect(x, y, width, height, 2, 2, "FD");
  doc.setFillColor(...primary);
  doc.rect(accentSide === "right" ? x + width - 2 : x, y, 2, height, "F");
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

function drawPixelLabFrame(doc: jsPDF, primary: Rgb, accent: Rgb, background: Rgb, includeHero = false): void {
  doc.setFillColor(...background);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
  if (!includeHero) return;

  doc.setFillColor(...mix(primary, [255, 255, 255], 0.88));
  doc.triangle(12.2, 10.2, 86, 10.2, 12.2, 57, "F");
  doc.setFillColor(...mix(accent, [255, 255, 255], 0.88));
  doc.triangle(197.8, 10.2, 197.8, 57, 123, 10.2, "F");
  doc.setDrawColor(231, 235, 239);
  doc.line(12, 57, 198, 57);
}

function drawPixelLabBrand(doc: jsPDF, data: InvoiceTemplateData, primary: Rgb, accent: Rgb, ink: Rgb): void {
  const x = 18;
  const y = 17;
  let nameX = x;
  const logoUrl = data.showLogo !== false ? data.logoUrl : undefined;

  if (logoUrl?.startsWith("data:image/")) {
    try {
      const properties = doc.getImageProperties(logoUrl);
      const ratio = properties.width / properties.height || 1;
      const height = 10;
      const width = Math.min(30, height * ratio);
      doc.addImage(logoUrl, properties.fileType, x, y, width, height, undefined, "FAST");
      nameX = x + width + 4;
    } catch {
      nameX = x;
    }
  }

  if (nameX === x) {
    const colors: Rgb[] = [primary, accent, primary, accent, ink, accent, primary, accent, primary];
    for (let index = 0; index < colors.length; index += 1) {
      const column = index % 3;
      const row = Math.floor(index / 3);
      doc.setFillColor(...colors[index]);
      doc.roundedRect(x + column * 3.8, y + row * 3.8, 3, 3, 0.7, 0.7, "F");
    }
    nameX = x + 14;
  }

  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  fitText(doc, data.businessName || "Your Business", 82 - (nameX - x), 15, 8);
  doc.text(data.businessName || "Your Business", nameX, y + 7);
}

function pixelAddressLines(data: InvoiceTemplateData, type: "business" | "client", fallback: string): string[] {
  const values = type === "business"
    ? [data.businessName || "Your Business", data.businessMeta, data.businessAddress, data.businessEmail, data.businessPhone]
    : [data.clientName || fallback, data.clientAddress, [data.clientCity, data.clientState, data.clientZip].filter(Boolean).join(", "), data.clientEmail];
  return values.flatMap((value) => plainText(value).split("\n")).filter(Boolean);
}

function drawPixelAddressCard(
  doc: jsPDF,
  title: string,
  lines: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  ink: Rgb,
): void {
  doc.setFillColor(247, 249, 250);
  doc.setDrawColor(231, 235, 239);
  doc.roundedRect(x, y, width, height, 2, 2, "FD");
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(title.toUpperCase(), x + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  const wrapped = lines.flatMap((line) => doc.splitTextToSize(line, width - 8) as string[]);
  doc.text(wrapped, x + 4, y + 11, { lineHeightFactor: 1.25 });
}

function createPixelLabInvoicePdf(
  doc: jsPDF,
  data: InvoiceTemplateData,
  primary: Rgb,
  accent: Rgb,
  ink: Rgb,
  background: Rgb,
): jsPDF {
  const labels = getInvoiceLabels(data.language, data.customLabels);
  const muted: Rgb = [111, 119, 130];
  const contentLeft = 18;
  const contentRight = 18;
  const contentWidth = PAGE_WIDTH - contentLeft - contentRight;

  drawPixelLabFrame(doc, primary, accent, background, true);
  drawPixelLabBrand(doc, data, primary, accent, ink);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(labels.invoice, PAGE_WIDTH - contentRight, 24, { align: "right" });

  const metaItems = [
    [`${labels.invoice} No`, data.invoiceNumber],
    [labels.issueDate, data.issueDate],
    ...(data.dueDate ? [[labels.dueDate, data.dueDate]] : []),
  ];
  const metaX = contentLeft;
  const metaY = 32;
  const metaHeight = 18;
  const metaWidth = contentWidth / metaItems.length;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(231, 235, 239);
  doc.roundedRect(metaX, metaY, contentWidth, metaHeight, 2, 2, "FD");
  metaItems.forEach(([label, value], index) => {
    const x = metaX + index * metaWidth;
    if (index > 0) doc.line(x, metaY, x, metaY + metaHeight);
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x + 4, metaY + 6);
    doc.setTextColor(...ink);
    fitText(doc, value, metaWidth - 8, 9.5, 7);
    doc.text(value, x + 4, metaY + 13);
  });

  const businessLines = pixelAddressLines(data, "business", labels.noClient);
  const clientLines = pixelAddressLines(data, "client", labels.noClient);
  const addressWidth = (contentWidth - 6) / 2;
  const maxAddressLines = Math.max(businessLines.length, clientLines.length);
  const addressHeight = Math.max(28, 15 + maxAddressLines * 3.6);
  const addressY = 63;
  drawPixelAddressCard(doc, "From", businessLines, contentLeft, addressY, addressWidth, addressHeight, ink);
  drawPixelAddressCard(doc, labels.billTo, clientLines, contentLeft + addressWidth + 6, addressY, addressWidth, addressHeight, ink);

  let y = addressY + addressHeight + 9;
  doc.setFillColor(...primary);
  doc.roundedRect(contentLeft, y - 2.5, 4, 4, 0.8, 0.8, "F");
  doc.setFillColor(...accent);
  doc.rect(contentLeft + 2, y - 2.5, 2, 4, "F");
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(labels.description.toUpperCase(), contentLeft + 7, y + 0.8);
  y += 5;

  const showDate = data.showDateColumn === true;
  const showRate = data.showHourlyRate !== false;
  const showUnits = data.showUnits !== false;
  const columns = [
    labels.description,
    ...(showDate ? [labels.date] : []),
    ...(showUnits ? [getInvoiceUnitsLabel(labels, data.lineItems)] : []),
    ...(showRate ? [labels.rate] : []),
    labels.amount,
  ];
  const columnCount = columns.length;
  const groupRows = new Set<number>();
  const body = data.lineItems.map((item, index) => {
    if (item.isGroupHeader) {
      groupRows.add(index);
      return [
        { content: item.description, colSpan: columnCount - 1, styles: { fontStyle: "bold", cellPadding: { top: 4, right: 2, bottom: 2.5, left: 8 } } },
        { content: item.amount, styles: { fontStyle: "bold", halign: "right", cellPadding: { top: 4, right: 2, bottom: 2.5, left: 2 } } },
      ];
    }
    const description = data.showProjectName !== false && item.subDescription ? `${item.description}\n${item.subDescription}` : item.description;
    return [description, ...(showDate ? [item.date || ""] : []), ...(showUnits ? [item.qty] : []), ...(showRate ? [item.rate] : []), item.amount];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: contentLeft, right: contentRight, top: 18, bottom: 18 },
    head: [columns],
    body: body as any,
    theme: "plain",
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 8.3,
      textColor: ink,
      lineColor: [231, 235, 239],
      lineWidth: { bottom: 0.2 },
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: muted,
      fontStyle: "bold",
      fontSize: 7,
      minCellHeight: 8,
      valign: "middle",
      lineColor: [231, 235, 239],
      lineWidth: { bottom: 0.2 },
    },
    columnStyles: {
      0: { cellWidth: "auto", halign: "left" },
      ...(showDate ? { 1: { cellWidth: 23, halign: "right" } } : {}),
      ...(showUnits ? { [1 + (showDate ? 1 : 0)]: { cellWidth: 20, halign: "right" } } : {}),
      ...(showRate ? { [1 + (showDate ? 1 : 0) + (showUnits ? 1 : 0)]: { cellWidth: 28, halign: "right" } } : {}),
      [columnCount - 1]: { cellWidth: 29, halign: "right" },
    },
    didParseCell: ({ cell, column, row, section }) => {
      if (section === "head" && column.index > 0) cell.styles.halign = "right";
      if (section === "body" && groupRows.has(row.index)) {
        cell.styles.fillColor = [255, 255, 255];
        cell.styles.lineWidth = 0;
      }
      if (section === "body" && cell.text.length > 1 && column.index === 0) cell.styles.minCellHeight = 11;
    },
    didDrawCell: ({ cell, column, row, section }) => {
      if (section !== "body" || column.index !== 0 || !groupRows.has(row.index)) return;
      doc.setFillColor(...primary);
      doc.roundedRect(cell.x + 2, cell.y + cell.height / 2 - 1.5, 3, 3, 0.6, 0.6, "F");
      doc.setFillColor(...accent);
      doc.rect(cell.x + 3.5, cell.y + cell.height / 2 - 1.5, 1.5, 3, "F");
    },
    willDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) drawPixelLabFrame(doc, primary, accent, background);
    },
  });

  y = ((doc as any).lastAutoTable?.finalY || y) + 8;
  const infoValues: Record<string, [string, string] | undefined> = {
    payment: data.showPaymentDetails !== false && data.paymentDetails ? [labels.paymentDetails, data.paymentDetails] : undefined,
    terms: data.showPaymentTerms !== false && data.paymentTerms ? [labels.paymentTerms, data.paymentTerms] : undefined,
    notes: data.showNotes !== false ? [labels.notes, data.notes || labels.defaultNotes] : undefined,
  };
  const infoOrder = Array.from(new Set([...(data.invoiceInfoOrder || "payment,notes,terms").split(",").map((key) => key.trim()), "payment", "notes", "terms"]));
  const infoBlocks = infoOrder.map((key) => infoValues[key]).filter(Boolean) as Array<[string, string]>;
  const totalRowsHeight = Number.parseFloat(data.taxFormatted) > 0 ? 13 : 0;
  const totalHeight = totalRowsHeight + 16;
  if (y + totalHeight + (infoBlocks.length ? 30 : 0) > PAGE_HEIGHT - 18) {
    doc.addPage();
    drawPixelLabFrame(doc, primary, accent, background);
    y = 20;
  }

  const totalsWidth = 74;
  const totalsX = PAGE_WIDTH - contentRight - totalsWidth;
  if (Number.parseFloat(data.taxFormatted) > 0) {
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal");
    doc.text(labels.subtotal, totalsX + 2, y + 4);
    doc.setFont("helvetica", "bold");
    doc.text(`${data.currency} ${data.subtotalFormatted}`, PAGE_WIDTH - contentRight - 2, y + 4, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(data.taxLabel || labels.tax, totalsX + 2, y + 10);
    doc.setFont("helvetica", "bold");
    doc.text(`${data.currency} ${data.taxFormatted}`, PAGE_WIDTH - contentRight - 2, y + 10, { align: "right" });
    y += 13;
  }
  doc.setFillColor(...ink);
  doc.roundedRect(totalsX, y, totalsWidth, 16, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(labels.total, totalsX + 5, y + 10);
  doc.setFontSize(12);
  fitText(doc, `${data.currency} ${data.totalFormatted}`, totalsWidth - 34, 12, 8);
  doc.text(`${data.currency} ${data.totalFormatted}`, PAGE_WIDTH - contentRight - 5, y + 10, { align: "right" });
  y += 24;

  const drawInfoContent = ([title, content]: [string, string], x: number, contentY: number, width: number): void => {
    const lines = doc.splitTextToSize(plainText(content), width - 8) as string[];
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(title.toUpperCase(), x, contentY + 6);
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.text(lines, x, contentY + 11, { lineHeightFactor: 1.25 });
  };

  if (infoBlocks.length) {
    const stacked = data.invoiceInfoLayout === "stacked";
    const cardWidth = stacked ? contentWidth : (contentWidth - 5) / 2;
    const rows: Array<{ left: [string, string]; right?: [string, string]; height: number }> = [];
    for (let index = 0; index < infoBlocks.length; index += stacked ? 1 : 2) {
      const left = infoBlocks[index];
      const leftLines = doc.splitTextToSize(plainText(left[1]), cardWidth - 8) as string[];
      const right = !stacked ? infoBlocks[index + 1] : undefined;
      const rightLines = right ? doc.splitTextToSize(plainText(right[1]), cardWidth - 8) as string[] : [];
      rows.push({ left, right, height: Math.max(20, 12 + Math.max(leftLines.length, rightLines.length) * 3.5) });
    }
    const panelHeight = 5 + rows.reduce((sum, row) => sum + row.height, 0);
    if (y + panelHeight > PAGE_HEIGHT - 20) {
      doc.addPage();
      drawPixelLabFrame(doc, primary, accent, background);
      y = 20;
    }
    doc.setFillColor(251, 252, 252);
    doc.rect(12, y, 186, panelHeight, "F");
    doc.setDrawColor(231, 235, 239);
    doc.line(12, y, 198, y);
    let rowY = y + 3;
    for (const row of rows) {
      drawInfoContent(row.left, contentLeft, rowY, cardWidth);
      if (row.right) drawInfoContent(row.right, contentLeft + cardWidth + 5, rowY, cardWidth);
      rowY += row.height;
    }
    y += panelHeight;
  }

  if (data.showFooterNotes !== false && plainText(data.footerNotes)) {
    const footer = plainText(data.footerNotes);
    const footerLines = doc.splitTextToSize(footer, contentWidth) as string[];
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(footerLines, PAGE_WIDTH - contentRight, Math.min(PAGE_HEIGHT - 13, y + 5), { align: "right", lineHeightFactor: 1.15 });
    y += 5 + footerLines.length * 3;
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(231, 235, 239);
    doc.setLineWidth(0.25);
    const frameHeight = page < pageCount ? 277 : Math.min(277, Math.max(100, y - 10 + 6));
    doc.roundedRect(12, 10, 186, frameHeight, 3, 3, "S");
    if (data.watermarkPreview) drawPreviewWatermark(doc);
    doc.setTextColor(145, 153, 164);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`${page} / ${pageCount}`, PAGE_WIDTH - contentRight, PAGE_HEIGHT - 7, { align: "right" });
  }
  return doc;
}

export function createInvoicePdf(data: InvoiceTemplateData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: false });
  const labels = getInvoiceLabels(data.language, data.customLabels);
  const defaults = TEMPLATE_COLOR_DEFAULTS[data.template] || TEMPLATE_COLOR_DEFAULTS.professional;
  const primary = hexToRgb(data.primaryColor || defaults.primary, [18, 40, 61]);
  const accent = hexToRgb(data.accentColor || defaults.accent, mix(primary, [255, 255, 255], 0.35));
  const ink = hexToRgb(data.textColor, [23, 32, 42]);
  const background = hexToRgb(data.bgColor, [255, 255, 255]);
  if (data.template === "pixellab") {
    return createPixelLabInvoicePdf(doc, data, primary, accent, ink, background);
  }
  const contentLeft = data.template === "graphic" ? 29 : data.template === "professional" ? 20 : MARGIN;
  const contentRight = MARGIN;
  const contentWidth = PAGE_WIDTH - contentLeft - contentRight;
  const darkHeader = data.template === "media" || data.template === "luxe";

  drawPageDecoration(doc, data, primary, accent, background);

  const headerY = darkHeader ? 13 : data.template === "avant" ? 17 : 20;
  const headerColor: Rgb = darkHeader ? contrastText(primary) : ink;
  const headerPlacement = data.invoiceHeaderPlacement || "standard";
  const businessX = headerPlacement === "reversed" ? PAGE_WIDTH - contentRight : headerPlacement === "centered" ? PAGE_WIDTH / 2 : contentLeft;
  const businessAlign = headerPlacement === "reversed" ? "right" : headerPlacement === "centered" ? "center" : "left";
  const invoiceX = headerPlacement === "reversed" ? contentLeft : headerPlacement === "centered" ? PAGE_WIDTH / 2 : PAGE_WIDTH - contentRight;
  const invoiceAlign = headerPlacement === "reversed" ? "left" : headerPlacement === "centered" ? "center" : "right";
  doc.setTextColor(...headerColor);
  doc.setFont("helvetica", "bold");
  fitText(doc, data.businessName || "Your Business", contentWidth * 0.58, 18, 10);
  doc.text(data.businessName || "Your Business", businessX, headerY, { align: businessAlign });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const businessLines = [data.businessMeta, data.businessAddress, data.businessEmail, data.businessPhone]
    .filter(Boolean)
    .join("\n");
  if (businessLines) doc.text(businessLines, businessX, headerY + 5, { lineHeightFactor: 1.25, align: businessAlign });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(27);
  const invoiceHeaderY = headerPlacement === "centered" ? headerY + 19 : headerY;
  doc.text(labels.invoice, invoiceX, invoiceHeaderY, { align: invoiceAlign });
  doc.setFontSize(9);
  doc.text(data.invoiceNumber, invoiceX, invoiceHeaderY + 6, { align: invoiceAlign });

  let y = headerPlacement === "centered" ? (darkHeader ? 55 : 62) : darkHeader ? 42 : 48;
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
  const showUnits = data.showUnits !== false;
  const columns = [
    labels.description,
    ...(showDate ? [labels.date] : []),
    ...(showUnits ? [getInvoiceUnitsLabel(labels, data.lineItems)] : []),
    ...(showRate ? [labels.rate] : []),
    labels.amount,
  ];
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
    return [
      description,
      ...(showDate ? [item.date || ""] : []),
      ...(showUnits ? [item.qty] : []),
      ...(showRate ? [item.rate] : []),
      item.amount,
    ];
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
      ...(showUnits ? { [1 + (showDate ? 1 : 0)]: { cellWidth: 21, halign: "right" } } : {}),
      ...(showRate ? { [1 + (showDate ? 1 : 0) + (showUnits ? 1 : 0)]: { cellWidth: 27, halign: "right" } } : {}),
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

  const availableBlocks: Record<string, [string, string, "left" | "right"] | undefined> = {
    payment: data.showPaymentDetails !== false && data.paymentDetails
      ? [labels.paymentDetails, data.paymentDetails, data.invoicePaymentAccentSide || "left"]
      : undefined,
    terms: data.showPaymentTerms !== false && data.paymentTerms
      ? [labels.paymentTerms, data.paymentTerms, "left"]
      : undefined,
    notes: data.showNotes !== false
      ? [labels.notes, data.notes || labels.defaultNotes, "left"]
      : undefined,
  };
  const requestedOrder = (data.invoiceInfoOrder || "payment,terms,notes").split(",").map((key) => key.trim());
  const blockOrder = Array.from(new Set([...requestedOrder, "payment", "terms", "notes"]));
  const blocks = blockOrder.map((key) => availableBlocks[key]).filter(Boolean) as Array<[string, string, "left" | "right"]>;

  const drawBlock = ([title, content, accentSide]: [string, string, "left" | "right"], x: number, width: number) => {
    const lines = doc.splitTextToSize(plainText(content), width - 8) as string[];
    const blockHeight = Math.max(22, 12 + lines.length * 4.1);
    if (y + blockHeight > PAGE_HEIGHT - 22) {
      doc.addPage();
      drawPageDecoration(doc, data, primary, accent, background);
      y = 22;
    }
    return drawTextBlock(doc, title, content, x, y, width, primary, accentSide);
  };

  if (data.invoiceInfoLayout === "columns" && blocks.length > 1) {
    const blockWidth = (contentWidth - 4) / 2;
    for (let index = 0; index < blocks.length; index += 2) {
      const leftBottom = drawBlock(blocks[index], contentLeft, blockWidth);
      const rightBottom = blocks[index + 1] ? drawBlock(blocks[index + 1], contentLeft + blockWidth + 4, blockWidth) : leftBottom;
      y = Math.max(leftBottom, rightBottom) + 4;
    }
  } else {
    for (const block of blocks) {
      y = drawBlock(block, contentLeft, contentWidth) + 4;
    }
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
