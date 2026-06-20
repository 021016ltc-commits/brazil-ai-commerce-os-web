from __future__ import annotations

from init_db import DEFAULT_DB_PATH, init_database


def main() -> None:
    db_path = init_database(DEFAULT_DB_PATH.resolve())
    print(f"Prepared internal user seed at: {db_path}")
    print("- default active admin is available when the users table is empty")
    print("- no business mock data was inserted")


if __name__ == "__main__":
    main()
