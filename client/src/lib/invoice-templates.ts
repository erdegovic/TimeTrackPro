// Invoice template system for generating professional invoices
// Maps template names to their corresponding HTML structures

export interface InvoiceTemplateData {
  // Business information
  businessName: string;
  businessAddress: string;
  businessCity: string;
  businessState: string;
  businessZipCode: string;
  businessCountry: string;
  businessPhone: string;
  businessEmail: string;
  businessTaxId: string;
  
  // Client information
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientZipCode: string;
  clientCountry: string;
  
  // Invoice details
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  tax: string;
  total: string;
  currency: string;
  
  // Items
  items: Array<{
    description: string;
    hours: string;
    rate: string;
    amount: string;
  }>;
  
  // Settings
  showLogo: boolean;
  companyLogo?: string;
  invoiceFooterText?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankSortCode?: string;
}

export const invoiceTemplates = {
  coding: (data: InvoiceTemplateData) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>// INVOICE // ${data.businessName}</title>
    <style>
        :root {
            --bg: #0a0a0a;
            --text: #e0e0e0;
            --primary: #00ff88;
            --secondary: #0077ff;
            --error: #ff5555;
            --comment: #666;
            --terminal-bg: #111;
            --border: #333;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Courier New', monospace;
        }

        body {
            background-color: var(--bg);
            color: var(--text);
            line-height: 1.6;
            padding: 2rem;
        }

        .invoice {
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid var(--border);
            background: var(--terminal-bg);
            box-shadow: 0 0 20px rgba(0, 255, 136, 0.1);
            padding: 2rem;
            position: relative;
        }

        .invoice::before {
            content: "${data.businessName} - INVOICE";
            position: absolute;
            top: -12px;
            left: 20px;
            background: var(--terminal-bg);
            padding: 0 10px;
            font-size: 0.9rem;
            color: var(--primary);
        }

        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2rem;
            border-bottom: 1px dashed var(--border);
            padding-bottom: 1rem;
        }

        .company-info h1 {
            color: var(--primary);
            font-size: 1.8rem;
            margin-bottom: 0.5rem;
        }

        .company-info p {
            color: var(--comment);
            font-size: 0.9rem;
        }

        .invoice-meta {
            text-align: right;
        }

        .invoice-id {
            font-size: 1.2rem;
            color: var(--secondary);
            margin-bottom: 0.5rem;
        }

        .date {
            color: var(--comment);
            font-size: 0.9rem;
        }

        .billing-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
        }

        .info-block h3 {
            color: var(--primary);
            margin-bottom: 0.5rem;
            font-size: 1.1rem;
        }

        .info-block p {
            margin-bottom: 0.3rem;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 2rem 0;
        }

        .items-table th {
            text-align: left;
            padding: 0.8rem;
            background: #1a1a1a;
            color: var(--primary);
            border: 1px solid var(--border);
        }

        .items-table td {
            padding: 0.8rem;
            border: 1px solid var(--border);
        }

        .items-table tr:nth-child(even) {
            background: rgba(0, 119, 255, 0.05);
        }

        .totals {
            margin-top: 2rem;
            border-top: 1px dashed var(--border);
            padding-top: 1rem;
        }

        .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
        }

        .grand-total {
            font-weight: bold;
            color: var(--primary);
            font-size: 1.2rem;
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px dashed var(--border);
        }

        .footer {
            margin-top: 2rem;
            text-align: center;
            color: var(--comment);
            font-size: 0.9rem;
        }

        .divider {
            text-align: center;
            margin: 1.5rem 0;
            color: var(--comment);
        }

        .divider::before, .divider::after {
            content: "//";
            margin: 0 10px;
        }
    </style>
</head>
<body>
    <div class="invoice">
        <div class="header">
            <div class="company-info">
                <h1>${data.businessName}</h1>
                <p>// Professional coding services</p>
                ${data.businessAddress ? `<p>${data.businessAddress}</p>` : ''}
                ${data.businessCity ? `<p>${data.businessCity}, ${data.businessState} ${data.businessZipCode}</p>` : ''}
                ${data.businessEmail ? `<p>${data.businessEmail}</p>` : ''}
            </div>
            <div class="invoice-meta">
                <div class="invoice-id">INV-<span style="color: var(--primary)">${data.invoiceNumber}</span></div>
                <div class="date">Date: ${data.issueDate}</div>
                <div class="date">Due: ${data.dueDate}</div>
            </div>
        </div>

        <div class="billing-info">
            <div class="info-block">
                <h3>// BILL TO</h3>
                <p><strong>${data.clientName}</strong></p>
                ${data.clientAddress ? `<p>${data.clientAddress}</p>` : ''}
                ${data.clientCity ? `<p>${data.clientCity}, ${data.clientState} ${data.clientZipCode}</p>` : ''}
                ${data.clientEmail ? `<p>${data.clientEmail}</p>` : ''}
            </div>
            ${data.bankName ? `
            <div class="info-block">
                <h3>// PAYMENT</h3>
                <p>Bank: ${data.bankName}</p>
                ${data.bankAccountName ? `<p>Account: ${data.bankAccountName}</p>` : ''}
                ${data.bankAccountNumber ? `<p>Number: ${data.bankAccountNumber}</p>` : ''}
                ${data.bankSortCode ? `<p>Sort: ${data.bankSortCode}</p>` : ''}
            </div>
            ` : ''}
        </div>

        <div class="divider"> SERVICES RENDERED </div>
        <table class="items-table">
            <thead>
                <tr>
                    <th>DESCRIPTION</th>
                    <th>HOURS</th>
                    <th>RATE</th>
                    <th>AMOUNT</th>
                </tr>
            </thead>
            <tbody>
                ${data.items.map(item => `
                <tr>
                    <td><strong>${item.description}</strong></td>
                    <td>${item.hours}</td>
                    <td>${data.currency}${item.rate}</td>
                    <td>${data.currency}${item.amount}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="totals">
            <div class="total-row">
                <span>Subtotal:</span>
                <span>${data.currency}${data.subtotal}</span>
            </div>
            ${data.tax && parseFloat(data.tax) > 0 ? `
            <div class="total-row">
                <span>Tax:</span>
                <span>${data.currency}${data.tax}</span>
            </div>
            ` : ''}
            <div class="total-row grand-total">
                <span>TOTAL DUE:</span>
                <span>${data.currency}${data.total}</span>
            </div>
        </div>

        <div class="footer">
            <p>// Thank you for your business! //</p>
            ${data.invoiceFooterText ? `<p>${data.invoiceFooterText}</p>` : ''}
        </div>
    </div>
</body>
</html>`,

  "video-production": (data: InvoiceTemplateData) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice | ${data.businessName}</title>
    <style>
        :root {
            --primary: #e50914;
            --secondary: #1a1a1a;
            --text: #333;
            --light-bg: #f9f9f9;
            --border: #e0e0e0;
            --highlight: #ff6b6b;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Helvetica Neue', Arial, sans-serif;
        }

        body {
            background-color: #f5f5f5;
            color: var(--text);
            line-height: 1.6;
            padding: 2rem;
        }

        .invoice {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 5px 30px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            overflow: hidden;
            position: relative;
        }

        .invoice::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 8px;
            background: linear-gradient(90deg, var(--primary), #ff4757);
        }

        .header {
            display: flex;
            justify-content: space-between;
            padding: 2.5rem;
            border-bottom: 1px solid var(--border);
        }

        .company-info h1 {
            font-size: 2rem;
            color: var(--secondary);
            margin-bottom: 0.5rem;
            font-weight: 700;
        }

        .company-info p {
            color: #666;
            font-size: 0.95rem;
        }

        .invoice-meta {
            text-align: right;
        }

        .invoice-id {
            font-size: 1.3rem;
            color: var(--primary);
            margin-bottom: 0.5rem;
            font-weight: 600;
        }

        .date {
            color: #666;
            font-size: 0.9rem;
        }

        .billing-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            padding: 2rem 2.5rem;
            background: var(--light-bg);
        }

        .info-block h3 {
            color: var(--primary);
            margin-bottom: 1rem;
            font-size: 1.1rem;
            font-weight: 600;
        }

        .info-block p {
            margin-bottom: 0.4rem;
            color: var(--text);
        }

        .items-section {
            padding: 2rem 2.5rem;
        }

        .section-title {
            font-size: 1.2rem;
            color: var(--primary);
            margin-bottom: 1.5rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 2rem;
        }

        .items-table th {
            text-align: left;
            padding: 1rem;
            background: var(--secondary);
            color: white;
            font-weight: 600;
        }

        .items-table td {
            padding: 1rem;
            border-bottom: 1px solid var(--border);
        }

        .items-table tr:hover {
            background: #fafafa;
        }

        .totals {
            background: var(--light-bg);
            padding: 2rem 2.5rem;
            border-top: 1px solid var(--border);
        }

        .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.8rem;
            font-size: 1rem;
        }

        .grand-total {
            font-weight: bold;
            color: var(--primary);
            font-size: 1.4rem;
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 2px solid var(--primary);
        }

        .footer {
            padding: 2rem 2.5rem;
            text-align: center;
            color: #666;
            font-size: 0.9rem;
            border-top: 1px solid var(--border);
        }

        .footer p {
            margin-bottom: 0.5rem;
        }
    </style>
</head>
<body>
    <div class="invoice">
        <div class="header">
            <div class="company-info">
                <h1>${data.businessName}</h1>
                <p>Professional Video Production Services</p>
                ${data.businessAddress ? `<p>${data.businessAddress}</p>` : ''}
                ${data.businessCity ? `<p>${data.businessCity}, ${data.businessState} ${data.businessZipCode}</p>` : ''}
                ${data.businessEmail ? `<p>${data.businessEmail}</p>` : ''}
            </div>
            <div class="invoice-meta">
                <div class="invoice-id">Invoice #${data.invoiceNumber}</div>
                <div class="date">Issue Date: ${data.issueDate}</div>
                <div class="date">Due Date: ${data.dueDate}</div>
            </div>
        </div>

        <div class="billing-info">
            <div class="info-block">
                <h3>BILL TO</h3>
                <p><strong>${data.clientName}</strong></p>
                ${data.clientAddress ? `<p>${data.clientAddress}</p>` : ''}
                ${data.clientCity ? `<p>${data.clientCity}, ${data.clientState} ${data.clientZipCode}</p>` : ''}
                ${data.clientEmail ? `<p>${data.clientEmail}</p>` : ''}
            </div>
            ${data.bankName ? `
            <div class="info-block">
                <h3>PAYMENT DETAILS</h3>
                <p>Bank: ${data.bankName}</p>
                ${data.bankAccountName ? `<p>Account Holder: ${data.bankAccountName}</p>` : ''}
                ${data.bankAccountNumber ? `<p>Account Number: ${data.bankAccountNumber}</p>` : ''}
                ${data.bankSortCode ? `<p>Sort Code: ${data.bankSortCode}</p>` : ''}
            </div>
            ` : ''}
        </div>

        <div class="items-section">
            <div class="section-title">Production Services</div>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>DESCRIPTION</th>
                        <th>HOURS</th>
                        <th>RATE</th>
                        <th>AMOUNT</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map(item => `
                    <tr>
                        <td><strong>${item.description}</strong></td>
                        <td>${item.hours}</td>
                        <td>${data.currency}${item.rate}</td>
                        <td>${data.currency}${item.amount}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="totals">
            <div class="total-row">
                <span>Subtotal:</span>
                <span>${data.currency}${data.subtotal}</span>
            </div>
            ${data.tax && parseFloat(data.tax) > 0 ? `
            <div class="total-row">
                <span>Tax:</span>
                <span>${data.currency}${data.tax}</span>
            </div>
            ` : ''}
            <div class="total-row grand-total">
                <span>TOTAL DUE:</span>
                <span>${data.currency}${data.total}</span>
            </div>
        </div>

        <div class="footer">
            <p><strong>Thank you for choosing our video production services!</strong></p>
            ${data.invoiceFooterText ? `<p>${data.invoiceFooterText}</p>` : ''}
        </div>
    </div>
</body>
</html>`,

  luxury: (data: InvoiceTemplateData) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice | ${data.businessName}</title>
    <style>
        :root {
            --gold: #d4af37;
            --dark-gold: #b8941f;
            --cream: #faf9f6;
            --dark: #2c2c2c;
            --light-gray: #f8f8f8;
            --border: #e8e8e8;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Georgia', 'Times New Roman', serif;
        }

        body {
            background: linear-gradient(135deg, var(--cream) 0%, #f0f0f0 100%);
            color: var(--dark);
            line-height: 1.6;
            padding: 3rem;
        }

        .invoice {
            max-width: 850px;
            margin: 0 auto;
            background: white;
            border: 2px solid var(--gold);
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
            position: relative;
        }

        .invoice::before {
            content: "";
            position: absolute;
            top: -4px;
            left: -4px;
            right: -4px;
            bottom: -4px;
            background: linear-gradient(45deg, var(--gold), var(--dark-gold), var(--gold));
            z-index: -1;
        }

        .header {
            background: linear-gradient(135deg, var(--gold) 0%, var(--dark-gold) 100%);
            color: white;
            padding: 3rem;
            text-align: center;
            position: relative;
        }

        .header::after {
            content: "";
            position: absolute;
            bottom: -20px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 20px solid transparent;
            border-right: 20px solid transparent;
            border-top: 20px solid var(--dark-gold);
        }

        .company-info h1 {
            font-size: 3rem;
            margin-bottom: 0.5rem;
            font-weight: 300;
            letter-spacing: 2px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }

        .company-info p {
            font-size: 1.1rem;
            opacity: 0.9;
            font-style: italic;
        }

        .invoice-details {
            display: flex;
            justify-content: space-between;
            padding: 2rem 3rem;
            background: var(--light-gray);
            border-bottom: 1px solid var(--border);
        }

        .invoice-meta {
            text-align: right;
        }

        .invoice-id {
            font-size: 1.5rem;
            color: var(--gold);
            margin-bottom: 0.5rem;
            font-weight: bold;
        }

        .date {
            color: #666;
            font-size: 1rem;
            margin-bottom: 0.3rem;
        }

        .billing-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3rem;
            padding: 3rem;
        }

        .info-block h3 {
            color: var(--gold);
            margin-bottom: 1rem;
            font-size: 1.3rem;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 2px solid var(--gold);
            padding-bottom: 0.5rem;
        }

        .info-block p {
            margin-bottom: 0.5rem;
            font-size: 1rem;
        }

        .items-section {
            padding: 2rem 3rem;
        }

        .section-title {
            font-size: 1.5rem;
            color: var(--gold);
            margin-bottom: 2rem;
            text-align: center;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 2rem;
            border: 1px solid var(--border);
        }

        .items-table th {
            text-align: left;
            padding: 1.2rem;
            background: linear-gradient(135deg, var(--gold), var(--dark-gold));
            color: white;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .items-table td {
            padding: 1.2rem;
            border-bottom: 1px solid var(--border);
            font-size: 1rem;
        }

        .items-table tr:nth-child(even) {
            background: var(--light-gray);
        }

        .totals {
            background: var(--cream);
            padding: 2rem 3rem;
            border-top: 2px solid var(--gold);
        }

        .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1rem;
            font-size: 1.1rem;
        }

        .grand-total {
            font-weight: bold;
            color: var(--gold);
            font-size: 1.6rem;
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 2px solid var(--gold);
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .footer {
            background: var(--dark);
            color: white;
            padding: 2rem 3rem;
            text-align: center;
        }

        .footer p {
            margin-bottom: 0.5rem;
            font-size: 1rem;
        }
    </style>
</head>
<body>
    <div class="invoice">
        <div class="header">
            <div class="company-info">
                <h1>${data.businessName}</h1>
                <p>Luxury Professional Services</p>
            </div>
        </div>

        <div class="invoice-details">
            <div class="company-address">
                ${data.businessAddress ? `<p>${data.businessAddress}</p>` : ''}
                ${data.businessCity ? `<p>${data.businessCity}, ${data.businessState} ${data.businessZipCode}</p>` : ''}
                ${data.businessEmail ? `<p>${data.businessEmail}</p>` : ''}
                ${data.businessPhone ? `<p>${data.businessPhone}</p>` : ''}
            </div>
            <div class="invoice-meta">
                <div class="invoice-id">Invoice #${data.invoiceNumber}</div>
                <div class="date">Issue Date: ${data.issueDate}</div>
                <div class="date">Due Date: ${data.dueDate}</div>
            </div>
        </div>

        <div class="billing-info">
            <div class="info-block">
                <h3>Bill To</h3>
                <p><strong>${data.clientName}</strong></p>
                ${data.clientAddress ? `<p>${data.clientAddress}</p>` : ''}
                ${data.clientCity ? `<p>${data.clientCity}, ${data.clientState} ${data.clientZipCode}</p>` : ''}
                ${data.clientEmail ? `<p>${data.clientEmail}</p>` : ''}
            </div>
            ${data.bankName ? `
            <div class="info-block">
                <h3>Payment Details</h3>
                <p>Bank: ${data.bankName}</p>
                ${data.bankAccountName ? `<p>Account: ${data.bankAccountName}</p>` : ''}
                ${data.bankAccountNumber ? `<p>Number: ${data.bankAccountNumber}</p>` : ''}
                ${data.bankSortCode ? `<p>Sort Code: ${data.bankSortCode}</p>` : ''}
            </div>
            ` : ''}
        </div>

        <div class="items-section">
            <div class="section-title">Services Provided</div>
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Hours</th>
                        <th>Rate</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map(item => `
                    <tr>
                        <td><strong>${item.description}</strong></td>
                        <td>${item.hours}</td>
                        <td>${data.currency}${item.rate}</td>
                        <td>${data.currency}${item.amount}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="totals">
            <div class="total-row">
                <span>Subtotal:</span>
                <span>${data.currency}${data.subtotal}</span>
            </div>
            ${data.tax && parseFloat(data.tax) > 0 ? `
            <div class="total-row">
                <span>Tax:</span>
                <span>${data.currency}${data.tax}</span>
            </div>
            ` : ''}
            <div class="total-row grand-total">
                <span>Total Due:</span>
                <span>${data.currency}${data.total}</span>
            </div>
        </div>

        <div class="footer">
            <p><strong>Thank you for choosing our premium services</strong></p>
            ${data.invoiceFooterText ? `<p>${data.invoiceFooterText}</p>` : ''}
        </div>
    </div>
</body>
</html>`
};

// Helper function to get template HTML
export function getInvoiceTemplate(templateName: string, data: InvoiceTemplateData): string {
  const template = invoiceTemplates[templateName as keyof typeof invoiceTemplates];
  if (template) {
    return template(data);
  }
  
  // Fallback to luxury template if template not found
  return invoiceTemplates.luxury(data);
}