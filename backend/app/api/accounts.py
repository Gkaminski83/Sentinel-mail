from fastapi import APIRouter
from app.services.imap_service import IMAPService

router = APIRouter()

@router.get("/accounts")
def get_accounts():
    service = IMAPService()
    return service.get_accounts()
