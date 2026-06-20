from __future__ import annotations

import argparse
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "brazil_ai_commerce_os.db"
DEFAULT_TENANT_ID = "demo_tenant"
DEFAULT_ADMIN_USER_ID = "user_admin_001"
DEFAULT_ADMIN_ACCOUNT = "楼天城"
DEFAULT_ADMIN_PASSWORD_SALT = "kWz9jaoFAO9WYkpkQ4xjsQ=="
DEFAULT_ADMIN_PASSWORD_HASH = "g+D8BZ+QLxsgO3EJsdIIi0FchxyA5pvk5v/gLYDMl/g="
DEFAULT_ADMIN_PASSWORD_ALGORITHM = "pbkdf2_sha256_100000"


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
        updated_at DATETIME,
        password_hash TEXT,
        password_salt TEXT,
        password_algorithm TEXT
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

USER_SECURITY_COLUMNS = {
    "password_hash": "TEXT",
    "password_salt": "TEXT",
    "password_algorithm": "TEXT",
}

SYSTEM_PERMISSIONS = [
    ("perm_dashboard_view", "dashboard:view", "dashboard", "view", "查看运营总览。"),
    ("perm_command_center_view", "command_center:view", "command_center", "view", "查看运营指挥中心。"),
    ("perm_daily_ops_view", "daily_ops:view", "daily_ops", "view", "查看每日运营。"),
    ("perm_tasks_view", "tasks:view", "tasks", "view", "查看今日任务。"),
    ("perm_opportunities_view", "opportunities:view", "opportunities", "view", "查看机会中心。"),
    ("perm_analysis_view", "analysis:view", "analysis", "view", "查看数据分析。"),
    ("perm_profit_view", "profit:view", "profit", "view", "查看利润中心。"),
    ("perm_inventory_view", "inventory:view", "inventory", "view", "查看库存中心。"),
    ("perm_approvals_view", "approvals:view", "approvals", "view", "查看审批中心。"),
    ("perm_approvals_approve", "approvals:approve", "approvals", "approve", "执行本地审批状态流转。"),
    ("perm_actions_view", "actions:view", "actions", "view", "查看执行中心。"),
    ("perm_actions_approve", "actions:approve", "actions", "approve", "审批本地受控执行申请。"),
    ("perm_shopee_view", "shopee:view", "shopee", "view", "查看 Shopee 店铺。"),
    ("perm_decision_feedback_view", "decision_feedback:view", "decision_feedback", "view", "查看决策复盘。"),
    ("perm_business_impact_view", "business_impact:view", "business_impact", "view", "查看经营结果分析。"),
    ("perm_self_optimization_view", "self_optimization:view", "self_optimization", "view", "查看规则优化。"),
    ("perm_verification_view", "verification:view", "verification", "view", "查看系统验收。"),
    ("perm_users_view", "users:view", "users", "view", "查看用户和权限。"),
    ("perm_users_manage", "users:manage", "users", "manage", "创建和修改本地用户。"),
    ("perm_tenants_view", "tenants:view", "tenants", "view", "查看工作空间。"),
    ("perm_system_view", "system:view", "system", "view", "查看系统设置。"),
    ("perm_system_health_view", "system_health:view", "system_health", "view", "查看系统健康。"),
]

ROLE_PERMISSION_KEYS = {
    "admin": [permission[1] for permission in SYSTEM_PERMISSIONS],
    "operator": [
        "dashboard:view",
        "command_center:view",
        "daily_ops:view",
        "tasks:view",
        "opportunities:view",
        "analysis:view",
        "approvals:view",
        "approvals:approve",
        "actions:view",
        "shopee:view",
        "decision_feedback:view",
        "business_impact:view",
        "self_optimization:view",
        "verification:view",
    ],
    "buyer": ["dashboard:view", "command_center:view", "daily_ops:view", "tasks:view", "inventory:view"],
    "finance": ["dashboard:view", "command_center:view", "profit:view"],
    "viewer": [permission[1] for permission in SYSTEM_PERMISSIONS if permission[3] == "view"],
}

ROLE_DESCRIPTIONS = {
    "admin": "系统管理员，拥有全部查看、管理和审批权限。",
    "operator": "运营角色，可处理运营总览、今日任务、机会中心、数据分析和审批中心。",
    "buyer": "采购角色，可查看运营总览、今日任务和库存中心。",
    "finance": "财务角色，可查看运营总览和利润中心。",
    "viewer": "只读角色，可查看页面但不能管理用户或执行审批。",
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


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def seed_system_identity(conn: sqlite3.Connection) -> None:
    created_at = utc_now()

    conn.execute(
        """
        INSERT OR IGNORE INTO tenants (tenant_id, name, plan_type, created_at)
        VALUES (?, ?, ?, ?)
        """,
        (DEFAULT_TENANT_ID, "Brazil Internal Workspace", "free", created_at),
    )
    conn.execute(
        """
        INSERT OR IGNORE INTO workspaces (workspace_id, tenant_id, name, shop_count, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        ("workspace_demo_default", DEFAULT_TENANT_ID, "默认工作空间", 1, created_at),
    )

    conn.executemany(
        """
        INSERT OR IGNORE INTO permissions (
            permission_id, permission_key, resource, action, description, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [(*permission, created_at) for permission in SYSTEM_PERMISSIONS],
    )

    for role_id, permission_keys in ROLE_PERMISSION_KEYS.items():
        conn.execute(
            """
            INSERT INTO roles (role_id, role_name, description, is_system, permission_keys_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(role_id) DO UPDATE SET
                permission_keys_json = excluded.permission_keys_json,
                description = excluded.description,
                is_system = excluded.is_system
            """,
            (
                role_id,
                role_id,
                ROLE_DESCRIPTIONS[role_id],
                1,
                json.dumps(permission_keys, ensure_ascii=False),
                created_at,
            ),
        )

    users_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if users_count == 0:
        conn.execute(
            """
            INSERT OR IGNORE INTO users (
                user_id, email, display_name, status, default_role,
                last_login_at, created_at, updated_at,
                password_hash, password_salt, password_algorithm
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                DEFAULT_ADMIN_USER_ID,
                DEFAULT_ADMIN_ACCOUNT,
                DEFAULT_ADMIN_ACCOUNT,
                "active",
                "admin",
                None,
                created_at,
                created_at,
                DEFAULT_ADMIN_PASSWORD_HASH,
                DEFAULT_ADMIN_PASSWORD_SALT,
                DEFAULT_ADMIN_PASSWORD_ALGORITHM,
            ),
        )
        conn.execute(
            """
            INSERT OR IGNORE INTO user_roles (user_id, role_id, assigned_at, assigned_by)
            VALUES (?, ?, ?, ?)
            """,
            (DEFAULT_ADMIN_USER_ID, "admin", created_at, "system"),
        )
        conn.execute(
            """
            INSERT OR IGNORE INTO tenant_users (tenant_id, user_id, role)
            VALUES (?, ?, ?)
            """,
            (DEFAULT_TENANT_ID, DEFAULT_ADMIN_USER_ID, "owner"),
        )
        conn.execute(
            """
            INSERT OR IGNORE INTO operation_logs (
                log_id, action_type, actor_user_id, actor_email, target_type,
                target_id, summary, status, created_at, metadata_json, tenant_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "oplog_internal_admin_seeded",
                "admin_seeded",
                "system",
                "system@local",
                "users",
                DEFAULT_ADMIN_USER_ID,
                "内部管理员账号已准备。",
                "success",
                created_at,
                json.dumps({"mode": "internal_admin_bootstrap"}, ensure_ascii=False),
                DEFAULT_TENANT_ID,
            ),
        )
    else:
        conn.execute(
            """
            UPDATE users
               SET password_hash = COALESCE(password_hash, ?),
                   password_salt = COALESCE(password_salt, ?),
                   password_algorithm = COALESCE(password_algorithm, ?),
                   status = CASE WHEN status IS NULL THEN 'active' ELSE status END,
                   default_role = CASE WHEN default_role IS NULL THEN 'admin' ELSE default_role END,
                   updated_at = COALESCE(updated_at, ?)
             WHERE user_id = ?
                OR email = ?
                OR display_name = ?
            """,
            (
                DEFAULT_ADMIN_PASSWORD_HASH,
                DEFAULT_ADMIN_PASSWORD_SALT,
                DEFAULT_ADMIN_PASSWORD_ALGORITHM,
                created_at,
                DEFAULT_ADMIN_USER_ID,
                DEFAULT_ADMIN_ACCOUNT,
                DEFAULT_ADMIN_ACCOUNT,
            ),
        )
        admin_exists = conn.execute(
            "SELECT user_id FROM users WHERE user_id = ? OR email = ? OR display_name = ? LIMIT 1",
            (DEFAULT_ADMIN_USER_ID, DEFAULT_ADMIN_ACCOUNT, DEFAULT_ADMIN_ACCOUNT),
        ).fetchone()
        if admin_exists:
            admin_user_id = admin_exists[0]
            conn.execute(
                """
                INSERT OR IGNORE INTO user_roles (user_id, role_id, assigned_at, assigned_by)
                VALUES (?, ?, ?, ?)
                """,
                (admin_user_id, "admin", created_at, "system"),
            )
            conn.execute(
                """
                INSERT OR IGNORE INTO tenant_users (tenant_id, user_id, role)
                VALUES (?, ?, ?)
                """,
                (DEFAULT_TENANT_ID, admin_user_id, "owner"),
            )


def init_database(db_path: Path) -> Path:
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
        conn.execute("PRAGMA foreign_keys = ON;")
        for statement in SCHEMA_STATEMENTS:
            conn.execute(statement)
        ensure_columns(conn, "action_queue", ACTION_QUEUE_COLUMNS)
        ensure_columns(conn, "decision_business_outcomes", DECISION_BUSINESS_OUTCOME_COLUMNS)
        ensure_columns(conn, "users", USER_SECURITY_COLUMNS)
        for table_name in TENANT_SCOPED_TABLES:
            ensure_columns(conn, table_name, {"tenant_id": "TEXT NOT NULL DEFAULT 'demo_tenant'"})
        seed_system_identity(conn)
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
