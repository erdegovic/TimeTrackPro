# Tickd API v1 (`/api/v1`)

A small, token-authenticated API so an external agent (for example Atlas) can read
clients/projects, run the timer and log time on the account owner's behalf.

- Base URL: `https://tickd.me/api/v1`
- Auth: `Authorization: Bearer tk_…` (personal API token, see below). No cookies, no CSRF.
- Format: JSON in / JSON out. Timestamps are ISO-8601 (UTC). Hours are decimal.
- Rate limit: 900 requests / 15 minutes per IP (`429` with `message` when exceeded).
- Every endpoint is scoped to the user who owns the token. Cross-tenant ids return `403`/`404`.

## Personal API tokens

Created in **Account → Security → API tokens** (`client/src/components/Auth/ApiTokensCard.tsx`).
The plaintext token (`tk_` + 40 characters) is shown **once**; Tickd stores only its sha256 hash
(`api_tokens.token_hash`) plus a display prefix. Revoking a token takes effect immediately.

Session-authenticated management routes (used by the UI):

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `GET` | `/api/auth/api-tokens` | – | active tokens (no secrets) |
| `POST` | `/api/auth/api-tokens` | `{ name, expiresInDays? }` | token record **+ `token` (plaintext, once)** |
| `DELETE` | `/api/auth/api-tokens/:id` | – | `{ ok: true }` (revokes) |

## Endpoints

### `GET /me`
`{ id, email, firstName, lastName, defaultCurrency, subscriptionPlan }`

### `GET /clients`
`[{ id, name, email, currency, color, country }]`

### `GET /projects?active=1|0`
`[{ id, name, description, active, color, hourlyRate, currency, clientId, clientName }]`
`currency` = client currency, falling back to the account's default currency.

### Timer
The running timer is server-side: a `time_entries` row with `end_time IS NULL AND duration IS NULL`.
The web app and the API share it (the browser reconciles with `GET /api/tracker/timer` on load/focus).

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `GET` | `/timer` | – | `{ running: Entry & { elapsedSeconds } \| null }` |
| `POST` | `/timer/start` | `{ projectId?, clientId?, description?, startTime?, timeZone? }` | `201 { running, entryId, stopped }` — stops any running timer first |
| `POST` | `/timer/stop` | `{ endTime?, description?, projectId?, clientId?, billable?, timeZone? }` | `{ entry }` or `404 { message: "No timer is running" }` |

`timeZone` (IANA, e.g. `Europe/Belgrade`) is used to derive the entry's calendar `date`; defaults to UTC.

### Time entries
`Entry` shape (all list/detail responses):
```json
{ "id": 120, "description": "Design review", "projectId": 20, "projectName": "Website",
  "clientId": 26, "clientName": "Acme", "startTime": "2026-08-15T07:00:00.000Z",
  "endTime": "2026-08-15T08:30:00.000Z", "hours": 1.5, "billable": true, "hourlyRate": 60,
  "amount": 90, "currency": "EUR", "date": "2026-08-15", "invoiceId": null, "running": false }
```

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/time-entries?from&to&clientId&projectId&limit&includeRunning=1&uninvoicedOnly=1` | `from`/`to` are `YYYY-MM-DD` on the entry `date`; newest first; running entries excluded unless `includeRunning=1`; default limit 500 (max 2000) |
| `POST` | `/time-entries` | `{ description?, projectId?, clientId?, startTime, endTime \| duration, billable?, date?, timeZone? }` → `201 Entry`; provide exactly one of `endTime` or `duration` |
| `PATCH` | `/time-entries/:id` | any of `description, projectId, clientId, startTime, endTime, duration, billable, date, timeZone` → `Entry` |
| `DELETE` | `/time-entries/:id` | `{ ok, id }`; `409` if the entry is on an invoice |

### `GET /reports/summary?from&to&clientId&projectId&groupBy=project|client|day`
```json
{ "from": "2026-08-01", "to": "2026-08-31", "groupBy": "project",
  "hours": 3.6, "billableHours": 2.85, "amountByCurrency": { "EUR": 120 }, "entryCount": 4,
  "groups": [{ "key": "20", "name": "Website", "hours": 2, "billableHours": 2, "amount": 120, "currency": "EUR" }] }
```
Amounts = hours × project `hourlyRate`, in the client's currency (or the account default). No FX.
Groups are sorted by hours (project/client) or by date (day). A day mixing currencies also carries `amountByCurrency`.

## Errors
`400` validation (`{ message, errors[] }`), `401` missing/invalid/revoked token, `403` foreign project/client,
`404` not found, `409` conflict, `429` rate limited, `500` `{ message: "Internal server error" }`.

## Deploying the API (schema)
`api_tokens` is created by `server/schema-bootstrap.ts` on boot (`CREATE TABLE IF NOT EXISTS`) and by
`migrations/0015_add_api_tokens.sql`. The same bootstrap also cleans up any historical duplicate
running timers and creates `time_entries_one_running_per_user`; its standalone migration is
`migrations/0016_one_running_timer_per_user.sql`. `shared/schema.ts` carries the Drizzle table
definition. Production only needs the normal deploy because the bootstrap runs before the server starts.

## Example
```bash
TOKEN=tk_…
curl -H "Authorization: Bearer $TOKEN" https://tickd.me/api/v1/me
curl -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"projectId":20,"description":"API integration","timeZone":"Europe/Belgrade"}' \
  https://tickd.me/api/v1/timer/start
curl -H "Authorization: Bearer $TOKEN" -X POST https://tickd.me/api/v1/timer/stop
```
