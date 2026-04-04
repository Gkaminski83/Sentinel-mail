import os
import json
from imapclient import IMAPClient
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime
from typing import List, Dict, Any


from app.services import config_service

class IMAPService:
    def __init__(self):
        pass

    def _connect(self, account):
        client = IMAPClient(account['imap_host'], port=account.get('imap_port', 993), use_uid=True, ssl=True)
        client.login(account['username'], account['password'])
        return client

    def fetch_latest_emails(self, limit=50) -> List[Dict[str, Any]]:
        accounts = config_service.load_accounts()
        all_messages = []
        for account in accounts:
            try:
                client = self._connect(account)
                client.select_folder('INBOX')
                messages = client.search(['ALL'])[-limit:]
                response = client.fetch(messages, ['ENVELOPE', 'BODY.PEEK[]<0.200>'])
                for msgid, data in response.items():
                    envelope = data[b'ENVELOPE']
                    snippet = data.get(b'BODY[]', b'').decode(errors='ignore')[:200]
                    subject = str(make_header(decode_header(envelope.subject))) if envelope.subject else ''
                    sender = envelope.from_[0]
                    from_addr = f"{sender.mailbox.decode()}@{sender.host.decode()}"
                    date = parsedate_to_datetime(envelope.date)
                    all_messages.append({
                        'id': f"{account['id']}|{msgid}",
                        'account': account['email'],
                        'subject': subject,
                        'from': from_addr,
                        'date': date.isoformat(),
                        'snippet': snippet
                    })
                client.logout()
            except Exception as e:
                continue
        all_messages.sort(key=lambda x: x['date'], reverse=True)
        return all_messages

    def fetch_email_body(self, account_id, msgid):
        accounts = config_service.load_accounts()
        account = next((a for a in accounts if a['id'] == account_id), None)
        if not account:
            return None
        client = self._connect(account)
        client.select_folder('INBOX')
        response = client.fetch([int(msgid)], ['BODY[]'])
        body = response[int(msgid)][b'BODY[]'].decode(errors='ignore')
        client.logout()
        return body

    def get_accounts(self):
        accounts = config_service.load_accounts()
        return [{'id': a['id'], 'email': a['email'], 'imap_host': a['imap_host']} for a in accounts]
