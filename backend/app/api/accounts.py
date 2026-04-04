from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.auth import get_current_admin
from app.services import config_service

router = APIRouter()


class AccountResponse(BaseModel):
    id: str
    name: str
    imap_host: str
    imap_port: int
    username: str
    secure: bool
    created_at: str


class CreateAccountRequest(BaseModel):
    name: str = Field(..., min_length=1)
    imap_host: str = Field(..., min_length=1)
    imap_port: int = Field(993, ge=1)
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    secure: bool = True


def _sanitize_account(account: dict) -> AccountResponse:
    return AccountResponse(**account)


@router.get("/accounts", response_model=List[AccountResponse])
def list_accounts(_: str = Depends(get_current_admin)):
    accounts = config_service.list_accounts()
    return [_sanitize_account(acc) for acc in accounts]


@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(payload: CreateAccountRequest, _: str = Depends(get_current_admin)):
    created = config_service.add_account(payload.dict())
    return _sanitize_account(created)


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: str, _: str = Depends(get_current_admin)):
    deleted = config_service.delete_account(account_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return None
