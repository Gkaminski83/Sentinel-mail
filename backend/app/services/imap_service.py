import logging
from collections import defaultdict
from contextlib import suppress
from datetime import datetime
from email import message_from_bytes
from email.header import decode_header, make_header
from email.policy import default
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
from typing import Any, Dict, Iterable, List, Tuple

from imapclient import IMAPClient

from app.services import config_service

logger = logging.getLogger(__name__)

DEFAULT_FOLDER = "INBOX"
TRASH_FOLDER = "Trash"
SPAM_FOLDER = "Spam"
SPAM_FLAGS = ("\\Junk", "\\Spam")

class _HTMLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self._chunks: List[str] = []

    def handle_data(self, data: str):
        if data:
            self._chunks.append(data)

    def get_text(self) -> str:
        return unescape("".join(self._chunks))


def _html_to_text(content: str) -> str:
    stripper = _HTMLStripper()
    stripper.feed(content)
    stripper.close()
    return stripper.get_text()


def _extract_text_from_email(raw_bytes: bytes) -> str:
    try:
        message = message_from_bytes(raw_bytes, policy=default)
    except Exception:
        return raw_bytes.decode(errors="ignore")

    body = message.get_body(preferencelist=("plain", "html"))
    if body:
        content = body.get_content()
        if body.get_content_type() == "text/html":
            return _html_to_text(content)
        return content

    if message.is_multipart():
        for part in message.walk():
            if part.get_content_maintype() == "text":
                content = part.get_content()
                if part.get_content_subtype() == "html":
                    return _html_to_text(content)
                return content

    payload = message.get_payload(decode=True)
    if isinstance(payload, bytes):
        charset = message.get_content_charset() or "utf-8"
        try:
            text = payload.decode(charset, errors="ignore")
        except LookupError:
            text = payload.decode("utf-8", errors="ignore")
        if message.get_content_subtype() == "html":
            return _html_to_text(text)
        return text
    if isinstance(payload, str):
        return payload
    return ""


class IMAPService:
    def _connect(self, account: Dict[str, Any]):
        client = IMAPClient(
            account["imap_host"],
            port=account.get("imap_port", 993),
            use_uid=True,
            ssl=account.get("secure", True),
        )
        client.login(account["username"], account["password"])
        return client

    @staticmethod
    def _encode_message_id(account_id: str, folder: str, uid: int) -> str:
        return f"{account_id}|{folder}|{uid}"

    @staticmethod
    def decode_message_id(message_id: str) -> Tuple[str, str, str]:
        parts = message_id.split("|", 2)
        if len(parts) != 3:
            raise ValueError("Invalid message id")
        return parts[0], parts[1], parts[2]

    def fetch_latest_emails(self, limit: int = 50, folder: str = DEFAULT_FOLDER) -> List[Dict[str, Any]]:
        accounts = config_service.load_accounts(only_enabled=True)
        all_messages: List[Dict[str, Any]] = []
        failures: List[Dict[str, str]] = []
        for account in accounts:
            try:
                client = self._connect(account)
                client.select_folder(folder)
                messages = client.search(["ALL"])[-limit:]
                response = client.fetch(
                    messages,
                    ["ENVELOPE", "BODY.PEEK[TEXT]<0.200>", "BODY.PEEK[]<0.200>"],
                )
                for msgid, data in response.items():
                    envelope = data[b"ENVELOPE"]
                    snippet_bytes = (
                        data.get(b"BODY[TEXT]<0.200>")
                        or data.get(b"BODY[]<0.200>")
                        or data.get(b"BODY[]", b"")
                    )
                    snippet = snippet_bytes.decode(errors="ignore").strip()
                    subject_value = envelope.subject
                    if isinstance(subject_value, bytes):
                        subject_value = subject_value.decode(errors="ignore")
                    subject = str(make_header(decode_header(subject_value))) if subject_value else ""
                    sender = envelope.from_[0]
                    from_addr = f"{sender.mailbox.decode()}@{sender.host.decode()}"

                    date_value = envelope.date
                    if isinstance(date_value, bytes):
                        date_value = date_value.decode(errors="ignore")

                    if isinstance(date_value, datetime):
                        date = date_value
                    elif isinstance(date_value, str):
                        date = parsedate_to_datetime(date_value)
                    else:
                        # IMAP servers normally return str or datetime; fallback prevents crashes if missing
                        date = datetime.utcnow()
                    all_messages.append(
                        {
                            "id": self._encode_message_id(account["id"], folder, msgid),
                            "account_id": account["id"],
                            "account": account["name"],
                            "folder": folder,
                            "subject": subject,
                            "from": from_addr,
                            "date": date.isoformat(),
                            "snippet": snippet,
                        }
                    )
                client.logout()
            except Exception as exc:  # pragma: no cover - depends on external IMAP servers
                logger.warning(
                    "Failed to fetch emails for account %s (%s): %s",
                    account.get("name"),
                    account.get("id"),
                    exc,
                    exc_info=exc,
                )
                failures.append(
                    {
                        "account_id": account.get("id", "unknown"),
                        "account": account.get("name", account.get("username", "unknown")),
                        "error": str(exc),
                    }
                )
                continue
        all_messages.sort(key=lambda x: x["date"], reverse=True)
        if not all_messages and failures and accounts:
            failure_strings = ", ".join(
                f"{failure['account']}: {failure['error']}" for failure in failures
            )
            raise RuntimeError(f"All accounts failed to sync: {failure_strings}")
        return all_messages

    def fetch_email_body(self, account_id: str, folder: str, msgid: str):
        accounts = config_service.load_accounts()
        account = next((a for a in accounts if a["id"] == account_id), None)
        if not account:
            return None
        client = self._connect(account)
        client.select_folder(folder)
        response = client.fetch([int(msgid)], ["BODY[]"])
        raw_body = response[int(msgid)][b"BODY[]"]
        if isinstance(raw_body, str):
            raw_body_bytes = raw_body.encode()
        else:
            raw_body_bytes = raw_body
        body = _extract_text_from_email(raw_body_bytes)
        client.logout()
        return body

    def get_accounts(self):
        return config_service.list_accounts()

    def move_messages(self, message_ids: Iterable[str], destination: str):
        return self._apply_imap_action(message_ids, destination_folder=destination, action="move")

    def copy_messages(self, message_ids: Iterable[str], destination: str):
        return self._apply_imap_action(message_ids, destination_folder=destination, action="copy")

    def delete_messages(self, message_ids: Iterable[str], permanent: bool = False):
        if permanent:
            return self._apply_imap_action(message_ids, action="delete", permanent=True)
        return self.move_messages(message_ids, TRASH_FOLDER)

    def mark_spam(self, message_ids: Iterable[str]):
        return self._apply_imap_action(message_ids, destination_folder=SPAM_FOLDER, action="spam")

    def _apply_imap_action(
        self,
        message_ids: Iterable[str],
        destination_folder: str | None = None,
        action: str = "move",
        permanent: bool = False,
    ):
        grouped: Dict[str, Dict[str, List[int]]] = defaultdict(lambda: defaultdict(list))
        for message_id in message_ids:
            account_id, folder, uid = self.decode_message_id(message_id)
            grouped[account_id][folder].append(int(uid))

        results = {"processed": 0, "errors": []}
        accounts = {acc["id"]: acc for acc in config_service.load_accounts(only_enabled=True)}
        for account_id, folders in grouped.items():
            account = accounts.get(account_id)
            if not account:
                results["errors"].append({"account_id": account_id, "error": "Account not found"})
                continue
            client = self._connect(account)
            try:
                for folder, uids in folders.items():
                    client.select_folder(folder)
                    if action == "move":
                        if not destination_folder:
                            raise ValueError("Destination folder is required for move action")
                        client.move(uids, destination_folder)
                    elif action == "copy":
                        if not destination_folder:
                            raise ValueError("Destination folder is required for copy action")
                        client.copy(uids, destination_folder)
                    elif action == "delete":
                        if destination_folder:
                            client.move(uids, destination_folder)
                        else:
                            client.delete_messages(uids)
                            if permanent:
                                client.expunge()
                    elif action == "spam":
                        if not destination_folder:
                            raise ValueError("Destination folder is required for spam action")
                        client.move(uids, SPAM_FOLDER)
                        for flag in SPAM_FLAGS:
                            with suppress(Exception):
                                client.add_flags(uids, flag)
                    else:
                        raise ValueError("Unsupported action")
                    results["processed"] += len(uids)
            finally:
                client.logout()
        return results
