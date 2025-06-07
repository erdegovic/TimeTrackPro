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

// Template configurations
const invoiceTemplates = {
  professional: {
    headerStyle: "border-b border-gray-300 pb-4",
    titleSize: "text-3xl",
    spacing: "mb-8",
    colors: { primary: "#1f2937", accent: "#3b82f6" }
  },
  modern: {
    headerStyle: "relative",
    titleSize: "text-4xl",
    spacing: "mb-8",
    colors: { primary: "#1f2937", accent: "#3b82f6" }
  },
  classic: {
    headerStyle: "text-center border-b border-gray-300 pb-6",
    titleSize: "text-2xl",
    spacing: "mb-8",
    colors: { primary: "#1f2937", accent: "#3b82f6" }
  },
  minimal: {
    headerStyle: "border-b border-gray-200 pb-4",
    titleSize: "text-xl",
    spacing: "mb-6",
    colors: { primary: "#1f2937", accent: "#3b82f6" }
  },
  media: {
    headerStyle: "bg-gradient-to-r border-4 border-gray-800 p-6",
    titleSize: "text-4xl",
    spacing: "mb-8",
    colors: { primary: "#991b1b", accent: "#ef4444" }
  }
};

/**
 * Enhanced PDF generator with proper template support and duration parsing
 */
export async function generatePdf(options: PdfOptions): Promise<void> {
  const doc = new jsPDF();
  
  console.log("Enhanced PDF Generation - Starting with options:", {
    type: options.type,
    filename: options.filename,
    hasInvoice: options.type === 'invoice' && !!(options as any).invoice,
    hasReportData: !!options.reportData,
    timeEntriesCount: options.reportData?.timeEntries?.length || 0,
    template: options.type === 'invoice' ? (options as any).settings?.invoiceTemplate : 'N/A'
  });
  
  if (options.type === "invoice") {
    const invoiceOptions = options as Extract<PdfOptions, { type: "invoice" }>;
    generateInvoicePdf({
      doc,
      autoTable,
      client: invoiceOptions.client,
      settings: invoiceOptions.settings,
      invoice: invoiceOptions.invoice,
      reportData: invoiceOptions.reportData,
      invoiceNumber: invoiceOptions.invoiceNumber,
      issueDate: invoiceOptions.issueDate,
      dueDate: invoiceOptions.dueDate,
      notes: invoiceOptions.notes,
      showDueDateOption: invoiceOptions.showDueDate
    });
  } else {
    const reportOptions = options as Extract<PdfOptions, { type: "report" }>;
    generateReportPdf({
      doc,
      autoTable,
      reportData: reportOptions.reportData,
      filters: reportOptions.filters
    });
  }

  doc.save(options.filename);
}

/**
 * Generates an invoice PDF with proper template styling
 */
function generateInvoicePdf({
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
}: {
  doc: jsPDF;
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
  const template = settings.invoiceTemplate || 'professional';
  const templateConfig = invoiceTemplates[template as keyof typeof invoiceTemplates] || invoiceTemplates.professional;
  
  console.log("Generating invoice PDF with template:", template);
  
  // Parse colors from settings
  const primaryColor = hexToRgb(settings.invoiceColorTheme || templateConfig.colors.primary);
  const accentColor = hexToRgb(settings.invoiceAccentColor || templateConfig.colors.accent);
  const textColor = hexToRgb(settings.invoiceTextColor || "#374151");
  const backgroundColor = hexToRgb(settings.invoiceBackgroundColor || "#ffffff");
  
  const fontSize = parseInt(settings.customFontSize || "12");
  let yPosition = 20;
  
  // Modern template with gradient header
  if (template === 'modern') {
    // Create gradient-like header using rectangles
    const headerHeight = 60;
    doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.rect(0, 0, doc.internal.pageSize.width, headerHeight, 'F');
    
    // Gradient effect with accent color
    doc.setFillColor(accentColor.r, accentColor.g, accentColor.b);
    doc.rect(0, headerHeight * 0.6, doc.internal.pageSize.width, headerHeight * 0.4, 'F');
    
    // Company name in white
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(fontSize + 10);
    doc.setFont("helvetica", "bold");
    if (settings.showBusinessName !== false) {
      doc.text(settings.businessName?.toUpperCase() || "YOUR BUSINESS NAME", 20, 25);
    }
    
    // Company details in smaller white text
    if (settings.showCompanyDetails !== false) {
      doc.setFontSize(fontSize - 2);
      doc.setFont("helvetica", "normal");
      let detailY = 35;
      
      if (settings.businessAddress) {
        doc.text(settings.businessAddress, 20, detailY);
        detailY += 5;
      }
      
      const cityStateZip = [settings.businessCity, settings.businessState, settings.businessZipCode]
        .filter(Boolean).join(", ");
      if (cityStateZip) {
        doc.text(cityStateZip, 20, detailY);
        detailY += 5;
      }
      
      if (settings.businessEmail) {
        doc.text(settings.businessEmail, 20, detailY);
      }
    }
    
    // Invoice details on the right
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(fontSize + 4);
    doc.setFont("helvetica", "bold");
    doc.text(`INV #${invoiceNumber || invoice?.invoiceNumber || "1001"}`, doc.internal.pageSize.width - 20, 25, { align: "right" });
    
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.text(`Issued: ${issueDate || format(new Date(), 'yyyy-MM-dd')}`, doc.internal.pageSize.width - 20, 35, { align: "right" });
    
    if (showDueDateOption && dueDate) {
      doc.text(`Due: ${dueDate}`, doc.internal.pageSize.width - 20, 42, { align: "right" });
    }
    
    yPosition = headerHeight + 20;
  } else if (template === 'media') {
    // Media template matching settings preview design
    
    // Colored top bar like in settings
    const topBarHeight = 3;
    doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.rect(0, 0, doc.internal.pageSize.width, topBarHeight, 'F');
    
    // Add accent color overlay
    doc.setFillColor(accentColor.r, accentColor.g, accentColor.b);
    doc.rect(doc.internal.pageSize.width * 0.7, 0, doc.internal.pageSize.width * 0.3, topBarHeight, 'F');
    
    yPosition = 30; // Start below the top bar with padding
    
    // Header section exactly like settings preview
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.setFontSize(fontSize + 12);
    doc.setFont("helvetica", "bold");
    if (settings.showBusinessName !== false) {
      doc.text(settings.businessName?.toUpperCase() || "AE PRODUCTIONS", 30, yPosition);
    }
    
    // Professional media services subtitle
    yPosition += 8;
    doc.setTextColor(textColor.r, textColor.g, textColor.b);
    doc.setFontSize(fontSize - 1);
    doc.setFont("helvetica", "normal");
    doc.text("Professional media services", 30, yPosition);
    
    // Invoice details on the right
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.setFontSize(fontSize + 4);
    doc.setFont("helvetica", "bold");
    doc.text(`INV #${invoiceNumber || invoice?.invoiceNumber || "1001"}`, doc.internal.pageSize.width - 30, 30, { align: "right" });
    
    doc.setTextColor(textColor.r, textColor.g, textColor.b);
    doc.setFontSize(fontSize - 1);
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${issueDate || format(new Date(), 'yyyy-MM-dd')}`, doc.internal.pageSize.width - 30, 38, { align: "right" });
    
    if (showDueDateOption && dueDate) {
      doc.text(`Due: ${dueDate}`, doc.internal.pageSize.width - 30, 45, { align: "right" });
    }
    
    yPosition += 10;
    
    // Business details section
    if (settings.showCompanyDetails !== false) {
      doc.setTextColor(textColor.r, textColor.g, textColor.b);
      doc.setFontSize(fontSize - 2);
      doc.setFont("helvetica", "normal");
      
      if (settings.businessAddress) {
        doc.text(settings.businessAddress, 30, yPosition);
        yPosition += 5;
      }
      
      const cityStateZip = [settings.businessCity, settings.businessState, settings.businessZipCode]
        .filter(Boolean).join(", ");
      if (cityStateZip) {
        doc.text(cityStateZip, 30, yPosition);
        yPosition += 5;
      }
      
      if (settings.businessEmail) {
        doc.text(settings.businessEmail, 30, yPosition);
        yPosition += 5;
      }
      
      if (settings.businessPhone) {
        doc.text(settings.businessPhone, 30, yPosition);
        yPosition += 5;
      }
    }
    
    yPosition += 15;
  } else {
    // Standard header for other templates
    yPosition = generateStandardHeader({
      doc,
      settings,
      client,
      template,
      templateConfig,
      primaryColor,
      textColor,
      fontSize,
      invoiceNumber: invoiceNumber || invoice?.invoiceNumber,
      issueDate,
      dueDate,
      showDueDateOption
    });
  }
  
  // Client details section
  yPosition = generateClientSection({
    doc,
    client,
    yPosition,
    primaryColor,
    textColor,
    fontSize
  });
  
  // Time entries table
  generateTimeEntriesTable({
    doc,
    autoTable,
    reportData,
    invoice,
    client,
    settings,
    yPosition,
    primaryColor,
    textColor,
    fontSize
  });
  
  // Footer notes
  if (notes || settings.invoiceFooterText) {
    generateFooterNotes({
      doc,
      notes: notes || settings.invoiceFooterText || "",
      textColor,
      fontSize
    });
  }
}

/**
 * Generates standard header for non-modern templates
 */
function generateStandardHeader({
  doc,
  settings,
  client,
  template,
  templateConfig,
  primaryColor,
  textColor,
  fontSize,
  invoiceNumber,
  issueDate,
  dueDate,
  showDueDateOption
}: any) {
  let yPosition = 20;
  
  // Logo
  if (settings.showLogo && settings.companyLogo) {
    try {
      const logoSize = parseInt(settings.logoSize || "64");
      doc.addImage(settings.companyLogo, 'PNG', 20, yPosition, logoSize * 0.75, logoSize * 0.75);
      yPosition += logoSize * 0.75 + 10;
    } catch (error) {
      console.warn("Could not add logo to PDF:", error);
    }
  }
  
  // Company name and details
  if (template === 'classic') {
    // Centered layout for classic template
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.setFontSize(fontSize + 8);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", doc.internal.pageSize.width / 2, yPosition, { align: "center" });
    yPosition += 15;
    
    if (settings.showBusinessName !== false) {
      doc.setFontSize(fontSize + 4);
      doc.text(settings.businessName || "Your Business Name", doc.internal.pageSize.width / 2, yPosition, { align: "center" });
      yPosition += 10;
    }
  } else {
    // Side-by-side layout for professional and minimal
    if (settings.showBusinessName !== false) {
      doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.setFontSize(fontSize + 4);
      doc.setFont("helvetica", "bold");
      doc.text(settings.businessName || "Your Business Name", 20, yPosition);
      yPosition += 12;
    }
    
    // Invoice title on the right
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.setFontSize(fontSize + 8);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", doc.internal.pageSize.width - 20, 20, { align: "right" });
  }
  
  // Company details
  if (settings.showCompanyDetails !== false) {
    doc.setTextColor(textColor.r, textColor.g, textColor.b);
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    
    if (settings.businessAddress) {
      doc.text(settings.businessAddress, 20, yPosition);
      yPosition += 6;
    }
    
    const cityStateZip = [settings.businessCity, settings.businessState, settings.businessZipCode]
      .filter(Boolean).join(", ");
    if (cityStateZip) {
      doc.text(cityStateZip, 20, yPosition);
      yPosition += 6;
    }
    
    if (settings.businessEmail) {
      doc.text(`Email: ${settings.businessEmail}`, 20, yPosition);
      yPosition += 6;
    }
    
    if (settings.businessPhone) {
      doc.text(`Phone: ${settings.businessPhone}`, 20, yPosition);
      yPosition += 6;
    }
  }
  
  // Invoice details on the right
  doc.setTextColor(textColor.r, textColor.g, textColor.b);
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");
  
  let rightY = template === 'classic' ? yPosition : 40;
  doc.text(`Invoice #: ${invoiceNumber || "1001"}`, doc.internal.pageSize.width - 20, rightY, { align: "right" });
  rightY += 8;
  
  doc.text(`Date: ${issueDate || format(new Date(), 'yyyy-MM-dd')}`, doc.internal.pageSize.width - 20, rightY, { align: "right" });
  rightY += 8;
  
  if (showDueDateOption && dueDate) {
    doc.text(`Due: ${dueDate}`, doc.internal.pageSize.width - 20, rightY, { align: "right" });
  }
  
  return Math.max(yPosition + 20, rightY + 20);
}

/**
 * Generates client details section
 */
function generateClientSection({
  doc,
  client,
  yPosition,
  primaryColor,
  textColor,
  fontSize
}: any) {
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.setFontSize(fontSize + 2);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", 20, yPosition);
  yPosition += 10;
  
  doc.setTextColor(textColor.r, textColor.g, textColor.b);
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");
  
  doc.text(client.name || "Client Name", 20, yPosition);
  yPosition += 8;
  
  if (client.email) {
    doc.text(client.email, 20, yPosition);
    yPosition += 6;
  }
  
  if (client.address) {
    doc.text(client.address, 20, yPosition);
    yPosition += 6;
  }
  
  return yPosition + 20;
}

/**
 * Generates time entries table with proper duration parsing
 */
function generateTimeEntriesTable({
  doc,
  autoTable,
  reportData,
  invoice,
  client,
  settings,
  yPosition,
  primaryColor,
  textColor,
  fontSize
}: any) {
  const tableContent: any[] = [];
  let subtotal = 0;
  let totalHours = 0;
  
  const currencySymbol = settings.displayCurrency === 'GBP' ? '£' : 
                        settings.displayCurrency === 'EUR' ? '€' : '$';
  
  console.log("Processing time entries for PDF table...");
  
  if (reportData?.timeEntries) {
    reportData.timeEntries.forEach((entry: any, index: number) => {
      console.log(`Processing entry ${index + 1}/${reportData.timeEntries.length}:`, {
        id: entry.id,
        description: entry.description,
        duration: entry.duration,
        adjustedDuration: entry.adjustedDuration,
        editedDuration: entry.editedDuration,
        amount: entry.amount,
        editedAmount: entry.editedAmount
      });
      
      // Use the EXACT same logic as the preview to ensure consistency
      let duration = 0;
      
      // Check if this entry has been edited in the preview
      if (entry.editedDuration !== undefined && entry.editedDuration !== null) {
        duration = typeof entry.editedDuration === 'number' ? entry.editedDuration : parseFloat(String(entry.editedDuration));
      } else if (entry.adjustedDuration !== undefined && entry.adjustedDuration !== null) {
        duration = typeof entry.adjustedDuration === 'number' ? entry.adjustedDuration : parseFloat(String(entry.adjustedDuration));
      } else if (entry.duration !== undefined && entry.duration !== null) {
        duration = typeof entry.duration === 'number' ? entry.duration : parseFloat(String(entry.duration));
      }
      
      // Ensure valid number
      if (isNaN(duration) || duration < 0) duration = 0;
      
      console.log(`PDF - Entry ${entry.id}: duration=${duration}, original=${entry.duration}, adjusted=${entry.adjustedDuration}`);
      
      console.log(`Entry ${entry.id} - Final duration: ${duration}`);
      
      // Get hourly rate
      let hourlyRate = 0;
      if (entry.project?.hourlyRate) {
        hourlyRate = parseFloat(String(entry.project.hourlyRate));
      } else if (entry.hourlyRate) {
        hourlyRate = parseFloat(String(entry.hourlyRate));
      } else if (client.hourlyRate) {
        hourlyRate = parseFloat(String(client.hourlyRate));
      }
      
      // Calculate amount
      let amount = 0;
      if (entry.editedAmount !== undefined && entry.editedAmount !== null) {
        amount = parseFloat(String(entry.editedAmount));
      } else if (entry.amount !== undefined && entry.amount !== null) {
        amount = parseFloat(String(entry.amount));
      } else {
        amount = duration * hourlyRate;
      }
      
      // Ensure amount is valid
      if (isNaN(amount) || amount < 0) {
        amount = 0;
      }
      
      console.log(`Entry ${entry.id} - Final amount: ${amount}`);
      
      tableContent.push([
        entry.description || "No description",
        formatTime(duration, reportData.timeFormat || 'decimal'),
        `${currencySymbol}${hourlyRate.toFixed(2)}`,
        `${currencySymbol}${amount.toFixed(2)}`
      ]);
      
      subtotal += amount;
      totalHours += duration;
    });
  }
  
  console.log(`PDF Table Summary - Total hours: ${totalHours}, Subtotal: ${subtotal}`);
  
  // Generate the table
  autoTable(doc, {
    startY: yPosition,
    head: [['Description', 'Hours', 'Rate', 'Amount']],
    body: tableContent,
    styles: {
      fontSize: fontSize - 1,
      textColor: [textColor.r, textColor.g, textColor.b]
    },
    headStyles: {
      fillColor: [primaryColor.r, primaryColor.g, primaryColor.b],
      textColor: [255, 255, 255],
      fontSize: fontSize,
      fontStyle: 'bold'
    },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    },
    margin: { left: 20, right: 20 }
  });
  
  // Add totals
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setTextColor(textColor.r, textColor.g, textColor.b);
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");
  
  const rightAlign = doc.internal.pageSize.width - 20;
  
  doc.text(`Total Hours: ${formatTime(totalHours, reportData?.timeFormat || 'decimal')}`, rightAlign, finalY, { align: 'right' });
  doc.text(`Subtotal: ${currencySymbol}${subtotal.toFixed(2)}`, rightAlign, finalY + 8, { align: 'right' });
  
  // Tax calculation if enabled
  if (settings.enableTax && settings.defaultTaxRate) {
    const taxRate = parseFloat(settings.defaultTaxRate) / 100;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;
    
    doc.text(`Tax (${settings.defaultTaxRate}%): ${currencySymbol}${taxAmount.toFixed(2)}`, rightAlign, finalY + 16, { align: 'right' });
    
    doc.setFont("helvetica", "bold");
    doc.text(`Total: ${currencySymbol}${total.toFixed(2)}`, rightAlign, finalY + 24, { align: 'right' });
  } else {
    doc.setFont("helvetica", "bold");
    doc.text(`Total: ${currencySymbol}${subtotal.toFixed(2)}`, rightAlign, finalY + 16, { align: 'right' });
  }
}

/**
 * Generates footer notes
 */
function generateFooterNotes({
  doc,
  notes,
  textColor,
  fontSize
}: any) {
  const pageHeight = doc.internal.pageSize.height;
  const footerY = pageHeight - 40;
  
  doc.setTextColor(textColor.r, textColor.g, textColor.b);
  doc.setFontSize(fontSize - 1);
  doc.setFont("helvetica", "normal");
  
  // Strip HTML tags and split into lines
  const cleanNotes = notes.replace(/<[^>]*>/g, '');
  const noteLines = doc.splitTextToSize(cleanNotes, doc.internal.pageSize.width - 40);
  
  noteLines.forEach((line: string, index: number) => {
    doc.text(line, 20, footerY + (index * 6));
  });
}

/**
 * Generates a report PDF
 */
function generateReportPdf({
  doc,
  autoTable,
  reportData,
  filters
}: {
  doc: jsPDF;
  autoTable: any;
  reportData: any;
  filters: any;
}) {
  // Implementation for report PDF generation
  doc.setFontSize(20);
  doc.text("Time Tracking Report", 20, 20);
  
  // Add report content here
  const tableContent = reportData.timeEntries.map((entry: any) => [
    entry.description,
    formatTime(parseFloat(String(entry.duration || 0)), filters.timeFormat || 'decimal'),
    entry.project?.name || "No project",
    entry.client?.name || "No client"
  ]);
  
  autoTable(doc, {
    startY: 40,
    head: [['Description', 'Duration', 'Project', 'Client']],
    body: tableContent
  });
}

/**
 * Helper function to convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}