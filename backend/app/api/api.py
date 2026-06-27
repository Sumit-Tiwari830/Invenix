from fastapi import APIRouter
from app.api.endpoints import knowledge_base, chat

api_router = APIRouter()

api_router.include_router(knowledge_base.router, prefix="/knowledge-base", tags=["knowledge-base"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
