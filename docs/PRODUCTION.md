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

Encrypted backup storage:

```text
BACKUP_ENABLED=true
BACKUP_INTERVAL_HOURS=12
BACKUP_S3_ENDPOINT=https://CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com
BACKUP_S3_REGION=auto
BACKUP_S3_BUCKET=tickd-backups
BACKUP_S3_ACCESS_KEY_ID=...
BACKUP_S3_SECRET_ACCESS_KEY=...
ACCOUNT_BACKUP_ENCRYPTION_KEY=...
```

Generate `ACCOUNT_BACKUP_ENCRYPTION_KEY` once with `openssl rand -base64 32`. Keep a secure offline copy. Losing this key makes every encrypted backup permanently unreadable; changing it without a key-rotation migration makes older snapshots unavailable.

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

Tickd has two independent backup layers:

1. **Account snapshots:** the application creates an encrypted snapshot for every account every `BACKUP_INTERVAL_HOURS`. The Recovery Center shows metadata only and can restore one existing user. Every restore first creates a safety snapshot, runs transactionally, clears the user's sessions, and writes an audit event.
2. **Database dumps:** `npm run backup:database` runs `pg_dump`, encrypts the resulting custom-format dump, uploads it to object storage, and removes expired dumps.

Both layers use this retention policy:

- Every snapshot for 7 days
- One per day through day 30
- One per week through day 90
- One per month through one year

### Cloudflare R2 setup

1. Create a Cloudflare account and open **R2 Object Storage**.
2. Create a private bucket named `tickd-backups`. Do not attach a public domain.
3. Create an R2 API token limited to **Object Read & Write** for only that bucket.
4. Copy the S3 endpoint, Access Key ID, and Secret Access Key into Hostinger environment variables.
5. Generate the encryption key locally and add it to Hostinger. Cloudflare never receives this key.
6. Set `BACKUP_ENABLED=true` and redeploy.
7. Open the Tickd Recovery Center and run **Run all backups**. Confirm every account changes to **Protected**.

### Whole-database schedule

`.github/workflows/database-backup.yml` creates an encrypted PostgreSQL dump every day at 01:17 UTC and supports manual runs from GitHub Actions. Configure these repository Actions secrets:

```text
BACKUP_DATABASE_URL
BACKUP_S3_ENDPOINT
BACKUP_S3_ACCESS_KEY_ID
BACKUP_S3_SECRET_ACCESS_KEY
ACCOUNT_BACKUP_ENCRYPTION_KEY
```

The workflow uses PostgreSQL 17 client tools in an isolated container, then passes the dump to `npm run backup:database` for encryption, R2 upload, and retention. GitHub receives only encrypted-backup credentials limited to the private `tickd-backups` bucket. A failed run appears in GitHub Actions and should be investigated before the next production schema change.

### Recovery checks

- Once per month, restore the latest database dump into a temporary Supabase project and run the smoke test.
- Before every production schema change, run both an account backup cycle and a whole-database dump.
- Keep GitHub as the application source of truth and Hostinger deployment history as a deployment rollback, not as a database backup.
- Supabase Storage objects are not included in PostgreSQL dumps. Tickd currently stores profile and company images in PostgreSQL; add an object-storage copy job before moving uploads to Supabase Storage.

Account snapshots intentionally do not restore passwords, email addresses, Google identities, roles, verification tokens, or active sessions. Those security credentials remain at their current values while business data and user preferences are restored.
