# TimeTrackPro

TimeTrackPro is a comprehensive time tracking app for freelancers and small businesses — managing projects, clients, time entries, reports, and invoices.

## Run & Operate
- **Start dev server**: `npm run dev` (runs the "Start application" workflow)
- **Push DB schema**: `npm run db:push` (never write SQL manually)
- **Build**: `npm run build`
- **Required env vars**: `DATABASE_URL`, `SESSION_SECRET`, `SENDGRID_API_KEY` (optional), `VITE_RECAPTCHA_SITE_KEY`

## Stack
- **Frontend**: React 18 + TypeScript + Vite, shadcn/ui + Radix UI, Tailwind CSS, TanStack Query v5, Wouter, React Hook Form + Zod
- **Backend**: Node.js + Express.js + TypeScript (ESM)
- **Database**: PostgreSQL (Neon serverless) + Drizzle ORM
- **Auth**: Session-based (express-session), bcrypt passwords, email verification tokens
- **PDF**: jsPDF + autoTable (client-side, 5 templates)

## Where things live
- `shared/schema.ts` — DB schema + Zod insert schemas + all types (source of truth)
- `server/routes.ts` — main API routes (auth, invoices, time entries, reports)
- `server/routes/auth.ts` — registration, login, email verification, password reset
- `server/storage.ts` — DB access layer (IStorage interface + PostgresStorage)
- `client/src/pages/` — page components (InvoicesPage, Dashboard, TimeTrackerPage, etc.)
- `client/src/components/Invoices/` — InvoiceEditor (new), InvoicePreview, InvoiceViewEdit
- `client/src/lib/enhanced-pdf-generator.ts` — PDF generation (5 templates)
- `client/src/index.css` — CSS variables, Tickd brand tokens

## Architecture decisions
- **Invoice line items**: stored as JSON in `invoices.lineItems` text column; legacy data also embedded in `notes` with `ADDITIONAL_ITEMS:` prefix — both formats are supported for backward compat
- **Invoice editing**: new `InvoiceEditor` component replaces the fragile multi-component stack; supports editing time entry durations/amounts + custom line items in one clean UI
- **Invoice status**: quick status update via `PATCH /api/invoices/:id/status`; full edits via `PUT /api/invoices/:id` (accepts partial schema)
- **Timer persistence**: timer state lives in localStorage (`timeTracker` key) and survives page reload
- **Auth routes**: main login is `POST /api/login` in `routes.ts`; registration/verify/reset in `server/routes/auth.ts` (mounted at `/api/auth`)
- **Password login**: uses `bcrypt.compare()` — critical fix applied, previously any password would log in

## Product
- Time tracking with project/client tagging and a live stop-watch timer
- Weekly/monthly dashboard with charts (bar + pie)
- Report generation with grouping, time adjustments, and invoice creation
- Invoice management: create from reports, edit line items, export PDF, track status (draft/sent/paid)
- Client + project CRUD with hourly rates and currency support
- Notes page and creativity sidebar (music, goals, wellness)
- Email-verified account system with password reset

## User preferences
- Communication style: simple, everyday language
- No emojis in code or output

## Gotchas
- `PUT /api/invoices/:id` uses `insertInvoiceSchema.partial()` — send only fields you want to change
- `npm run db:push` is the only way to apply schema changes; never write raw SQL migrations
- `server/routes/auth.ts.new` exists but is NOT mounted — the working auth routes are in `server/routes/auth.ts`
- TypeScript errors exist in `MusicPlayer.tsx` and `ProjectForm.tsx` — pre-existing, not blocking

## Pointers
- DB schema: `shared/schema.ts`
- PDF templates: `client/src/lib/enhanced-pdf-generator.ts`
- Invoice editor: `client/src/components/Invoices/InvoiceEditor.tsx`
