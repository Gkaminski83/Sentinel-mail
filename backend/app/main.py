from fastapi import FastAPI
from app.api import accounts, messages

app = FastAPI()

app.include_router(accounts.router)
app.include_router(messages.router)
