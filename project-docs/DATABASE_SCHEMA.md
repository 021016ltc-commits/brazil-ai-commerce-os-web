# Brazil AI Commerce OS Lite - Database Schema

Last updated: 2026-06-17

## 1. Scan Source

This document summarizes the current SQLite database by scanning:

```text
data/brazil_ai_commerce_os.db
```

Scan method:

- SQLite `sqlite_master`
- SQLite `PRAGMA table_info`
- SQLite `PRAGMA index_list`
- Row counts are historical snapshots and should be regenerated from the current real database.

Important note:

- The current SQLite schema does not define foreign key constraints.
- Relationships below are logical relationships based on shared IDs such as `product_uid`, `seller_uid`, `keyword_uid`, `action_id`, and `approval_id`.
- Vercel production should use PostgreSQL/Supabase via `DATABASE_URL`, not test sample data.

## 2. Table Overview

| Table | Rows | Primary key | Purpose |
| --- | ---: | --- | --- |
| `action_queue` | 6 | `action_id` | Stores suggested actions awaiting local review or status updates. |
| `analysis_queue` | 6 | `analysis_id` | Stores packages or analysis jobs awaiting rules or future AI analysis. |
| `approval_history` | 3 | `history_id` | Stores local approval decisions and reviewer notes. |
| `crawl_logs` | 3 | `crawl_run_id` | Stores sync or crawler run logs. |
| `data_quality_report` | 3 | `report_id` | Stores data quality checks and warning status. |
| `inventory_risk` | 4 | `risk_id` | Stores inventory-level risk alerts. |
| `inventory_snapshot` | 1 | `inventory_snapshot_id` | Stores overall inventory health snapshot. |
| `inventory_stock` | 6 | `inventory_item_id` | Stores SKU-level stock metrics. |
| `keywords` | 6 | `keyword_uid` | Stores platform-neutral keyword records. |
| `market_score` | 6 | `market_score_id` | Stores keyword market scoring. |
| `opportunity_score` | 6 | `opportunity_score_id` | Stores opportunity scoring and recommendation levels. |
| `product_profit` | 6 | `profit_item_id` | Stores SKU-level profit metrics. |
| `products` | 6 | `product_uid` | Stores normalized product records. |
| `profit_snapshot` | 1 | `profit_snapshot_id` | Stores overall profit and cost snapshot. |
| `reorder_recommendation` | 3 | `recommendation_id` | Stores display-only replenishment suggestions. |
| `sellers` | 6 | `seller_uid` | Stores normalized seller records. |
| `upload_queue` | 2 | `upload_id` | Stores upload requests that still require approval; no real upload execution. |

## 3. Logical Relationships

Core market graph:

- `products.seller_uid` -> `sellers.seller_uid`
- `products.platform_shop_id` -> `sellers.platform_shop_id`
- `products.product_uid` -> product-level tables such as `product_profit`, `inventory_stock`, `inventory_risk`, `reorder_recommendation`, `action_queue.target_id`
- `keywords.keyword_uid` -> `market_score.keyword_uid`
- `keywords.keyword_uid` -> `opportunity_score.keyword_uid`
- `opportunity_score.product_uid` is not stored directly in the schema, but the repository maps opportunity rows to products by platform and market in the current local implementation.

Approval and execution graph:

- `action_queue.action_id` -> `approval_history.approval_id`
- `action_queue.target_id` -> usually `products.product_uid`
- `upload_queue.target_id` -> usually `products.product_uid`
- `action_queue.approval_status` and `upload_queue.approval_status` represent local review state only.

Profit and inventory graph:

- `profit_snapshot.market_code` summarizes market-level profitability.
- `product_profit.product_uid` links profit to products.
- `inventory_snapshot.market_code` summarizes market-level inventory health.
- `inventory_stock.product_uid`, `inventory_risk.product_uid`, and `reorder_recommendation.product_uid` link inventory signals to products.

System health graph:

- `crawl_logs` records data ingestion or sync runs.
- `data_quality_report.source_table` points to the table being checked.

## 4. Unique Constraints

Current non-primary unique constraints:

- `products`: `platform + market_code + platform_product_id`
- `sellers`: `platform + market_code + platform_shop_id`
- `keywords`: `market_code + normalized_keyword`

## 5. Field Details

### `action_queue`

Purpose: suggested action queue. Approval state is local. No real platform action is executed.

Fields:

`action_id TEXT PK`, `package_id TEXT`, `created_at DATETIME`, `platform TEXT`, `market_code TEXT`, `target_type TEXT`, `target_id TEXT`, `action_type TEXT`, `before_value_json JSON`, `after_value_json JSON`, `recommendation_text TEXT`, `confidence_score REAL`, `risk_level TEXT`, `need_approval BOOLEAN`, `approval_status TEXT`, `status TEXT`, `approved_by TEXT`, `approved_at DATETIME`, `executed_at DATETIME`, `execution_result TEXT`, `error_log TEXT`

### `analysis_queue`

Purpose: analysis package queue for rules engine now and future AI analysis later.

Fields:

`analysis_id TEXT PK`, `package_id TEXT`, `created_at DATETIME`, `analysis_type TEXT`, `platform_scope_json JSON`, `date_range_start TEXT`, `date_range_end TEXT`, `package_path TEXT`, `quality_status TEXT`, `status TEXT`, `priority INTEGER`, `requested_questions_json JSON`, `exported_at DATETIME`, `analyzed_at DATETIME`, `notes TEXT`

### `approval_history`

Purpose: audit log of local approval decisions.

Fields:

`history_id TEXT PK`, `approval_id TEXT NOT NULL`, `action TEXT NOT NULL`, `reviewer TEXT`, `reviewed_at DATETIME`, `notes TEXT`

### `crawl_logs`

Purpose: sync and crawler run logging. Current project has no real crawler.

Fields:

`crawl_run_id TEXT PK`, `crawl_task_id TEXT`, `platform TEXT NOT NULL`, `market_code TEXT NOT NULL`, `started_at DATETIME`, `ended_at DATETIME`, `status TEXT`, `items_requested INTEGER`, `items_captured INTEGER`, `items_failed INTEGER`, `error_type TEXT`, `error_message TEXT`, `retry_count INTEGER`, `raw_output_path TEXT`, `notes TEXT`

### `data_quality_report`

Purpose: data quality warnings and pass/fail checks.

Fields:

`report_id TEXT PK`, `report_date DATE`, `platform TEXT`, `market_code TEXT`, `source_table TEXT`, `check_name TEXT`, `severity TEXT`, `status TEXT`, `metric_value REAL`, `threshold REAL`, `details TEXT`, `quality_status TEXT`, `generated_at DATETIME`

### `inventory_risk`

Purpose: SKU-level inventory risk alerts.

Fields:

`risk_id TEXT PK`, `reporting_date DATE NOT NULL`, `platform TEXT NOT NULL`, `market_code TEXT NOT NULL`, `product_uid TEXT NOT NULL`, `risk_type TEXT`, `risk_level TEXT`, `risk_reason TEXT`, `suggested_action TEXT`, `created_at DATETIME`

### `inventory_snapshot`

Purpose: market-level inventory health summary.

Fields:

`inventory_snapshot_id TEXT PK`, `reporting_date DATE NOT NULL`, `market_code TEXT NOT NULL`, `total_inventory_value REAL`, `inventory_turnover_days REAL`, `stock_health_score REAL`, `stockout_risk_count INTEGER`, `overstock_risk_count INTEGER`, `slow_moving_sku_count INTEGER`, `created_at DATETIME`

### `inventory_stock`

Purpose: SKU-level stock metrics.

Fields:

`inventory_item_id TEXT PK`, `reporting_date DATE NOT NULL`, `platform TEXT NOT NULL`, `market_code TEXT NOT NULL`, `product_uid TEXT NOT NULL`, `product_name TEXT`, `stock_qty INTEGER`, `daily_sales_avg REAL`, `days_of_stock REAL`, `reorder_point INTEGER`, `suggested_reorder_qty INTEGER`, `stock_status TEXT`, `inventory_value REAL`, `created_at DATETIME`

### `keywords`

Purpose: normalized keyword records.

Fields:

`keyword_uid TEXT PK`, `platform TEXT NOT NULL`, `market_code TEXT NOT NULL`, `language_code TEXT`, `normalized_keyword TEXT NOT NULL`, `original_keyword TEXT`, `category_hint TEXT`, `first_seen_at DATETIME`, `last_seen_at DATETIME`, `latest_result_count INTEGER`, `competition_level TEXT`, `seasonality_tag TEXT`, `status TEXT`, `notes TEXT`

Unique:

- `market_code + normalized_keyword`

### `market_score`

Purpose: keyword market score records.

Fields:

`market_score_id TEXT PK`, `score_date DATE NOT NULL`, `platform TEXT NOT NULL`, `market_code TEXT NOT NULL`, `keyword_uid TEXT NOT NULL`, `keyword TEXT`, `market_demand_score REAL`, `competition_score REAL`, `price_attractiveness_score REAL`, `trend_score REAL`, `macro_risk_score REAL`, `operation_quality_score REAL`, `total_score REAL`, `score_version TEXT`, `created_at DATETIME`, `notes TEXT`

### `opportunity_score`

Purpose: opportunity score records for product and keyword evaluation.

Fields:

`opportunity_score_id TEXT PK`, `score_date DATE NOT NULL`, `platform TEXT NOT NULL`, `market_code TEXT NOT NULL`, `keyword_uid TEXT NOT NULL`, `keyword TEXT`, `category_hint TEXT`, `market_demand_score REAL`, `competition_score REAL`, `profit_score REAL`, `content_gap_score REAL`, `logistics_risk_score REAL`, `policy_risk_score REAL`, `total_score REAL`, `recommendation_level TEXT`, `decision_notes TEXT`, `created_at DATETIME`

### `product_profit`

Purpose: product-level profit ranking and margin risk.

Fields:

`profit_item_id TEXT PK`, `reporting_date DATE NOT NULL`, `platform TEXT NOT NULL`, `market_code TEXT NOT NULL`, `product_uid TEXT NOT NULL`, `product_name TEXT`, `revenue REAL`, `procurement_cost REAL`, `advertising_cost REAL`, `logistics_cost REAL`, `platform_commission REAL`, `tax_cost REAL`, `cost REAL`, `gross_profit REAL`, `net_profit REAL`, `net_margin REAL`, `inventory_days REAL`, `risk_level TEXT`, `created_at DATETIME`

### `products`

Purpose: normalized product master table.

Fields:

`product_uid TEXT PK`, `platform TEXT NOT NULL`, `market_code TEXT NOT NULL`, `platform_product_id TEXT NOT NULL`, `platform_shop_id TEXT NOT NULL`, `product_url TEXT`, `title_current TEXT`, `price_amount REAL`, `market_currency TEXT`, `original_price_amount REAL`, `rating REAL`, `review_count INTEGER`, `sold_count_text TEXT`, `image_url TEXT`, `seller_uid TEXT`, `category_path TEXT`, `availability_status TEXT`, `upload_status TEXT`, `data_confidence REAL`, `first_seen_at DATETIME`, `last_seen_at DATETIME`, `platform_updated_at DATETIME`, `raw_product_id_latest TEXT`, `created_at DATETIME`, `updated_at DATETIME`

Unique:

- `platform + market_code + platform_product_id`

### `profit_snapshot`

Purpose: market-level profit and cost summary.

Fields:

`profit_snapshot_id TEXT PK`, `reporting_date DATE NOT NULL`, `market_code TEXT NOT NULL`, `yesterday_net_profit REAL`, `month_net_profit REAL`, `net_margin REAL`, `cash_flow REAL`, `inventory_turnover_days REAL`, `procurement_cost REAL`, `advertising_cost REAL`, `logistics_cost REAL`, `platform_commission REAL`, `tax_cost REAL`, `created_at DATETIME`

### `reorder_recommendation`

Purpose: display-only replenishment recommendations.

Fields:

`recommendation_id TEXT PK`, `reporting_date DATE NOT NULL`, `platform TEXT NOT NULL`, `market_code TEXT NOT NULL`, `product_uid TEXT NOT NULL`, `product_name TEXT`, `current_stock INTEGER`, `daily_sales_avg REAL`, `lead_time_days INTEGER`, `recommended_reorder_qty INTEGER`, `reorder_priority TEXT`, `decision_notes TEXT`, `created_at DATETIME`

### `sellers`

Purpose: normalized seller master table.

Fields:

`seller_uid TEXT PK`, `platform TEXT NOT NULL`, `market_code TEXT NOT NULL`, `platform_shop_id TEXT NOT NULL`, `shop_url TEXT`, `shop_name TEXT`, `followers INTEGER`, `rating REAL`, `product_count INTEGER`, `location TEXT`, `response_rate REAL`, `data_confidence REAL`, `first_seen_at DATETIME`, `last_seen_at DATETIME`, `platform_updated_at DATETIME`, `raw_seller_id_latest TEXT`, `is_active BOOLEAN`

Unique:

- `platform + market_code + platform_shop_id`

### `upload_queue`

Purpose: queued listing or content upload requests. Current project does not execute real upload.

Fields:

`upload_id TEXT PK`, `created_at DATETIME`, `platform TEXT`, `market_code TEXT`, `platform_product_id TEXT`, `platform_shop_id TEXT`, `upload_request_type TEXT`, `target_id TEXT`, `payload_json JSON`, `need_approval BOOLEAN`, `approval_status TEXT`, `status TEXT`, `approved_by TEXT`, `approved_at DATETIME`, `uploaded_at DATETIME`, `platform_response_json JSON`, `error_log TEXT`, `notes TEXT`

## 6. Current Schema Gaps

Tables from the broader OS vision that are not present in the current SQLite implementation yet:

- `source_registry`
- `crawl_tasks`
- `raw_products`
- `raw_sellers`
- `raw_keywords`
- `price_history`
- `sales_history`
- `review_history`
- `rank_history`
- `weather_data`
- `holiday_calendar`
- `policy_monitor`
- `exchange_rate`

These should be added through a migration plan before real crawler or connector development.
