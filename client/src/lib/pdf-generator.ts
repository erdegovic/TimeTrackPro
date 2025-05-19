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
export function generatePdf(options: PdfOptions): void {
  const doc = new jsPDF();
  
  if (options.type === "report") {
    generateReportPdf(doc, autoTable, options.reportData, options.filters);
  } else {
    // Extract necessary information for invoice generation
    const {
      client,
      settings,
      invoice,
      reportData,
      invoiceNumber,
      issueDate,
      dueDate,
      notes,
      showDueDate
    } = options;

    // Use either the invoice data or the provided parameters
    const invNumber = invoice?.invoiceNumber || invoiceNumber || "DRAFT";
    const invIssueDate = invoice?.issueDate || issueDate || format(new Date(), 'yyyy-MM-dd');
    const invDueDate = invoice?.dueDate || dueDate || format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    const invNotes = invoice?.notes || notes || "";
    
    // Parse additional items if they're in the notes
    let additionalItems: any[] = [];
    let cleanNotes = invNotes;
    
    // If reportData has additionalItems directly, use those
    if (reportData && Array.isArray(reportData.additionalItems)) {
      additionalItems = reportData.additionalItems;
    }
    // Otherwise try to extract from notes
    else if (invNotes && invNotes.includes("ADDITIONAL_ITEMS:")) {
      try {
        const parts = invNotes.split("ADDITIONAL_ITEMS:");
        cleanNotes = parts[0].trim();
        additionalItems = JSON.parse(parts[1].trim());
      } catch (e) {
        console.error("Failed to parse additional items from notes:", e);
      }
    }
    
    // Determine currency to use throughout the document
    const currency = client.currency || settings.defaultCurrency || 'USD';
    
    // Document Header
    doc.setFontSize(20);
    doc.text("INVOICE", 14, 20);
    
    doc.setFontSize(14);
    doc.text(invNumber, 14, 28);
    
    // Business/Client Information
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("From:", 14, 40);
    doc.text("To:", doc.internal.pageSize.width / 2 + 10, 40);
    doc.setFont(undefined, 'normal');
    
    // From section (business details)
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
    
    // To section (client details)
    let toY = 48;
    const toLines = [
      client.name,
      client.address,
      `${client.city || ''}, ${client.state || ''} ${client.zipCode || ''}`.trim().replace(/^,\s*/, ''),
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
    let detailsY = detailsYStart;
    
    doc.text(`Invoice #: ${invNumber}`, 14, detailsY);
    detailsY += 6;
    
    doc.text(`Issue Date: ${format(new Date(invIssueDate), 'MMMM d, yyyy')}`, 14, detailsY);
    detailsY += 6;
    
    // Only show due date if specified
    if (showDueDate !== false) {
      doc.text(`Due Date: ${format(new Date(invDueDate), 'MMMM d, yyyy')}`, 14, detailsY);
      detailsY += 6;
    }
    
    // Payment information
    let paymentY = detailsYStart;
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
    
    // Determine if we have time entries and how to format them
    const timeEntries = reportData?.timeEntries || [];
    
    // Add each time entry
    timeEntries.forEach((entry: any) => {
      // Use edited duration if available, otherwise use normal duration
      const duration = typeof entry.editedDuration === 'number' 
        ? entry.editedDuration 
        : parseFloat(String(entry.duration || 0));
      
      // Get rate from project
      let hourlyRate = 0;
      if (entry.project && entry.project.hourlyRate) {
        hourlyRate = parseFloat(String(entry.project.hourlyRate));
      }
      
      // Calculate amount or use edited amount
      let amount = entry.editedAmount !== undefined 
        ? parseFloat(String(entry.editedAmount))
        : duration * hourlyRate;
      
      // Add to table
      tableContent.push([
        entry.description,
        formatTime(duration, settings.defaultTimeFormat || 'decimal'),
        formatCurrency(hourlyRate, currency),
        formatCurrency(amount, currency)
      ]);
      
      subtotal += amount;
    });
    
    // If we don't have any time entries, add a placeholder row
    if (tableContent.length === 0) {
      tableContent.push(["No time entries", "", "", ""]);
    }
    
    // Add the table to the document
    autoTable(doc, {
      head: [['Description', 'Hours', 'Rate', 'Amount']],
      body: tableContent,
      startY: tableStartY,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      }
    });
    
    // Determine total with tax and additional items
    const finalY = (doc as any).lastAutoTable.finalY;
    let totalY = finalY + 15;
    
    // Add subtotal
    doc.setFontSize(10);
    doc.text('Subtotal:', doc.internal.pageSize.width - 60, totalY);
    doc.text(formatCurrency(subtotal, currency), doc.internal.pageSize.width - 15, totalY, { align: 'right' });
    totalY += 6;
    
    // Add additional items if any
    if (additionalItems && additionalItems.length > 0) {
      additionalItems.forEach(item => {
        doc.text(`${item.description}:`, doc.internal.pageSize.width - 60, totalY);
        doc.text(formatCurrency(parseFloat(String(item.amount || 0)), currency), doc.internal.pageSize.width - 15, totalY, { align: 'right' });
        totalY += 6;
      });
    }
    
    // Add tax if applicable
    let tax = 0;
    let taxRate = 0;
    
    if (invoice) {
      // Use invoice tax values if available
      tax = parseFloat(String(invoice.tax || 0));
      taxRate = parseFloat(String(invoice.taxRate || 0));
    } else if (settings.enableTax) {
      // Otherwise calculate from settings
      taxRate = parseFloat(String(settings.defaultTaxRate || 0));
      tax = subtotal * (taxRate / 100);
    }
    
    if (tax > 0) {
      doc.text(`Tax (${taxRate}%):`, doc.internal.pageSize.width - 60, totalY);
      doc.text(formatCurrency(tax, currency), doc.internal.pageSize.width - 15, totalY, { align: 'right' });
      totalY += 6;
    }
    
    // Add total amount
    const totalAmount = subtotal + tax + 
      (additionalItems && additionalItems.length > 0 
        ? additionalItems.reduce((sum, item) => sum + parseFloat(String(item.amount || 0)), 0) 
        : 0);
    
    totalY += 2;
    doc.setFillColor(59, 130, 246);
    doc.rect(doc.internal.pageSize.width - 80, totalY - 5, 80, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text('Total Due:', doc.internal.pageSize.width - 60, totalY);
    doc.text(formatCurrency(totalAmount, currency), doc.internal.pageSize.width - 15, totalY, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    totalY += 15;
    
    // Add notes if present
    if (cleanNotes) {
      doc.setFontSize(10);
      doc.text('Notes:', 14, totalY);
      totalY += 6;
      
      const notesLines = doc.splitTextToSize(cleanNotes, doc.internal.pageSize.width - 30);
      notesLines.forEach((line: string) => {
        doc.text(line, 14, totalY);
        totalY += 5;
      });
    }
    
    // Add page number
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Page 1 of 1`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
  }

  // Save the PDF
  doc.save(options.filename);
}

/**
 * Generates a report PDF
 */
function generateReportPdf(doc: any, autoTable: any, reportData: any, filters: any) {
  // Set up document
  doc.setFontSize(20);
  doc.text("Time Tracking Report", 14, 20);
  
  // Add filter information
  doc.setFontSize(10);
  doc.setTextColor(100);
  
  let yPos = 30;
  
  // Date range
  if (filters) {
    const startDate = filters.startDate ? format(new Date(filters.startDate), 'MMMM d, yyyy') : 'All time';
    const endDate = filters.endDate ? format(new Date(filters.endDate), 'MMMM d, yyyy') : 'Present';
    
    doc.text(`Date Range: ${startDate} - ${endDate}`, 14, yPos);
    yPos += 5;
    
    // Client
    if (filters.clientId) {
      const clientName = reportData.timeEntries?.[0]?.client?.name || 'Unknown Client';
      doc.text(`Client: ${clientName}`, 14, yPos);
      yPos += 5;
    }
    
    // Project
    if (filters.projectId) {
      const projectName = reportData.timeEntries?.[0]?.project?.name || 'Unknown Project';
      doc.text(`Project: ${projectName}`, 14, yPos);
      yPos += 5;
    }
    
    // Time format
    doc.text(`Time Format: ${filters.timeFormat === 'decimal' ? 'Decimal' : 'HH:MM:SS'}`, 14, yPos);
    yPos += 5;
    
    // Rounding type
    if (filters.roundingType !== 'none') {
      const roundingTypes: Record<string, string> = {
        nearest_tenth: 'Nearest Tenth',
        nearest_quarter: 'Nearest Quarter',
        nearest_half: 'Nearest Half'
      };
      doc.text(`Rounding: ${roundingTypes[filters.roundingType] || filters.roundingType}`, 14, yPos);
      yPos += 5;
    }
    
    // Time adjustment
    if (filters.timeAdjustment && filters.timeAdjustment.percentage > 0) {
      doc.text(`Time Adjustment: ${filters.timeAdjustment.increaseByPercentage ? '+' : '-'}${filters.timeAdjustment.percentage}%`, 14, yPos);
      yPos += 5;
    }
  }
  
  yPos += 10;
  
  // Table content
  const tableContent: any[] = [];
  
  // Determine the currency to use for the report
  const currency = filters.clientId && reportData.timeEntries?.length > 0 && reportData.timeEntries[0].client
    ? reportData.timeEntries[0].client.currency
    : 'USD';
  
  // Add entries
  if (reportData.weeklyData && reportData.weeklyData.length > 0) {
    // Group by week
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
          tableContent.push([
            format(new Date(entry.date), 'MMM d, yyyy'),
            entry.description,
            entry.client?.name || '—',
            entry.project?.name || '—',
            formatTime(entry.adjustedDuration || entry.duration, filters.timeFormat),
            formatCurrency(parseFloat(entry.amount || '0'), currency)
          ]);
        });
      }
    });
  } else if (reportData.timeEntries && reportData.timeEntries.length > 0) {
    // Flat list of entries
    reportData.timeEntries.forEach((entry: any) => {
      tableContent.push([
        format(new Date(entry.date || entry.startTime), 'MMM d, yyyy'),
        entry.description,
        entry.client?.name || '—',
        entry.project?.name || '—', 
        formatTime(entry.adjustedDuration || entry.duration, filters.timeFormat),
        formatCurrency(parseFloat(entry.amount || '0'), currency)
      ]);
    });
  } else {
    // No entries
    tableContent.push(['No time entries found', '', '', '', '', '']);
  }
  
  // Add total row
  tableContent.push([
    {
      content: 'Total',
      colSpan: 4,
      styles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
    },
    {
      content: formatTime(reportData.totalHours || 0, filters.timeFormat),
      styles: { fontStyle: 'bold', fillColor: [240, 240, 240] }
    },
    {
      content: formatCurrency(reportData.totalAmount || 0, currency),
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
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      5: { halign: 'right' }
    }
  });
  
  // Add generation date at the bottom
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on ${format(new Date(), 'MMMM d, yyyy')}`, 14, doc.internal.pageSize.height - 10);
  doc.text(`Page 1 of 1`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
}