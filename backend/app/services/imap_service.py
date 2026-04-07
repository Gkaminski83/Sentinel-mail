import logging
import re
from collections import Counter, defaultdict
from contextlib import suppress
from datetime import datetime, timedelta, timezone
from email import message_from_bytes
from email.header import decode_header, make_header
from email.policy import default
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
from typing import Any, Dict, Iterable, List, Tuple

import bleach

from imapclient import IMAPClient

from app.services import config_service

logger = logging.getLogger(__name__)

DEFAULT_FOLDER = "INBOX"
TRASH_FOLDER = "Trash"
SPAM_FOLDER = "Spam"
SPAM_FLAGS = ("\\Junk", "\\Spam")

ALLOWED_HTML_TAGS = sorted(
    set(
        bleach.sanitizer.ALLOWED_TAGS
        | {
            "p",
            "pre",
            "blockquote",
            "img",
            "hr",
            "span",
            "br",
            "strong",
            "em",
            "ul",
            "ol",
            "li",
            "table",
            "thead",
            "tbody",
            "tr",
            "th",
            "td",
            "code",
        }
    )
)

ALLOWED_HTML_ATTRS = {
    **bleach.sanitizer.ALLOWED_ATTRIBUTES,
    "a": ["href", "title", "target", "rel"],
    "img": ["src", "alt", "title", "width", "height"],
    "td": ["colspan", "rowspan", "align"],
    "th": ["colspan", "rowspan", "align"],
    "span": ["style"],
}

ALLOWED_HTML_PROTOCOLS = ["http", "https", "mailto", "cid", "data"]

_BLOCK_TAG_RE = re.compile(r"<(script|style)[^>]*>.*?<\/\s*\1\s*>", re.IGNORECASE | re.DOTALL)


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


def _decode_text_part(part) -> str:
    payload = part.get_payload(decode=True)
    if isinstance(payload, bytes):
        charset = part.get_content_charset() or "utf-8"
        try:
            return payload.decode(charset, errors="ignore")
        except LookupError:
            return payload.decode("utf-8", errors="ignore")
    content = part.get_payload()
    if isinstance(content, str):
        return content
    return ""


def _sanitize_html(content: str) -> str:
    stripped = _BLOCK_TAG_RE.sub("", content)
    return bleach.clean(
        stripped,
        tags=ALLOWED_HTML_TAGS,
        attributes=ALLOWED_HTML_ATTRS,
        protocols=ALLOWED_HTML_PROTOCOLS,
        strip=True,
    )


def _extract_email_content(raw_bytes: bytes) -> Dict[str, Any]:
    try:
        message = message_from_bytes(raw_bytes, policy=default)
    except Exception:
        decoded = raw_bytes.decode(errors="ignore")
        return {"text_body": decoded, "html_body": None, "attachments": []}

    text_body: str | None = None
    html_body: str | None = None
    attachments: List[Dict[str, Any]] = []

    for index, part in enumerate(message.walk()):
        content_type = part.get_content_type()
        disposition = part.get_content_disposition()
        filename = part.get_filename()

        if disposition in {"attachment", "inline"} and (filename or disposition == "attachment"):
            payload = part.get_payload(decode=True) or b""
            attachments.append(
                {
                    "id": f"att-{index}",
                    "filename": filename or f"attachment-{index}",
                    "content_type": content_type,
                    "size": len(payload),
                    "disposition": disposition or "attachment",
                }
            )
            continue

        if content_type == "text/plain" and text_body is None:
            text_body = _decode_text_part(part).strip()
            continue

        if content_type == "text/html" and html_body is None:
            html_body = _sanitize_html(_decode_text_part(part))
            # also provide fallback plain text if missing
            if not text_body:
                text_body = _html_to_text(html_body)
            continue

    if text_body is None and not message.is_multipart():
        text_body = _decode_text_part(message).strip()
        if message.get_content_subtype() == "html":
            html_body = _sanitize_html(text_body)
            text_body = _html_to_text(html_body)

    return {
        "text_body": text_body or "",
        "html_body": html_body,
        "attachments": attachments,
    }


def _bodystructure_has_attachments(structure: Any) -> bool:
    if not structure:
        return False

    def _normalize(value: Any) -> Any:
        if isinstance(value, bytes):
            with suppress(Exception):
                return value.decode(errors="ignore")
        return value

    def _walk(node: Any) -> bool:
        node = _normalize(node)
        if isinstance(node, dict):
            for child in node.values():
                if _walk(child):
                    return True
            return False
        if isinstance(node, (list, tuple)):
            for child in node:
                if _walk(child):
                    return True
            return False
        if isinstance(node, str):
            upper = node.upper()
            if upper in {"ATTACHMENT", "INLINE", "FILENAME", "NAME"}:
                return True
        return False

    return _walk(structure)


def _decode_bytes(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        with suppress(Exception):
            return value.decode(errors="ignore").strip()
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def _decode_references(raw_references: Any) -> List[str]:
    if not raw_references:
        return []
    if isinstance(raw_references, (list, tuple)):
        values = raw_references
    else:
        values = [raw_references]
    decoded: List[str] = []
    for ref in values:
        decoded_value = _decode_bytes(ref)
        if decoded_value:
            decoded.append(decoded_value)
    return decoded


def _ensure_aware_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _parse_date_filter(value: str | None, *, end_of_day: bool = False) -> datetime | None:
    if not value:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    normalized = normalized.replace("Z", "+00:00")
    parsed: datetime | None = None
    with suppress(ValueError):
        parsed = datetime.fromisoformat(normalized)
    if parsed is None:
        with suppress(ValueError):
            parsed = datetime.strptime(normalized, "%Y-%m-%d")
    if parsed is None:
        return None
    parsed = _ensure_aware_datetime(parsed)
    if end_of_day:
        parsed = parsed + timedelta(days=1) - timedelta(microseconds=1)
    return parsed


def _serialize_message_summary(message: Dict[str, Any]) -> Dict[str, Any]:
    serialized = dict(message)
    date_value = serialized.get("date")
    if isinstance(date_value, datetime):
        serialized["date"] = _ensure_aware_datetime(date_value).isoformat()
    return serialized


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

    def fetch_latest_emails(
        self,
        limit: int = 50,
        folder: str = DEFAULT_FOLDER,
        page: int = 1,
        query: str | None = None,
        sender: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        has_attachment: bool | None = None,
    ) -> Dict[str, Any]:
        accounts = config_service.load_accounts(only_enabled=True)
        all_messages: List[Dict[str, Any]] = []
        failures: List[Dict[str, str]] = []
        normalized_query = query.strip().lower() if query else None
        sender_filter = sender.strip().lower() if sender else None
        start_date = _parse_date_filter(date_from)
        end_date = _parse_date_filter(date_to, end_of_day=True)
        per_account_fetch = max(limit * (page + 2), limit)
        for account in accounts:
            try:
                client = self._connect(account)
                client.select_folder(folder)
                uids = client.search(["ALL"])
                if not uids:
                    client.logout()
                    continue
                messages = uids[-per_account_fetch:]
                response = client.fetch(
                    messages,
                    ["ENVELOPE", "BODY.PEEK[TEXT]<0.200>", "BODY.PEEK[]<0.200>", "BODYSTRUCTURE"],
                )
                for msgid, data in response.items():
                    envelope = data[b"ENVELOPE"]
                    snippet_bytes = (
                        data.get(b"BODY[TEXT]<0.200>")
                        or data.get(b"BODY[]<0.200>")
                        or data.get(b"BODY[]", b"")
                    )
                    snippet = snippet_bytes.decode(errors="ignore").strip()
                    structure = data.get(b"BODYSTRUCTURE")
                    has_attachments = _bodystructure_has_attachments(structure)
                    subject_value = envelope.subject
                    if isinstance(subject_value, bytes):
                        subject_value = subject_value.decode(errors="ignore")
                    subject = str(make_header(decode_header(subject_value))) if subject_value else ""
                    sender = envelope.from_[0]
                    from_addr = f"{sender.mailbox.decode()}@{sender.host.decode()}"
                    sender_name_value = sender.name
                    if isinstance(sender_name_value, bytes):
                        sender_name_value = sender_name_value.decode(errors="ignore")
                    sender_name = (
                        str(make_header(decode_header(sender_name_value))) if sender_name_value else ""
                    )
                    display_from = f"{sender_name} <{from_addr}>" if sender_name else from_addr
                    message_id_header = _decode_bytes(envelope.message_id)
                    in_reply_to = _decode_bytes(envelope.in_reply_to)
                    references = _decode_references(envelope.references)

                    thread_candidates = [references[0] if references else None, in_reply_to, message_id_header]
                    thread_id = next((candidate for candidate in thread_candidates if candidate), None)

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
                    date = _ensure_aware_datetime(date)
                    encoded_id = self._encode_message_id(account["id"], folder, msgid)
                    normalized_thread_id = thread_id or message_id_header or encoded_id
                    all_messages.append(
                        {
                            "id": encoded_id,
                            "account_id": account["id"],
                            "account": account["name"],
                            "folder": folder,
                            "subject": subject,
                            "from": display_from,
                            "from_email": from_addr,
                            "date": date,
                            "has_attachments": has_attachments,
                            "message_id_header": message_id_header,
                            "thread_id": normalized_thread_id,
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
        if not all_messages and failures and accounts:
            failure_strings = ", ".join(
                f"{failure['account']}: {failure['error']}" for failure in failures
            )
            raise RuntimeError(f"All accounts failed to sync: {failure_strings}")
        attachment_filter = has_attachment if has_attachment in {True, False} else None

        def matches_filters(message: Dict[str, Any]) -> bool:
            if start_date and message["date"] < start_date:
                return False
            if end_date and message["date"] > end_date:
                return False
            if sender_filter:
                sender_value = " ".join(
                    filter(None, [message.get("from"), message.get("from_email"), message.get("account")])
                ).lower()
                if sender_filter not in sender_value:
                    return False
            if attachment_filter is True and not message.get("has_attachments"):
                return False
            if attachment_filter is False and message.get("has_attachments"):
                return False
            if normalized_query:
                subject = message.get("subject", "")
                sender_text = message.get("from", "")
                snippet = message.get("snippet", "")
                account_name = message.get("account", "")
                haystack = " ".join(filter(None, [subject, sender_text, snippet, account_name])).lower()
                if normalized_query not in haystack:
                    return False
            return True

        filtered_messages = [message for message in all_messages if matches_filters(message)]
        filtered_messages.sort(key=lambda x: x["date"], reverse=True)
        thread_sizes = Counter(message["thread_id"] for message in filtered_messages)
        for message in filtered_messages:
            message["thread_size"] = thread_sizes.get(message["thread_id"], 1)
        total = len(filtered_messages)
        start = (page - 1) * limit
        end = start + limit
        page_items = filtered_messages[start:end]
        has_next = total > end
        return {
            "messages": [_serialize_message_summary(message) for message in page_items],
            "page": page,
            "page_size": limit,
            "has_next": has_next,
            "total": total,
        }

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
        body = _extract_email_content(raw_body_bytes)
        client.logout()
        return body

    def fetch_attachment(self, account_id: str, folder: str, msgid: str, attachment_id: str):
        accounts = config_service.load_accounts()
        account = next((a for a in accounts if a["id"] == account_id), None)
        if not account:
            return None

        try:
            _, index_str = attachment_id.split("-", 1)
            target_index = int(index_str)
        except (ValueError, IndexError):
            raise ValueError("Invalid attachment id")

        client = self._connect(account)
        try:
            client.select_folder(folder)
            response = client.fetch([int(msgid)], ["BODY[]"])
            raw_body = response[int(msgid)][b"BODY[]"]
            raw_body_bytes = raw_body.encode() if isinstance(raw_body, str) else raw_body
            message = message_from_bytes(raw_body_bytes, policy=default)

            for index, part in enumerate(message.walk()):
                disposition = part.get_content_disposition()
                filename = part.get_filename()
                if disposition in {"attachment", "inline"} and (filename or disposition == "attachment"):
                    if index == target_index:
                        payload = part.get_payload(decode=True) or b""
                        return {
                            "filename": filename or f"attachment-{index}",
                            "content_type": part.get_content_type(),
                            "data": payload,
                        }
        finally:
            client.logout()

        return None

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
