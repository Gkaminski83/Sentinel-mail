import base64
import logging
import smtplib
from contextlib import suppress
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import formataddr, format_datetime, make_msgid
from typing import Any, Dict, Iterable, List

from app.services import config_service

logger = logging.getLogger(__name__)

DEFAULT_SMTP_PORT = 587


class SMTPServiceError(RuntimeError):
    """Custom error raised when sending mail fails."""


class SMTPService:
    def send_email(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        account_id = payload.get("account_id")
        if not account_id:
            raise SMTPServiceError("account_id is required")

        account = config_service.get_account(account_id, include_password=True)
        if not account:
            raise SMTPServiceError("Account not found")

        if not account.get("smtp_enabled"):
            raise SMTPServiceError("SMTP is not enabled for this account")

        if not account.get("smtp_host"):
            raise SMTPServiceError("SMTP host is not configured for this account")

        msg = EmailMessage()
        from_email = account.get("smtp_from_email") or account.get("email") or account.get("username")
        from_name = account.get("smtp_from_name") or account.get("name")
        msg["From"] = formataddr((from_name, from_email)) if from_name else from_email
        msg["Subject"] = payload.get("subject", "")
        msg["Date"] = format_datetime(datetime.now(timezone.utc))
        msg["Message-ID"] = make_msgid()

        to_header = self._format_addresses(payload.get("to") or [])
        cc_header = self._format_addresses(payload.get("cc") or [])
        bcc_addresses = self._extract_emails(payload.get("bcc") or [])

        if to_header:
            msg["To"] = ", ".join(to_header)
        if cc_header:
            msg["Cc"] = ", ".join(cc_header)
        if payload.get("in_reply_to"):
            msg["In-Reply-To"] = payload["in_reply_to"]
        references = payload.get("references") or []
        if references:
            msg["References"] = " ".join(references)

        text_body = payload.get("text_body") or ""
        html_body = payload.get("html_body")
        if html_body:
            msg.set_content(text_body or "")
            msg.add_alternative(html_body, subtype="html")
        else:
            msg.set_content(text_body or "")

        for attachment in payload.get("attachments") or []:
            self._add_attachment(msg, attachment)

        smtp_client = self._build_client(account)
        all_recipients = self._extract_emails(payload.get("to") or []) + \
            self._extract_emails(payload.get("cc") or []) + bcc_addresses
        if not all_recipients:
            raise SMTPServiceError("At least one recipient is required")

        try:
            username = account.get("smtp_username") or account.get("username")
            password = account.get("smtp_password") or account.get("password")
            if username and password:
                smtp_client.login(username, password)
            smtp_client.send_message(msg, to_addrs=all_recipients)
        except smtplib.SMTPException as exc:
            logger.warning("Failed to send email via SMTP for account %s: %s", account_id, exc, exc_info=exc)
            raise SMTPServiceError(str(exc)) from exc
        finally:
            with suppress(Exception):
                smtp_client.quit()

        sent_at = datetime.now(timezone.utc).isoformat()
        return {
            "message_id": msg["Message-ID"],
            "sent_at": sent_at,
            "recipients": all_recipients,
        }

    def _add_attachment(self, message: EmailMessage, attachment: Dict[str, Any]):
        filename = attachment.get("filename") or "attachment"
        content_type = attachment.get("content_type") or "application/octet-stream"
        content_base64 = attachment.get("content_base64")
        if not content_base64:
            return
        try:
            data = base64.b64decode(content_base64)
        except Exception as exc:  # pragma: no cover - invalid user input
            raise SMTPServiceError("Invalid attachment encoding") from exc
        maintype, subtype = self._split_content_type(content_type)
        message.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)

    @staticmethod
    def _split_content_type(content_type: str) -> Iterable[str]:
        if "/" in content_type:
            parts = content_type.split("/", 1)
            return parts[0], parts[1]
        return "application", "octet-stream"

    @staticmethod
    def _extract_emails(recipients: Iterable[Dict[str, Any]]) -> List[str]:
        emails: List[str] = []
        for recipient in recipients:
            email = recipient.get("email")
            if email:
                emails.append(email)
        return emails

    @staticmethod
    def _format_addresses(recipients: Iterable[Dict[str, Any]]) -> List[str]:
        formatted: List[str] = []
        for recipient in recipients:
            email = recipient.get("email")
            name = recipient.get("name")
            if not email:
                continue
            formatted.append(formataddr((name, email)) if name else email)
        return formatted

    @staticmethod
    def _build_client(account: Dict[str, Any]):
        host = account["smtp_host"]
        port = account.get("smtp_port", DEFAULT_SMTP_PORT)
        secure = account.get("smtp_secure", True)

        if secure and port == 465:
            return smtplib.SMTP_SSL(host, port, timeout=30)

        client = smtplib.SMTP(host, port, timeout=30)
        if secure:
            client.starttls()
        return client
