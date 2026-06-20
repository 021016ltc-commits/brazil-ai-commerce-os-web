# Brazil AI Commerce OS Lite - Business Logic

Last updated: 2026-06-17

## 1. Why Database Fields Are English and UI Is Chinese

The project uses English field names because the database, API, and future exports must be stable, portable, and easy to analyze by tools and AI systems.

Examples:

- `platform`
- `market_code`
- `product_uid`
- `platform_product_id`
- `platform_shop_id`
- `opportunity_score`
- `approval_status`

The UI is Chinese because the current business operator and decision maker work in Chinese. The product is meant to help the owner and operations team make decisions quickly, so business explanations, module titles, and workflow text should stay Chinese.

This split gives the system two advantages:

- Machines and future integrations receive clean English contracts.
- Humans receive local, clear, business-facing Chinese interfaces.

## 2. Why AI Does Not Execute Automatically

AI output is treated as a recommendation, not an order.

The current system uses rules and mock analysis results. It does not call OpenAI, real AI models, or platform write APIs. Even when real AI is added later, it should only write suggestions into queues.

The reason is simple: commerce execution can create direct financial and platform risk.

Blocked automatic actions include:

- Uploading products.
- Changing prices.
- Changing main images.
- Modifying titles.
- Adjusting ad budgets.
- Triggering replenishment.

These actions can affect profit, account health, compliance, ranking, inventory, and cash flow. They require human review.

## 3. Why Approval Is Required

Approval turns recommendations into controlled decisions.

Current approval status values:

- `pending_review`
- `approved_local`
- `rejected_local`
- `deferred_local`

The current Approval Center only updates local SQLite state. It does not execute real platform actions.

Business reasons for approval:

- Prevent bad AI suggestions from becoming real operational damage.
- Keep accountability for price, content, listing, and inventory decisions.
- Allow high-risk recommendations to be delayed or rejected.
- Preserve history through `approval_history`.
- Keep the owner in control before real execution features exist.

## 4. Why Start With Shopee Before Other Platforms

Shopee is a practical first channel because it is a familiar marketplace and can be used as an initial data and workflow reference.

However, the current project is not a Shopee-only tool.

Current design rules:

- Never use `shopee_xxx` fields.
- Use `platform` for channel name.
- Use `platform_product_id` for channel product ID.
- Use `platform_shop_id` for channel shop ID.
- Use `market_code` for country or regional scope.

The seed data already includes multiple platform values:

- Shopee
- Mercado Livre
- Amazon BR
- TikTok Shop BR
- Temu
- AliExpress

Shopee can be the first connector to implement later, but the product must remain channel-neutral.

## 5. Project Operating Goal

The operating goal is to help the owner answer daily business questions:

- Are we making money today?
- Is cash flow healthy?
- Which products deserve attention?
- Which products create risk?
- Is inventory enough?
- Are we overstocked?
- Which AI or rule-based suggestions need approval?
- Which actions should be delayed?

The system should make decisions easier, not hide risk behind automation.

## 6. Profit-First Principle

Revenue without profit is not the goal.

Profit-first means:

- Net profit is more important than order volume.
- Net margin is more important than raw traffic.
- A product with weak margin should not be scaled blindly.
- Ads, logistics, commission, tax, and procurement cost must be visible.
- Dashboard should show profit and cash flow before lower-level metrics.

Current profit signals:

- `yesterday_net_profit`
- `month_net_profit`
- `net_margin`
- `cash_flow`
- `profit_risk_summary`
- `product_profit`

Current low-profit rule:

- Products with `net_profit >= 0` and `net_margin < 0.12` are treated as low-profit products.

## 7. Inventory-First Principle

A good opportunity can still be a bad decision if stock cannot support it.

Inventory-first means:

- Do not scale traffic before checking stock.
- Do not approve aggressive actions when stockout risk is high.
- Watch overstock because it traps cash.
- Slow-moving SKU risk should feed profit and cash-flow decisions.

Current inventory signals:

- `total_inventory_value`
- `inventory_turnover_days`
- `stock_health_score`
- `stockout_risk_count`
- `overstock_risk_count`
- `slow_moving_sku_count`
- `days_of_stock`
- `reorder_point`
- `suggested_reorder_qty`

Current system behavior:

- Inventory recommendations are display-only.
- Reorder suggestions do not trigger real replenishment.
- Inventory risk is surfaced in Dashboard and Inventory Center.

## 8. Brazil First, LATAM Ready

The current market scope is Brazil, represented as:

- `market_code = br`

The schema and UI should remain ready for later expansion to:

- Mexico
- Chile
- Colombia
- Peru
- Argentina

Future multi-market support should reuse `market_code` rather than creating country-specific tables.
