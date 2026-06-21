# Brazil AI Commerce OS Lite V0.1 - Web MVP

Task 1 delivers a local Web MVP for Brazil AI Commerce OS Lite. Task 3B adds a local API layer backed by SQLite. Task 4 adds deployment-ready configuration. Task 5 upgrades `/opportunities` into an Opportunities Center that helps operators decide which products, keywords, and risks deserve attention today. Task 6 adds `/analysis` as a rules-based Analysis Center. Task 7 upgrades `/approvals` into a local human approval system. Task 8 adds `/profit` as a Profit Center for margin and cost monitoring. Task 9 adds `/inventory` as an Inventory Center for stock health, stockout risk, overstock pressure, and reorder review. Task 10 upgrades `/dashboard` into CEO Dashboard V2 so the owner can judge profit, cash flow, inventory risk, opportunity pressure, and pending approvals in one screen. Task 11B adds `/tasks` as Today's Task Center, turning module data into prioritized work items. Task 12 adds `/system-health` as a read-only System Health & Observability layer. Task 13 adds `/users` as a local User & Permission System. Task 14 adds `/shopee` as a Shopee read-only connector with SQLite cache and read-only API preparation. Task 15 adds `/decision-feedback` as a decision feedback and data loop for learning from historical results. Task 16 adds `/actions` as a guarded execution queue for approval-first simulated actions. Task 17 adds `/business-impact` as a read-only 经营结果分析 layer for profit, inventory, GMV, and decision attribution. Task 18 adds `/self-optimization` as a recommendation-only engine for rule and scoring weight optimization. Task 19 adds `/daily-ops` as a Daily Operations Control Center that aggregates decision, task, action, 经营结果分析, and 规则优化 data into a daily operating view. Task 20 adds `/verification` as a unified verification center for module checks, API health, quick test entries, and release acceptance mode. Task 21 adds `/tenants` as the multi-tenant SaaS foundation with tenant, workspace, subscription-plan display, tenant-scoped APIs, and default `demo_tenant` isolation. Task 22 adds `/command-center` as an internal-only Command Center that aggregates Dashboard, Tasks, Daily Ops, System Health, and Verification status into one operating console. Documentation Task 1 adds `/project-docs` as the project master documentation system.

## Run

Recommended Windows launcher:

```bash
start-system.bat
```

You can also double-click `start-system.bat` from the project folder. The launcher enters the project directory, starts the Next.js dev server, detects the actual port from the Local URL, and opens the first available system entry in this order:

1. `/login`
2. `/dashboard`
3. `/command-center`

The launcher prints:

- `server status`
- `actual port`
- `access URL`
- `ready state`

If startup fails, it tries `npm run dev`, then `npx next dev`, then the local Next.js binary from `node_modules`. It also retries ports `3000`, `3001`, `3002`, and `3005`. If the same project is already running, the launcher reuses the existing detected Local URL and opens the correct entry instead of leaving the user on a stale port.

Advanced launcher command:

```bash
node scripts/start-system.js
```

For verification without opening a browser:

```bash
node scripts/start-system.js --no-open
```

Standard Node workflow:

```bash
npm install
npm run dev
```

Verified in the current Codex environment with:

```bash
pnpm install
pnpm exec next build
```

Open these routes after the dev server starts:

- `http://127.0.0.1:3000/login`
- `http://127.0.0.1:3000/dashboard`
- `http://127.0.0.1:3000/command-center`
- `http://127.0.0.1:3000/tenants`
- `http://127.0.0.1:3000/daily-ops`
- `http://127.0.0.1:3000/tasks`
- `http://127.0.0.1:3000/opportunities`
- `http://127.0.0.1:3000/analysis`
- `http://127.0.0.1:3000/profit`
- `http://127.0.0.1:3000/inventory`
- `http://127.0.0.1:3000/approvals`
- `http://127.0.0.1:3000/actions`
- `http://127.0.0.1:3000/shopee`
- `http://127.0.0.1:3000/decision-feedback`
- `http://127.0.0.1:3000/business-impact`
- `http://127.0.0.1:3000/self-optimization`
- `http://127.0.0.1:3000/verification`
- `http://127.0.0.1:3000/users`
- `http://127.0.0.1:3000/system`
- `http://127.0.0.1:3000/system-health`

## Project documentation

Documentation Task 1 adds the project handover and architecture documentation under `project-docs/`.

Files:

- `project-docs/PROJECT_MASTER.md` - project goal, version, current architecture, completed modules, pending modules, and roadmap.
- `project-docs/BUSINESS_LOGIC.md` - business principles for Chinese UI, English database fields, human approval, platform neutrality, profit priority, and inventory priority.
- `project-docs/DATABASE_SCHEMA.md` - current SQLite schema scanned from `data/brazil_ai_commerce_os.db`, including tables, fields, purposes, and logical relationships.
- `project-docs/SYSTEM_ARCHITECTURE.md` - Markdown architecture diagrams and current data flow.
- `project-docs/RULE_ENGINE.md` - current local rule engine behavior for opportunities, analysis, approvals, profit, inventory, risk, and system health.
- `project-docs/HANDOVER_PROMPT.md` - copyable prompt for future account, GPT, or Codex handover.

Documentation scope:

- No business functionality added.
- No page logic changed.
- No API changed.
- No database logic changed.

## Scope

- Chinese UI text
- English field names
- Local SQLite/API data first
- Test data display disabled by default
- Production data access is routed through `src/lib/dataService.ts` and `src/lib/database.ts`
- No crawler work
- No platform write API
- No real approve or reject execution

## User roles and permissions

Task 13 adds a local user and permission system. It does not connect to third-party login providers, WeChat, Google, or any external identity system.

Roles:

- `admin`: all permissions
- `operator`: `dashboard`, `command_center`, `tenants`, `daily_ops`, `tasks`, `opportunities`, `analysis`, `approvals`, `shopee`, `decision_feedback`, `business_impact`, `self_optimization`, `verification`
- `buyer`: `dashboard`, `command_center`, `tenants`, `daily_ops`, `tasks`, `inventory`, `verification`
- `finance`: `dashboard`, `command_center`, `tenants`, `daily_ops`, `profit`, `actions`, `business_impact`, `self_optimization`, `verification`
- `viewer`: read-only page permissions

SQLite tables:

- `users`
- `roles`
- `permissions`
- `user_roles`
- `operation_logs`
- `tenants`
- `workspaces`
- `tenant_users`

Approve and Reject only update local `action_queue` status in SQLite when SQLite mode is available. They never execute any platform action.

## Platform-neutral fields

Platform names appear only as `platform` values such as `Shopee`, `Mercado Livre`, `Amazon BR`, `TikTok Shop BR`, `Temu`, and `AliExpress`.

Core fields:

- `platform`
- `market_code`
- `platform_product_id`
- `platform_shop_id`
- `product_uid`
- `seller_uid`
- `keyword_uid`

## SQLite database

Task 3A adds a local SQLite database only. It does not change the current UI flow.

Database file:

- `data/brazil_ai_commerce_os.db`

Initialize tables:

```bash
python scripts/init_db.py
```

Check that the core tables exist:

```bash
python -c "import sqlite3; conn = sqlite3.connect('data/brazil_ai_commerce_os.db'); print([row[0] for row in conn.execute(\"select name from sqlite_master where type='table' order by name\")])"
```

Check sample query results:

```bash
python -c "import sqlite3; conn = sqlite3.connect('data/brazil_ai_commerce_os.db'); print(conn.execute('select count(*) from products').fetchone()); print(conn.execute('select count(*) from opportunity_score').fetchone()); print(conn.execute('select count(*) from analysis_queue').fetchone()); print(conn.execute('select count(*) from action_queue').fetchone())"
```

## Production hardening core

Production Hardening Core Upgrade V1 adds a unified data access path without changing the current pages or business behavior.

Core files:

- `src/lib/database.ts` - database adapter with PostgreSQL/Supabase connection support, SQLite fallback, and mock mode detection.
- `src/lib/dataService.ts` - single DataService layer used by API routes for products, orders, inventory, tasks, users, decisions, approvals, actions, Shopee, profit, and system status.
- `src/lib/cache.ts` - in-memory TTL cache for high-read API responses such as dashboard summary, profit, inventory, and tasks.
- `src/lib/errorHandler.ts` - tenant-aware API wrapper with logging and safe fallback responses.
- `src/lib/connectors/shopee.ts` - standardized read-only Shopee connector wrapper with token refresh support, rate-limit retry handling, and SQLite cache reuse.

Environment:

```bash
DATA_SOURCE_MODE=sqlite
ALLOW_TEST_DATA=false
DATABASE_URL=
SQLITE_DB_PATH=./data/brazil_ai_commerce_os.db
CACHE_ENABLED=true
SHOPEE_API_KEY=
SHOPEE_SECRET=
SHOPEE_TOKEN_URL=
SHOPEE_ACCESS_TOKEN=
SHOPEE_REFRESH_TOKEN=
SHOPEE_READONLY_API_BASE_URL=
SHOPEE_READONLY_ACCESS_TOKEN=
```

Data source behavior:

1. If `DATABASE_URL` is configured and a PostgreSQL driver is available, `src/lib/database.ts` can connect to PostgreSQL/Supabase.
2. If PostgreSQL is not configured or unavailable in local development, the system can read local SQLite.
3. Test data is disabled by default with `ALLOW_TEST_DATA=false`.
4. When a real data source is unavailable, pages render empty states or connection messages instead of sample business data.

Important production notes:

- No Shopee write operation is enabled.
- No automatic purchase, price change, listing upload, or ad action is enabled.
- Approval and action APIs only update local queues and logs.
- Vercel production deployments should use PostgreSQL/Supabase through `DATABASE_URL`; do not use mock mode for operations.

Shopee read-only sync modes:

- `SHOPEE_SYNC_MODE=realtime` reads through the adapter and returns the current read-only source.
- `SHOPEE_SYNC_MODE=snapshot` returns DataService memory snapshots named like `shopee_orders_snapshot`, without changing the SQLite schema.
- `SHOPEE_SYNC_MODE=hybrid` prefers realtime data and falls back to the latest snapshot when realtime data is empty.

The sync engine only reads Shopee data. It does not call Shopee write endpoints, does not change listings, prices, orders, ads, or inventory on the platform, and records local observability events in `operation_logs`.

## API-driven local UI

Task 3B switches the main local UI from direct mock imports to local API reads backed by SQLite.

API routes:

- `GET /api/products`
- `GET /api/tenants`
- `POST /api/tenants`
- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/opportunities`
- `GET /api/analysis`
- `GET /api/profit`
- `GET /api/inventory`
- `GET /api/approvals`
- `PATCH /api/approvals`
- `GET /api/dashboard-summary`
- `GET /api/tasks`
- `GET /api/daily-ops`
- `GET /api/system-health`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users`
- `GET /api/roles`
- `GET /api/operation-logs`
- `GET /api/shopee/orders`
- `GET /api/shopee/products`
- `GET /api/shopee/inventory`
- `POST /api/shopee/sync`
- `POST /api/decision/feedback`
- `GET /api/decision/history`
- `GET /api/decision/metrics`
- `POST /api/actions/create`
- `POST /api/actions/approve`
- `POST /api/actions/reject`
- `GET /api/actions/queue`
- `GET /api/actions/history`
- `GET /api/business-impact`
- `GET /api/business-impact/actions`
- `GET /api/business-impact/summary`
- `GET /api/self-optimization`
- `GET /api/self-optimization/recommendations`
- `GET /api/self-optimization/analysis`
- `GET /api/verification/status`

The UI reads real local/API data. If `data/brazil_ai_commerce_os.db` is missing or unreadable, pages keep rendering but show empty states or connection messages instead of sample business data.

Task 3B verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/dashboard`
- `http://127.0.0.1:3000/tenants`
- `http://127.0.0.1:3000/opportunities`
- `http://127.0.0.1:3000/analysis`
- `http://127.0.0.1:3000/profit`
- `http://127.0.0.1:3000/inventory`
- `http://127.0.0.1:3000/approvals`

Check API data source:

```bash
python -c "import urllib.request, json; print(json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/dashboard-summary'))['source'])"
```

Real data verification example:

```text
sqlite
```

## Opportunities Center V0.1

Task 5 upgrades `/opportunities` from a simple list page into a Chinese operations-facing Opportunities Center.

Included in this page:

- Today opportunity products
  - `product_uid`
  - `platform`
  - `title_current`
  - `price_amount`
  - `rating`
  - `sold_count_text`
  - `market_score`
  - `opportunity_score`
  - `recommendation_level`
  - `decision_notes`
- Keyword opportunities
  - `keyword_uid`
  - `keyword`
  - `category_hint`
  - `market_demand_score`
  - `competition_score`
  - `trend_score`
  - `total_score`
- Risk alerts
  - `risk_type`
  - `risk_level`
  - `affected_product`
  - `reason`
  - `suggested_action`
- Filters
  - by `platform`
  - by `recommendation_level`
  - by `risk_level`
- Sorting
  - by `opportunity_score`
  - by `market_score`
  - by `risk_level`

The page reads from `GET /api/opportunities`. When the real data source is missing, unreadable, or disabled, the page keeps rendering with empty states instead of sample business data.

`/api/opportunities` now returns:

- `source`
- `products`
- `keywords`
- `market_score`
- `opportunity_score`
- `today_opportunities`
- `keyword_opportunities`
- `risk_alerts`

Task 5 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/opportunities`

Optional API check:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/opportunities')); print(data['source'], len(data['today_opportunities']), len(data['keyword_opportunities']), len(data['risk_alerts']))"
```

Real data verification example:

```text
sqlite 6 6 6
```

Production build check:

```bash
npm run build
```

## Analysis Center V0.1

Task 6 adds `/analysis` as a local Analysis Center powered by rules and real business data. It does not call OpenAI, does not connect to a real model, does not run crawlers, and does not execute platform actions.

Included in this page:

- Opportunity analysis
  - `analysis_id`
  - `product_uid`
  - `opportunity_score`
  - `analysis_summary`
  - `analysis_reason`
  - `recommendation`
- Risk analysis
  - `risk_type`
  - `risk_level`
  - `risk_reason`
  - `mitigation_action`
- Market analysis
  - `category`
  - `demand_score`
  - `competition_score`
  - `trend_direction`
- AI recommendations
  - `recommendation_type`
  - `priority`
  - `action_suggestion`
  - `expected_impact`

Task 6 API route:

- `GET /api/analysis`

Task 6 behavior:

- Chinese UI
- API-first reads
- Local SQLite support
- Empty state when real data is missing or unavailable
- Filters for platform, risk level, and suggestion priority
- Sorting by `opportunity_score`, `risk_level`, `demand_score`, and `priority`
- Recommendations stay at the manual-review layer and do not auto-execute

Task 6 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/analysis`

Optional API check:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/analysis')); print(data['source'], len(data['opportunity_analysis']), len(data['risk_analysis']), len(data['market_analysis']), len(data['ai_recommendations']))"
```

Real data verification example:

```text
sqlite 6 6 6 6
```

Build check:

```bash
npm run build
```

## Approval Center V1

Task 7 upgrades `/approvals` into a full local human approval system. It does not execute platform actions, does not connect to real platform APIs, and does not call OpenAI.

Included in this page:

- Pending approval queue
  - `approval_id`
  - `recommendation_type`
  - `product_uid`
  - `priority`
  - `recommendation_summary`
  - `created_at`
- Approval operations
  - `approved`
  - `rejected`
  - `deferred`
- Approval history
  - `approval_id`
  - `action`
  - `reviewer`
  - `reviewed_at`
  - `notes`
- Stats panel
  - pending count
  - approved count
  - rejected count
  - deferred count

Task 7 API routes:

- `GET /api/approvals`
- `PATCH /api/approvals`

Task 7 behavior:

- API-driven
- Local SQLite support
- Empty real-data state support
- Chinese UI
- Filters for status, priority, and platform
- Sorting by `created_at`, `priority`, and `status`
- Approval actions update local state and local SQLite only
- No real platform execution

Task 7 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/approvals`

Optional API checks:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/approvals')); print(data['source']); print(len(data['approval_queue']), len(data['approval_history'])); print(data['approval_stats'])"
```

Real data verification example:

```text
sqlite
6 3
{'pending_count': 3, 'approved_count': 1, 'rejected_count': 1, 'deferred_count': 1}
```

Build check:

```bash
npm run build
```

## Profit Center V1

Task 8 adds `/profit` as a local Profit Center. It does not connect to a real finance system, does not call platform APIs, and does not execute actions automatically.

Included in this page:

- Profit overview
  - `yesterday_net_profit`
  - `month_net_profit`
  - `net_margin`
  - `cash_flow`
  - `inventory_turnover_days`
- Cost structure
  - `procurement_cost`
  - `ad_cost`
  - `logistics_cost`
  - `platform_fee`
  - `tax_cost`
- Profit risk
  - `loss_products`
  - `low_profit_products`
  - `high_risk_products`
- Product profit ranking
  - `product_uid`
  - `product_name`
  - `revenue`
  - `cost`
  - `gross_profit`
  - `net_profit`
  - `net_margin`

Task 8 API route:

- `GET /api/profit`

Task 8 behavior:

- Chinese UI
- API-driven reads
- Local SQLite support
- Empty real-data state support
- Filters for `platform` and profit risk
- Sorting by `net_profit`, `net_margin`, and `revenue`
- No financial-system integration
- No platform execution

Task 8 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/profit`

Optional API check:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/profit')); print(data['source']); print(len(data['product_profit'])); print(data['profit_risk'])"
```

Real data verification example:

```text
sqlite
6
{'loss_products': 1, 'low_profit_products': 2, 'high_risk_products': 3}
```

Build check:

```bash
npm run build
```

## Inventory Center V1

Task 9 adds `/inventory` as a local Inventory Center. It does not connect to a real warehouse system, does not call platform APIs, and does not execute replenishment automatically.

Included in this page:

- Inventory overview
  - `total_inventory_value`
  - `inventory_turnover_days`
  - `stock_health_score`
  - `stockout_risk_count`
  - `overstock_risk_count`
  - `slow_moving_sku_count`
- SKU inventory monitoring
  - `product_uid`
  - `product_name`
  - `platform`
  - `stock_qty`
  - `daily_sales_avg`
  - `days_of_stock`
  - `reorder_point`
  - `suggested_reorder_qty`
  - `stock_status`
- Inventory risks
  - `risk_id`
  - `product_uid`
  - `risk_type`
  - `risk_level`
  - `risk_reason`
  - `suggested_action`
- Reorder recommendations
  - `product_uid`
  - `product_name`
  - `current_stock`
  - `daily_sales_avg`
  - `lead_time_days`
  - `recommended_reorder_qty`
  - `reorder_priority`
  - `decision_notes`

Task 9 API route:

- `GET /api/inventory`

Task 9 behavior:

- Chinese UI
- API-driven reads
- Local SQLite support
- Empty real-data state support
- Filters for `platform`, `stock_status`, and `risk_level`
- Sorting by `days_of_stock`, `stock_qty`, `stockout_risk`, and `reorder_priority`
- No warehouse-system integration
- No auto-replenishment
- No platform execution

Task 9 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/inventory`

Optional API check:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/inventory')); print(data['source']); print(len(data['inventory_stock']), len(data['inventory_risks']), len(data['reorder_recommendations'])); print(data['snapshot'])"
```

Real data verification example:

```text
sqlite
6 4 3
```

Build check:

```bash
npm run build
```

## CEO Dashboard V2

Task 10 upgrades `/dashboard` into a real CEO dashboard instead of a standalone mock snapshot. The page now aggregates existing module data from profit, inventory, opportunities, approvals, crawl logs, and data-quality signals through `GET /api/dashboard-summary`.

Included in this page:

- Boss three-second core metrics
  - `yesterday_net_profit`
  - `month_net_profit`
  - `net_margin`
  - `cash_flow`
  - `inventory_turnover_days`
  - `pending_approval_count`
- Today operating status
  - `today_opportunity_count`
  - `high_priority_recommendation_count`
  - `stockout_risk_count`
  - `low_profit_product_count`
  - `high_risk_alert_count`
- Profit and cash summary
  - `yesterday_net_profit`
  - `month_net_profit`
  - `net_margin`
  - `cash_flow`
  - `profit_risk_summary`
- Inventory risk summary
  - `inventory_turnover_days`
  - `stock_health_score`
  - `stockout_risk_count`
  - `overstock_risk_count`
  - `slow_moving_sku_count`
- AI pending approvals
  - `pending_count`
  - `high_priority_count`
  - `deferred_count`
  - `latest_recommendations`
- Opportunity and risk summary
  - `top_opportunities`
  - `top_risks`
  - `recommended_actions`
- System status
  - `data_source`
  - `last_updated_at`
  - `api_status`
  - `database_status`

Task 10 behavior:

- Chinese interface
- API-driven dashboard summary
- Local SQLite support
- Empty state when SQLite is missing or unreadable
- Reuses existing repository logic from opportunities, analysis, approvals, profit, and inventory
- Displays recommendations only and does not auto-execute any action
- Keeps `/opportunities`, `/analysis`, `/profit`, `/inventory`, `/approvals`, and `/system` unchanged

Task 10 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/dashboard`

Optional API check:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/dashboard-summary')); print(data['source']); print(data['dashboard_summary']['core_metrics']); print(data['dashboard_summary']['operating_status'])"
```

Real data verification example:

```text
sqlite
```

Build check:

```bash
npm run build
```

## Task Center V1.5

Task 11B adds `/tasks` as Today's Task Center. It converts existing opportunity, analysis, approval, profit, and inventory data into prioritized operating tasks so the owner can start from "what should we handle today" instead of reading every report first.

Included in this page:

- Today's task overview
  - `total_tasks`
  - `high_priority_tasks`
  - `medium_priority_tasks`
  - `low_priority_tasks`
  - `estimated_profit_impact`
  - `estimated_gmv_impact`
  - `estimated_inventory_impact`
- Today's TOP 5 tasks
  - `rank`
  - `task_title`
  - `task_type`
  - `source_module`
  - `impact_type`
  - `estimated_profit_impact`
  - `estimated_gmv_impact`
  - `estimated_inventory_impact`
  - `priority`
  - `suggested_action`
- High, medium, and low priority task queues
  - `task_id`
  - `task_type`
  - `source_module`
  - `title`
  - `summary`
  - `priority`
  - `expected_impact`
  - `suggested_action`
  - `created_at`
- AI suggestions
  - `recommendation_id`
  - `recommendation_type`
  - `recommendation_summary`
  - `recommendation_reason`
  - `expected_benefit`
  - `approval_required`
- Task source statistics
  - `inventory_tasks`
  - `profit_tasks`
  - `approval_tasks`
  - `analysis_tasks`
  - `opportunity_tasks`
- Task impact statistics
  - `total_profit_impact`
  - `total_gmv_impact`
  - `total_inventory_impact`

Task 11B API route:

- `GET /api/tasks`

Task 11B rule engine:

- Inventory rule: `days_of_stock < 5` creates an inventory alert task.
- Profit rule: `net_margin < 10%` creates a profit abnormal task.
- Approval rule: pending approval items create approval review tasks.
- Opportunity rule: `opportunity_score > 90` creates opportunity follow-up tasks.
- Risk rule: `risk_level = high` creates high-risk handling tasks.

Task navigation:

- Inventory tasks link to `/inventory`
- Profit tasks link to `/profit`
- Approval tasks link to `/approvals`
- Opportunity tasks link to `/opportunities`
- Analysis tasks link to `/analysis`

Task 11B behavior:

- Chinese UI
- API-driven reads
- Local SQLite support
- Empty real-data state support
- Filters by priority and source module
- Sorting by default priority order, profit impact, risk level, inventory impact, and GMV impact
- Mobile responsive layout
- No real platform API
- No OpenAI API
- No crawler
- No automatic execution, replenishment, repricing, ads, or listing upload

Task 11B verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/tasks`

Optional API check:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/tasks')); print(data['source']); print(len(data['top_tasks']))"
```

Real data verification example:

```text
sqlite
5
```

Build check:

```bash
npm run build
```

## System Health & Observability Layer V1

Task 12 adds `/system-health` as a read-only observability page. It checks local API health, data consistency, data source status, system health score, and recent operating logs. It does not call external APIs, does not add platform-specific logic, and does not execute any business action.

Included in this page:

- API health checks
  - `status`
  - `response_time`
  - `data_source`
  - `last_updated`
- Data consistency checks
  - `inventory -> tasks`
  - `profit -> tasks`
  - `approvals -> tasks`
  - `mismatch_count`
  - `mismatch_items`
  - `severity`
- Data source status
  - `sqlite_available`
  - `mock_fallback_active`
  - `last_db_init_time`
- System health score
  - `system_health_score`
  - API failure rate
  - data missing rate
  - mock ratio
  - task anomaly rate
- Log summary
  - task generation
  - approval operations
  - inventory updates

Task 12 API route:

- `GET /api/system-health`

Task 12 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/system-health`

Optional API check:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/system-health')); print(data['system_health_score']); print(len(data['api_health']), len(data['data_consistency']), data['data_source_status'])"
```

Real data verification example:

```text
7 API checks
3 consistency checks
```

Build check:

```bash
npm run build
```

## User & Permission System V1

Task 13 adds `/users` as a local user, role, permission, and operation-log center. It keeps the system local-first and does not connect to third-party identity providers.

Included in this page:

- Login state management
  - local user selection on `/login`
  - localStorage-backed current user
  - logout clears local state
- User list
  - `user_id`
  - `email`
  - `display_name`
  - `roles`
  - `status`
  - `last_login_at`
  - permission count
- Role management
  - `admin`
  - `operator`
  - `buyer`
  - `finance`
  - `viewer`
- Permission management
  - role-permission matrix
  - view/manage/approve permissions
- Operation logs
  - login
  - logout
  - approval
  - user_create
  - user_update

Task 13 API routes:

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users`
- `GET /api/roles`
- `GET /api/operation-logs`

Task 13 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/login`
- `http://127.0.0.1:3000/users`

Optional API checks:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/users')); print(data['source'], len(data['users']), len(data['roles']), len(data['permissions']))"
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/roles')); print(data['source'], [role['role_id'] for role in data['roles']])"
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/operation-logs')); print(data['source'], len(data['operation_logs']))"
```

Real data verification example:

```text
sqlite 5 5 20
```

Build check:

```bash
npm run build
```

## Decision Feedback & Data Loop V1

Task 15 adds `/decision-feedback` as a local decision feedback loop. It records historical decisions, writes back actual business results, calculates decision quality metrics, and returns rule-based learning suggestions.

Important boundaries:

- No changes to the Shopee connector
- No external API calls
- No automatic order placement
- No automatic repricing
- No automatic listing upload
- No automatic execution
- Data recording and analysis only

Decision feedback module:

- `src/decision_feedback_system/`

SQLite tables:

- `decision_feedback`
- `decision_business_outcomes`
- `decision_learning_adjustments`

Task 15 API routes:

- `POST /api/decision/feedback`
- `GET /api/decision/history`
- `GET /api/decision/metrics`

Dashboard metrics added:

- `decision_accuracy_score`
- `recommendation_success_rate`
- `blocked_correct_rate`
- `roi_deviation_rate`

Task 15 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/decision-feedback`
- `http://127.0.0.1:3000/dashboard`

Optional API checks:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/decision/history')); print(data['source'], len(data['history']))"
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/decision/metrics')); print(data['source'], data['metrics']['decision_accuracy_score'], data['metrics']['recommendation_success_rate'])"
python -c "import urllib.request, json; payload=b'{\"product_id\":\"ITEM-DEMO\",\"decisionState\":\"RECOMMEND\",\"user_action\":\"buy\",\"source\":\"manual\",\"actual_sales\":12,\"actual_profit\":240,\"roi_real\":1.18,\"stock_change\":-12,\"conversion_rate\":0.03}'; req=urllib.request.Request('http://127.0.0.1:3000/api/decision/feedback', data=payload, headers={'Content-Type':'application/json'}, method='POST'); data=json.load(urllib.request.urlopen(req)); print(data['source'], data['persisted'], data['metrics']['total_decisions'])"
```

Build check:

```bash
npm run build
```

## Action Execution Guard Layer V1

Task 16 adds `/actions` as a guarded local execution queue. It does not execute real platform operations. It only creates local execution requests, stores approval decisions, calculates simulation results, and keeps an audit history.

Important boundaries:

- No automatic execution
- No Shopee connector changes
- No external write API calls
- No automatic order placement
- No automatic repricing
- No automatic listing upload
- No automatic advertising changes

Action execution module:

- `src/action_execution_layer/`

SQLite tables:

- `action_queue`
- `action_history`

Task 16 API routes:

- `POST /api/actions/create`
- `POST /api/actions/approve`
- `POST /api/actions/reject`
- `GET /api/actions/queue`
- `GET /api/actions/history`

Approval rules:

- `operator` can create execution requests.
- `admin` can approve or reject any execution request.
- `finance` can approve or reject cost-related requests: `purchase`, `price`, and `ad`.
- `buyer` and `viewer` cannot approve execution requests.

Dashboard metrics added:

- pending execution count
- approved execution count
- rejected execution count
- simulated profit total

Task 16 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/actions`
- `http://127.0.0.1:3000/dashboard`

Optional API checks:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/actions/queue')); print(data['source'], len(data['queue']), data['stats']['pending_count'])"
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/actions/history')); print(data['source'], len(data['history']))"
python -c "import urllib.request, json; payload=b'{\"action_type\":\"purchase\",\"product_id\":\"ITEM-DEMO\",\"platform\":\"Shopee\",\"suggested_by\":\"taskSystem\",\"requested_by\":\"operator@local.br\"}'; req=urllib.request.Request('http://127.0.0.1:3000/api/actions/create', data=payload, headers={'Content-Type':'application/json'}, method='POST'); data=json.load(urllib.request.urlopen(req)); print(data['source'], data['persisted'], data['action']['status'])"
python -c "import urllib.request, json; payload=b'{\"action_id\":\"exec_20260618_purchase_001\",\"actor_role\":\"admin\",\"actor_name\":\"admin@local.br\"}'; req=urllib.request.Request('http://127.0.0.1:3000/api/actions/approve', data=payload, headers={'Content-Type':'application/json'}, method='POST'); data=json.load(urllib.request.urlopen(req)); print(data['source'], data['persisted'], data['action']['status'])"
```

Build check:

```bash
npm run build
```

## 经营结果分析 V1

Task 17 adds `/business-impact` as a read-only attribution layer. It measures how historical decisions and guarded execution requests affected profit, inventory, and GMV.

Important boundaries:

- No Shopee connector changes
- No automatic execution
- No external API calls
- No real-time trading
- No platform writes
- Analysis and attribution only

Business impact module:

- `src/business_impact_engine/`

SQLite table:

- `business_impact_results`

Task 17 API routes:

- `GET /api/business-impact`
- `GET /api/business-impact/actions`
- `GET /api/business-impact/summary`

Data sources:

- `action_queue`
- `business_impact_results`
- `decision_feedback`
- `shopee_orders`
- `shopee_products`

Dashboard metrics added:

- total profit impact
- decision success rate
- best strategy
- worst strategy

Task 17 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/business-impact`
- `http://127.0.0.1:3000/dashboard`

Optional API checks:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/business-impact')); print(data['source'], data['summary']['total_profit_impact'], len(data['action_impacts']))"
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/business-impact/summary')); print(data['source'], data['summary']['action_success_rate'], data['summary']['ROI_prediction_error'])"
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/business-impact/actions')); print(data['source'], len(data['action_impacts']))"
```

Build check:

```bash
npm run build
```

## Self-Optimization Engine V1

Task 18 adds `/self-optimization` as a recommendation-only optimization layer. It analyzes historical business outcomes and suggests rule or scoring weight adjustments, but it does not apply any change automatically.

Important boundaries:

- No automatic code modification
- No automatic production rule adjustment
- No external operations
- No 决策规则 changes
- No Scoring Engine changes
- No 经营结果分析 rules changes
- Recommendations require human approval

Self-optimization module:

- `src/self_optimization_engine/`

Task 18 API routes:

- `GET /api/self-optimization`
- `GET /api/self-optimization/recommendations`
- `GET /api/self-optimization/analysis`

Data sources:

- `decision_feedback`
- `business_impact_results`
- `action_queue`
- `shopee_orders`

Dashboard metrics added:

- rule hit rate
- rule bias rate
- recommended optimization list
- system learning trend chart

Task 18 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/self-optimization`
- `http://127.0.0.1:3000/dashboard`

Optional API checks:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/self-optimization')); print(data['source'], data['summary']['rule_hit_rate'], len(data['recommendations']))"
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/self-optimization/recommendations')); print(data['source'], len(data['recommendations']), data['guardrails'][0])"
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/self-optimization/analysis')); print(data['source'], len(data['rule_performance']), len(data['failure_patterns']))"
```

Build check:

```bash
npm run build
```

## Daily Operations Control Center V1

Task 19 adds `/daily-ops` as the daily operations command view. It aggregates existing Decision, Task, Action, 经营结果分析, and 规则优化 data into one read-only operating surface.

Important boundaries:

- No automatic execution
- No Shopee Connector changes
- No new platform API writes
- No crawler work
- No business engine changes
- All actions remain suggestion-first and approval-first

Included in this page:

- Today core goals Top 3
  - sourced from `tasks`, `business_impact`, and `decision_engine`
  - sorted by profit impact, risk level, and priority
- Today risk overview
  - stockout risk
  - profit decline risk
  - high-risk products
  - approval backlog
- Today opportunities
  - high-ROI opportunities
  - recommended purchase observations
  - rule optimization opportunities
- Execution queue summary
  - pending approvals
  - approved but not executed
  - rejected actions
- Today metrics panel
  - expected GMV
  - expected profit
  - stock health score
  - decision success rate

Task 19 API route:

- `GET /api/daily-ops`

Dashboard entry:

- `/dashboard` includes a hero shortcut and fixed entry card for Daily Operations Control Center.

Task 19 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/daily-ops`
- `http://127.0.0.1:3000/dashboard`

Optional API check:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/daily-ops')); print(data['source'], len(data['core_goals']), len(data['opportunities']), data['execution_queue']['pending_approval_count'])"
```

Build check:

```bash
npm run build
```

## Verification Center V1

Task 20 adds `/verification` as the unified system acceptance center. It is a read-only inspection layer: it checks module availability, summarizes key API health, exposes quick test links, and shows the current 验收检查 for each update.

Included in this page:

- System module checklist
  - Dashboard
  - Tasks
  - Opportunities
  - Analysis
  - Profit
  - Inventory
  - Approvals
  - Actions
  - Shopee
  - Decision Feedback
  - 经营结果分析
  - 规则优化
  - System Health
  - Users
- API health summary
  - `/api/dashboard-summary`
  - `/api/tasks`
  - `/api/actions/queue`
  - `/api/shopee/orders`
  - `/api/system-health`
  - `/api/business-impact`
  - `/api/self-optimization`
- Quick test entries for Dashboard, Tasks, Actions, Shopee, Decision Feedback, 经营结果分析, and 规则优化.
- Runtime summary
  - system available
  - module completeness
  - API health score
  - data consistency status
- 验收检查
  - current version
  - newly added module
  - impact scope
  - whether existing system is affected

Task 20 API route:

- `GET /api/verification/status`

Task 20 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/verification`

Optional API check:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/verification/status')); print(data['runtime_summary']['system_available'], len(data['modules']), len(data['api_health']))"
```

Expected result:

```text
YES 14 7
```

Build check:

```bash
npm run build
```

## Store Authorization Center / Shopee Read-Only Connector V1

Task 14 adds `/shopee` as the Store Authorization Center. The current production connector supports Shopee first, while the UI keeps platform slots for Mercado Livre, Amazon BR, TikTok Shop BR, AliExpress, and future channels. Each Shopee shop must be authorized once through the official Shopee Open Platform flow. After authorization, the system can pull real read-only shop data, cache the data locally, and use it as the operating data source for the rest of the system.

Important boundaries:

- Read-only data only
- No Shopee writes
- No order operations
- No repricing
- No listing upload
- No ad operations
- No automatic trading
- No cron or background scheduled sync
- No Shopee write API is implemented
- Multiple Shopee shops can be bound under the same app and are synchronized one by one

Connector module:

- `src/connectors/shopee/`
- `src/lib/connectors/shopeeOfficialClient.ts`
- `src/lib/connectors/shopeeBindingRepository.ts`

SQLite cache tables:

- `shopee_orders`
- `shopee_products`
- `shopee_inventory`
- `shopee_shop_bindings`

Task 14 API routes:

- `GET /api/shopee/binding`
- `PATCH /api/shopee/binding`
- `GET /api/shopee/auth/start`
- `GET /api/shopee/auth/callback`
- `GET /api/shopee/orders`
- `GET /api/shopee/products`
- `GET /api/shopee/inventory`
- `POST /api/shopee/sync`

Data priority:

1. Official Shopee shop binding when `SHOPEE_PARTNER_ID` and `SHOPEE_PARTNER_KEY` are configured and the shop is authorized
2. Shopee read-only API proxy when `SHOPEE_READONLY_API_BASE_URL` is configured
3. SQLite/PostgreSQL cache
4. Empty real-data state when no source is connected

Optional environment variables:

```bash
SHOPEE_MODE=readonly
SHOPEE_OPEN_API_BASE_URL=https://partner.shopeemobile.com
SHOPEE_PARTNER_ID=
SHOPEE_PARTNER_KEY=
SHOPEE_REDIRECT_URL=https://your-domain.com/api/shopee/auth/callback
SHOPEE_TOKEN_ENCRYPTION_KEY=
SHOPEE_READONLY_API_BASE_URL=
SHOPEE_READONLY_ACCESS_TOKEN=
```

Official shop binding:

1. Configure the Shopee variables above in Vercel or the local `.env` file.
2. Set the same redirect URL in Shopee Open Platform: `/api/shopee/auth/callback`.
3. Open `/shopee` as an admin user.
4. Select `Shopee` and click `授权当前平台店铺`.
5. Log in to the target Shopee shop and complete authorization.
6. The callback stores `shop_id`, access token, refresh token, expiry time, and binding status in `shopee_shop_bindings`.
7. Repeat authorization for every Shopee shop that should be included.
8. Use the bound shop list to set `shop_name`, `owner_name`, and `notes` for internal operations.
9. `/api/shopee/orders`, `/api/shopee/products`, and `/api/shopee/inventory` read from authorized shops first.

Token safety:

- Tokens are not returned to the frontend.
- Tokens are encrypted at rest when `SHOPEE_TOKEN_ENCRYPTION_KEY` is configured.
- The binding flow only enables read-only data pulls.

Expected read-only API proxy shape:

```text
GET {SHOPEE_READONLY_API_BASE_URL}/orders
GET {SHOPEE_READONLY_API_BASE_URL}/products
GET {SHOPEE_READONLY_API_BASE_URL}/inventory
```

The connector sends only `GET` requests to the configured source. Manual sync writes only to local SQLite cache tables.

Task 14 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/shopee`

Optional API checks:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/shopee/orders')); print(data['source'], len(data['data']), data['readonly'])"
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/shopee/products')); print(data['source'], len(data['data']), data['readonly'])"
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/shopee/inventory')); print(data['source'], len(data['data']), data['readonly'])"
```

Manual sync check:

```bash
python -c "import urllib.request, json; req = urllib.request.Request('http://127.0.0.1:3000/api/shopee/sync', method='POST'); data = json.load(urllib.request.urlopen(req)); print(data)"
```

Build check:

```bash
npm run build
```

## Multi-Tenant SaaS Foundation V1

Task 21 adds a tenant/workspace layer without changing existing business modules, without payment logic, and without external authentication.

New page:

- `http://127.0.0.1:3000/tenants`

New SQLite tables:

- `tenants`
- `workspaces`
- `tenant_users`

Tenant rules:

- Default tenant is `demo_tenant`.
- APIs accept `?tenant_id=...` or the `x-tenant-id` request header.
- Business tables receive a `tenant_id` column through the SQLite init script.
- Tenant context is supported. Tenants without real data return empty business collections until real data is imported or synchronized.
- Subscription is display-only through `plan_type` (`free`, `pro`, `enterprise`). No Stripe, billing, or real charging logic is included.

Task 21 API routes:

- `GET /api/tenants`
- `POST /api/tenants`
- `GET /api/workspaces`
- `POST /api/workspaces`

Tenant-scoped example checks:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/tenants`

Optional API checks:

```bash
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/tenants')); print(data['tenant_id'], len(data['tenants']), len(data['workspaces']))"
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/workspaces?tenant_id=demo_tenant')); print(data['tenant_id'], len(data['workspaces']))"
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/products?tenant_id=demo_tenant')); print(data['tenant_id'], data['source'], len(data['products']))"
python -c "import urllib.request, json; data = json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/products?tenant_id=growth_tenant')); print(data['tenant_id'], data['source'], len(data['products']))"
```

Expected isolation signal:

```text
demo_tenant sqlite 6
growth_tenant sqlite 0
```

Build check:

```bash
npm run build
```

## Internal Command Center V1

Task 22 adds `/command-center` as a single internal operating console. It aggregates existing system data without adding SaaS features, billing logic, platform writes, or automatic execution.

New page:

- `http://127.0.0.1:3000/command-center`

Aggregated sources:

- `GET /api/dashboard-summary`
- `GET /api/tasks`
- `GET /api/daily-ops`
- `GET /api/system-health`
- `GET /api/verification/status`

Included views:

- Must Do: high-profit opportunities, high-risk inventory, and approval blockers.
- Risk: stockout pressure, profit decline, high-risk alerts, and system exceptions.
- Opportunity: high-ROI products and recommended display-only actions.
- System status: API health, DB health, test-data disabled status, and latest data update.
- Quick links: `/dashboard`, `/tasks`, `/actions`, `/inventory`, `/profit`, `/business-impact`, `/self-optimization`, `/verification`.

Decision priority rule:

1. Profit impact has the highest weight.
2. Risk severity is second.
3. Opportunity score is third.

Task 22 boundaries:

- Internal operations only.
- No SaaS commercialization added.
- No tenant system enhancement.
- No payment or billing logic.
- No Shopee Connector change.
- No automatic execution.

Task 22 verification:

```bash
python scripts/init_db.py
npm run dev
```

Then open:

- `http://127.0.0.1:3000/command-center`

Build check:

```bash
npm run build
```

## Deployment ready

Task 4 adds Vercel-ready deployment files:

- `vercel.json`
- `.env.example`
- `.vercelignore`
- `DEPLOYMENT.md`

Vercel deployment should use `DATA_SOURCE_MODE=postgres` with `DATABASE_URL` configured for PostgreSQL/Supabase. Local development keeps `DATA_SOURCE_MODE=sqlite` by default and does not display test sample data unless explicitly enabled for development.

Deployment verification:

```bash
python scripts/init_db.py
npm run build
npm run start
```

Then open:

- `http://127.0.0.1:3000/dashboard`
- `http://127.0.0.1:3000/command-center`
- `http://127.0.0.1:3000/opportunities`
- `http://127.0.0.1:3000/analysis`
- `http://127.0.0.1:3000/profit`
- `http://127.0.0.1:3000/inventory`
- `http://127.0.0.1:3000/approvals`
- `http://127.0.0.1:3000/actions`
- `http://127.0.0.1:3000/shopee`
- `http://127.0.0.1:3000/decision-feedback`
- `http://127.0.0.1:3000/business-impact`
- `http://127.0.0.1:3000/self-optimization`
- `http://127.0.0.1:3000/users`
- `http://127.0.0.1:3000/system`
- `http://127.0.0.1:3000/system-health`

Full deployment guide:

- `DEPLOYMENT.md`
