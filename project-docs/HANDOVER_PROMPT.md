# Brazil AI Commerce OS Lite - Handover Prompt

Last updated: 2026-06-17

Use this prompt when switching account, switching GPT, switching Codex, or asking a new coding agent to continue the project.

## Copyable Prompt

```text
You are continuing the project "Brazil AI Commerce OS Lite".

Workspace:
C:\Users\ltc02\Documents\数据库\brazil-ai-commerce-os-web

Important rule:
Do not rebuild the project from scratch. Continue from the existing Next.js project.

Current product status:
- Next.js App Router project.
- Local SQLite database exists at data/brazil_ai_commerce_os.db.
- API routes exist under src/app/api.
- SQLite/PostgreSQL real-data flow with empty-state fallback is implemented.
- Vercel deployment config exists.
- Vercel should use DATA_SOURCE_MODE=postgres with DATABASE_URL.
- Local development should use DATA_SOURCE_MODE=sqlite and show empty states if unavailable.

Current pages:
- /login
- /dashboard
- /tasks
- /opportunities
- /analysis
- /profit
- /inventory
- /approvals
- /system

Current APIs:
- GET /api/products
- GET /api/opportunities
- GET /api/analysis
- GET /api/profit
- GET /api/inventory
- GET /api/approvals
- PATCH /api/approvals
- GET /api/dashboard-summary
- GET /api/tasks

Current database scripts:
- scripts/init_db.py

Current documentation:
- README.md
- DEPLOYMENT.md
- project-docs/PROJECT_MASTER.md
- project-docs/BUSINESS_LOGIC.md
- project-docs/DATABASE_SCHEMA.md
- project-docs/SYSTEM_ARCHITECTURE.md
- project-docs/RULE_ENGINE.md
- project-docs/HANDOVER_PROMPT.md

Business positioning:
This is not a Shopee tool. It is Brazil AI Commerce OS Lite.
Shopee is only one platform value. The schema must stay platform-neutral.

Use these platform-neutral fields:
- platform
- market_code
- platform_product_id
- platform_shop_id
- product_uid
- seller_uid
- keyword_uid

Do not introduce fields like shopee_xxx.

Current completed modules:
- Web MVP
- SQLite database
- API data layer
- Opportunities Center
- Analysis Center
- Approval Center
- Profit Center
- Inventory Center
- CEO Dashboard V2
- Today's Task Center V1.5
- Project documentation system

Strict constraints:
- Do not connect real platform APIs unless explicitly requested.
- Do not develop crawlers unless explicitly requested.
- Do not connect OpenAI API or real AI models unless explicitly requested.
- Do not execute real platform actions.
- Do not upload products.
- Do not change real prices.
- Do not change real titles.
- Do not change real images.
- Do not change real ad budgets.
- Do not auto-replenish inventory.

Human approval rule:
All suggested execution actions must remain in queues and require human review.
Valid local review statuses:
- pending_review
- approved_local
- rejected_local
- deferred_local

Recommended orientation before coding:
1. Read README.md.
2. Read project-docs/PROJECT_MASTER.md.
3. Read project-docs/SYSTEM_ARCHITECTURE.md.
4. Read project-docs/DATABASE_SCHEMA.md.
5. Read project-docs/RULE_ENGINE.md.
6. Inspect src/lib/dbRepository.ts and src/types/index.ts.

Local verification commands:
python scripts/init_db.py
npm run build
npm run dev

If npm is not available in PATH in the Codex environment, use the bundled Node runtime and call Next directly.

Expected safety behavior:
- Build must pass.
- Existing pages must keep working.
- API should return SQLite data locally when the database is available.
- API/UI should not display sample business data when SQLite/PostgreSQL is unavailable.
- Vercel deployment should remain compatible.

When implementing future tasks:
- Prefer small scoped changes.
- Keep database-first thinking.
- Preserve platform-neutral schema.
- Update README and project-docs when project behavior changes.
```

## Current Best Next Steps

Recommended next development order:

1. Add automated smoke checks for API routes.
2. Add user, role, and permission model before real execution features.
3. Add database migration strategy.
4. Add source registry and crawl task tables before crawler development.
5. Add read-only connector abstraction before any real platform integration.
6. Add analysis package export for JSON and CSV.
7. Only after the above, consider real AI integration.

## Current Risks For A New Agent

Watch for these risks:

- Some existing Chinese strings may display with encoding artifacts in shell output.
- The browser UI may still render correctly even when PowerShell output looks garbled.
- `npm` may not be available in PATH in the local Codex environment.
- `git` may not be available in PATH.
- Vercel should not rely on local SQLite persistence.
- The project should not be converted into a Shopee-only tool.

## Definition Of Done For Future Tasks

A future task is complete only when:

- Requested files or pages are implemented.
- Existing pages are not broken.
- Real-data empty-state behavior remains intact where required.
- README is updated when behavior changes.
- `npm run build` or equivalent direct Next build passes.
- Any real execution behavior remains blocked unless explicitly approved and designed.
