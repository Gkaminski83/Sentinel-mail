import logging
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List

from imapclient import IMAPClient

from app.services import config_service


logger = logging.getLogger(__name__)


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

    def fetch_latest_emails(self, limit: int = 50) -> List[Dict[str, Any]]:
        accounts = config_service.load_accounts(only_enabled=True)
        all_messages: List[Dict[str, Any]] = []
        failures: List[Dict[str, str]] = []
        for account in accounts:
            try:
                client = self._connect(account)
                client.select_folder("INBOX")
                messages = client.search(["ALL"])[-limit:]
                response = client.fetch(messages, ["ENVELOPE", "BODY.PEEK[]<0.200>"])
                for msgid, data in response.items():
                    envelope = data[b"ENVELOPE"]
                    snippet = data.get(b"BODY[]", b"").decode(errors="ignore")[:200]
                    subject = str(make_header(decode_header(envelope.subject))) if envelope.subject else ""
                    sender = envelope.from_[0]
                    from_addr = f"{sender.mailbox.decode()}@{sender.host.decode()}"
                    date = parsedate_to_datetime(envelope.date)
                    all_messages.append(
                        {
                            "id": f"{account['id']}|{msgid}",
                            "account_id": account["id"],
                            "account": account["name"],
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

    def fetch_email_body(self, account_id: str, msgid: str):
        accounts = config_service.load_accounts()
        account = next((a for a in accounts if a["id"] == account_id), None)
        if not account:
            return None
        client = self._connect(account)
        client.select_folder("INBOX")
        response = client.fetch([int(msgid)], ["BODY[]"])
        body = response[int(msgid)][b"BODY[]"].decode(errors="ignore")
        client.logout()
        return body

    def get_accounts(self):
        return config_service.list_accounts()
