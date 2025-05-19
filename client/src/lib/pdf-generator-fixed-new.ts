import { TimeEntry, Client, Settings, Invoice } from "@shared/schema";
import { formatTime, formatCurrency, convertCurrency } from "@/lib/utils/timeUtils";
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
  
  console.log("PDF Generation - Starting with options:", JSON.stringify({
    type: options.type,
    filename: options.filename,
    hasInvoice: !!options.type === 'invoice' && !!(options as any).invoice,
    hasReportData: !!options.reportData,
    timeEntriesCount: options.reportData?.timeEntries?.length || 0
  }));
  
  if (options.reportData?.timeEntries) {
    console.log("PDF Generation - First few time entries sample:", 
      JSON.stringify(options.reportData.timeEntries.slice(0, 2), null, 2));
  }
  
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
      const clientName = reportData.timeEntries[0]?.client?.name || 'Unknown Client';
      doc.text(`Client: ${clientName}`, 14, yPos);
      yPos += 5;
    }
    
    if (filters.projectId) {
      const projectName = reportData.timeEntries[0]?.project?.name || 'Unknown Project';
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
    weekData.entries.forEach((entry: any) => {
      // Get the client currency or use USD as fallback
      const clientCurrency = entry.client?.currency || 'USD';
      
      tableContent.push([
        format(new Date(entry.date), 'MMM d, yyyy'),
        entry.description,
        entry.client?.name || '—',
        entry.project?.name || '—',
        formatTime(entry.adjustedDuration || entry.duration, filters.timeFormat),
        formatCurrency(parseFloat(entry.amount), clientCurrency)
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
      content: formatTime(
        typeof reportData.totalHours === 'number' 
          ? reportData.totalHours 
          : parseFloat(reportData.totalHours || '0'),
        filters.timeFormat
      ),
      styles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
    },
    {
      // Use the client's currency if filtering by client
      content: formatCurrency(
        reportData.totalAmount, 
        filters.clientId && reportData.timeEntries[0]?.client?.currency || 'USD'
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
  
  // Extract additional items from notes if present
  if (invNotes.includes("ADDITIONAL_ITEMS:")) {
    const parts = invNotes.split("ADDITIONAL_ITEMS:");
    invNotes = parts[0].trim(); // Extract the actual notes
    
    try {
      // Try to parse additional items
      const itemsJson = parts[1].trim();
      additionalItems = JSON.parse(itemsJson);
      console.log("Found additional items in notes:", additionalItems);
    } catch (e) {
      console.error("Failed to parse additional items:", e);
    }
  }
  
  // Determine which currency to use - client currency takes precedence
  const currencyToUse = client.currency || 'USD';
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
  
  // Get the currency symbol for the used currency
  const currencySymbol = currencyToUse === 'GBP' ? '£' : currencyToUse === 'EUR' ? '€' : '$';
  
  if (reportData) {
    // Use report data for generating invoice
    if (reportData.weeklyData) {
      reportData.weeklyData.forEach((weekData: any) => {
        // Add week header
        tableContent.push([
          {
            content: weekData.weekLabel,
            colSpan: 3,
            styles: { fillColor: [240, 240, 240], fontStyle: 'bold' }
          },
          {
            content: formatCurrency(weekData.totalAmount, currencyToUse),
            styles: { halign: 'right', fillColor: [240, 240, 240], fontStyle: 'bold' }
          }
        ]);
        
        // Add time entries for this week (only for selected client)
        const clientEntries = weekData.entries.filter((entry: any) => 
          entry.client && entry.client.id === client.id
        );
        
        clientEntries.forEach((entry: any) => {
          // Use edited duration if available
          const duration = typeof entry.editedDuration === 'number' 
            ? entry.editedDuration 
            : typeof entry.adjustedDuration === 'number' 
              ? entry.adjustedDuration 
              : typeof entry.duration === 'number' 
                ? entry.duration 
                : parseFloat(entry.duration || '0');
          
          // Format hourly rate and amount in client's currency
          // Just use the hourly rate value that is passed with the entry or a default
          const hourlyRate = typeof entry.hourlyRate === 'number' 
            ? entry.hourlyRate 
            : parseFloat(String(entry.hourlyRate || '0'));
          // Use the edited amount if available
          const amount = parseFloat(String(entry.editedAmount || entry.amount || '0'));
          
          tableContent.push([
            entry.description,
            formatTime(duration, reportData.timeFormat || 'decimal'),
            formatCurrency(hourlyRate, currencyToUse),
            formatCurrency(amount, currencyToUse)
          ]);
          
          subtotal += amount;
          totalHours += duration;
        });
      });
    } else if (reportData.timeEntries) {
      // Directly use time entries without weekly grouping
      reportData.timeEntries.forEach((entry: any) => {
        // Make sure we use the most up-to-date edited duration
        // Check all possible sources for edited duration in this priority order
        const duration = 
          // 1. Explicit editedDuration property (set by the invoice editor)
          typeof entry.editedDuration === 'number' ? entry.editedDuration :
          // 2. Adjusted duration from time adjustment in reports
          typeof entry.adjustedDuration === 'number' ? entry.adjustedDuration :
          // 3. Regular duration as a number
          typeof entry.duration === 'number' ? entry.duration :
          // 4. Duration as a string that needs parsing
          parseFloat(entry.duration || '0');
        
        // Get the hourly rate safely - handle the type issue
        let hourlyRate = 0;
        if (entry.project && typeof entry.project === 'object') {
          // Access hourlyRate from project safely
          const projectData = entry.project as any;
          hourlyRate = parseFloat(String(projectData.hourlyRate || '0'));
        } else if (typeof entry.hourlyRate !== 'undefined') {
          // Direct hourly rate on the entry
          hourlyRate = parseFloat(String(entry.hourlyRate || '0'));
        }
        
        // Calculate the amount, prioritizing any explicitly edited amount
        const amount = 
          // 1. Explicit editedAmount property
          typeof entry.editedAmount !== 'undefined' ? parseFloat(String(entry.editedAmount)) :
          // 2. Explicit amount property
          typeof entry.amount !== 'undefined' && entry.amount !== null ? parseFloat(String(entry.amount)) :
          // 3. Calculate from duration and hourly rate
          duration * hourlyRate;
        
        tableContent.push([
          entry.description,
          formatTime(duration, reportData.timeFormat || 'decimal'),
          formatCurrency(hourlyRate, currencyToUse),
          formatCurrency(amount, currencyToUse)
        ]);
        
        subtotal += amount;
        totalHours += duration;
      });
    }
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
  const total = reportData && typeof reportData.total === 'number' 
    ? reportData.total 
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
  
  // Add additional items if present (from reportData or extracted from notes)
  const itemsToDisplay = reportData?.additionalItems || additionalItems;
  if (itemsToDisplay && itemsToDisplay.length > 0) {
    itemsToDisplay.forEach((item: any) => {
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