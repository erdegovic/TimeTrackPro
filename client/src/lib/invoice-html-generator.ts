export interface InvoiceLineItem {
  description: string;
  subDescription: string;
  qty: string;
  rate: string;
  amount: string;
}

export interface InvoiceTemplateData {
  template: string;
  businessName: string;
  businessMeta: string;
  businessAddress: string;
  businessEmail: string;
  businessPhone: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  clientName: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientZip: string;
  clientEmail: string;
  lineItems: InvoiceLineItem[];
  subtotalFormatted: string;
  taxFormatted: string;
  taxLabel: string;
  totalFormatted: string;
  notes: string;
  currency: string;
  logoUrl?: string;
  showLogo?: boolean;
  logoSize?: string;
  primaryColor?: string;
  accentColor?: string;
  textColor?: string;
  bgColor?: string;
}

export const TEMPLATE_OPTIONS = [
  { value: "classic", label: "Classic" },
  { value: "professional", label: "Professional" },
  { value: "media", label: "Media" },
  { value: "web", label: "Web Design" },
  { value: "graphic", label: "Graphic Design" },
  { value: "minimalistic", label: "Minimalistic" },
  { value: "freelancer", label: "Freelancer" },
  { value: "avant", label: "Playful Pop Creative" },
  { value: "luxe", label: "Bold Collage Creative" },
];

function esc(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const INVOICE_CSS = `
  :root {
    --paper: #ffffff;
    --ink: #17202a;
    --muted: #68717d;
    --line: #dfe4ea;
    --soft: #f5f7fa;
    --shadow: 0 18px 55px rgba(26,32,44,0.14);
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: transparent; color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.45; }

  .invoice-page { position: relative; width: 210mm; min-height: 297mm; overflow: hidden; background: var(--paper); break-after: page; page-break-after: always; }
  .invoice { position: relative; z-index: 1; min-height: 297mm; padding: 20mm; }
  .template-label { display: none; }

  .topline { display: grid; grid-template-columns: 1.25fr 0.75fr; gap: 26px; align-items: start; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .mark { display: grid; width: 42px; height: 42px; place-items: center; flex: 0 0 auto; border-radius: 8px; color: #fff; font-weight: 800; letter-spacing: 0.02em; }
  .brand-name { margin: 0; font-size: 21px; font-weight: 800; letter-spacing: 0; line-height: 1.1; }
  .brand-meta, .address, .terms, .footer-note { color: var(--muted); font-size: 10.5px; }
  .address { margin-top: 10px; }
  .invoice-title { margin: 0; font-size: 39px; line-height: 1; letter-spacing: 0; text-align: right; }
  .invoice-number { margin-top: 9px; color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-align: right; text-transform: uppercase; }

  .meta-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin: 28px 0 26px; }
  .meta-grid.two-col { grid-template-columns: 1fr 1fr; }
  .meta-card { min-height: 70px; padding: 12px; border: 1px solid var(--line); border-radius: 6px; background: #fff; }
  .label { display: block; margin-bottom: 5px; color: var(--muted); font-size: 9.5px; font-weight: 800; letter-spacing: 0.11em; text-transform: uppercase; }
  .value { font-size: 13px; font-weight: 750; }

  .billing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
  .billing-block { padding-top: 14px; border-top: 2px solid var(--line); }
  .billing-block h3 { margin: 0 0 8px; font-size: 13px; }
  .billing-block p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.65; }

  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { padding: 11px 10px; color: var(--muted); font-size: 9.5px; font-weight: 800; letter-spacing: 0.1em; text-align: left; text-transform: uppercase; white-space: nowrap; }
  td { padding: 14px 10px; border-top: 1px solid var(--line); vertical-align: top; }
  th:nth-child(n+2), td:nth-child(n+2) { text-align: right; }
  .item-title { display: block; color: var(--ink); font-weight: 760; }
  .item-sub { display: block; margin-top: 3px; color: var(--muted); font-size: 10px; }

  .summary { display: grid; grid-template-columns: 1fr 210px; gap: 28px; margin-top: 24px; align-items: start; }
  .terms { padding-top: 3px; }
  .terms h4 { margin: 0 0 6px; color: var(--ink); font-size: 11px; letter-spacing: 0; }
  .totals { width: 100%; }
  .total-row { display: flex; justify-content: space-between; gap: 18px; padding: 8px 0; color: var(--muted); border-bottom: 1px solid var(--line); font-size: 11px; }
  .grand-total { margin-top: 10px; padding: 13px 14px; color: #fff; border-radius: 6px; font-size: 16px; font-weight: 850; }
  .grand-total span { float: right; }

  .footer { position: absolute; right: 20mm; bottom: 15mm; left: 20mm; display: flex; justify-content: space-between; gap: 20px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--muted); font-size: 10px; }

  /* === CLASSIC === */
  .classic { border: 11mm solid #efe7d9; color: #261f19; font-family: Georgia,"Times New Roman",serif; background: linear-gradient(#fffaf1,#fffaf1) padding-box, linear-gradient(135deg,#c4a46a,#7c6242) border-box; }
  .classic .inner-border { position: absolute; inset: 13mm; border: 1px solid rgba(124,98,66,0.34); pointer-events: none; z-index: 0; }
  .classic .invoice { min-height: 275mm; padding: 17mm; }
  .classic .topline { display: block; text-align: center; }
  .classic .brand { justify-content: center; margin-top: 6mm; }
  .classic .mark { background: #7c6242; font-family: Inter,sans-serif; border-radius: 50%; }
  .classic .address { margin-top: 12px; }
  .classic .invoice-title { margin-top: 22px; color: #261f19; font-family: Georgia,"Times New Roman",serif; font-size: 34px; font-weight: 500; text-align: center; }
  .classic .invoice-number { color: #7c6242; text-align: center; }
  .classic .meta-grid { border-top: 1px solid rgba(124,98,66,0.36); border-bottom: 1px solid rgba(124,98,66,0.36); padding: 11px 0; }
  .classic .meta-card { padding: 6px 10px; border-width: 0 1px 0 0; border-radius: 0; background: transparent; }
  .classic .meta-card:last-child { border-right: 0; }
  .classic th { background: #efe7d9; color: #7c6242; }
  .classic .grand-total { background: #7c6242; }

  /* === PROFESSIONAL === */
  .professional { background: #f4f7fa; }
  .professional .sidebar { position: absolute; inset: 0 auto 0 0; width: 42mm; background: #12283d; z-index: 0; }
  .professional .invoice { padding-left: 52mm; }
  .professional .topline { padding-bottom: 18px; border-bottom: 4px solid #12283d; }
  .professional .mark { background: #12283d; border-radius: 3px; }
  .professional .invoice-title { color: #12283d; font-size: 46px; font-weight: 900; }
  .professional .meta-grid { grid-template-columns: 1fr; float: right; width: 62mm; margin: 22px 0 18px 18px; }
  .professional .meta-card { min-height: 58px; background: #fff; border-left: 5px solid #12283d; border-radius: 2px; box-shadow: 0 10px 26px rgba(18,40,61,0.08); }
  .professional .billing-grid { clear: none; grid-template-columns: 1fr; gap: 12px; }
  .professional table { clear: both; }
  .professional th { color: #fff; background: #12283d; }
  .professional tbody tr:nth-child(even) td { background: #eaf0f5; }
  .professional .grand-total { background: #12283d; border-radius: 2px; }

  /* === MEDIA === */
  .media { color: #f7f7fb; background: #25222b; }
  .media .media-watermark { display: none; }
  .media .invoice { padding: 18mm 20mm; }
  .media .topline { padding: 16px; border-radius: 8px; background: #f04f5f; }
  .media .brand-meta, .media .address, .media .invoice-number { color: rgba(255,255,255,0.8); }
  .media .mark { color: #f04f5f; background: #fff; }
  .media .invoice-title { color: #fff; font-weight: 950; }
  .media .meta-card { border: 0; background: #34313d; }
  .media .label { color: #ffb6bf; }
  .media .billing-block { border-top-color: #f04f5f; }
  .media .billing-block p, .media .item-sub, .media .terms, .media .footer, .media .total-row { color: rgba(247,247,251,0.72); }
  .media th { background: #f04f5f; color: #fff; }
  .media td { border-color: rgba(255,255,255,0.12); }
  .media .item-title { color: #fff; }
  .media .terms h4 { color: #fff; }
  .media .grand-total { color: #25222b; background: #ffd166; }

  /* === WEB === */
  .web { background: linear-gradient(90deg,rgba(45,108,223,0.08) 1px,transparent 1px), linear-gradient(rgba(45,108,223,0.08) 1px,transparent 1px), #f7fbff; background-size: 12px 12px; }
  .web .invoice { padding: 18mm; }
  .web .topline { padding: 14px; border: 1px solid #c7d7ff; border-radius: 8px; background: #fff; box-shadow: 0 14px 36px rgba(45,108,223,0.12); }
  .web .mark { background: #2d6cdf; border-radius: 7px; }
  .web .invoice-title { color: #2d6cdf; font-size: 35px; font-weight: 900; }
  .web .meta-grid { grid-template-columns: 1.2fr 0.9fr 0.9fr; }
  .web .meta-card { border: 1px solid #c7d7ff; background: #fff; box-shadow: 0 10px 26px rgba(45,108,223,0.08); }
  .web .billing-grid { padding: 14px; border: 1px solid #c7d7ff; border-radius: 8px; background: rgba(255,255,255,0.82); }
  .web .billing-block { padding: 0; border-top: 0; }
  .web table { overflow: hidden; border: 1px solid #c7d7ff; border-radius: 8px; background: #fff; border-collapse: separate; border-spacing: 0; }
  .web th { color: #2d6cdf; background: #edf4ff; }
  .web tbody tr:nth-child(even) td { background: rgba(45,108,223,0.045); }
  .web .summary { padding: 14px; border: 1px solid #c7d7ff; border-radius: 8px; background: #fff; }
  .web .grand-total { background: #2d6cdf; }

  /* === GRAPHIC === */
  .graphic { background: linear-gradient(90deg,#101418 0 26mm,transparent 26mm), linear-gradient(153deg,transparent 0 58%,rgba(255,90,64,0.16) 58% 77%,transparent 77%), #ffffff; }
  .graphic .design-label { position: absolute; left: 0; top: 0; bottom: 0; width: 26mm; display: flex; align-items: center; justify-content: center; writing-mode: vertical-rl; transform: rotate(180deg); color: rgba(255,255,255,0.85); font-size: 13px; font-weight: 950; letter-spacing: 0.28em; z-index: 2; pointer-events: none; }
  .graphic .invoice { padding-left: 36mm; }
  .graphic .topline { grid-template-columns: 0.82fr 1.18fr; gap: 14px; }
  .graphic .mark { background: #ff5a40; border-radius: 0; }
  .graphic .invoice-title { color: #101418; font-size: 56px; font-weight: 950; text-transform: uppercase; }
  .graphic .meta-grid { grid-template-columns: 1fr 1fr 1fr; gap: 0; border: 3px solid #101418; }
  .graphic .meta-card { border: 0; border-right: 3px solid #101418; border-radius: 0; background: #f2f3f5; }
  .graphic .meta-card:last-child { border-right: 0; background: #ffefeb; }
  .graphic th { color: #fff; background: #101418; }
  .graphic td { border-color: #101418; }
  .graphic .grand-total { background: #ff5a40; border-radius: 0; }

  /* === MINIMALISTIC === */
  .minimalistic { color: #161616; background: #fff; }
  .minimalistic .invoice { padding: 28mm 25mm; }
  .minimalistic .topline { grid-template-columns: 1fr; gap: 18px; }
  .minimalistic .brand { align-items: flex-start; }
  .minimalistic .mark { width: 10px; height: 42px; overflow: hidden; color: transparent; background: #161616; border-radius: 0; }
  .minimalistic .brand-name { font-size: 18px; font-weight: 650; }
  .minimalistic .invoice-title { font-size: 54px; font-weight: 450; text-align: left; }
  .minimalistic .invoice-number { text-align: left; }
  .minimalistic .meta-grid { grid-template-columns: repeat(3,1fr); gap: 28px; margin: 38px 0; }
  .minimalistic .meta-card { min-height: auto; padding: 0 0 10px; border-width: 0 0 1px; border-radius: 0; background: transparent; }
  .minimalistic .billing-grid { gap: 44px; }
  .minimalistic .billing-block { border-top: 1px solid #161616; }
  .minimalistic th { padding-left: 0; padding-right: 0; border-bottom: 1px solid #161616; }
  .minimalistic td { padding-left: 0; padding-right: 0; }
  .minimalistic .summary { grid-template-columns: 1fr 180px; margin-top: 42px; }
  .minimalistic .grand-total { background: #161616; border-radius: 0; }

  /* === FREELANCER === */
  .freelancer { background: linear-gradient(90deg,rgba(36,129,110,0.08) 1px,transparent 1px), #fffdf8; background-size: 9mm 9mm; }
  .freelancer .deco-circle { position: absolute; right: 18mm; top: 24mm; width: 34mm; height: 34mm; border-radius: 50%; background: #ffd166; box-shadow: -18mm 120mm 0 -10mm rgba(36,129,110,0.24); z-index: 0; }
  .freelancer .deco-stamp { position: absolute; right: 18mm; bottom: 19mm; padding: 7px 9px; color: #24816e; border: 2px solid #24816e; border-radius: 8px; background: #fffdf8; font-size: 9px; font-weight: 900; letter-spacing: 0.12em; transform: rotate(-5deg); z-index: 2; }
  .freelancer .topline { padding: 15px; border: 2px solid #24816e; border-radius: 8px; background: #fffdf8; }
  .freelancer .mark { background: #24816e; border-radius: 50%; }
  .freelancer .invoice-title { color: #24816e; font-size: 36px; font-weight: 850; }
  .freelancer .invoice-number { color: #b45f06; }
  .freelancer .meta-card { border: 2px solid #24816e; background: #f6fff7; box-shadow: 4px 4px 0 rgba(36,129,110,0.15); }
  .freelancer .billing-block { border-top: 2px dotted #24816e; }
  .freelancer th { color: #24816e; border-bottom: 2px solid #24816e; }
  .freelancer tbody tr:nth-child(odd) td { background: rgba(255,209,102,0.12); }
  .freelancer .grand-total { background: #24816e; box-shadow: 4px 4px 0 #ffd166; }

  /* === AVANT (Playful Pop Creative) === */
  .avant { background: repeating-linear-gradient(135deg,rgba(255,110,96,0.11) 0 2px,transparent 2px 16px), linear-gradient(160deg,#fff7db 0 27%,transparent 27%), linear-gradient(20deg,transparent 0 74%,rgba(67,97,238,0.13) 74%), #fffdf6; }
  .avant .color-bar { position: absolute; inset: 0 0 auto 0; height: 13mm; background: linear-gradient(90deg,#ff6b6b 0 21%,#ffd166 21% 42%,#06d6a0 42% 63%,#4361ee 63% 82%,#1b1b1f 82%); z-index: 2; }
  .avant .creative-badge { position: absolute; right: 3mm; top: 66mm; padding: 4px 18px; color: #1b1b1f; border: 2px solid #1b1b1f; background: #ffd166; font-size: 10px; font-weight: 900; letter-spacing: 0.22em; transform: rotate(90deg); transform-origin: right center; z-index: 3; }
  .avant .invoice { padding: 23mm 22mm 20mm; }
  .avant .topline { align-items: end; padding: 13px 14px; border: 2px solid #1b1b1f; background: rgba(255,255,255,0.9); box-shadow: 7px 7px 0 #06d6a0; }
  .avant .mark { background: #ff6b6b; color: #1b1b1f; border: 2px solid #1b1b1f; box-shadow: 4px 4px 0 #ffd166; }
  .avant .brand-name, .avant .invoice-title { color: #1b1b1f; font-weight: 950; }
  .avant .invoice-title { font-size: 45px; }
  .avant .invoice-number { color: #4361ee; }
  .avant .meta-card { border: 2px solid #1b1b1f; background: #fff; box-shadow: 4px 4px 0 rgba(27,27,31,0.13); }
  .avant .meta-card:nth-child(1) { background: #fff0ef; }
  .avant .meta-card:nth-child(2) { background: #ecfff8; }
  .avant .meta-card:nth-child(3) { background: #eef1ff; }
  .avant .billing-block { border-top: 3px solid #1b1b1f; }
  .avant th { color: #1b1b1f; background: #ffd166; border-top: 2px solid #1b1b1f; border-bottom: 2px solid #1b1b1f; }
  .avant td { border-color: rgba(27,27,31,0.18); }
  .avant tbody tr:nth-child(even) td { background: rgba(6,214,160,0.08); }
  .avant .grand-total { color: #1b1b1f; background: #06d6a0; border: 2px solid #1b1b1f; box-shadow: 5px 5px 0 #ff6b6b; }

  /* === LUXE (Bold Collage Creative) === */
  .luxe { background: linear-gradient(90deg,rgba(18,18,18,0.04) 1px,transparent 1px), linear-gradient(rgba(18,18,18,0.04) 1px,transparent 1px), linear-gradient(145deg,transparent 0 62%,#ffe66d 62% 74%,transparent 74%), #f8fbff; background-size: 14px 14px,14px 14px,auto,auto; }
  .luxe .luxe-header-bg { position: absolute; left: 0; top: 0; width: 100%; height: 37mm; z-index: 0; overflow: hidden; }
  .luxe .luxe-header-bg-dark { position: absolute; inset: 0; background: linear-gradient(120deg,#111827 0 44%,transparent 44%); }
  .luxe .luxe-header-bg-stripe { position: absolute; inset: 0; background: linear-gradient(90deg,transparent 0 48%,#ef476f 48% 59%,#118ab2 59% 73%,transparent 73%); }
  .luxe .luxe-memo { position: absolute; right: 20mm; bottom: 32mm; width: 48mm; padding: 7px 9px; color: #111827; border: 2px solid #111827; background: #ffe66d; font-size: 9px; font-weight: 950; letter-spacing: 0.13em; text-align: center; transform: rotate(-4deg); box-shadow: 5px 5px 0 rgba(17,24,39,0.18); z-index: 3; }
  .luxe .invoice { padding-top: 21mm; }
  .luxe .brand-name, .luxe .brand-meta, .luxe .address { color: #fff; }
  .luxe .invoice-title { color: #111827; font-size: 43px; font-weight: 950; text-shadow: 4px 4px 0 #ffe66d; }
  .luxe .invoice-number { color: #ef476f; }
  .luxe .mark { background: #ffe66d; color: #111827; border: 2px solid #fff; transform: rotate(-3deg); }
  .luxe .meta-grid { margin-top: 38px; }
  .luxe .meta-card { border: 0; background: #fff; box-shadow: 0 0 0 2px #111827 inset, 6px 6px 0 rgba(17,24,39,0.12); }
  .luxe .meta-card:nth-child(1) { border-bottom: 6px solid #ef476f; }
  .luxe .meta-card:nth-child(2) { border-bottom: 6px solid #118ab2; }
  .luxe .meta-card:nth-child(3) { border-bottom: 6px solid #ffe66d; }
  .luxe .billing-block { border-top: 3px dashed #111827; }
  .luxe th { color: #fff; background: #111827; }
  .luxe tbody tr:nth-child(odd) td { background: rgba(239,71,111,0.055); }
  .luxe .grand-total { color: #fff; background: #ef476f; box-shadow: 5px 5px 0 #111827; }
`;

function buildInvoiceBody(data: InvoiceTemplateData): string {
  const initials = data.businessName
    .split(" ")
    .slice(0, 2)
    .map((w) => (w[0] || "").toUpperCase())
    .join("");

  const lineItemsHTML = data.lineItems
    .map(
      (item) => `
    <tr>
      <td>
        <span class="item-title">${esc(item.description)}</span>
        ${item.subDescription ? `<span class="item-sub">${esc(item.subDescription)}</span>` : ""}
      </td>
      <td>${esc(item.qty)}</td>
      <td>${esc(item.rate)}</td>
      <td>${esc(item.amount)}</td>
    </tr>`
    )
    .join("");

  const taxRow =
    parseFloat(data.taxFormatted) > 0
      ? `<div class="total-row"><span>${esc(data.taxLabel)}</span><strong>${esc(data.currency)} ${esc(data.taxFormatted)}</strong></div>`
      : "";

  const clientLines = [
    esc(data.clientName),
    data.clientAddress ? esc(data.clientAddress) : "",
    [data.clientCity, data.clientState, data.clientZip].filter(Boolean).map(esc).join(", "),
    data.clientEmail ? esc(data.clientEmail) : "",
  ]
    .filter(Boolean)
    .join("<br>");

  const businessContact = [data.businessEmail, data.businessPhone]
    .filter(Boolean)
    .map(esc)
    .join(" | ");

  const businessAddress = [esc(data.businessAddress), businessContact]
    .filter(Boolean)
    .join("<br>");

  const template = data.template;

  const sidebarDiv =
    template === "professional"
      ? `<div class="sidebar"></div>`
      : "";

  const mediaWatermark =
    template === "media"
      ? `<div class="media-watermark">MEDIA KIT</div>`
      : "";

  const graphicLabel =
    template === "graphic"
      ? `<div class="design-label">DESIGN</div>`
      : "";

  const freelancerDecos =
    template === "freelancer"
      ? `<div class="deco-circle"></div><div class="deco-stamp">PAID WITH CARE</div>`
      : "";

  const avantDecos =
    template === "avant"
      ? `<div class="color-bar"></div><div class="creative-badge">CREATIVE</div>`
      : "";

  const luxeDecos =
    template === "luxe"
      ? `<div class="luxe-header-bg"><div class="luxe-header-bg-dark"></div><div class="luxe-header-bg-stripe"></div></div><div class="luxe-memo">MAKE IT MEMORABLE</div>`
      : "";

  const classicInnerBorder =
    template === "classic"
      ? `<div class="inner-border"></div>`
      : "";

  return `
    ${sidebarDiv}${mediaWatermark}${graphicLabel}${freelancerDecos}${avantDecos}${luxeDecos}${classicInnerBorder}
    <header class="topline">
      <div>
        <div class="brand">
          ${data.showLogo !== false && data.logoUrl
            ? `<img src="${data.logoUrl}" alt="" style="max-height:${data.logoSize || "64"}px;max-width:120px;object-fit:contain;display:block;flex-shrink:0;" />`
            : `<div class="mark">${initials || "BN"}</div>`}
          <div>
            <h1 class="brand-name">${esc(data.businessName) || "Your Business"}</h1>
            ${data.businessMeta ? `<div class="brand-meta">${esc(data.businessMeta)}</div>` : ""}
          </div>
        </div>
        ${businessAddress ? `<div class="address">${businessAddress}</div>` : ""}
      </div>
      <div>
        <h2 class="invoice-title">Invoice</h2>
        <div class="invoice-number">${esc(data.invoiceNumber)}</div>
      </div>
    </header>

    <div class="meta-grid${data.dueDate ? '' : ' two-col'}">
      <div class="meta-card"><span class="label">Issue Date</span><span class="value">${esc(data.issueDate)}</span></div>
      ${data.dueDate ? `<div class="meta-card"><span class="label">Due Date</span><span class="value">${esc(data.dueDate)}</span></div>` : ''}
      <div class="meta-card"><span class="label">Balance Due</span><span class="value">${esc(data.currency)} ${esc(data.totalFormatted)}</span></div>
    </div>

    <div class="billing-grid">
      <div class="billing-block">
        <h3>Bill To</h3>
        <p>${clientLines || "(no client)"}</p>
      </div>
      <div class="billing-block">
        <h3>Notes</h3>
        <p>${data.notes ? esc(data.notes).replace(/\n/g, "<br>") : "Thank you for your business."}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Hours</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHTML}
      </tbody>
    </table>

    <div class="summary">
      <div class="terms">
        <h4>Payment Terms</h4>
        Payment is due by the stated due date. Please include the invoice number on your remittance.
      </div>
      <div class="totals">
        <div class="total-row"><span>Subtotal</span><strong>${esc(data.currency)} ${esc(data.subtotalFormatted)}</strong></div>
        ${taxRow}
        <div class="grand-total">Total <span>${esc(data.currency)} ${esc(data.totalFormatted)}</span></div>
      </div>
    </div>

    <footer class="footer">
      <span>${esc(data.businessName)}</span>
      <span>${esc(data.businessEmail || "")}</span>
    </footer>
  `;
}

function buildColorOverrideCSS(data: InvoiceTemplateData): string {
  const { template, primaryColor: p, accentColor: a, bgColor } = data;
  if (!p) return "";

  const acc = a || p;

  let css = `
    .${template} .grand-total { background: ${p} !important; color: #fff !important; }
    .${template} th { background: ${p} !important; color: #fff !important; }
    .${template} .mark { background: ${p} !important; }
    .${template} .billing-block { border-top-color: ${p} !important; }
  `;

  switch (template) {
    case "professional":
      css += `
        .professional .sidebar { background: ${p} !important; }
        .professional .topline { border-bottom-color: ${p} !important; }
        .professional .meta-card { border-left-color: ${p} !important; }
      `;
      break;
    case "classic":
      css += `
        .classic { border-color: ${acc} !important; }
        .classic .inner-border { border-color: ${acc}88 !important; }
        .classic .invoice-title { color: ${p} !important; }
        .classic .invoice-number { color: ${p} !important; }
        .classic th { background: transparent !important; color: ${p} !important; }
      `;
      break;
    case "media":
      css += `
        .media .topline { background: ${p} !important; }
        .media .mark { color: ${p} !important; background: #fff !important; }
        .media th { background: ${p} !important; }
        .media .label { color: ${acc} !important; }
        .media .grand-total { background: ${acc} !important; color: #111 !important; }
        .media .billing-block { border-top-color: ${p} !important; }
      `;
      break;
    case "web":
      css += `
        .web .mark { background: ${p} !important; }
        .web .invoice-title { color: ${p} !important; }
        .web .meta-card { border-color: ${acc} !important; }
        .web .topline { border-color: ${acc} !important; }
        .web .billing-grid { border-color: ${acc} !important; }
        .web .summary { border-color: ${acc} !important; }
        .web th { background: transparent !important; color: ${p} !important; border-top: none; }
      `;
      break;
    case "graphic":
      css += `
        .graphic { background: linear-gradient(90deg,${p} 0 26mm,transparent 26mm), linear-gradient(153deg,transparent 0 58%,${acc}28 58% 77%,transparent 77%), #ffffff !important; }
        .graphic .design-label { color: rgba(255,255,255,0.85) !important; }
        .graphic .meta-grid { border-color: ${p} !important; }
        .graphic .meta-card { border-color: ${p} !important; }
        .graphic .grand-total { background: ${acc} !important; }
        .graphic .mark { background: ${acc} !important; }
        .graphic .meta-card:last-child { background: ${acc}22 !important; }
      `;
      break;
    case "minimalistic":
      css += `
        .minimalistic .mark { background: ${p} !important; }
        .minimalistic .grand-total { background: ${p} !important; }
        .minimalistic th { border-bottom-color: ${p} !important; background: transparent !important; color: var(--muted) !important; }
        .minimalistic .billing-block { border-top-color: ${p} !important; }
      `;
      break;
    case "freelancer":
      css += `
        .freelancer .topline { border-color: ${p} !important; }
        .freelancer .meta-card { border-color: ${p} !important; }
        .freelancer .invoice-title { color: ${p} !important; }
        .freelancer .deco-circle { background: ${acc} !important; }
        .freelancer .deco-stamp { color: ${p} !important; border-color: ${p} !important; }
        .freelancer .grand-total { background: ${p} !important; box-shadow: 4px 4px 0 ${acc} !important; }
        .freelancer th { color: ${p} !important; background: transparent !important; border-bottom-color: ${p} !important; }
        .freelancer .billing-block { border-top-color: ${p} !important; }
      `;
      break;
    case "avant":
      css += `
        .avant .color-bar { background: ${p} !important; }
        .avant .topline { box-shadow: 7px 7px 0 ${acc} !important; border-color: ${p} !important; }
        .avant .mark { background: ${p} !important; }
        .avant th { background: ${acc} !important; border-color: ${p} !important; }
        .avant .grand-total { background: ${acc} !important; border-color: ${p} !important; box-shadow: 5px 5px 0 ${p} !important; }
        .avant .creative-badge { background: ${acc} !important; border-color: ${p} !important; }
      `;
      break;
    case "luxe":
      css += `
        .luxe .luxe-header-bg-dark { background: linear-gradient(120deg,${p} 0 44%,transparent 44%) !important; }
        .luxe .meta-card:nth-child(1) { border-bottom-color: ${p} !important; }
        .luxe .meta-card:nth-child(2) { border-bottom-color: ${acc} !important; }
        .luxe .grand-total { background: ${p} !important; }
        .luxe .luxe-memo { background: ${acc} !important; }
        .luxe .invoice-number { color: ${p} !important; }
      `;
      break;
  }

  if (bgColor && bgColor !== "#ffffff") {
    css += `body, .invoice-page.${template} { background: ${bgColor} !important; }`;
  }

  return css;
}

export function generateInvoiceHTML(data: InvoiceTemplateData): string {
  const colorOverrides = buildColorOverrideCSS(data);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    ${INVOICE_CSS}
    ${colorOverrides}
  </style>
</head>
<body>
  <section class="invoice-page ${esc(data.template)}">
    <div class="invoice">
      ${buildInvoiceBody(data)}
    </div>
  </section>
</body>
</html>`;
}
