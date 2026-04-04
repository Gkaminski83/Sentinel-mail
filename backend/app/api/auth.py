import os
from datetime import datetime, timedelta

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

router = APIRouter()

SECRET_KEY = os.environ.get("ADMIN_SECRET_KEY", "change_this_secret")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin")

TOKEN_EXPIRE_MINUTES = 60 * 24

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    token: str
    expires_at: datetime

def _create_access_token(subject: str) -> TokenResponse:
    expires_at = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expires_at}
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return TokenResponse(token=token, expires_at=expires_at)

def decode_admin_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    username = payload.get("sub")
    if username != ADMIN_USERNAME:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return username

def get_current_admin(request: Request) -> str:
    cached_admin = getattr(request.state, "admin", None)
    if cached_admin:
        return cached_admin

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token = auth_header.split(" ", 1)[1]
    admin = decode_admin_token(token)
    request.state.admin = admin
    return admin

@router.post("/auth/login", response_model=TokenResponse)
def login(credentials: LoginRequest):
    if credentials.username != ADMIN_USERNAME or credentials.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return _create_access_token(credentials.username)

@router.get("/auth/me")
def auth_me(current_admin: str = Depends(get_current_admin)):
    return {"username": current_admin}
