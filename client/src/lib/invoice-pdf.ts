import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { generateInvoiceHTML, InvoiceTemplateData } from "./invoice-html-generator";

export async function exportInvoicePdf(
  data: InvoiceTemplateData,
  filename: string
): Promise<void> {
  const htmlString = generateInvoiceHTML(data);

  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-9999px;top:0;width:794px;min-height:1123px;background:#fff;z-index:-1;";
  document.body.appendChild(container);

  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "width:794px;height:1123px;border:none;display:block;";
  container.appendChild(iframe);

  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    iframe.srcdoc = htmlString;
  });

  await new Promise((r) => setTimeout(r, 600));

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(container);
    throw new Error("Could not access iframe document");
  }

  const invoicePage = iframeDoc.querySelector(".invoice-page") as HTMLElement;
  if (!invoicePage) {
    document.body.removeChild(container);
    throw new Error("Invoice page element not found");
  }

  invoicePage.style.boxShadow = "none";

  const canvas = await html2canvas(invoicePage, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    width: 794,
    height: 1123,
    windowWidth: 794,
    windowHeight: 1123,
    foreignObjectRendering: false,
    logging: false,
  });

  document.body.removeChild(container);

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
  pdf.save(filename);
}
