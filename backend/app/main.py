from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import accounts, messages, admin, auth

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

app.include_router(accounts.router)
app.include_router(messages.router)
app.include_router(admin.router)
app.include_router(auth.router)
