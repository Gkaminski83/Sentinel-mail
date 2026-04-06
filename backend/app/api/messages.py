from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field

from app.api.auth import get_current_admin
from app.services.imap_service import IMAPService, DEFAULT_FOLDER, SPAM_FOLDER, TRASH_FOLDER
from app.services.smtp_service import SMTPService, SMTPServiceError

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


class Recipient(BaseModel):
    email: EmailStr
    name: str | None = None


class AttachmentInput(BaseModel):
    filename: str | None = None
    content_type: str | None = None
    content_base64: str


class SendEmailRequest(BaseModel):
    account_id: str
    to: List[Recipient] = Field(..., min_items=1)
    cc: List[Recipient] = Field(default_factory=list)
    bcc: List[Recipient] = Field(default_factory=list)
    subject: str = ""
    text_body: str | None = None
    html_body: str | None = None
    in_reply_to: str | None = None
    references: List[str] | None = None
    attachments: List[AttachmentInput] | None = None

@router.get("/messages")
def get_messages(
    folder: str | None = Query(None, description="Folder alias or IMAP folder name"),
    limit: int = Query(50, ge=1, le=200),
    page: int = Query(1, ge=1),
    query: str | None = Query(
        None,
        min_length=1,
        max_length=200,
        description="Keyword search across subject, sender, snippet, and account name",
    ),
    sender: str | None = Query(
        None,
        min_length=1,
        max_length=200,
        description="Filter by sender name or email substring",
    ),
    date_from: str | None = Query(
        None,
        description="ISO8601 date/time or YYYY-MM-DD to include messages from this date onward",
    ),
    date_to: str | None = Query(
        None,
        description="ISO8601 date/time or YYYY-MM-DD to include messages up to this date",
    ),
    has_attachment: bool | None = Query(
        None,
        description="true for messages with attachments, false for messages without, omit for all",
    ),
    _: str = Depends(get_current_admin),
):
    service = IMAPService()
    resolved_folder = _resolve_folder(folder)
    return service.fetch_latest_emails(
        limit=limit,
        folder=resolved_folder,
        page=page,
        query=query,
        sender=sender,
        date_from=date_from,
        date_to=date_to,
        has_attachment=has_attachment,
    )

@router.get("/messages/{id}")
def get_message(id: str, _: str = Depends(get_current_admin)):
    service = IMAPService()
    try:
        account_id, folder, msgid = IMAPService.decode_message_id(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message id")

    body = service.fetch_email_body(account_id, folder, msgid)
    if body is None:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"id": id, **body}

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


@router.get("/messages/{id}/attachments/{attachment_id}")
def download_attachment(id: str, attachment_id: str, _: str = Depends(get_current_admin)):
    service = IMAPService()
    try:
        account_id, folder, msgid = IMAPService.decode_message_id(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid message id")

    try:
        attachment = service.fetch_attachment(account_id, folder, msgid, attachment_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    filename = attachment["filename"].replace('"', "")
    content_type = attachment["content_type"] or "application/octet-stream"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=attachment["data"], media_type=content_type, headers=headers)


@router.post("/messages/send")
def send_email(payload: SendEmailRequest, _: str = Depends(get_current_admin)):
    service = SMTPService()
    try:
        result = service.send_email(payload.dict())
    except SMTPServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return result
