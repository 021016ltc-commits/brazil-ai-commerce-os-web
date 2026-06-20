# Brazil AI Commerce OS Lite - Rule Engine

Last updated: 2026-06-17

## 1. Current Rule Engine Scope

The current system uses local deterministic rules and mock or SQLite data.

It does not call:

- OpenAI API
- External AI models
- Real platform APIs
- Real crawler services
- Real execution systems

Rules live mainly in:

- `src/lib/opportunities.ts`
- `src/lib/analysis.ts`
- `src/lib/approvals.ts`
- `src/lib/profit.ts`
- `src/lib/dashboard.ts`
- `src/lib/tasks.ts`

Inventory rules are partly data-driven from SQLite or mock seed records.

## 2. Opportunity Rules

Opportunity item construction:

- Match each `opportunity_score` record with a product by `product_uid`.
- Use `title_current`, `price_amount`, `rating`, and `sold_count_text` from product data.
- Use `market_score`, `opportunity_score`, `recommendation_level`, and `decision_notes` from opportunity data.
- Sort opportunity products by `opportunity_score` descending.

Recommendation level:

- Prefer `recommendation_level`.
- Fallback to `suggestion_level`.

Opportunity risk score fallback:

- If `risk_score` exists, use it directly.
- If product `availability_status = limited_stock`, use risk score `34`.
- If product `availability_status = low_stock`, use risk score `29`.
- If `review_count < 80`, use risk score `27`.
- If `risk_level = high`, use risk score `44`.
- If `risk_level = medium`, use risk score `28`.
- Otherwise use risk score `16`.

Opportunity risk alert type priority:

- `risk_level = high` -> `policy_compliance`
- limited or low stock -> `inventory_tension`
- risk score >= 30 -> `logistics_latency`
- review count < 80 -> `review_sample_gap`
- otherwise -> `competition_pressure`

Risk alert sorting:

- `high` before `medium` before `low`

## 3. Analysis Rules

Analysis Center is rules-based.

Opportunity analysis:

- Sort opportunities by `opportunity_score` descending.
- Use `analysis_queue` item IDs when available.
- Generate summary and recommendation from opportunity level, risk level, inventory availability, review count, and market score.

Priority rules:

- `P1` if queue priority is `1`, risk level is `high`, or `opportunity_score >= 88`.
- `P2` if queue priority is `2`, risk level is `medium`, or `opportunity_score >= 78`.
- `P3` otherwise.

Market trend rules:

- Use keyword `trend_direction` when available.
- Else if `trend_score >= 80`, treat as `up`.
- Else if `trend_score >= 65`, treat as `flat`.
- Otherwise treat as `down`.

AI recommendation rules:

- Use top opportunity scores as recommendation input.
- Generate `manual_risk_gate` for high-risk opportunities.
- Generate `supply_validation` when stock is limited or low.
- Generate `content_validation` when review count is below 80.
- Generate `listing_optimization` when opportunity score is at least 88.
- Add approval queue cleanup suggestions from recent actions.

## 4. Approval Rules

Approval priority:

- `P1` when `risk_level = high` or `confidence_score >= 0.8`.
- `P2` when `risk_level = medium` or `action_type = listing_review`.
- `P3` otherwise.

Approval queue sorting:

- Pending items first.
- Higher priority first.
- Newer `created_at` first.

Approval stats:

- Count `pending_review`.
- Count `approved_local`.
- Count `rejected_local`.
- Count `deferred_local`.

Allowed approval operations:

- Approve locally.
- Reject locally.
- Defer locally.

Not allowed:

- Execute approved action on a real platform.
- Upload real listing after approval.
- Change real product data after approval.

## 5. Profit Rules

Cost structure:

- Procurement cost
- Advertising cost
- Logistics cost
- Platform commission
- Tax cost

Cost share:

- Each cost item share = item cost / total tracked cost.
- If total tracked cost is zero, share is zero.

Profit risk summary:

- `loss_products`: count products with `net_profit < 0`.
- `low_profit_products`: count products with `net_profit >= 0` and `net_margin < 0.12`.
- `high_risk_products`: count products with `risk_level = high`.

Dashboard profit risk items:

- Negative net profit -> high risk.
- Net margin below `0.12` -> low margin risk.
- Existing high `risk_level` -> high profit risk.

## 6. Inventory Rules

Current inventory center reads inventory fields from SQLite or mock fallback.

Important fields:

- `stock_qty`
- `daily_sales_avg`
- `days_of_stock`
- `reorder_point`
- `suggested_reorder_qty`
- `stock_status`
- `risk_level`
- `recommended_reorder_qty`
- `reorder_priority`

Current stock status values:

- `healthy`
- `reorder_soon`
- `stockout_risk`
- `overstock_risk`
- `slow_moving`

Current inventory rule behavior:

- Inventory snapshot counts are read from `inventory_snapshot`.
- SKU stock status is read from `inventory_stock`.
- Risk cards are read from `inventory_risk`.
- Reorder suggestions are read from `reorder_recommendation`.
- No real replenishment is executed.

Future inventory computation should derive:

- `days_of_stock = stock_qty / daily_sales_avg`
- stockout risk when days of stock falls below lead-time coverage
- overstock risk when days of stock is far above target range
- reorder quantity from daily sales average, lead time, safety stock, and current stock

## 7. Risk Rules

Current risk levels:

- `low`
- `medium`
- `high`

Risk sorting:

- `high` = 3
- `medium` = 2
- `low` = 1

Dashboard risk aggregation:

- Opportunity risk alerts
- Inventory risks
- Profit risk items

High-risk alert count:

- Count all aggregated dashboard risks with `risk_level = high`.

## 8. System Health Rules

Dashboard system status:

- `data_source = sqlite` means SQLite was readable.
- `data_source = mock` means fallback mode is active.
- `api_status = healthy` when source is SQLite.
- `api_status = fallback` when source is mock.
- `database_status = connected` when source is SQLite.
- `database_status = fallback` when source is mock.

Latest updated time:

- Prefer latest crawl log finish time.
- Fallback to crawl start time.
- Fallback to approval queue time.
- Fallback to profit or inventory reporting date.
- Fallback to current time.

## 9. Rule Engine Boundaries

## 9. Task Generation Rules

Task Center V1.5 turns existing module signals into today's operating tasks.

Inventory tasks:

- `days_of_stock < 5` creates an `inventory_alert` task.
- High inventory risks create `risk_handling` tasks from the inventory module.

Profit tasks:

- `net_margin < 0.10` creates a `profit_alert` task.

Approval tasks:

- Each `pending_review` approval item creates an `approval_review` task.

Opportunity tasks:

- `opportunity_score > 90` creates an `opportunity_follow_up` task.

Risk tasks:

- `risk_level = high` creates a `risk_handling` or `analysis_review` task depending on source.

TOP5 sorting:

- Estimated profit impact descending.
- Risk level descending.
- Inventory impact descending.
- GMV impact descending.

All task links route users back to the source module:

- inventory -> `/inventory`
- profit -> `/profit`
- approval -> `/approvals`
- opportunity -> `/opportunities`
- analysis -> `/analysis`

Task rules may only create display tasks and recommendations. They may not execute real actions.

## 10. Rule Engine Boundaries

Rules may:

- Rank opportunities.
- Surface risk.
- Generate display-only recommendations.
- Suggest manual review.
- Update local approval status.

Rules may not:

- Execute real uploads.
- Execute real price changes.
- Execute real title changes.
- Execute real image changes.
- Execute real ad budget changes.
- Execute real replenishment.
