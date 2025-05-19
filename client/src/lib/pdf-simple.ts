import { TimeEntry, Client, Settings, Invoice } from "@shared/schema";
import { formatTime, formatCurrency } from "@/lib/utils/timeUtils";
import { format } from "date-fns";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type PdfOptions = {
  filename: string;
  type: "report" | "invoice";
  showDueDate?: boolean;
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
  const doc = new jsPDF();
  
  if (options.type === "report") {
    generateReportPdf(doc, autoTable, options.reportData, options.filters);
  } else {
    // Extract necessary information from options
    const {
      invoice,
      client,
      settings,
      reportData,
      invoiceNumber,
      issueDate,
      dueDate,
      notes,
      showDueDate
    } = options;

    generateInvoicePdf({
      doc,
      autoTable,
      client,
      settings,
      invoice,
      reportData,
      invoiceNumber,
      issueDate,
      dueDate,
      notes,
      showDueDateOption: showDueDate
    });
  }

  // Save the document
  doc.save(options.filename);
}

/**
 * Generates a report PDF
 */
function generateReportPdf(doc: any, autoTable: any, reportData: any, filters: any) {
  // Set up document
  doc.setFontSize(18);
  doc.text("Time Tracking Report", 14, 20);
  
  // Add report details
  doc.setFontSize(10);
  doc.setTextColor(100);
  
  let yPos = 30;
  
  // Add filter information
  if (filters) {
    const startDate = filters.startDate ? format(new Date(filters.startDate), 'MMMM d, yyyy') : 'All time';
    const endDate = filters.endDate ? format(new Date(filters.endDate), 'MMMM d, yyyy') : 'Present';
    
    doc.text(`Date Range: ${startDate} - ${endDate}`, 14, yPos);
    yPos += 5;
    
    if (filters.clientId) {
      const clientName = reportData.timeEntries?.[0]?.client?.name || 'Unknown Client';
      doc.text(`Client: ${clientName}`, 14, yPos);
      yPos += 5;
    }
    
    if (filters.projectId) {
      const projectName = reportData.timeEntries?.[0]?.project?.name || 'Unknown Project';
      doc.text(`Project: ${projectName}`, 14, yPos);
      yPos += 5;
    }
    
    doc.text(`Time Format: ${filters.timeFormat === 'decimal' ? 'Decimal' : 'HH:MM:SS'}`, 14, yPos);
    yPos += 5;
    
    if (filters.roundingType !== 'none') {
      const roundingTypes: Record<string, string> = {
        nearest_tenth: 'Nearest Tenth',
        nearest_quarter: 'Nearest Quarter',
        nearest_half: 'Nearest Half'
      };
      doc.text(`Rounding: ${roundingTypes[filters.roundingType] || filters.roundingType}`, 14, yPos);
      yPos += 5;
    }
    
    if (filters.timeAdjustment && filters.timeAdjustment.percentage > 0) {
      doc.text(`Time Adjustment: ${filters.timeAdjustment.increaseByPercentage ? '+' : '-'}${filters.timeAdjustment.percentage}%`, 14, yPos);
      yPos += 5;
    }
  }
  
  yPos += 5;
  
  // Table content
  const tableContent: any[] = [];
  
  // Add entries based on whether we have weeklyData or just timeEntries
  if (reportData.weeklyData && reportData.weeklyData.length > 0) {
    // Add weekly data
    reportData.weeklyData.forEach((weekData: any) => {
      // Add week header
      tableContent.push([
        {
          content: weekData.weekLabel,
          colSpan: 5,
          styles: { fillColor: [240, 240, 240], fontStyle: 'bold' }
        },
        {
          content: formatTime(weekData.totalDuration, filters.timeFormat),
          styles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
        }
      ]);
      
      // Add time entries for this week
      if (weekData.entries && weekData.entries.length > 0) {
        weekData.entries.forEach((entry: any) => {
          // Get the client currency or use USD as fallback
          const clientCurrency = entry.client?.currency || filters.clientId && reportData.timeEntries?.[0]?.client?.currency || 'USD';
          
          tableContent.push([
            format(new Date(entry.date), 'MMM d, yyyy'),
            entry.description,
            entry.client?.name || '—',
            entry.project?.name || '—',
            formatTime(entry.adjustedDuration || entry.duration, filters.timeFormat),
            formatCurrency(parseFloat(entry.amount), clientCurrency)
          ]);
        });
      }
    });
  } else if (reportData.timeEntries && reportData.timeEntries.length > 0) {
    // Handle case when there's no weekly data structure but direct timeEntries
    reportData.timeEntries.forEach((entry: any) => {
      const clientCurrency = entry.client?.currency || filters.clientId && reportData.timeEntries?.[0]?.client?.currency || 'USD';
      
      tableContent.push([
        format(new Date(entry.date || entry.startTime), 'MMM d, yyyy'),
        entry.description,
        entry.client?.name || '—',
        entry.project?.name || '—',
        formatTime(entry.adjustedDuration || entry.duration, filters.timeFormat),
        formatCurrency(parseFloat(entry.amount || '0'), clientCurrency)
      ]);
    });
  }
  
  // Add total row
  tableContent.push([
    {
      content: 'Total',
      colSpan: 4,
      styles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
    },
    {
      content: formatTime(
        typeof reportData.totalHours === 'number' 
          ? reportData.totalHours 
          : parseFloat(reportData.totalHours || '0'),
        filters.timeFormat
      ),
      styles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
    },
    {
      // Use the appropriate currency
      content: formatCurrency(
        reportData.totalAmount, 
        reportData.clientCurrency || (filters.clientId && reportData.timeEntries?.[0]?.client?.currency) || 'USD'
      ),
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
function generateInvoicePdf(options: {
  doc: any;
  autoTable: any;
  client: Client;
  settings: Settings;
  invoice?: Invoice;
  reportData?: any;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  showDueDateOption?: boolean;
}) {
  const { 
    doc, 
    autoTable, 
    client, 
    settings, 
    invoice, 
    reportData, 
    invoiceNumber, 
    issueDate, 
    dueDate, 
    notes,
    showDueDateOption
  } = options;
  
  // Use either the invoice data or the provided parameters
  const invNumber = invoice?.invoiceNumber || invoiceNumber || "DRAFT";
  const invIssueDate = invoice?.issueDate || issueDate || format(new Date(), 'yyyy-MM-dd');
  const invDueDate = invoice?.dueDate || dueDate || format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  
  // Parse the notes to extract additional items if present
  let invNotes = invoice?.notes || notes || "Thank you for your business.";
  let additionalItems: any[] = [];
  
  // First, check if reportData already has additionalItems
  if (reportData && reportData.additionalItems) {
    additionalItems = reportData.additionalItems;
    console.log("Using additional items from reportData:", additionalItems);
  }
  // Otherwise, try to extract from notes
  else if (invNotes && invNotes.includes("ADDITIONAL_ITEMS:")) {
    const parts = invNotes.split("ADDITIONAL_ITEMS:");
    invNotes = parts[0].trim(); // Extract the actual notes
    
    try {
      // Try to parse additional items
      const itemsJson = parts[1].trim();
      additionalItems = JSON.parse(itemsJson);
      console.log("Extracted additional items from notes:", additionalItems);
    } catch (e) {
      console.error("Failed to parse additional items:", e);
    }
  }
  
  // Determine which currency to use - client currency takes precedence
  const currencyToUse = client.currency || settings.defaultCurrency || 'USD';
  console.log("Using currency for PDF generation:", currencyToUse);
  
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
    client.city && client.state ? `${client.city}, ${client.state} ${client.zipCode || ''}` : 
      (client.city ? client.city : (client.state ? client.state : null)),
    client.country,
    client.email,
    client.taxId ? `Tax ID: ${client.taxId}` : null
  ].filter(Boolean);
  
  toLines.forEach(line => {
    if (line) {
      doc.text(line, doc.internal.pageSize.width / 2 + 10, toY);
      toY += 6;
    }
  });
  
  // Add invoice details
  const detailsYStart = Math.max(fromY, toY) + 10;
  let detailsY = detailsYStart;
  
  doc.text(`Invoice #: ${invNumber}`, 14, detailsY);
  detailsY += 6;
  
  doc.text(`Issue Date: ${format(new Date(invIssueDate), 'MMMM d, yyyy')}`, 14, detailsY);
  detailsY += 6;
  
  // Only show due date if it's enabled
  if (showDueDateOption !== false) {
    doc.text(`Due Date: ${format(new Date(invDueDate), 'MMMM d, yyyy')}`, 14, detailsY);
    detailsY += 6;
  }
  
  // Payment details
  let paymentY = detailsYStart + 8;
  doc.text(`Bank Name: ${settings.bankName || ''}`, doc.internal.pageSize.width / 2 + 10, paymentY);
  paymentY += 6;
  doc.text(`Account Name: ${settings.bankAccountName || ''}`, doc.internal.pageSize.width / 2 + 10, paymentY);
  paymentY += 6;
  doc.text(`Account Number: ${settings.bankAccountNumber || ''}`, doc.internal.pageSize.width / 2 + 10, paymentY);
  paymentY += 6;
  
  if (settings.bankSortCode) {
    doc.text(`Sort Code: ${settings.bankSortCode}`, doc.internal.pageSize.width / 2 + 10, paymentY);
    paymentY += 6;
  }
  
  // Table for time entries
  const tableContent: any[] = [];
  const tableStartY = Math.max(detailsY, paymentY) + 15;
  
  let subtotal = 0;
  let totalHours = 0;
  
  // Get time entries in one of multiple potential formats
  const timeEntries = 
    (reportData && reportData.timeEntries && reportData.timeEntries.length > 0) ? reportData.timeEntries : 
    (reportData && reportData.weeklyData) ? reportData.weeklyData.flatMap((week: any) => week.entries || []) : 
    [];
  
  console.log(`Adding ${timeEntries.length} time entries to invoice PDF`);
  
  if (timeEntries.length > 0) {
    // Add each time entry to the table
    timeEntries.forEach((entry: any) => {
      // Use edited duration if available, otherwise normal duration
      const duration = typeof entry.editedDuration === 'number' 
        ? entry.editedDuration 
        : typeof entry.adjustedDuration === 'number'
          ? entry.adjustedDuration
          : typeof entry.duration === 'number'
            ? entry.duration
            : parseFloat(String(entry.duration || '0'));
      
      // Get the hourly rate from project data
      let hourlyRate = 0;
      if (entry.project && typeof entry.project === 'object') {
        if (entry.project.hourlyRate) {
          hourlyRate = parseFloat(String(entry.project.hourlyRate));
        }
      }
      
      // Use the edited amount if available, otherwise calculate from duration and rate
      const amount = entry.editedAmount !== undefined
        ? parseFloat(String(entry.editedAmount))
        : entry.amount !== undefined
          ? parseFloat(String(entry.amount))
          : duration * hourlyRate;
      
      console.log(`Entry: ${entry.description}, Duration: ${duration}, Rate: ${hourlyRate}, Amount: ${amount}`);
      
      tableContent.push([
        entry.description,
        formatTime(duration, reportData?.timeFormat || 'decimal'),
        formatCurrency(hourlyRate, currencyToUse),
        formatCurrency(amount, currencyToUse)
      ]);
      
      subtotal += amount;
      totalHours += duration;
    });
  } else {
    console.log("No time entries found for invoice PDF");
    // Add an empty row if no entries
    tableContent.push([
      "No time entries found",
      "",
      "",
      ""
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
  
  // If reportData has a calculated total, use that
  const total = reportData && typeof reportData.totalAmount === 'number' 
    ? reportData.totalAmount 
    : invoice ? Number(invoice.total) : (subtotal + tax);
  
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
    },
    styles: {
      overflow: 'linebreak',
      cellWidth: 'wrap',
      cellPadding: 5
    },
    margin: { top: 10 }
  });
  
  // Add totals section
  const finalY = (doc as any).lastAutoTable.finalY || tableStartY + 50;
  
  // Start with subtitle
  let totalY = finalY + 15;
  
  // Add subtotal row
  doc.setFontSize(10);
  doc.text('Subtotal:', doc.internal.pageSize.width - 60, totalY);
  doc.text(formatCurrency(subtotal, currencyToUse), doc.internal.pageSize.width - 15, totalY, { align: 'right' });
  totalY += 6;
  
  // Add additional items if present
  if (additionalItems && additionalItems.length > 0) {
    additionalItems.forEach((item: any) => {
      doc.text(item.description + ':', doc.internal.pageSize.width - 60, totalY);
      doc.text(formatCurrency(Number(item.amount), currencyToUse), doc.internal.pageSize.width - 15, totalY, { align: 'right' });
      totalY += 6;
    });
  }
  
  // Add tax if applicable
  if (tax > 0) {
    doc.text(`Tax (${taxRate}%):`, doc.internal.pageSize.width - 60, totalY);
    doc.text(formatCurrency(tax, currencyToUse), doc.internal.pageSize.width - 15, totalY, { align: 'right' });
    totalY += 6;
  }
  
  // Add total due
  totalY += 2; // Add a bit more space
  doc.setFillColor(0, 165, 228); // Light blue
  doc.rect(doc.internal.pageSize.width - 100, totalY - 5, 100, 8, 'F');
  doc.setTextColor(255); // White text
  doc.setFontSize(12);
  doc.text('Total Due:', doc.internal.pageSize.width - 60, totalY);
  doc.text(formatCurrency(total, currencyToUse), doc.internal.pageSize.width - 15, totalY, { align: 'right' });
  doc.setTextColor(0); // Reset to black
  doc.setFontSize(10);
  totalY += 15;
  
  // Add notes
  if (invNotes) {
    doc.setFontSize(11);
    doc.text('Notes:', 14, totalY);
    totalY += 6;
    
    // Split notes into lines
    const notesLines = doc.splitTextToSize(invNotes, 180);
    notesLines.forEach((line: string) => {
      doc.text(line, 14, totalY);
      totalY += 5;
    });
  }
  
  // Add page number
  const pageCount = doc.internal.getNumberOfPages();
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Page ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
}