from fastapi import APIRouter, Depends, Request, HTTPException
from app.services import config_service
from app.api.auth import get_current_admin

router = APIRouter()

@router.get("/admin/accounts")
def list_accounts(request: Request, _: str = Depends(get_current_admin)):
    return config_service.load_accounts()

@router.post("/admin/accounts")
def create_account(data: dict, request: Request, _: str = Depends(get_current_admin)):
    required = ["email", "imap_host", "imap_port", "username", "password"]
    if not all(k in data for k in required):
        raise HTTPException(status_code=400, detail="Missing fields")
    return config_service.add_account(data)

@router.put("/admin/accounts/{account_id}")
def update_account(account_id: str, data: dict, request: Request, _: str = Depends(get_current_admin)):
    updated = config_service.update_account(account_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Account not found")
    return updated

@router.delete("/admin/accounts/{account_id}")
def delete_account(account_id: str, request: Request, _: str = Depends(get_current_admin)):
    ok = config_service.delete_account(account_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"ok": True}
