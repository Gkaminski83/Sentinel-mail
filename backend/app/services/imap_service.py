import os
import json
from imapclient import IMAPClient
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime
from typing import List, Dict, Any

class IMAPService:
    def __init__(self):
        accounts_json = os.getenv('ACCOUNTS_JSON', '[]')
        self.accounts = json.loads(accounts_json)

    def _connect(self, account):
        client = IMAPClient(account['host'], use_uid=True, ssl=True)
        client.login(account['username'], account['password'])
        return client

    def fetch_latest_emails(self, limit=50) -> List[Dict[str, Any]]:
        all_messages = []
        for account in self.accounts:
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
                        'id': f"{account['username']}|{msgid}",
                        'account': account['username'],
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

    def fetch_email_body(self, account_username, msgid):
        account = next((a for a in self.accounts if a['username'] == account_username), None)
        if not account:
            return None
        client = self._connect(account)
        client.select_folder('INBOX')
        response = client.fetch([int(msgid)], ['BODY[]'])
        body = response[int(msgid)][b'BODY[]'].decode(errors='ignore')
        client.logout()
        return body

    def get_accounts(self):
        return [{'username': a['username'], 'host': a['host']} for a in self.accounts]
