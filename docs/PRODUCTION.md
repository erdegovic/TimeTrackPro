# Tickd production operations

## Hosting layout

- Application: Hostinger Node.js Web App, connected to `erdegovic/TimeTrackPro`
- Domain: `https://tickd.me`
- Database: Supabase PostgreSQL
- Authentication: password sessions and Google OpenID Connect
- Transactional email: Brevo

## Hostinger build settings

- Node.js: 22
- Build command: `npm run build`
- Start command: `npm start`
- Output directory: `dist`
- Entry file: `dist/index.js`

Hostinger supplies `PORT` at runtime. The application listens on `0.0.0.0`.

## Required environment variables

```text
NODE_ENV=production
APP_URL=https://tickd.me
DATABASE_URL=postgresql://...
SESSION_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
BREVO_API_KEY=...
SENDER_EMAIL=noreply@tickd.me
```

Optional services:

```text
RECAPTCHA_SECRET_KEY=...
VITE_RECAPTCHA_SITE_KEY=...
```

`SESSION_SECRET` should be a cryptographically random value of at least 32 bytes. Never commit production values to Git.

## Database initialization

Use the Supabase session pooler connection string on port `5432` for `DATABASE_URL`. From a trusted workstation with that variable set, initialize or reconcile the schema:

```bash
npm ci
npm run db:push
```

The application creates the `express_sessions` table automatically. All business tables are defined in `shared/schema.ts`.

## Google sign-in

Create a Google OAuth 2.0 client of type **Web application** with:

- Authorized JavaScript origin: `https://tickd.me`
- Authorized redirect URI: `https://tickd.me/api/auth/google/callback`

For local testing, add:

- Authorized JavaScript origin: `http://127.0.0.1:5001`
- Authorized redirect URI: `http://127.0.0.1:5001/api/auth/google/callback`

Tickd uses Authorization Code flow with PKCE, state, and nonce checks. A verified Google email links to an existing Tickd account on first use; otherwise Tickd creates an active account.

## Deployments

Pushing to GitHub `main` triggers a Hostinger deployment after the repository is connected. After changing environment variables, use **Settings & Redeploy** in hPanel.

Verify every deployment:

1. Open `https://tickd.me/api/health` and confirm `{"status":"ok"}`.
2. Sign in with password and Google.
3. Create a disposable client, project, and time entry.
4. Generate a report and invoice, then remove the disposable records.

## Backups and recovery

- Keep Supabase point-in-time/database backups appropriate to the plan.
- Export a PostgreSQL backup before schema changes.
- Keep Hostinger deployment history and GitHub as the application source of truth.
- Test restoring the database into a temporary Supabase project before launch and after major schema changes.
