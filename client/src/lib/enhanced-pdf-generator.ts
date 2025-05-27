import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Settings } from "@shared/schema";

export interface EnhancedInvoiceData {
  invoice: {
    id: number;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    status: string;
    notes?: string;
    subtotal: string;
    tax?: string;
    taxRate?: string;
    total: string;
  };
  client: {
    id: number;
    name: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    phone?: string;
    taxId?: string;
  };
  timeEntries: Array<{
    id: number;
    description: string;
    duration: number;
    amount: number;
    date: string;
    weekLabel?: string;
    project: {
      name: string;
      hourlyRate: string;
    };
  }>;
  weeklyGroups: Array<{
    weekLabel: string;
    entries: Array<{
      id: number;
      description: string;
      duration: number;
      amount: number;
      date: string;
    }>;
    totalHours: number;
    totalAmount: number;
  }>;
  timeAdjustment?: {
    increaseByPercentage: boolean;
    percentage: number;
    roundToNearestTenth: boolean;
  };
  settings: Settings;
}

export function generateEnhancedInvoicePDF(data: EnhancedInvoiceData): void {
  const { invoice, client, timeEntries, weeklyGroups, timeAdjustment, settings } = data;

  // Create PDF with custom settings
  const doc = new jsPDF();
  
  // Apply custom colors and fonts
  const primaryColor = hexToRgb(settings.invoiceColorTheme || "#1f2937");
  const accentColor = hexToRgb(settings.invoiceAccentColor || "#3b82f6");
  const textColor = hexToRgb(settings.invoiceTextColor || "#374151");
  const backgroundColor = hexToRgb(settings.invoiceBackgroundColor || "#ffffff");
  
  const fontSize = parseInt(settings.customFontSize || "12");
  
  // Set background color if not white
  if (settings.invoiceBackgroundColor && settings.invoiceBackgroundColor !== "#ffffff") {
    doc.setFillColor(backgroundColor.r, backgroundColor.g, backgroundColor.b);
    doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, 'F');
  }

  let yPosition = 20;

  // Company Logo
  if (settings.showLogo && settings.companyLogo) {
    try {
      // Add logo (max height 30)
      doc.addImage(settings.companyLogo, 'JPEG', 20, yPosition, 0, 30);
      yPosition += 40;
    } catch (error) {
      console.warn("Could not add logo to PDF:", error);
      yPosition += 10;
    }
  }

  // Company Information
  if (settings.showCompanyDetails) {
    doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
    doc.setFontSize(fontSize + 4);
    doc.setFont("helvetica", "bold");
    doc.text(settings.businessName || "Your Business", 20, yPosition);
    yPosition += 8;

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

    if (settings.businessCountry) {
      doc.text(settings.businessCountry, 20, yPosition);
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

    if (settings.businessTaxId) {
      doc.text(`Tax ID: ${settings.businessTaxId}`, 20, yPosition);
      yPosition += 6;
    }
  }

  // Invoice Title and Details (Right Side)
  const rightColumnX = 120;
  let rightYPosition = settings.showLogo && settings.companyLogo ? 60 : 20;

  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.setFontSize(fontSize + 8);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", rightColumnX, rightYPosition, { align: "left" });
  rightYPosition += 12;

  doc.setTextColor(textColor.r, textColor.g, textColor.b);
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");

  doc.text(`Invoice #: ${invoice.invoiceNumber}`, rightColumnX, rightYPosition);
  rightYPosition += 6;
  doc.text(`Date: ${format(new Date(invoice.issueDate), "MMM dd, yyyy")}`, rightColumnX, rightYPosition);
  rightYPosition += 6;

  if (settings.showDueDate && invoice.dueDate) {
    doc.text(`Due: ${format(new Date(invoice.dueDate), "MMM dd, yyyy")}`, rightColumnX, rightYPosition);
    rightYPosition += 6;
  }

  // Client Information
  yPosition = Math.max(yPosition + 10, rightYPosition + 10);
  
  doc.setTextColor(accentColor.r, accentColor.g, accentColor.b);
  doc.setFontSize(fontSize + 2);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", 20, yPosition);
  yPosition += 8;

  doc.setTextColor(textColor.r, textColor.g, textColor.b);
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");

  doc.text(client.name, 20, yPosition);
  yPosition += 6;

  if (client.address) {
    doc.text(client.address, 20, yPosition);
    yPosition += 6;
  }

  const clientCityState = [client.city, client.state, client.zipCode].filter(Boolean).join(", ");
  if (clientCityState) {
    doc.text(clientCityState, 20, yPosition);
    yPosition += 6;
  }

  if (client.country) {
    doc.text(client.country, 20, yPosition);
    yPosition += 6;
  }

  if (client.email) {
    doc.text(`Email: ${client.email}`, 20, yPosition);
    yPosition += 6;
  }

  yPosition += 10;

  // Time Entries Table
  const tableColumns = [
    { header: "Description", dataKey: "description" },
    { header: "Date", dataKey: "date" },
    { header: "Hours", dataKey: "hours" },
    { header: "Rate", dataKey: "rate" },
    { header: "Amount", dataKey: "amount" },
  ];

  // Prepare table data by weeks
  const tableData: any[] = [];

  weeklyGroups.forEach((week, weekIndex) => {
    // Add week header
    if (weeklyGroups.length > 1) {
      tableData.push({
        description: week.weekLabel,
        date: "",
        hours: "",
        rate: "",
        amount: "",
        isWeekHeader: true,
      });
    }

    // Add entries for this week
    week.entries.forEach((entry) => {
      tableData.push({
        description: entry.description,
        date: format(new Date(entry.date), "MMM dd"),
        hours: entry.duration.toFixed(2),
        rate: `${settings.displayCurrency}${parseFloat(entry.project?.hourlyRate || "0").toFixed(2)}`,
        amount: `${settings.displayCurrency}${entry.amount.toFixed(2)}`,
        isWeekHeader: false,
      });
    });

    // Add week subtotal
    if (weeklyGroups.length > 1) {
      tableData.push({
        description: "",
        date: "",
        hours: week.totalHours.toFixed(2),
        rate: "Subtotal:",
        amount: `${settings.displayCurrency}${week.totalAmount.toFixed(2)}`,
        isSubtotal: true,
      });
    }
  });

  // Add time adjustment note if applicable
  if (timeAdjustment?.increaseByPercentage && timeAdjustment.percentage > 0) {
    tableData.push({
      description: `Time adjustment: +${timeAdjustment.percentage}% increase`,
      date: "",
      hours: "",
      rate: "",
      amount: "",
      isNote: true,
    });
  }

  autoTable(doc, {
    startY: yPosition,
    head: [tableColumns.map(col => col.header)],
    body: tableData.map(row => [
      row.description,
      row.date,
      row.hours,
      row.rate,
      row.amount,
    ]),
    styles: {
      fontSize: fontSize - 1,
      textColor: [textColor.r, textColor.g, textColor.b],
    },
    headStyles: {
      fillColor: [accentColor.r, accentColor.g, accentColor.b],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    didParseCell: function(data) {
      const rowData = tableData[data.row.index];
      
      if (rowData?.isWeekHeader) {
        data.cell.styles.fillColor = [primaryColor.r, primaryColor.g, primaryColor.b];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
      } else if (rowData?.isSubtotal) {
        data.cell.styles.fillColor = [240, 240, 240];
        data.cell.styles.fontStyle = "bold";
      } else if (rowData?.isNote) {
        data.cell.styles.fillColor = [255, 255, 240];
        data.cell.styles.fontStyle = "italic";
      }
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 25, halign: "center" },
      2: { cellWidth: 20, halign: "right" },
      3: { cellWidth: 25, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
  });

  // Calculate totals position
  const finalY = (doc as any).lastAutoTable.finalY + 15;

  // Totals section
  const totalsX = 140;
  let totalsY = finalY;

  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textColor.r, textColor.g, textColor.b);

  doc.text("Subtotal:", totalsX, totalsY);
  doc.text(`${settings.displayCurrency}${invoice.subtotal}`, totalsX + 30, totalsY, { align: "right" });
  totalsY += 6;

  if (settings.enableTax && invoice.tax && parseFloat(invoice.tax) > 0) {
    const taxLabel = invoice.taxRate ? `Tax (${invoice.taxRate}%):` : "Tax:";
    doc.text(taxLabel, totalsX, totalsY);
    doc.text(`${settings.displayCurrency}${invoice.tax}`, totalsX + 30, totalsY, { align: "right" });
    totalsY += 6;
  }

  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize + 2);
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text("Total:", totalsX, totalsY);
  doc.text(`${settings.displayCurrency}${invoice.total}`, totalsX + 30, totalsY, { align: "right" });
  totalsY += 10;

  // Banking Information
  if (settings.showBankDetails && (settings.bankName || settings.bankAccountNumber)) {
    totalsY += 10;
    
    doc.setFontSize(fontSize + 1);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(accentColor.r, accentColor.g, accentColor.b);
    doc.text("Payment Details:", 20, totalsY);
    totalsY += 8;

    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textColor.r, textColor.g, textColor.b);

    if (settings.bankName) {
      doc.text(`Bank: ${settings.bankName}`, 20, totalsY);
      totalsY += 6;
    }

    if (settings.bankAccountName) {
      doc.text(`Account Name: ${settings.bankAccountName}`, 20, totalsY);
      totalsY += 6;
    }

    if (settings.bankAccountNumber) {
      doc.text(`Account Number: ${settings.bankAccountNumber}`, 20, totalsY);
      totalsY += 6;
    }

    if (settings.bankSortCode) {
      doc.text(`Sort Code: ${settings.bankSortCode}`, 20, totalsY);
      totalsY += 6;
    }
  }

  // Notes
  if (invoice.notes && invoice.notes.trim()) {
    totalsY += 10;
    
    doc.setFontSize(fontSize + 1);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(accentColor.r, accentColor.g, accentColor.b);
    doc.text("Notes:", 20, totalsY);
    totalsY += 8;

    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textColor.r, textColor.g, textColor.b);
    
    const notesLines = doc.splitTextToSize(invoice.notes, 170);
    doc.text(notesLines, 20, totalsY);
    totalsY += notesLines.length * 6;
  }

  // Footer text
  if (settings.invoiceFooterText && settings.invoiceFooterText.trim()) {
    const pageHeight = doc.internal.pageSize.height;
    const footerY = Math.max(totalsY + 20, pageHeight - 30);
    
    doc.setFontSize(fontSize - 1);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(textColor.r, textColor.g, textColor.b);
    
    const footerLines = doc.splitTextToSize(settings.invoiceFooterText, 170);
    const footerStartY = footerY - (footerLines.length * 5);
    
    // Add a line above footer
    doc.setDrawColor(accentColor.r, accentColor.g, accentColor.b);
    doc.line(20, footerStartY - 5, 190, footerStartY - 5);
    
    doc.text(footerLines, doc.internal.pageSize.width / 2, footerStartY, { align: "center" });
  }

  // Save the PDF
  const fileName = `Invoice-${invoice.invoiceNumber}.pdf`;
  doc.save(fileName);
}

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// CSV Export Function
export function generateInvoiceCSV(data: EnhancedInvoiceData): void {
  const { invoice, client, timeEntries, settings } = data;

  const csvData: string[] = [];
  
  // Header information
  csvData.push("Invoice Export");
  csvData.push("");
  csvData.push(`Invoice Number,${invoice.invoiceNumber}`);
  csvData.push(`Issue Date,${format(new Date(invoice.issueDate), "yyyy-MM-dd")}`);
  csvData.push(`Due Date,${invoice.dueDate ? format(new Date(invoice.dueDate), "yyyy-MM-dd") : "N/A"}`);
  csvData.push(`Status,${invoice.status}`);
  csvData.push("");
  
  // Client information
  csvData.push("Client Information");
  csvData.push(`Name,${client.name}`);
  csvData.push(`Email,${client.email || "N/A"}`);
  csvData.push(`Address,${client.address || "N/A"}`);
  csvData.push(`City,${client.city || "N/A"}`);
  csvData.push(`State,${client.state || "N/A"}`);
  csvData.push(`ZIP Code,${client.zipCode || "N/A"}`);
  csvData.push(`Country,${client.country || "N/A"}`);
  csvData.push(`Phone,${client.phone || "N/A"}`);
  csvData.push("");
  
  // Time entries header
  csvData.push("Time Entries");
  csvData.push("Description,Date,Hours,Rate,Amount,Week,Project");
  
  // Time entries data
  timeEntries.forEach(entry => {
    const rate = parseFloat(entry.project?.hourlyRate || "0");
    csvData.push([
      `"${entry.description}"`,
      format(new Date(entry.date), "yyyy-MM-dd"),
      entry.duration.toFixed(2),
      rate.toFixed(2),
      entry.amount.toFixed(2),
      `"${entry.weekLabel || ""}"`,
      `"${entry.project?.name || ""}"`
    ].join(","));
  });
  
  csvData.push("");
  
  // Totals
  csvData.push("Summary");
  csvData.push(`Subtotal,${invoice.subtotal}`);
  if (settings.enableTax && invoice.tax) {
    csvData.push(`Tax,${invoice.tax}`);
    if (invoice.taxRate) {
      csvData.push(`Tax Rate,${invoice.taxRate}%`);
    }
  }
  csvData.push(`Total,${invoice.total}`);
  
  if (invoice.notes) {
    csvData.push("");
    csvData.push("Notes");
    csvData.push(`"${invoice.notes}"`);
  }

  // Create and download CSV
  const csvContent = csvData.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Invoice-${invoice.invoiceNumber}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}