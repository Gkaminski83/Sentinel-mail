from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.auth import get_current_admin
from app.services.imap_service import IMAPService, DEFAULT_FOLDER, SPAM_FOLDER, TRASH_FOLDER

router = APIRouter()

FOLDER_ALIASES = {
    "inbox": DEFAULT_FOLDER,
    "sent": "Sent",
    "starred": "Starred",
    "trash": TRASH_FOLDER,
    "spam": SPAM_FOLDER,
}

def _resolve_folder(folder: str | None) -> str:
    if not folder:
        return DEFAULT_FOLDER
    return FOLDER_ALIASES.get(folder.lower(), folder)

class MessageActionRequest(BaseModel):
    message_ids: List[str] = Field(..., min_items=1)

class MoveMessagesRequest(MessageActionRequest):
    destination_folder: str = Field(..., min_length=1)

class DeleteMessagesRequest(MessageActionRequest):
    permanent: bool = False

class SpamMessagesRequest(MessageActionRequest):
    pass

@router.get("/messages")
def get_messages(
    folder: str | None = Query(None, description="Folder alias or IMAP folder name"),
    limit: int = Query(50, ge=1, le=200),
    _: str = Depends(get_current_admin),
):
    service = IMAPService()
    resolved_folder = _resolve_folder(folder)
    return service.fetch_latest_emails(limit=limit, folder=resolved_folder)

@router.get("/messages/{id}")
def get_message(id: str, _: str = Depends(get_current_admin)):
    service = IMAPService()
    try:
        account_id, folder, msgid = IMAPService.decode_message_id(id)
        body = service.fetch_email_body(account_id, folder, msgid)
        if body is None:
            raise HTTPException(status_code=404, detail="Message not found")
        return {"id": id, "body": body}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid message id")

@router.post("/messages/actions/move")
def move_messages(payload: MoveMessagesRequest, _: str = Depends(get_current_admin)):
    service = IMAPService()
    destination = _resolve_folder(payload.destination_folder)
    return service.move_messages(payload.message_ids, destination)

@router.post("/messages/actions/delete")
def delete_messages(payload: DeleteMessagesRequest, _: str = Depends(get_current_admin)):
    service = IMAPService()
    return service.delete_messages(payload.message_ids, permanent=payload.permanent)

@router.post("/messages/actions/spam")
def mark_spam(payload: SpamMessagesRequest, _: str = Depends(get_current_admin)):
    service = IMAPService()
    return service.mark_spam(payload.message_ids)
