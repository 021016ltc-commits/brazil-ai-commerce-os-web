# Brazil AI Commerce OS Lite - Project Master

Last updated: 2026-06-17

## 1. Project Goal

Brazil AI Commerce OS Lite is a local-first operating system prototype for Brazil cross-platform commerce.

The long-term operating loop is:

Market data -> AI product selection -> AI generated product suggestions -> Human review -> Listing preparation -> Operations monitoring -> Optimization suggestions -> Data accumulation.

In the current system, Shopee is only one channel value in the `platform` field. The architecture is platform-neutral and is designed to support Shopee, Mercado Livre, Amazon BR, TikTok Shop BR, Temu, AliExpress, and independent store channels later.

## 2. Project Version

Current product version: `0.1.0`

Current implementation stage:

- Web MVP completed.
- SQLite local database completed.
- API layer completed.
- Real-data empty-state fallback completed.
- Deployment-ready Vercel config completed.
- Core local business centers completed through Task 10.
- Today's Task Center completed through Task 11B.
- Documentation system started with Documentation Task 1.

## 3. Current Architecture

Runtime stack:

- Next.js App Router
- React client pages
- TypeScript domain types
- Local API routes under `src/app/api`
- Repository layer under `src/lib/dbRepository.ts`
- SQLite local database at `data/brazil_ai_commerce_os.db`
- Empty response shapes under `src/data`
- Vercel deployment config with `DATA_SOURCE_MODE=postgres`

Data source strategy:

- Local development prefers SQLite.
- If SQLite/PostgreSQL is missing or unavailable, UI routes show empty states or connection messages.
- Vercel uses PostgreSQL/Supabase through `DATABASE_URL` for production data.

Current user-facing routes:

- `/login`
- `/dashboard`
- `/tasks`
- `/opportunities`
- `/analysis`
- `/profit`
- `/inventory`
- `/approvals`
- `/system`

Current API routes:

- `GET /api/products`
- `GET /api/opportunities`
- `GET /api/analysis`
- `GET /api/profit`
- `GET /api/inventory`
- `GET /api/approvals`
- `PATCH /api/approvals`
- `GET /api/dashboard-summary`
- `GET /api/tasks`

## 4. Completed Modules

Task 1 - Web MVP:

- Created local Next.js app.
- Added platform-neutral shell and Chinese UI direction.

Task 3A - SQLite database:

- Created local SQLite database.
- Added initialization script.
- Seed data script removed from the production-ready flow.

Task 3B - API-driven UI:

- Added local API layer.
- Pages read from API first.
- SQLite reads and empty-state handling work.

Task 4 - Deployment ready:

- Added `vercel.json`.
- Added `.env.example`.
- Added deployment documentation.
- Production build verified.

Task 5 - Opportunities Center:

- Added opportunity product list.
- Added keyword opportunity list.
- Added risk alerts.
- Added filtering and sorting.

Task 6 - Analysis Center:

- Added rules-based analysis page.
- Added `GET /api/analysis`.
- Added opportunity, risk, market, and recommendation sections.

Task 7 - Approval Center:

- Added approval queue.
- Added local approve, reject, and defer status flow.
- Added approval history.
- Added approval stats.

Task 8 - Profit Center:

- Added profit overview.
- Added cost structure.
- Added product profit ranking.
- Added profit risk summary.

Task 9 - Inventory Center:

- Added inventory overview.
- Added SKU stock monitoring.
- Added inventory risk list.
- Added reorder recommendation display.

Task 10 - CEO Dashboard V2:

- Upgraded `/dashboard`.
- Aggregates profit, inventory, opportunity, approval, risk, and system health data.
- Keeps recommendations display-only.

Task 11B - Task Center V1.5:

- Added Today's Task Center at `/tasks`.
- Added `GET /api/tasks`.
- Converts inventory, profit, approval, analysis, and opportunity data into prioritized tasks.
- Adds TOP5 daily task ranking.
- Adds task source and task impact charts.
- Keeps all suggested actions display-only and human-review-first.

Documentation Task 1:

- Adds `/project-docs`.
- Creates master project documentation for handover and future development.

## 5. Pending Modules

Not implemented yet:

- Real crawler development.
- Real platform connector APIs.
- Real OpenAI or external AI model integration.
- Real listing upload.
- Real price update.
- Real image update.
- Real ad budget update.
- Authentication and permission management.
- Multi-user collaboration.
- Persistent production database.
- Background job scheduler.
- Real data export package generation.
- Real connector observability.

## 6. Development Roadmap

Priority 1 - Stability and ownership:

- Clean encoding issues in existing Chinese labels if they affect browser display.
- Add simple automated API smoke checks.
- Add role and permission model before any real execution feature.
- Add user and reviewer identity records.

Priority 2 - Data foundation:

- Expand SQLite schema toward source registry, crawl tasks, raw data, and historical data tables.
- Add export pipeline for JSON, CSV, and SQLite analysis packages.
- Add database migrations instead of only one initialization script.

Priority 3 - Connector preparation:

- Define connector interfaces for Shopee, Mercado Livre, Amazon BR, TikTok Shop BR, Temu, AliExpress, and independent store data.
- Add read-only connector mocks first.
- Add connector logs and data quality checks before any write action.

Priority 4 - Analysis package:

- Generate structured analysis packages from current data.
- Add local rules first.
- Only later connect external AI, and keep AI output in suggestion queues.

Priority 5 - Controlled execution:

- Keep all execution actions behind approval.
- Expand `action_queue`, `upload_queue`, and `approval_history`.
- Add irreversible-action guardrails before any real platform write API.

## 7. Core Guardrails

- Database-first development.
- English field names, Chinese UI.
- Platform-neutral schema.
- SQLite/PostgreSQL real-data flow with empty-state handling.
- Human approval before execution.
- No automatic listing, pricing, image, title, or ad budget changes.
- Historical and operational data should not be overwritten when future incremental ingestion is added.
