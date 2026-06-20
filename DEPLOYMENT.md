# Brazil AI Commerce OS Lite - Deployment Guide

Task 4 made the current system deployment-ready. Production Deployment Finalization V1 adds environment separation, production runtime bootstrap, scheduler recovery, cache warmup, PostgreSQL/Supabase-first database adaptation, and system-health observability without changing business logic, UI flows, or database schema.

## Deployment Scope

- Keep Dashboard, Opportunities, Approvals, and System behavior unchanged.
- Keep local SQLite/API mode for development.
- Use production mode on Vercel by default, with PostgreSQL/Supabase as the intended production database.
- Keep SQLite and mock fallback for development and local verification only; production runtime disables mock priority.
- Keep Shopee read-only. No write operation is enabled.

## Environment Variables

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `SYSTEM_MODE` | `development` locally, `production` on deployment | Yes | `development`, `staging`, or `production`. Production enables scheduler bootstrap and runtime health reporting. |
| `DATA_SOURCE_MODE` | `sqlite` locally, `postgres` on Vercel | Yes | `sqlite` is for local development. `postgres`/`supabase` is the production target. `mock` is ignored as a priority source in production. |
| `DATABASE_URL` | empty locally | Production required | PostgreSQL/Supabase connection string. Local production verification may fall back to SQLite when this is empty. |
| `SQLITE_DB_PATH` | `./data/brazil_ai_commerce_os.db` | Local only | Path to the local SQLite database. Relative paths resolve from the project root. |
| `SHOPEE_MODE` | `mock` locally, `readonly` in production | Yes | Canonical Shopee connector mode. Production must remain `readonly`. |
| `SHOOPE_API_MODE` | mirrors `SHOPEE_MODE` | No | Backward-compatible alias for older task spelling. |
| `SHOPEE_API_MODE` | mirrors `SHOPEE_MODE` | No | Backward-compatible alias. |
| `CACHE_MODE` | `memory` locally, `memory_or_upstash` in production | Yes | `memory_or_upstash` uses memory cache today and leaves room for Upstash without API changes. `disabled` disables cache. |
| `LOG_LEVEL` | `debug` locally, `error` in production | Yes | Production suppresses debug-style output. |
| `SCHEDULER_ENABLED` | `false` locally, `true` in production | Yes | Enables production scheduler bootstrap and recovery. |
| `SERVER_INSTANCE_ID` | generated at runtime | No | Optional explicit instance id for production logs and health checks. |
| `NEXT_PUBLIC_APP_NAME` | `Brazil AI Commerce OS Lite` | No | Public display label. Safe to expose in the browser. |

Copy `.env.example` to `.env.local` for local development if you want to override defaults.

## SQLite Compatibility

Local development uses `data/brazil_ai_commerce_os.db` through the API routes.

Vercel Functions have a read-only deployment filesystem and only provide writable scratch space under `/tmp`. The bundled Sprint 1 SQLite file can be used as a read-only fallback for demo and verification traffic, but it is not suitable for durable production writes.

Production Deployment Finalization V1 changes `vercel.json` to `SYSTEM_MODE=production` and `DATA_SOURCE_MODE=postgres`. In production, the adapter attempts PostgreSQL/Supabase first when `DATABASE_URL` is configured. If a cloud database is not available, the deployed read-only SQLite file can provide fallback demo reads, but writes still require a durable database. Mock priority is disabled in production mode. For durable SaaS production on Vercel, configure `DATABASE_URL` with Supabase or another PostgreSQL provider.

## Local Production Build

Install dependencies:

```bash
npm install
```

Initialize and seed the local database:

```bash
python scripts/init_db.py
python scripts/seed_mock_data.py
```

Build for production:

```bash
npm run build
```

Run the production server:

```bash
npm run start
```

Run the production bootstrap layer:

```bash
npm run start:production
```

The production bootstrap loads `.env.production`, validates the environment, starts the Next.js server, wakes `/api/system-health`, starts or recovers the scheduler, warms the dashboard/tasks/inventory cache, and prints the access URL.

Open:

- `http://127.0.0.1:3000/dashboard`
- `http://127.0.0.1:3000/opportunities`
- `http://127.0.0.1:3000/approvals`
- `http://127.0.0.1:3000/system`

## Vercel Deployment Steps

1. Import the project into Vercel from Git, or deploy the project root with Vercel CLI.
2. Vercel detects the Next.js framework from `vercel.json`.
3. Vercel runs `npm run build`.
4. Runtime environment uses `SYSTEM_MODE=production`, `DATA_SOURCE_MODE=postgres`, `CACHE_MODE=memory_or_upstash`, `LOG_LEVEL=error`, and `SCHEDULER_ENABLED=true` from `vercel.json`.
5. Add `DATABASE_URL` in Vercel Environment Variables before production traffic. Supabase connection strings are supported.
6. After deployment, open `/system-health` first, then `/dashboard`, `/opportunities`, `/approvals`, and `/system`.

Optional CLI deployment:

```bash
npm i -g vercel
vercel --prod
```

## Production Runtime Notes

- Dashboard reads `/api/dashboard-summary`.
- System Health reads `/api/system-health` and reports production mode, scheduler status, DB connection status, API latency, cache hit rate, and last scheduler cycle runtime.
- Opportunities reads `/api/opportunities`.
- Approvals reads `/api/approvals`.
- Approve and Reject only update local action state in SQLite when running locally.
- On fallback mode, Approve and Reject return safe API responses and do not perform platform actions.
- No crawler, AI agent, auto listing, auto repricing, or real platform API is enabled.

## Production Runtime Flow

```text
start:production
  -> load .env.production
  -> normalize SYSTEM_MODE=production
  -> start Next.js server
  -> call /api/system-health
  -> validate production environment
  -> bootstrap scheduler with 3 retry attempts
  -> check PostgreSQL/Supabase, fallback SQLite for local verification
  -> warm cache
  -> write runtime trace metadata into operation_logs.metadata_json
```

## Project Structure

```text
brazil-ai-commerce-os-web/
  src/app/                  Next.js pages and API routes
  src/app/api/              Local API layer
  src/components/           Shared UI components
  src/data/mock.ts          Mock fallback data
  src/lib/dbRepository.ts   SQLite repository with dev-only mock fallback
  src/lib/sqlite.ts         Local SQLite adapter
  src/lib/database.ts       Unified database client
  src/lib/database/         Production database adapter
  src/lib/runtime/          Production runtime config, bootstrap, and autonomous scheduler
  scripts/init_db.py        SQLite schema initializer
  scripts/seed_mock_data.py Mock seed data loader
  scripts/start-production.ts Production startup wrapper
  data/                     Local SQLite database folder
  vercel.json               Vercel deployment configuration
  .env.example              Environment variable template
```

## Acceptance Checklist

- `npm run build` succeeds.
- `npm run start:production` starts the production bootstrap.
- `/api/system-health` reports production runtime fields.
- `/api/system-health` includes system mode, scheduler status, database status, API latency, cache hit rate, sync lag, and last cycle time.
- Vercel can deploy directly.
- Dashboard remains available.
- Opportunities remains available.
- Approvals remains available.
- System remains available.
- No real API keys, platform APIs, crawlers, or AI execution logic are introduced.
