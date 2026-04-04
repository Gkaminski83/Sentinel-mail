import smtplib
from contextlib import suppress
from typing import Dict, Tuple

from imapclient import IMAPClient


DEFAULT_IMAP_PORT = 993
DEFAULT_SMTP_PORT = 587


def test_imap(account: Dict) -> Tuple[bool, str | None]:
    try:
        client = IMAPClient(
            account["imap_host"],
            port=account.get("imap_port", DEFAULT_IMAP_PORT),
            use_uid=True,
            ssl=account.get("secure", True),
            timeout=15,
        )
        client.login(account["username"], account["password"])
        client.select_folder("INBOX")
        client.logout()
        return True, None
    except Exception as exc:  # pragma: no cover - network errors are environment-specific
        return False, str(exc)


def _build_smtp_client(settings: Dict):
    host = settings["smtp_host"]
    port = settings.get("smtp_port", DEFAULT_SMTP_PORT)
    secure = settings.get("smtp_secure", True)

    if secure and port == 465:
        return smtplib.SMTP_SSL(host, port, timeout=15)

    client = smtplib.SMTP(host, port, timeout=15)
    if secure:
        # Some servers expect STARTTLS even on custom ports
        client.starttls()
    return client


def test_smtp(account: Dict) -> Tuple[bool, str | None]:
    host = account.get("smtp_host")
    if not host:
        return True, "SMTP not configured"

    try:
        client = _build_smtp_client(account)
        username = account.get("smtp_username")
        password = account.get("smtp_password")
        if username and password:
            client.login(username, password)
        client.noop()
        with suppress(Exception):
            client.quit()
        return True, None
    except Exception as exc:  # pragma: no cover - network errors are environment-specific
        return False, str(exc)


def test_connections(account: Dict) -> Dict:
    imap_success, imap_error = test_imap(account)
    smtp_success, smtp_error = test_smtp(account)
    return {
        "imap_success": imap_success,
        "imap_error": imap_error,
        "smtp_success": smtp_success,
        "smtp_error": smtp_error,
    }
