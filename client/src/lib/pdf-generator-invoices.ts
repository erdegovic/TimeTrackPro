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
 * Generates a PDF file for invoices
 * @param options - Options for PDF generation
 */
export async function generateInvoicePdf(options: PdfOptions): Promise<void> {
  const doc = new jsPDF();
  
  if (options.type === "invoice") {
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

    // Use either the invoice data or the provided parameters
    const invNumber = invoice?.invoiceNumber || invoiceNumber || "DRAFT";
    const invIssueDate = invoice?.issueDate || issueDate || format(new Date(), 'yyyy-MM-dd');
    const invDueDate = invoice?.dueDate || dueDate || format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    let invNotes = invoice?.notes || notes || "Thank you for your business.";
    
    // Parse additional items from notes if present
    let additionalItems: any[] = [];
    
    // If reportData has additionalItems, use those first
    if (reportData && reportData.additionalItems) {
      additionalItems = reportData.additionalItems;
    } 
    // Otherwise extract from notes
    else if (invNotes && invNotes.includes("ADDITIONAL_ITEMS:")) {
      try {
        const parts = invNotes.split("ADDITIONAL_ITEMS:");
        invNotes = parts[0].trim();
        additionalItems = JSON.parse(parts[1].trim());
        console.log("Extracted additional items from notes:", additionalItems);
      } catch (e) {
        console.error("Failed to parse additional items from notes:", e);
      }
    }
    
    // Determine which currency to use - client currency takes precedence
    const clientCurrency = client.currency || settings.defaultCurrency || 'USD';
    console.log("Using currency for PDF:", clientCurrency);
    
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
    if (showDueDate !== false) {
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
    const tableStartY = Math.max(detailsY, paymentY) + 15;
    const tableContent: any[] = [];
    
    let subtotal = 0;
    let totalHours = 0;
    
    // Get time entries for the invoice
    if (reportData && reportData.timeEntries && reportData.timeEntries.length > 0) {
      // Directly output the time entries without weekly breakdown
      const entries = reportData.timeEntries;
      console.log(`Adding ${entries.length} time entries to invoice PDF`);
      
      entries.forEach((entry: any) => {
        // Get hourly rate from project if available, default to 0
        let hourlyRate = 0;
        if (entry.project && typeof entry.project === 'object' && entry.project.hourlyRate) {
          hourlyRate = parseFloat(String(entry.project.hourlyRate));
        }
        
        // Get duration or edited duration if available
        const duration = typeof entry.editedDuration === 'number' 
          ? entry.editedDuration 
          : parseFloat(String(entry.duration || 0));
        
        // Calculate amount based on duration and rate
        let amount = duration * hourlyRate;
        // Use edited amount if available
        if (typeof entry.editedAmount === 'number') {
          amount = entry.editedAmount;
        }
        
        // Add row to table
        tableContent.push([
          entry.description,
          formatTime(duration, reportData.timeFormat || 'decimal'),
          formatCurrency(hourlyRate, clientCurrency),
          formatCurrency(amount, clientCurrency)
        ]);
        
        // Update totals
        subtotal += amount;
        totalHours += duration;
      });
    }
    
    // Calculate tax based on settings or invoice
    let tax = invoice ? Number(invoice.tax) : 0;
    let taxRate = invoice ? Number(invoice.taxRate) : 0;
    
    // If no invoice is provided (we're generating a new one), use settings
    if (!invoice && settings.enableTax) {
      taxRate = Number(settings.defaultTaxRate);
      tax = subtotal * (taxRate / 100);
    }
    
    // Use the reportData's total if available
    const total = reportData && typeof reportData.totalAmount === 'number' 
      ? reportData.totalAmount 
      : invoice ? Number(invoice.total) : (subtotal + tax);
    
    // Draw the table
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
    doc.text(formatCurrency(subtotal, clientCurrency), doc.internal.pageSize.width - 15, totalY, { align: 'right' });
    totalY += 6;
    
    // Add additional items if present
    if (additionalItems && additionalItems.length > 0) {
      additionalItems.forEach((item: any) => {
        doc.text(item.description + ':', doc.internal.pageSize.width - 60, totalY);
        doc.text(formatCurrency(Number(item.amount), clientCurrency), doc.internal.pageSize.width - 15, totalY, { align: 'right' });
        totalY += 6;
      });
    }
    
    // Add tax if applicable
    if (tax > 0) {
      doc.text(`Tax (${taxRate}%):`, doc.internal.pageSize.width - 60, totalY);
      doc.text(formatCurrency(tax, clientCurrency), doc.internal.pageSize.width - 15, totalY, { align: 'right' });
      totalY += 6;
    }
    
    // Add total due
    totalY += 2; // Add a bit more space
    doc.setFillColor(0, 165, 228); // Light blue
    doc.rect(doc.internal.pageSize.width - 100, totalY - 5, 100, 8, 'F');
    doc.setTextColor(255); // White text
    doc.setFontSize(12);
    doc.text('Total Due:', doc.internal.pageSize.width - 60, totalY);
    doc.text(formatCurrency(total, clientCurrency), doc.internal.pageSize.width - 15, totalY, { align: 'right' });
    doc.setTextColor(0); // Reset to black
    doc.setFontSize(10);
    totalY += 15;
    
    // Add notes
    if (invNotes) {
      doc.setFontSize(11);
      doc.text('Notes:', 14, totalY);
      totalY += 6;
      
      // Split notes into lines that fit page width
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

  // Save the document
  doc.save(options.filename);
}