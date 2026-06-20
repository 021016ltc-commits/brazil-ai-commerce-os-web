from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "brazil_ai_commerce_os.db"


SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS tenants (
        tenant_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        plan_type TEXT NOT NULL CHECK(plan_type IN ('free', 'pro', 'enterprise')),
        created_at DATETIME NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS workspaces (
        workspace_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        shop_count INTEGER DEFAULT 0,
        created_at DATETIME NOT NULL,
        FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS tenant_users (
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'operator', 'viewer')),
        PRIMARY KEY (tenant_id, user_id),
        FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id),
        FOREIGN KEY(user_id) REFERENCES users(user_id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS sellers (
        seller_uid TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        market_code TEXT NOT NULL,
        platform_shop_id TEXT NOT NULL,
        shop_url TEXT,
        shop_name TEXT,
        followers INTEGER,
        rating REAL,
        product_count INTEGER,
        location TEXT,
        response_rate REAL,
        data_confidence REAL,
        first_seen_at DATETIME,
        last_seen_at DATETIME,
        platform_updated_at DATETIME,
        raw_seller_id_latest TEXT,
        is_active BOOLEAN,
        UNIQUE(platform, market_code, platform_shop_id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS products (
        product_uid TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        market_code TEXT NOT NULL,
        platform_product_id TEXT NOT NULL,
        platform_shop_id TEXT NOT NULL,
        product_url TEXT,
        title_current TEXT,
        price_amount REAL,
        market_currency TEXT,
        original_price_amount REAL,
        rating REAL,
        review_count INTEGER,
        sold_count_text TEXT,
        image_url TEXT,
        seller_uid TEXT,
        category_path TEXT,
        availability_status TEXT,
        upload_status TEXT,
        data_confidence REAL,
        first_seen_at DATETIME,
        last_seen_at DATETIME,
        platform_updated_at DATETIME,
        raw_product_id_latest TEXT,
        created_at DATETIME,
        updated_at DATETIME,
        UNIQUE(platform, market_code, platform_product_id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS keywords (
        keyword_uid TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        market_code TEXT NOT NULL,
        language_code TEXT,
        normalized_keyword TEXT NOT NULL,
        original_keyword TEXT,
        category_hint TEXT,
        first_seen_at DATETIME,
        last_seen_at DATETIME,
        latest_result_count INTEGER,
        competition_level TEXT,
        seasonality_tag TEXT,
        status TEXT,
        notes TEXT,
        UNIQUE(market_code, normalized_keyword)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS market_score (
        market_score_id TEXT PRIMARY KEY,
        score_date DATE NOT NULL,
        platform TEXT NOT NULL,
        market_code TEXT NOT NULL,
        keyword_uid TEXT NOT NULL,
        keyword TEXT,
        market_demand_score REAL,
        competition_score REAL,
        price_attractiveness_score REAL,
        trend_score REAL,
        macro_risk_score REAL,
        operation_quality_score REAL,
        total_score REAL,
        score_version TEXT,
        created_at DATETIME,
        notes TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS opportunity_score (
        opportunity_score_id TEXT PRIMARY KEY,
        score_date DATE NOT NULL,
        platform TEXT NOT NULL,
        market_code TEXT NOT NULL,
        keyword_uid TEXT NOT NULL,
        keyword TEXT,
        category_hint TEXT,
        market_demand_score REAL,
        competition_score REAL,
        profit_score REAL,
        content_gap_score REAL,
        logistics_risk_score REAL,
        policy_risk_score REAL,
        total_score REAL,
        recommendation_level TEXT,
        decision_notes TEXT,
        created_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS analysis_queue (
        analysis_id TEXT PRIMARY KEY,
        package_id TEXT,
        created_at DATETIME,
        analysis_type TEXT,
        platform_scope_json JSON,
        date_range_start TEXT,
        date_range_end TEXT,
        package_path TEXT,
        quality_status TEXT,
        status TEXT,
        priority INTEGER,
        requested_questions_json JSON,
        exported_at DATETIME,
        analyzed_at DATETIME,
        notes TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS action_queue (
        action_id TEXT PRIMARY KEY,
        package_id TEXT,
        created_at DATETIME,
        platform TEXT,
        market_code TEXT,
        product_id TEXT,
        target_type TEXT,
        target_id TEXT,
        action_type TEXT,
        suggested_by TEXT,
        before_value_json JSON,
        after_value_json JSON,
        recommendation_text TEXT,
        confidence_score REAL,
        risk_level TEXT,
        need_approval BOOLEAN,
        approval_status TEXT,
        status TEXT,
        approved_by TEXT,
        approved_at DATETIME,
        executed_at DATETIME,
        execution_result TEXT,
        error_log TEXT,
        simulate_result TEXT,
        expected_profit_change REAL,
        expected_risk_change REAL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS action_history (
        history_id TEXT PRIMARY KEY,
        action_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        actor_name TEXT,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME,
        simulate_result TEXT,
        FOREIGN KEY(action_id) REFERENCES action_queue(action_id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS upload_queue (
        upload_id TEXT PRIMARY KEY,
        created_at DATETIME,
        platform TEXT,
        market_code TEXT,
        platform_product_id TEXT,
        platform_shop_id TEXT,
        upload_request_type TEXT,
        target_id TEXT,
        payload_json JSON,
        need_approval BOOLEAN,
        approval_status TEXT,
        status TEXT,
        approved_by TEXT,
        approved_at DATETIME,
        uploaded_at DATETIME,
        platform_response_json JSON,
        error_log TEXT,
        notes TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS approval_history (
        history_id TEXT PRIMARY KEY,
        approval_id TEXT NOT NULL,
        action TEXT NOT NULL,
        reviewer TEXT,
        reviewed_at DATETIME,
        notes TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT,
        status TEXT,
        default_role TEXT,
        last_login_at DATETIME,
        created_at DATETIME,
        updated_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS roles (
        role_id TEXT PRIMARY KEY,
        role_name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_system BOOLEAN,
        permission_keys_json JSON,
        created_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS permissions (
        permission_id TEXT PRIMARY KEY,
        permission_key TEXT NOT NULL UNIQUE,
        resource TEXT NOT NULL,
        action TEXT NOT NULL,
        description TEXT,
        created_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS user_roles (
        user_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        assigned_at DATETIME,
        assigned_by TEXT,
        PRIMARY KEY (user_id, role_id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS operation_logs (
        log_id TEXT PRIMARY KEY,
        action_type TEXT NOT NULL,
        actor_user_id TEXT,
        actor_email TEXT,
        target_type TEXT,
        target_id TEXT,
        summary TEXT,
        status TEXT,
        created_at DATETIME,
        metadata_json JSON
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS shopee_orders (
        order_id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        sku TEXT,
        quantity INTEGER,
        price REAL,
        order_status TEXT,
        created_at DATETIME,
        synced_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS shopee_products (
        product_id TEXT PRIMARY KEY,
        title TEXT,
        price REAL,
        stock INTEGER,
        sales_count INTEGER,
        synced_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS shopee_inventory (
        product_id TEXT PRIMARY KEY,
        available_stock INTEGER,
        reserved_stock INTEGER,
        synced_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS decision_feedback (
        decision_id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        product_uid TEXT,
        platform TEXT,
        decision_state TEXT NOT NULL,
        user_action TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        source TEXT NOT NULL,
        created_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS decision_history (
        history_id TEXT PRIMARY KEY,
        decision_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_uid TEXT,
        platform TEXT,
        decision_state TEXT NOT NULL,
        user_action TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        is_profitable BOOLEAN,
        is_failed BOOLEAN,
        roi_real REAL,
        source TEXT NOT NULL,
        created_at DATETIME,
        FOREIGN KEY(decision_id) REFERENCES decision_feedback(decision_id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS decision_business_outcomes (
        outcome_id TEXT PRIMARY KEY,
        decision_id TEXT NOT NULL,
        actual_sales REAL,
        actual_profit REAL,
        roi_real REAL,
        stock_change INTEGER,
        conversion_rate REAL,
        is_profitable BOOLEAN,
        is_failed BOOLEAN,
        recorded_at DATETIME,
        FOREIGN KEY(decision_id) REFERENCES decision_feedback(decision_id)
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS decision_learning_adjustments (
        adjustment_id TEXT PRIMARY KEY,
        adjustment_type TEXT NOT NULL,
        target_key TEXT NOT NULL,
        previous_value REAL,
        suggested_value REAL,
        reason TEXT,
        generated_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS business_impact_results (
        impact_id TEXT PRIMARY KEY,
        action_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_uid TEXT,
        platform TEXT,
        action_type TEXT,
        action_status TEXT,
        expected_impact REAL,
        actual_impact REAL,
        expected_profit_change REAL,
        profit_before REAL,
        profit_after REAL,
        profit_delta REAL,
        stock_before INTEGER,
        stock_after INTEGER,
        stock_turnover_change REAL,
        gmv_before REAL,
        gmv_after REAL,
        gmv_delta REAL,
        attribution_note TEXT,
        measured_at DATETIME,
        source TEXT,
        created_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS profit_snapshot (
        profit_snapshot_id TEXT PRIMARY KEY,
        reporting_date DATE NOT NULL,
        market_code TEXT NOT NULL,
        yesterday_net_profit REAL,
        month_net_profit REAL,
        net_margin REAL,
        cash_flow REAL,
        inventory_turnover_days REAL,
        procurement_cost REAL,
        advertising_cost REAL,
        logistics_cost REAL,
        platform_commission REAL,
        tax_cost REAL,
        created_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS product_profit (
        profit_item_id TEXT PRIMARY KEY,
        reporting_date DATE NOT NULL,
        platform TEXT NOT NULL,
        market_code TEXT NOT NULL,
        product_uid TEXT NOT NULL,
        product_name TEXT,
        revenue REAL,
        procurement_cost REAL,
        advertising_cost REAL,
        logistics_cost REAL,
        platform_commission REAL,
        tax_cost REAL,
        cost REAL,
        gross_profit REAL,
        net_profit REAL,
        net_margin REAL,
        inventory_days REAL,
        risk_level TEXT,
        created_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS inventory_snapshot (
        inventory_snapshot_id TEXT PRIMARY KEY,
        reporting_date DATE NOT NULL,
        market_code TEXT NOT NULL,
        total_inventory_value REAL,
        inventory_turnover_days REAL,
        stock_health_score REAL,
        stockout_risk_count INTEGER,
        overstock_risk_count INTEGER,
        slow_moving_sku_count INTEGER,
        created_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS inventory_stock (
        inventory_item_id TEXT PRIMARY KEY,
        reporting_date DATE NOT NULL,
        platform TEXT NOT NULL,
        market_code TEXT NOT NULL,
        product_uid TEXT NOT NULL,
        product_name TEXT,
        stock_qty INTEGER,
        daily_sales_avg REAL,
        days_of_stock REAL,
        reorder_point INTEGER,
        suggested_reorder_qty INTEGER,
        stock_status TEXT,
        inventory_value REAL,
        created_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS inventory_risk (
        risk_id TEXT PRIMARY KEY,
        reporting_date DATE NOT NULL,
        platform TEXT NOT NULL,
        market_code TEXT NOT NULL,
        product_uid TEXT NOT NULL,
        risk_type TEXT,
        risk_level TEXT,
        risk_reason TEXT,
        suggested_action TEXT,
        created_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS reorder_recommendation (
        recommendation_id TEXT PRIMARY KEY,
        reporting_date DATE NOT NULL,
        platform TEXT NOT NULL,
        market_code TEXT NOT NULL,
        product_uid TEXT NOT NULL,
        product_name TEXT,
        current_stock INTEGER,
        daily_sales_avg REAL,
        lead_time_days INTEGER,
        recommended_reorder_qty INTEGER,
        reorder_priority TEXT,
        decision_notes TEXT,
        created_at DATETIME
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS crawl_logs (
        crawl_run_id TEXT PRIMARY KEY,
        crawl_task_id TEXT,
        platform TEXT NOT NULL,
        market_code TEXT NOT NULL,
        started_at DATETIME,
        ended_at DATETIME,
        status TEXT,
        items_requested INTEGER,
        items_captured INTEGER,
        items_failed INTEGER,
        error_type TEXT,
        error_message TEXT,
        retry_count INTEGER,
        raw_output_path TEXT,
        notes TEXT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS data_quality_report (
        report_id TEXT PRIMARY KEY,
        report_date DATE,
        platform TEXT,
        market_code TEXT,
        source_table TEXT,
        check_name TEXT,
        severity TEXT,
        status TEXT,
        metric_value REAL,
        threshold REAL,
        details TEXT,
        quality_status TEXT,
        generated_at DATETIME
    );
    """,
]


ACTION_QUEUE_COLUMNS = {
    "product_id": "TEXT",
    "suggested_by": "TEXT",
    "simulate_result": "TEXT",
    "expected_profit_change": "REAL",
    "expected_risk_change": "REAL",
}

DECISION_BUSINESS_OUTCOME_COLUMNS = {
    "is_profitable": "BOOLEAN",
    "is_failed": "BOOLEAN",
}

TENANT_SCOPED_TABLES = [
    "sellers",
    "products",
    "keywords",
    "market_score",
    "opportunity_score",
    "analysis_queue",
    "action_queue",
    "action_history",
    "upload_queue",
    "approval_history",
    "operation_logs",
    "shopee_orders",
    "shopee_products",
    "shopee_inventory",
    "decision_feedback",
    "decision_history",
    "decision_business_outcomes",
    "decision_learning_adjustments",
    "business_impact_results",
    "profit_snapshot",
    "product_profit",
    "inventory_snapshot",
    "inventory_stock",
    "inventory_risk",
    "reorder_recommendation",
    "crawl_logs",
    "data_quality_report",
]


def ensure_columns(conn: sqlite3.Connection, table_name: str, columns: dict[str, str]) -> None:
    existing_columns = {
        row[1]
        for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    }

    for column_name, column_type in columns.items():
        if column_name not in existing_columns:
            conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")


def init_database(db_path: Path) -> Path:
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
        conn.execute("PRAGMA foreign_keys = ON;")
        for statement in SCHEMA_STATEMENTS:
            conn.execute(statement)
        ensure_columns(conn, "action_queue", ACTION_QUEUE_COLUMNS)
        ensure_columns(conn, "decision_business_outcomes", DECISION_BUSINESS_OUTCOME_COLUMNS)
        for table_name in TENANT_SCOPED_TABLES:
            ensure_columns(conn, table_name, {"tenant_id": "TEXT NOT NULL DEFAULT 'demo_tenant'"})
        conn.commit()

    return db_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Initialize Brazil AI Commerce OS SQLite database.")
    parser.add_argument(
        "--db-path",
        type=Path,
        default=DEFAULT_DB_PATH,
        help="Target SQLite database path.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    db_path = init_database(args.db_path.resolve())
    print(f"Initialized SQLite database at: {db_path}")
    print("Created tables:")
    print("- tenants")
    print("- workspaces")
    print("- tenant_users")
    print("- products")
    print("- sellers")
    print("- keywords")
    print("- market_score")
    print("- opportunity_score")
    print("- analysis_queue")
    print("- action_queue")
    print("- action_history")
    print("- upload_queue")
    print("- approval_history")
    print("- users")
    print("- roles")
    print("- permissions")
    print("- user_roles")
    print("- operation_logs")
    print("- shopee_orders")
    print("- shopee_products")
    print("- shopee_inventory")
    print("- decision_feedback")
    print("- decision_history")
    print("- decision_business_outcomes")
    print("- decision_learning_adjustments")
    print("- business_impact_results")
    print("- profit_snapshot")
    print("- product_profit")
    print("- inventory_snapshot")
    print("- inventory_stock")
    print("- inventory_risk")
    print("- reorder_recommendation")
    print("- crawl_logs")
    print("- data_quality_report")


if __name__ == "__main__":
    main()
