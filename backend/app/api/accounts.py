from fastapi import APIRouter, Depends
from app.api.auth import get_current_admin
from app.services.imap_service import IMAPService

router = APIRouter()

@router.get("/accounts")
def get_accounts(_: str = Depends(get_current_admin)):
    service = IMAPService()
    return service.get_accounts()
