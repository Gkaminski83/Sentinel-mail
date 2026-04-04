from fastapi import APIRouter, HTTPException
from app.services.imap_service import IMAPService

router = APIRouter()

@router.get("/messages")
def get_messages():
    service = IMAPService()
    return service.fetch_latest_emails()

@router.get("/messages/{id}")
def get_message(id: str):
    service = IMAPService()
    try:
        account, msgid = id.split("|", 1)
        body = service.fetch_email_body(account, msgid)
        if body is None:
            raise HTTPException(status_code=404, detail="Message not found")
        return {"id": id, "body": body}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid message id")
