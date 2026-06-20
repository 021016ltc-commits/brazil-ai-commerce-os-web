# Brazil AI Commerce OS Lite - System Architecture

Last updated: 2026-06-17

## 1. Current System Shape

The current system is a local-first Next.js application with SQLite-backed API routes and mock fallback.

It is not connected to real platform APIs, real crawler jobs, real AI models, or real execution systems.

## 2. High-Level Architecture

```mermaid
flowchart TD
  User["Owner / Operator"] --> AppShell["Next.js App Shell"]

  AppShell --> Dashboard["Dashboard / CEO Dashboard V2"]
  AppShell --> Tasks["Today's Task Center"]
  AppShell --> Opportunities["Opportunities Center"]
  AppShell --> Analysis["Analysis Center"]
  AppShell --> Approvals["Approval Center"]
  AppShell --> Profit["Profit Center"]
  AppShell --> Inventory["Inventory Center"]
  AppShell --> System["System Status"]

  Dashboard --> DashboardAPI["GET /api/dashboard-summary"]
  Tasks --> TasksAPI["GET /api/tasks"]
  Opportunities --> OpportunitiesAPI["GET /api/opportunities"]
  Analysis --> AnalysisAPI["GET /api/analysis"]
  Approvals --> ApprovalsAPI["GET /api/approvals, PATCH /api/approvals"]
  Profit --> ProfitAPI["GET /api/profit"]
  Inventory --> InventoryAPI["GET /api/inventory"]
  System --> SystemData["Local status display"]

  DashboardAPI --> Repository["Repository Layer / dbRepository.ts"]
  TasksAPI --> Repository
  OpportunitiesAPI --> Repository
  AnalysisAPI --> Repository
  ApprovalsAPI --> Repository
  ProfitAPI --> Repository
  InventoryAPI --> Repository

  Repository --> SQLite["Local SQLite / data/brazil_ai_commerce_os.db"]
  Repository --> MockFallback["Mock Fallback / src/data"]

  Connectors["Future Connectors"] -. read-only first .-> SQLite
  Connectors -. "Shopee, Mercado Livre, Amazon BR, TikTok Shop BR, Temu, AliExpress, Independent Store" .-> SQLite

  Rules["Rule Engine / src/lib"] --> Repository
  Repository --> Rules
```

## 3. Data Flow

```mermaid
flowchart LR
  Seed["scripts/seed_mock_data.py"] --> SQLite["SQLite Tables"]
  Init["scripts/init_db.py"] --> SQLite

  SQLite --> Repo["dbRepository.ts"]
  Mock["src/data mock files"] --> Repo

  Repo --> Products["/api/products"]
  Repo --> OppAPI["/api/opportunities"]
  Repo --> AnalysisAPI["/api/analysis"]
  Repo --> ProfitAPI["/api/profit"]
  Repo --> InventoryAPI["/api/inventory"]
  Repo --> ApprovalsAPI["/api/approvals"]
  Repo --> DashAPI["/api/dashboard-summary"]

  Products --> UI["React Pages"]
  OppAPI --> UI
  AnalysisAPI --> UI
  ProfitAPI --> UI
  InventoryAPI --> UI
  ApprovalsAPI --> UI
  DashAPI --> UI

  UI --> Human["Human Review"]
  Human --> ApprovalsAPI
  ApprovalsAPI --> ActionQueue["action_queue + approval_history"]
```

## 4. Module Responsibilities

Dashboard:

- Aggregates data from profit, inventory, opportunities, approvals, risk, and system health.
- Helps the owner answer whether the business is making money, whether inventory is risky, and what needs review today.

Tasks:

- Shows today's task overview, TOP5 tasks, priority queues, AI suggestions, source statistics, and impact statistics.
- Converts opportunity, analysis, approval, profit, and inventory data into task cards.
- Tasks link to their source page for human handling.
- Reads from `/api/tasks`.
- Does not execute any real platform or replenishment action.

Opportunities:

- Shows opportunity products, keyword opportunities, and risk alerts.
- Supports filters and sorting.
- Reads from `/api/opportunities`.

Analysis:

- Shows rules-based opportunity, risk, market, and recommendation analysis.
- Does not connect to OpenAI or real AI models.
- Reads from `/api/analysis`.

Approvals:

- Shows approval queue, status operations, history, and stats.
- `PATCH /api/approvals` updates local SQLite only.
- Does not execute platform actions.

Profit:

- Shows profit snapshot, cost structure, profit risk, and product profit ranking.
- Reads from `/api/profit`.

Inventory:

- Shows inventory snapshot, SKU monitoring, risk alerts, and reorder suggestions.
- Reads from `/api/inventory`.
- Does not trigger replenishment.

Connectors:

- Not implemented yet.
- Future connectors should be read-only first.
- Real write actions must stay behind approval and execution queues.

## 5. Runtime Modes

SQLite mode:

- `DATA_SOURCE_MODE=sqlite`
- API attempts to read `SQLITE_DB_PATH`.
- If SQLite is missing or fails, repository returns mock fallback.

Mock mode:

- `DATA_SOURCE_MODE=mock`
- API returns mock data directly.
- Recommended for Vercel demo deployment.

## 6. Deployment Architecture

```mermaid
flowchart TD
  Local["Local Development"] --> LocalSQLite["SQLite file"]
  Local --> LocalAPI["Next.js API routes"]
  LocalAPI --> LocalUI["Local UI"]

  Vercel["Vercel Deployment"] --> VercelEnv["DATA_SOURCE_MODE=mock"]
  VercelEnv --> MockData["Mock fallback data"]
  MockData --> VercelUI["Public demo UI"]
```

## 7. Execution Boundary

The current system never executes real platform actions.

Allowed:

- Read local SQLite.
- Read mock fallback.
- Display recommendations.
- Update local approval status.
- Write local approval history.

Not allowed:

- Upload real products.
- Change real prices.
- Change real titles.
- Change real images.
- Change real ad budgets.
- Trigger real replenishment.
