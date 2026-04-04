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
                imap_host TEXT NOT NULL,
                imap_port INTEGER NOT NULL DEFAULT 993,
                username TEXT NOT NULL,
                password_encrypted BLOB NOT NULL,
                secure INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
            """
        )


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
        "imap_host": row["imap_host"],
        "imap_port": row["imap_port"],
        "username": row["username"],
        "secure": bool(row["secure"]),
        "created_at": row["created_at"],
    }
    if include_password:
        account["password"] = _decrypt(row["password_encrypted"])
    return account


def list_accounts(include_password: bool = False) -> List[Dict]:
    with _get_connection() as conn:
        rows = conn.execute("SELECT * FROM accounts ORDER BY created_at DESC").fetchall()
    return [_row_to_account(row, include_password=include_password) for row in rows]


def load_accounts() -> List[Dict]:
    return list_accounts(include_password=True)


def add_account(account: Dict) -> Dict:
    account_id = str(uuid4())
    now = datetime.utcnow().isoformat()
    secure_flag = 1 if account.get("secure", True) else 0
    password_encrypted = _encrypt(account["password"])
    with _lock, _get_connection() as conn:
        conn.execute(
            """
            INSERT INTO accounts (id, name, imap_host, imap_port, username, password_encrypted, secure, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                account_id,
                account["name"],
                account["imap_host"],
                account.get("imap_port", 993),
                account["username"],
                password_encrypted,
                secure_flag,
                now,
            ),
        )
    return {
        "id": account_id,
        "name": account["name"],
        "imap_host": account["imap_host"],
        "imap_port": account.get("imap_port", 993),
        "username": account["username"],
        "secure": bool(secure_flag),
        "created_at": now,
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

    if not fields:
        return get_account(account_id)

    values.append(account_id)
    with _lock, _get_connection() as conn:
        cur = conn.execute(f"UPDATE accounts SET {', '.join(fields)} WHERE id = ?", values)
        if cur.rowcount == 0:
            return None
    return get_account(account_id)
