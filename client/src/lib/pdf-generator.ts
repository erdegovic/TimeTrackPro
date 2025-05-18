import { TimeEntry, Client, Settings, Invoice } from "@shared/schema";
import { formatTime, formatCurrency, convertCurrency } from "@/lib/utils/timeUtils";
import { format } from "date-fns";

type PdfOptions = {
  filename: string;
  type: "report" | "invoice";
} & (
  | {
      type: "report";
      reportData: any;
      filters: any;
    }
  | {
      type: "invoice";
      invoice?: Invoice;
      reportData?: any;
      client: Client;
      settings: Settings;
      invoiceNumber?: string;
      issueDate?: string;
      dueDate?: string;
      notes?: string;
    }
);

/**
 * Generates a PDF file for reports or invoices
 * @param options - Options for PDF generation
 */
export async function generatePdf(options: PdfOptions): Promise<void> {
  // Dynamically import jspdf and jspdf-autotable to reduce bundle size
  const { jsPDF } = await import("jspdf");
  const autoTable = await import("jspdf-autotable").then(m => m.default);
  
  const doc = new jsPDF();
  
  if (options.type === "report") {
    generateReportPdf(doc, autoTable, options.reportData, options.filters);
  } else {
    generateInvoicePdf(
      doc, 
      autoTable, 
      options.invoice || undefined, 
      options.reportData || undefined, 
      options.client, 
      options.settings,
      options.invoiceNumber,
      options.issueDate,
      options.dueDate,
      options.notes
    );
  }
  
  // Save the PDF
  doc.save(options.filename);
}

/**
 * Generates a report PDF
 */
function generateReportPdf(doc: any, autoTable: any, reportData: any, filters: any) {
  // Add title
  doc.setFontSize(20);
  doc.text("Time Tracking Report", 14, 20);
  
  // Add report date range
  doc.setFontSize(12);
  doc.text(`Period: ${filters.startDate} to ${filters.endDate}`, 14, 30);
  
  // Add client and project filter info if applied
  let yPos = 35;
  if (filters.clientId) {
    const client = reportData.timeEntries.find((e: any) => e.client?.id === filters.clientId)?.client;
    if (client) {
      doc.text(`Client: ${client.name}`, 14, yPos);
      yPos += 5;
    }
  }
  
  if (filters.projectId) {
    const project = reportData.timeEntries.find((e: any) => e.project?.id === filters.projectId)?.project;
    if (project) {
      doc.text(`Project: ${project.name}`, 14, yPos);
      yPos += 5;
    }
  }
  
  // Add time format and rounding info
  doc.text(`Time Format: ${filters.timeFormat === 'decimal' ? 'Decimal' : 'Hours:Minutes:Seconds'}`, 14, yPos);
  yPos += 5;
  
  const roundingLabels: Record<string, string> = {
    'none': 'No rounding',
    'nearest_tenth': 'Nearest 0.1 hour',
    'nearest_quarter': 'Nearest 0.25 hour',
    'nearest_half': 'Nearest 0.5 hour'
  };
  
  doc.text(`Rounding: ${roundingLabels[filters.roundingType]}`, 14, yPos);
  yPos += 10;
  
  // Generate table content
  const tableContent: any[] = [];
  
  reportData.weeklyData.forEach((weekData: any) => {
    // Add week header
    tableContent.push([
      {
        content: weekData.weekLabel,
        colSpan: 5,
        styles: { fillColor: [240, 240, 240], fontStyle: 'bold' }
      },
      {
        content: `$${weekData.totalAmount.toFixed(2)}`,
        styles: { halign: 'right', fillColor: [240, 240, 240], fontStyle: 'bold' }
      }
    ]);
    
    // Add time entries for this week
    weekData.entries.forEach((entry: any) => {
      tableContent.push([
        format(new Date(entry.date), 'MMM d, yyyy'),
        entry.description,
        entry.client?.name || '—',
        entry.project?.name || '—',
        formatTime(entry.adjustedDuration || entry.duration, filters.timeFormat),
        `$${parseFloat(entry.amount).toFixed(2)}`
      ]);
    });
  });
  
  // Add total row
  tableContent.push([
    {
      content: 'Total',
      colSpan: 4,
      styles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
    },
    {
      content: formatTime(reportData.totalHours, filters.timeFormat),
      styles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
    },
    {
      content: `$${reportData.totalAmount.toFixed(2)}`,
      styles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
    }
  ]);
  
  // Add table to document
  autoTable(doc, {
    startY: yPos,
    head: [['Date', 'Description', 'Client', 'Project', 'Hours', 'Amount']],
    body: tableContent,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 165, 228],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      5: { halign: 'right' }
    }
  });
  
  // Add generation date at the bottom
  const pageCount = doc.internal.getNumberOfPages();
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on ${format(new Date(), 'MMMM d, yyyy')}`, 14, doc.internal.pageSize.height - 10);
  doc.text(`Page ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
}

/**
 * Generates an invoice PDF
 */
function generateInvoicePdf(
  doc: any, 
  autoTable: any, 
  invoice?: Invoice, 
  reportData?: any,
  client: Client,
  settings: Settings,
  invoiceNumber?: string,
  issueDate?: string,
  dueDate?: string,
  notes?: string
) {
  // Use either the invoice data or the provided parameters
  const invNumber = invoice?.invoiceNumber || invoiceNumber || "DRAFT";
  const invIssueDate = invoice?.issueDate || issueDate || format(new Date(), 'yyyy-MM-dd');
  const invDueDate = invoice?.dueDate || dueDate || format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  const invNotes = invoice?.notes || notes || "Thank you for your business.";
  
  // Add title and invoice number
  doc.setFontSize(24);
  doc.text("INVOICE", 14, 20);
  
  doc.setFontSize(14);
  doc.text(invNumber, 14, 28);
  
  // Add from/to sections
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text("From:", 14, 40);
  doc.text("To:", doc.internal.pageSize.width / 2 + 10, 40);
  doc.setFont(undefined, 'normal');
  
  // From address (business)
  let fromY = 48;
  const fromLines = [
    settings.businessName,
    settings.businessAddress,
    `${settings.businessCity}, ${settings.businessState} ${settings.businessZipCode}`,
    settings.businessCountry,
    settings.businessEmail,
    `Tax ID: ${settings.businessTaxId}`
  ].filter(Boolean);
  
  fromLines.forEach(line => {
    if (line) {
      doc.text(line, 14, fromY);
      fromY += 6;
    }
  });
  
  // To address (client)
  let toY = 48;
  const toLines = [
    client.name,
    client.address,
    `${client.city}, ${client.state} ${client.zipCode}`,
    client.country,
    client.email,
    client.taxId ? `Tax ID: ${client.taxId}` : ''
  ].filter(Boolean);
  
  toLines.forEach(line => {
    if (line) {
      doc.text(line, doc.internal.pageSize.width / 2 + 10, toY);
      toY += 6;
    }
  });
  
  // Invoice details section
  const detailsYStart = Math.max(fromY, toY) + 10;
  
  doc.setFont(undefined, 'bold');
  doc.text("Invoice Details:", 14, detailsYStart);
  doc.text("Payment Details:", doc.internal.pageSize.width / 2 + 10, detailsYStart);
  doc.setFont(undefined, 'normal');
  
  // Invoice details
  let detailsY = detailsYStart + 8;
  doc.text(`Issue Date: ${format(new Date(invIssueDate), 'MMMM d, yyyy')}`, 14, detailsY);
  detailsY += 6;
  doc.text(`Due Date: ${format(new Date(invDueDate), 'MMMM d, yyyy')}`, 14, detailsY);
  
  // Payment details
  let paymentY = detailsYStart + 8;
  doc.text(`Bank Name: ${settings.bankName || ''}`, doc.internal.pageSize.width / 2 + 10, paymentY);
  paymentY += 6;
  doc.text(`Account Name: ${settings.bankAccountName || ''}`, doc.internal.pageSize.width / 2 + 10, paymentY);
  paymentY += 6;
  doc.text(`Account Number: ${settings.bankAccountNumber || ''}`, doc.internal.pageSize.width / 2 + 10, paymentY);
  
  // Generate table content
  const tableContent: any[] = [];
  const tableStartY = Math.max(detailsY, paymentY) + 15;
  
  let subtotal = 0;
  let totalHours = 0;
  
  // Get the currency for the client
  const currency = client.currency || 'USD';
  const currencySymbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
  
  if (reportData) {
    // Use report data for generating invoice
    reportData.weeklyData.forEach((weekData: any) => {
      // Add week header
      tableContent.push([
        {
          content: weekData.weekLabel,
          colSpan: 4,
          styles: { fillColor: [240, 240, 240], fontStyle: 'bold' }
        },
        {
          content: formatCurrency(weekData.totalAmount, currency),
          styles: { halign: 'right', fillColor: [240, 240, 240], fontStyle: 'bold' }
        }
      ]);
      
      // Add time entries for this week (only for selected client)
      const clientEntries = weekData.entries.filter((entry: any) => 
        entry.client && entry.client.id === client.id
      );
      
      clientEntries.forEach((entry: any) => {
        // Convert duration from string to number if needed
        const duration = typeof entry.adjustedDuration === 'number' 
          ? entry.adjustedDuration 
          : typeof entry.duration === 'number' 
            ? entry.duration 
            : parseFloat(entry.duration || '0');
        
        // Format hourly rate and amount in client's currency
        const hourlyRate = parseFloat(entry.hourlyRate);
        const amount = parseFloat(entry.amount);
        
        tableContent.push([
          entry.description,
          formatTime(duration, reportData.timeFormat),
          formatCurrency(hourlyRate, currency),
          formatCurrency(amount, currency)
        ]);
        
        subtotal += amount;
        totalHours += duration;
      });
    });
  } else if (invoice) {
    // Use invoice data directly
    subtotal = Number(invoice.subtotal);
    
    // TODO: Implement fetching time entries for this invoice if needed
    tableContent.push([
      {
        content: 'Services rendered',
        styles: {}
      },
      {
        content: 'See attached details',
        styles: {}
      },
      {
        content: '',
        styles: {}
      },
      {
        content: formatCurrency(subtotal, currency),
        styles: { halign: 'right' }
      }
    ]);
  }
  
  // Calculate tax based on settings
  let tax = invoice ? Number(invoice.tax) : 0;
  let taxRate = invoice ? Number(invoice.taxRate) : 0;
  
  // If no invoice is provided (we're generating a new one), use settings
  if (!invoice && settings.enableTax) {
    taxRate = Number(settings.defaultTaxRate);
    tax = subtotal * (taxRate / 100);
  }
  
  // Calculate total
  const total = invoice ? Number(invoice.total) : (subtotal + tax);
  
  tableContent.push([
    {
      content: 'Subtotal',
      colSpan: 3,
      styles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
    },
    {
      content: `$${subtotal.toFixed(2)}`,
      styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] }
    }
  ]);
  
  tableContent.push([
    {
      content: `Tax (${taxRate}%)`,
      colSpan: 3,
      styles: { fillColor: [255, 255, 255] }
    },
    {
      content: `$${tax.toFixed(2)}`,
      styles: { halign: 'right', fillColor: [255, 255, 255] }
    }
  ]);
  
  tableContent.push([
    {
      content: 'Total Due',
      colSpan: 3,
      styles: { fontStyle: 'bold', fillColor: [0, 165, 228, 0.1] }
    },
    {
      content: `$${total.toFixed(2)}`,
      styles: { halign: 'right', fontStyle: 'bold', fillColor: [0, 165, 228, 0.1], textColor: [0, 165, 228] }
    }
  ]);
  
  // Add table to document
  autoTable(doc, {
    startY: tableStartY,
    head: [['Description', 'Hours', 'Rate', 'Amount']],
    body: tableContent,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 165, 228],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      3: { halign: 'right' }
    }
  });
  
  // Add notes section
  const finalY = doc.previousAutoTable.finalY + 15;
  doc.setFont(undefined, 'bold');
  doc.text("Notes:", 14, finalY);
  doc.setFont(undefined, 'normal');
  doc.text(invNotes, 14, finalY + 8, { maxWidth: doc.internal.pageSize.width - 28 });
  
  // Add footer with page numbers
  const pageCount = doc.internal.getNumberOfPages();
  doc.setFontSize(10);
  doc.setTextColor(100);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
  }
}
