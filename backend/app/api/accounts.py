from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.auth import get_current_admin
from app.services import config_service
from app.services.connection_test_service import test_connections

router = APIRouter()


class AccountResponse(BaseModel):
    id: str
    name: str
    email: str
    imap_host: str
    imap_port: int
    username: str
    secure: bool
    enabled: bool
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_username: str | None = None
    smtp_secure: bool | None = None
    smtp_enabled: bool | None = None
    smtp_from_name: str | None = None
    smtp_from_email: str | None = None
    created_at: str
    updated_at: str


class SMTPSettings(BaseModel):
    host: str | None = Field(None, min_length=1)
    port: int | None = Field(587, ge=1)
    username: str | None = Field(None, min_length=1)
    password: str | None = Field(None, min_length=1)
    secure: bool = True
    enabled: bool = False
    from_name: str | None = None
    from_email: str | None = None


class CreateAccountRequest(BaseModel):
    name: str = Field(..., min_length=1)
    imap_host: str = Field(..., min_length=1)
    imap_port: int = Field(993, ge=1)
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    secure: bool = True
    enabled: bool = True
    smtp: SMTPSettings | None = None


class UpdateAccountRequest(BaseModel):
    name: str | None = Field(None, min_length=1)
    email: str | None = None
    imap_host: str | None = Field(None, min_length=1)
    imap_port: int | None = Field(None, ge=1)
    username: str | None = Field(None, min_length=1)
    password: str | None = Field(None, min_length=1)
    secure: bool | None = None
    enabled: bool | None = None
    smtp: SMTPSettings | None = None


class TestAccountRequest(BaseModel):
    account_id: str | None = None
    name: str | None = Field(None, min_length=1)
    email: str | None = None
    imap_host: str | None = Field(None, min_length=1)
    imap_port: int | None = Field(None, ge=1)
    username: str | None = Field(None, min_length=1)
    password: str | None = Field(None, min_length=1)
    secure: bool | None = None
    enabled: bool | None = None
    smtp: SMTPSettings | None = None


def _sanitize_account(account: dict) -> AccountResponse:
    return AccountResponse(**account)


@router.get("/accounts", response_model=List[AccountResponse])
def list_accounts(_: str = Depends(get_current_admin)):
    accounts = config_service.list_accounts()
    return [_sanitize_account(acc) for acc in accounts]


@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(payload: CreateAccountRequest, _: str = Depends(get_current_admin)):
    payload_dict = payload.dict()
    smtp = payload_dict.pop("smtp", None) or {}
    created = config_service.add_account({
        **payload_dict,
        "smtp_host": smtp.get("host"),
        "smtp_port": smtp.get("port"),
        "smtp_username": smtp.get("username"),
        "smtp_password": smtp.get("password"),
        "smtp_secure": smtp.get("secure", True),
        "smtp_enabled": smtp.get("enabled", False),
        "smtp_from_name": smtp.get("from_name"),
        "smtp_from_email": smtp.get("from_email"),
    })
    return _sanitize_account(created)


@router.put("/accounts/{account_id}", response_model=AccountResponse)
def update_account(account_id: str, payload: UpdateAccountRequest, _: str = Depends(get_current_admin)):
    payload_dict = {k: v for k, v in payload.dict(exclude_unset=True).items() if k != "smtp"}
    smtp = payload.smtp
    if smtp is not None:
        payload_dict.update(
            {
                "smtp_host": smtp.host,
                "smtp_port": smtp.port,
                "smtp_username": smtp.username,
                "smtp_password": smtp.password,
                "smtp_secure": smtp.secure,
                "smtp_enabled": smtp.enabled,
                "smtp_from_name": smtp.from_name,
                "smtp_from_email": smtp.from_email,
            }
        )
    updated = config_service.update_account(account_id, payload_dict)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return _sanitize_account(updated)


@router.delete("/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: str, _: str = Depends(get_current_admin)):
    deleted = config_service.delete_account(account_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return None


@router.post("/accounts/test")
def test_account_connection(payload: TestAccountRequest, _: str = Depends(get_current_admin)):
    account_data = None
    if payload.account_id:
        account_data = config_service.get_account(payload.account_id, include_password=True)
        if not account_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    account: dict = account_data.copy() if account_data else {}

    def assign(field: str, value):
        if value is not None:
            account[field] = value

    assign("name", payload.name)
    assign("email", payload.email)
    assign("imap_host", payload.imap_host)
    assign("imap_port", payload.imap_port)
    assign("username", payload.username)
    assign("secure", payload.secure)
    assign("enabled", payload.enabled)
    if payload.password:
        account["password"] = payload.password

    smtp = payload.smtp
    if smtp is not None:
        assign("smtp_host", smtp.host)
        assign("smtp_port", smtp.port)
        assign("smtp_username", smtp.username)
        if smtp.password:
            account["smtp_password"] = smtp.password
        assign("smtp_secure", smtp.secure)
        assign("smtp_enabled", smtp.enabled)
        assign("smtp_from_name", smtp.from_name)
        assign("smtp_from_email", smtp.from_email)

    required_fields = ["imap_host", "imap_port", "username"]
    for field in required_fields:
        if not account.get(field):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing {field}")

    if not account.get("password"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required to test IMAP",
        )

    result = test_connections(account)
    return result
