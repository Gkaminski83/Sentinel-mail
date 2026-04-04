import json
import os
import threading
from typing import List, Dict, Optional
from uuid import uuid4

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'accounts.json')
_lock = threading.Lock()

def load_accounts() -> List[Dict]:
    with _lock:
        if not os.path.exists(CONFIG_PATH):
            return []
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)

def save_accounts(accounts: List[Dict]):
    with _lock:
        with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(accounts, f, indent=2)

def add_account(account: Dict) -> Dict:
    accounts = load_accounts()
    account['id'] = str(uuid4())
    accounts.append(account)
    save_accounts(accounts)
    return account

def update_account(account_id: str, new_data: Dict) -> Optional[Dict]:
    accounts = load_accounts()
    for acc in accounts:
        if acc['id'] == account_id:
            acc.update(new_data)
            save_accounts(accounts)
            return acc
    return None

def delete_account(account_id: str) -> bool:
    accounts = load_accounts()
    new_accounts = [acc for acc in accounts if acc['id'] != account_id]
    if len(new_accounts) == len(accounts):
        return False
    save_accounts(new_accounts)
    return True
