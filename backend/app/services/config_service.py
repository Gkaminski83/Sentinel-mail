import os
import sqlite3
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from uuid import uuid4

from cryptography.fernet import Fernet, InvalidToken

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "accounts.db"
_lock = threading.Lock()


def _get_cipher() -> Fernet:
    key = os.environ.get("ACCOUNTS_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError("ACCOUNTS_ENCRYPTION_KEY environment variable is required")
    try:
        return Fernet(key)
    except ValueError as exc:
        raise RuntimeError("ACCOUNTS_ENCRYPTION_KEY must be a valid Fernet key") from exc


_cipher = _get_cipher()


def _ensure_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS accounts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT,
                imap_host TEXT NOT NULL,
                imap_port INTEGER NOT NULL DEFAULT 993,
                username TEXT NOT NULL,
                password_encrypted BLOB NOT NULL,
                secure INTEGER NOT NULL DEFAULT 1,
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT
            )
            """
        )
        existing_columns = {row[1] for row in conn.execute("PRAGMA table_info(accounts)")}
        def _add_column(name: str, ddl: str):
            if name not in existing_columns:
                conn.execute(f"ALTER TABLE accounts ADD COLUMN {ddl}")
                existing_columns.add(name)

        _add_column("email", "email TEXT")
        _add_column("enabled", "enabled INTEGER NOT NULL DEFAULT 1")
        _add_column("updated_at", "updated_at TEXT")

        if "email" not in existing_columns:
            conn.execute("UPDATE accounts SET email = username WHERE email IS NULL")
        if "updated_at" not in existing_columns:
            conn.execute("UPDATE accounts SET updated_at = created_at WHERE updated_at IS NULL")


def _get_connection():
    _ensure_db()
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _encrypt(password: str) -> bytes:
    return _cipher.encrypt(password.encode("utf-8"))


def _decrypt(token: bytes) -> str:
    try:
        return _cipher.decrypt(token).decode("utf-8")
    except InvalidToken as exc:
        raise RuntimeError("Failed to decrypt stored credential") from exc


def _row_to_account(row: sqlite3.Row, include_password: bool = False) -> Dict:
    account = {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"] or row["username"],
        "imap_host": row["imap_host"],
        "imap_port": row["imap_port"],
        "username": row["username"],
        "secure": bool(row["secure"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"] or row["created_at"],
        "enabled": bool(row["enabled"] if "enabled" in row.keys() else 1),
    }
    if include_password:
        account["password"] = _decrypt(row["password_encrypted"])
    return account


def list_accounts(include_password: bool = False, only_enabled: bool = False) -> List[Dict]:
    query = "SELECT * FROM accounts"
    params: List = []
    if only_enabled:
        query += " WHERE enabled = 1"
    query += " ORDER BY created_at DESC"
    with _get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_row_to_account(row, include_password=include_password) for row in rows]


def load_accounts(only_enabled: bool = False) -> List[Dict]:
    return list_accounts(include_password=True, only_enabled=only_enabled)


def add_account(account: Dict) -> Dict:
    account_id = str(uuid4())
    now = datetime.utcnow().isoformat()
    secure_flag = 1 if account.get("secure", True) else 0
    enabled_flag = 1 if account.get("enabled", True) else 0
    password_encrypted = _encrypt(account["password"])
    with _lock, _get_connection() as conn:
        conn.execute(
            """
            INSERT INTO accounts (id, name, email, imap_host, imap_port, username, password_encrypted, secure, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                account_id,
                account["name"],
                account.get("email") or account["username"],
                account["imap_host"],
                account.get("imap_port", 993),
                account["username"],
                password_encrypted,
                secure_flag,
                enabled_flag,
                now,
                now,
            ),
        )
    return {
        "id": account_id,
        "name": account["name"],
        "email": account.get("email") or account["username"],
        "imap_host": account["imap_host"],
        "imap_port": account.get("imap_port", 993),
        "username": account["username"],
        "secure": bool(secure_flag),
        "enabled": bool(enabled_flag),
        "created_at": now,
        "updated_at": now,
    }


def delete_account(account_id: str) -> bool:
    with _lock, _get_connection() as conn:
        cur = conn.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
        return cur.rowcount > 0


def get_account(account_id: str, include_password: bool = False) -> Optional[Dict]:
    with _get_connection() as conn:
        row = conn.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
    if not row:
        return None
    return _row_to_account(row, include_password=include_password)


def update_account(account_id: str, new_data: Dict) -> Optional[Dict]:
    fields = []
    values = []
    if "name" in new_data:
        fields.append("name = ?")
        values.append(new_data["name"])
    if "email" in new_data:
        fields.append("email = ?")
        values.append(new_data["email"])
    if "imap_host" in new_data:
        fields.append("imap_host = ?")
        values.append(new_data["imap_host"])
    if "imap_port" in new_data:
        fields.append("imap_port = ?")
        values.append(new_data["imap_port"])
    if "username" in new_data:
        fields.append("username = ?")
        values.append(new_data["username"])
    if "secure" in new_data:
        fields.append("secure = ?")
        values.append(1 if new_data["secure"] else 0)
    if "password" in new_data:
        fields.append("password_encrypted = ?")
        values.append(_encrypt(new_data["password"]))
    if "enabled" in new_data:
        fields.append("enabled = ?")
        values.append(1 if new_data["enabled"] else 0)

    if not fields:
        return get_account(account_id)

    fields.append("updated_at = ?")
    values.append(datetime.utcnow().isoformat())
    values.append(account_id)
    with _lock, _get_connection() as conn:
        cur = conn.execute(f"UPDATE accounts SET {', '.join(fields)} WHERE id = ?", values)
        if cur.rowcount == 0:
            return None
    return get_account(account_id)
