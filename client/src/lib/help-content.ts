import trackerImage from "@/assets/help/time-tracker.webp";
import dashboardImage from "@/assets/help/dashboard.webp";
import reportsImage from "@/assets/help/reports.webp";
import invoicesImage from "@/assets/help/invoices.webp";

export type HelpSection = {
  title: string;
  introduction?: string;
  steps?: string[];
  bullets?: string[];
  note?: string;
};

export type HelpArticle = {
  slug: string;
  category: "Start" | "Track" | "Review" | "Bill" | "Personalize" | "Support";
  title: string;
  summary: string;
  keywords: string[];
  image?: string;
  imageAlt?: string;
  imageCaption?: string;
  sections: HelpSection[];
  related: string[];
};

export const helpArticles: HelpArticle[] = [
  {
    slug: "getting-started",
    category: "Start",
    title: "Getting started with Tickd",
    summary: "Set up your first client and project, track work, review it, and prepare it for billing.",
    keywords: ["onboarding", "first client", "first project", "workflow"],
    sections: [
      {
        title: "The complete Tickd workflow",
        introduction: "Tickd is designed so information is entered once and reused throughout the working and billing process.",
        steps: [
          "Create a client and choose the client currency, color, and contact details.",
          "Create a project for that client, then set its hourly rate, color, and active status.",
          "Open Time Tracker, describe the task, choose the client and project, and start the timer.",
          "Stop the timer when the work session ends. Tickd saves it as an editable time block.",
          "Review the selected period on Dashboard or generate a detailed report from Reports.",
          "Edit the report presentation if needed, then export the report or generate an invoice.",
        ],
      },
      {
        title: "What to configure first",
        bullets: [
          "Business Settings: your legal name, address, tax information, payment details, and default currency.",
          "Invoice Settings: invoice number format, default due date, template, visible fields, notes, payment terms, and footer.",
          "Account Settings: your name, profile image, password, and subscription plan.",
        ],
        note: "Client-specific invoice settings override global defaults only for that client. Use them when clients require different languages, currencies, payment details, or layouts.",
      },
    ],
    related: ["clients-and-projects", "tracking-time", "settings-and-account"],
  },
  {
    slug: "clients-and-projects",
    category: "Start",
    title: "Clients and projects",
    summary: "Organize billable work with client currencies, colors, invoice profiles, project rates, and active status.",
    keywords: ["client", "project", "rate", "color", "currency", "invoice profile"],
    sections: [
      {
        title: "Create or edit a client",
        steps: [
          "Open Clients and select Add Client. You can also add a client from the client menu above the timer.",
          "Enter the client name. Add email, phone, billing address, and tax details when they are needed on invoices.",
          "Choose the billing currency and a client color. The color identifies the client across lists, tracking, and dashboard views.",
          "Optionally enable a client invoice profile to choose a template, language, custom labels, layout, notes, footer, and payment details for this client.",
          "Save the client. Use Edit from the client list whenever those details change.",
        ],
      },
      {
        title: "Create or edit a project",
        steps: [
          "Open Projects or use the project menu above the timer.",
          "Select the client, enter the project name, and set the hourly rate.",
          "Choose a project color. This color appears in tracker suggestions and project-based summaries.",
          "Leave Active enabled while the project should be available for new time entries. Disabling it keeps historical records but removes it from active choices.",
        ],
        note: "A project inherits its billing currency from its client. Changing the client currency updates how that client’s work is presented in reports and invoices.",
      },
      {
        title: "When to use separate projects",
        bullets: [
          "Use separate projects when rates differ for the same client.",
          "Use separate projects when the client wants work divided by service, campaign, department, or contract.",
          "Keep one project when the work shares one rate and does not need separate reporting.",
        ],
      },
    ],
    related: ["getting-started", "tracking-time", "currencies-and-conversion"],
  },
  {
    slug: "tracking-time",
    category: "Track",
    title: "Track time with the timer",
    summary: "Start, stop, continue, and organize work while keeping every account’s timer separate.",
    keywords: ["timer", "start", "stop", "suggestions", "description", "blocks"],
    image: trackerImage,
    imageAlt: "Tickd Time Tracker with description, client, project, timer, format, grouping, and date controls",
    imageCaption: "The Time Tracker combines the active timer with display, grouping, and date-range controls.",
    sections: [
      {
        title: "Start and stop a timer",
        steps: [
          "Enter a clear description of the work. The description becomes the report and invoice line description.",
          "Choose the client, then choose one of that client’s projects.",
          "Select Start. The timer remains visible in the sidebar while you move through Tickd.",
          "Select Stop when the session ends. Tickd saves the start time, end time, duration, date, client, project, and description.",
        ],
        note: "Timers are scoped to the signed-in account. Logging into another Tickd account does not expose or control the first account’s timer.",
      },
      {
        title: "Continue previous work",
        bullets: [
          "Select the play control on an existing entry to continue the same description, client, and project.",
          "Stopping and restarting the same task on the same date creates separate blocks inside one grouped entry.",
          "After three typed characters, suggestions appear from your own history with the previous project, client, and project color.",
        ],
      },
      {
        title: "Change the tracker view",
        bullets: [
          "Format switches between decimal hours and HH:MM:SS-style time.",
          "Group by organizes entries by date, project, or client.",
          "Date Range limits the list to a chosen period without deleting any entries.",
        ],
      },
    ],
    related: ["editing-time-entries", "clients-and-projects", "dashboard"],
  },
  {
    slug: "editing-time-entries",
    category: "Track",
    title: "Edit time entries and blocks",
    summary: "Correct descriptions, projects, dates, start and end times, durations, notes, and individual work blocks.",
    keywords: ["edit", "duration", "start time", "end time", "date", "duplicate", "delete", "notes"],
    sections: [
      {
        title: "Edit a grouped entry",
        introduction: "Entries with the same description, project, and date are shown as one grouped task total. Expand the row when you need to work with an individual block.",
        steps: [
          "Open the entry’s edit control.",
          "Change the description, client, project, or total duration.",
          "Press Enter or click outside an editable time field to save. Press Escape to cancel that field edit.",
          "Review the recalculated total after saving.",
        ],
      },
      {
        title: "Edit start and end times",
        bullets: [
          "Type compact values such as 230, 0230, 1430, or standard values such as 2:30 pm and 14:30.",
          "Tickd uses the surrounding start time, end time, and duration to choose the most logical AM or PM interpretation.",
          "A valid change immediately recalculates the duration and related totals.",
          "Tickd avoids negative durations and only moves the end time into the next day when the entry clearly crosses midnight.",
        ],
      },
      {
        title: "Move one block to another date",
        steps: [
          "Expand the grouped entry and select the calendar beside the specific block.",
          "Choose today or an earlier date. Future dates are disabled.",
          "If a matching task exists on the destination date, the block joins it. Otherwise Tickd creates a new entry with the same client and project.",
          "The destination entry is briefly highlighted so it is easy to find.",
        ],
      },
      {
        title: "Notes, duplication, and deletion",
        bullets: [
          "Entry notes remain attached to the time entry and are also searchable from Notes.",
          "Duplicate creates a copy on the same date for quick correction or reuse.",
          "Delete asks for confirmation because deleted time affects reports and billing totals.",
        ],
      },
    ],
    related: ["tracking-time", "reports", "troubleshooting"],
  },
  {
    slug: "dashboard",
    category: "Review",
    title: "Understand the dashboard",
    summary: "Review hours, active days, work patterns, estimated value, clients, and projects for any period.",
    keywords: ["dashboard", "chart", "date range", "hours", "value", "clients", "projects"],
    image: dashboardImage,
    imageAlt: "Tickd Dashboard showing the selected date range, tracked hours, active days, and work pattern",
    imageCaption: "Every dashboard summary and chart follows the same selected date range.",
    sections: [
      {
        title: "Choose a date range",
        bullets: [
          "This week shows Sunday through Saturday, including days with zero time.",
          "Last 7 days, Last 30 days, Last 90 days, and Last year provide quick rolling periods.",
          "Custom displays start and end calendars only after Custom is selected.",
          "Changing the range updates summary totals, daily bars, client breakdowns, project breakdowns, and estimated value together.",
        ],
      },
      {
        title: "Read the dashboard",
        bullets: [
          "Tracked Hours is the total duration inside the selected range.",
          "Active Days counts dates that contain tracked work and shows the daily average.",
          "Daily Work Pattern compares each date. Weekly bars are wide; longer ranges use denser bars to reduce horizontal scrolling.",
          "Client and Project sections explain where time and value were concentrated.",
        ],
      },
      {
        title: "Display value in another currency",
        introduction: "The dashboard can convert estimated value without changing the currency used to bill the client.",
        bullets: [
          "Supported currencies use the live exchange-rate source.",
          "Unsupported or custom currencies use the USD comparison rate saved in your profile.",
          "Changing dashboard display currency does not rewrite project rates or invoice currencies.",
        ],
      },
    ],
    related: ["tracking-time", "reports", "currencies-and-conversion"],
  },
  {
    slug: "reports",
    category: "Review",
    title: "Create and edit reports",
    summary: "Filter tracked work, group it by week, adjust time, edit billing details, export it, or send it to an invoice.",
    keywords: ["report", "filters", "weekly", "adjustment", "rounding", "export", "edit report"],
    image: reportsImage,
    imageAlt: "Tickd Reports page showing report filters and the Apply Filters action",
    imageCaption: "Reports begin with client, project, and date filters before any billing adjustments are applied.",
    sections: [
      {
        title: "Generate a report",
        steps: [
          "Choose a client. Optionally limit the report to one of that client’s projects.",
          "Choose inclusive start and end dates.",
          "Select Apply Filters to load the matching time entries.",
          "Choose decimal or clock-style hours and enable weekly grouping when the client needs week-by-week detail.",
          "Review descriptions, hours, rates, currency, amounts, and totals before exporting or invoicing.",
        ],
      },
      {
        title: "Use time adjustments",
        bullets: [
          "Percentage Increase applies the chosen percentage to report hours and updates the visible amounts immediately.",
          "Round Up to Tenth always rounds upward. For example, 0.64 hours becomes 0.7 hours.",
          "Adjustments affect the current report and generated invoice, not the original tracked entries.",
        ],
      },
      {
        title: "Edit the report presentation",
        bullets: [
          "Edit Report makes the visible description, project, hours, and rate editable.",
          "Each amount recalculates immediately from edited hours and rate.",
          "Leaving edit mode keeps those revisions available for export and invoice generation during the current report session.",
          "The source time entries remain unchanged.",
        ],
      },
      {
        title: "Export report or generate invoice",
        bullets: [
          "Export Report creates a work summary with Hours and Amount columns in the client currency.",
          "Generate Invoice transfers the currently visible report rows, edits, adjustments, grouping, currency, and totals into the invoice editor.",
          "Equivalent work blocks are combined. With weekly grouping they combine within each week; without it they combine across the full report period.",
        ],
      },
    ],
    related: ["dashboard", "invoices", "currencies-and-conversion"],
  },
  {
    slug: "invoices",
    category: "Bill",
    title: "Create and manage invoices",
    summary: "Generate invoices from reviewed time, customize line items, save records, export PDFs, and track payment status.",
    keywords: ["invoice", "generate", "line items", "save", "status", "paid", "due date", "pdf"],
    image: invoicesImage,
    imageAlt: "Tickd Invoices page with invoice creation guidance, payment summary, and invoice navigation",
    imageCaption: "Invoices are generated from reports, then saved and managed from the Invoices page.",
    sections: [
      {
        title: "Generate an invoice from tracked work",
        steps: [
          "Open Reports and generate the exact client, project, and date period you intend to bill.",
          "Review or edit report descriptions, hours, rates, adjustments, currency, and weekly grouping.",
          "Select Generate Invoice.",
          "Review the transferred line items and totals in the invoice editor.",
          "Save the invoice when it is correct. Previewing alone does not consume the next invoice number.",
        ],
      },
      {
        title: "Edit invoice content",
        bullets: [
          "Edit line descriptions, hours, rates, and amounts. Totals recalculate automatically.",
          "Choose the invoice date and due-date rule. The default due date is one calendar month after the invoice date.",
          "Use a custom number of days or a manually selected due date when the client requires different terms.",
          "Enable tax, notes, payment details, payment terms, project names, and optional columns only when needed.",
        ],
      },
      {
        title: "Save, export, and update status",
        bullets: [
          "Save as Draft while the invoice still needs review.",
          "Use Sent after delivery and Paid after payment is received. Status can be returned to Draft when necessary.",
          "Exported invoices include the saved client profile, payment details, totals, notes, footer, language, and currency.",
          "The invoice list summarizes outstanding and paid values by their real currencies.",
        ],
      },
      {
        title: "Invoice numbering",
        introduction: "The displayed invoice number can include a prefix, padded sequential number, and suffix.",
        bullets: [
          "A format such as INV-1104 is used consistently in settings, preview, generated invoice, and saved record.",
          "The sequential counter advances only after successful invoice creation.",
          "Different letters can be configured around the number when the business requires a specific naming convention.",
        ],
      },
    ],
    related: ["reports", "invoice-customization", "currencies-and-conversion"],
  },
  {
    slug: "invoice-customization",
    category: "Bill",
    title: "Customize invoice templates",
    summary: "Control templates, client languages, labels, colors, notes, payment details, footers, and reusable client profiles.",
    keywords: ["invoice settings", "template", "language", "notes", "payment terms", "footer", "client profile"],
    sections: [
      {
        title: "Global defaults and client profiles",
        bullets: [
          "Invoice Settings defines the default template for new clients and invoices.",
          "A client invoice profile overrides the defaults only for that client.",
          "Use client profiles for different languages, currencies, payment methods, numbering preferences, colors, or layouts.",
          "The live preview updates as settings change so the saved result is visible before export.",
        ],
      },
      {
        title: "Language and custom labels",
        steps: [
          "Choose a built-in invoice language when available.",
          "Choose Custom to edit invoice titles and labels in any language.",
          "Save custom labels to your user profile, then assign them through a client invoice profile.",
          "Preview the client invoice to confirm every translated label fits the selected layout.",
        ],
      },
      {
        title: "Notes, payment terms, and payment details",
        bullets: [
          "Notes can be turned on or off. When enabled, the displayed notes text is editable.",
          "Payment Terms is an independent toggle. Disabling it hides the terms but preserves the saved text.",
          "Payment Details receive visual emphasis and appear above or beside Notes according to the chosen layout.",
          "The editable footer remains inside the safe invoice content width and avoids contrasting side panels.",
        ],
      },
      {
        title: "Change a generated invoice",
        introduction: "Use Edit invoice settings from the generated invoice when the preview needs layout or content changes. Tickd returns to customization with the invoice and its line items still available.",
      },
    ],
    related: ["invoices", "clients-and-projects", "settings-and-account"],
  },
  {
    slug: "currencies-and-conversion",
    category: "Review",
    title: "Currencies and conversion",
    summary: "Understand client billing currency, dashboard display currency, live rates, and custom user currencies.",
    keywords: ["currency", "exchange rate", "GBP", "USD", "custom currency", "conversion"],
    sections: [
      {
        title: "Billing currency versus display currency",
        bullets: [
          "Client currency controls the currency used in that client’s reports and invoices.",
          "Project rates are interpreted in the associated client currency.",
          "Dashboard and tracker display currency converts estimated value for analysis only.",
          "Changing display currency does not change client rates, invoice currency, or saved invoice totals.",
        ],
      },
      {
        title: "Live and manual exchange rates",
        bullets: [
          "Supported currencies use the live exchange-rate source.",
          "When the source does not support a currency, Tickd asks for its current value compared with USD.",
          "Conversion between a client currency and a custom currency goes through USD using the live supported rate and your saved custom rate.",
          "Manual and custom rates belong only to the signed-in user profile.",
        ],
      },
      {
        title: "Add, edit, or remove a custom currency",
        steps: [
          "Open the currency selector and choose the custom-currency action.",
          "Enter the currency code or name and its value compared with USD.",
          "Save it. The currency becomes available in the dashboard and time tracker selectors.",
          "Open the selector again and use the edit icon beside a manual or custom currency to change or remove it.",
        ],
        note: "Review manual rates regularly. Tickd can only update currencies supplied by the live provider automatically.",
      },
    ],
    related: ["clients-and-projects", "dashboard", "reports"],
  },
  {
    slug: "settings-and-account",
    category: "Personalize",
    title: "Business, invoice, and account settings",
    summary: "Manage business identity, payment information, invoice defaults, profile details, security, and subscription state.",
    keywords: ["settings", "business", "profile", "password", "avatar", "subscription", "payment details"],
    sections: [
      {
        title: "Business Settings",
        bullets: [
          "Save the business name, address, country, phone, email, and tax identification used on invoices.",
          "Choose the payment method and complete the fields relevant to bank transfer, PayPal, Wise, or other instructions.",
          "Set default currency and tax behavior for new invoice workflows.",
          "Saved settings remain associated only with the signed-in account.",
        ],
      },
      {
        title: "Invoice Settings",
        bullets: [
          "Configure invoice numbering, template, theme colors, typography, logo, visible columns, grouping, and project-name display.",
          "Set the default due-date rule to one calendar month, a chosen number of days, or a manual date during invoice editing.",
          "Configure default notes, payment terms, payment details, and footer content.",
          "Client invoice profiles can override these settings without changing other clients.",
        ],
      },
      {
        title: "Account Settings",
        bullets: [
          "Profile updates your name and email. Email changes require confirmation.",
          "Profile image uploads show progress and use consistent circular cropping without stretching.",
          "Security changes the account password.",
          "Plan shows the current subscription and available downgrade controls. Paid upgrades will be connected through billing.",
        ],
      },
    ],
    related: ["invoice-customization", "getting-started", "troubleshooting"],
  },
  {
    slug: "creative-panel",
    category: "Personalize",
    title: "Creative panel and notes",
    summary: "Use optional soundtracks, idea notes, inspiration, weekly goals, wellness tools, and work-entry notes.",
    keywords: ["creative panel", "music", "notes", "goals", "breathing", "wellness", "inspiration"],
    sections: [
      {
        title: "Soundtracks",
        bullets: [
          "Deep Work is intended for long editing, invoicing, writing, and concentration sessions.",
          "Creative Flow supports design, concepting, and arrangement work.",
          "Reset provides a quieter transition between clients or at the end of the day.",
          "Tracks and artwork appear automatically as the private Tickd soundtrack library is populated.",
        ],
      },
      {
        title: "Creative notes and inspiration",
        bullets: [
          "Creative notes can include a title, content, category, tags, and pinning.",
          "Search, edit, and delete controls apply only to notes owned by the signed-in user.",
          "Inspiration provides refreshable quotes, prompts, and color palettes for a quick change of pace.",
        ],
      },
      {
        title: "Weekly goals and wellness",
        bullets: [
          "Weekly goals can be created, prioritized, completed, edited, and deleted. Only the current Monday-start week is shown.",
          "Wellness includes guided breathing presets with Start, Pause, and Reset controls.",
          "The entire panel can be collapsed when it is not useful for the current session.",
        ],
      },
      {
        title: "Work-entry notes versus creative notes",
        introduction: "A note attached to a tracked entry documents client work and appears on the main Notes page. A creative-panel note belongs to the separate personal idea library. The two note systems intentionally remain separate.",
      },
    ],
    related: ["tracking-time", "settings-and-account", "troubleshooting"],
  },
  {
    slug: "troubleshooting",
    category: "Support",
    title: "Troubleshooting common questions",
    summary: "Quick answers for timer, grouping, currency, report, invoice, and account behavior.",
    keywords: ["problem", "error", "cannot start", "missing", "grouped", "support"],
    sections: [
      {
        title: "Why can’t I start the timer?",
        introduction: "Enter a description and select the required client and project context. Start remains unavailable until the entry is valid. If no clients exist, use Add Client from the open client menu.",
      },
      {
        title: "Why did two entries become one?",
        introduction: "Entries with the same description, project, and date are displayed as one grouped task. Expand it to see and edit each underlying time block.",
      },
      {
        title: "Why is Tickd asking for a currency rate?",
        introduction: "The live provider does not support that currency, or the currency is custom. Enter its value compared with USD and Tickd saves it only to your profile.",
      },
      {
        title: "Does editing a report change tracked time?",
        introduction: "No. Report edits and time adjustments affect the current report and generated invoice presentation. The source time entries remain unchanged.",
      },
      {
        title: "Why are repeated invoice items combined?",
        introduction: "Equivalent blocks are combined to avoid duplicate invoice lines. With weekly grouping they combine within each week. Without weekly grouping they combine across the complete report range.",
      },
      {
        title: "What should I include in a support request?",
        bullets: [
          "The page where the problem occurred.",
          "The action you selected immediately before it happened.",
          "The result you expected and what appeared instead.",
          "A screenshot that does not expose passwords, payment credentials, or confidential client information.",
        ],
      },
    ],
    related: ["tracking-time", "reports", "invoices"],
  },
];

export const getHelpArticle = (slug?: string) => helpArticles.find((article) => article.slug === slug);
