from typing import List
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import models, schemas
from app.db.session import get_db
from app.services.chat_service import generate_response

router = APIRouter()

@router.post("/", response_model=schemas.Chat)
def create_chat_session(chat_in: schemas.ChatCreate, db: Session = Depends(get_db)):
    # Verify knowledge base exists
    kb = db.query(models.models.KnowledgeBase).filter(models.models.KnowledgeBase.id == chat_in.knowledge_base_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
        
    db_chat = models.models.Chat(
        title=chat_in.title,
        knowledge_base_id=chat_in.knowledge_base_id
    )
    db.add(db_chat)
    db.commit()
    db.refresh(db_chat)
    return db_chat

@router.get("/", response_model=List[schemas.Chat])
def list_chat_sessions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.models.Chat).offset(skip).limit(limit).all()

@router.get("/{chat_id}", response_model=schemas.Chat)
def get_chat_session(chat_id: int, db: Session = Depends(get_db)):
    chat = db.query(models.models.Chat).filter(models.models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return chat

@router.delete("/{chat_id}")
def delete_chat_session(chat_id: int, db: Session = Depends(get_db)):
    chat = db.query(models.models.Chat).filter(models.models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")
    db.delete(chat)
    db.commit()
    return {"message": f"Chat session ID {chat_id} deleted successfully."}

@router.post("/{chat_id}/messages")
async def chat_message(
    chat_id: int,
    message: schemas.MessageCreate,
    db: Session = Depends(get_db)
):
    """
    RAG Chat endpoint: Accepts user message and streams the AI assistant response.
    """
    # Verify chat session exists
    chat = db.query(models.models.Chat).filter(models.models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")
        
    generator = generate_response(db=db, chat_id=chat_id, user_query=message.content)
    return StreamingResponse(generator, media_type="text/plain")
