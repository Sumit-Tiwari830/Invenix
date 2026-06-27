from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Any, Dict

# Message schemas
class MessageBase(BaseModel):
    role: str
    content: str

class MessageCreate(MessageBase):
    pass

class Message(MessageBase):
    id: int
    chat_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Chat schemas
class ChatBase(BaseModel):
    title: str
    knowledge_base_id: int

class ChatCreate(ChatBase):
    pass

class Chat(ChatBase):
    id: int
    created_at: datetime
    messages: List[Message] = []

    class Config:
        from_attributes = True

# Document schemas
class DocumentBase(BaseModel):
    file_name: str
    file_size: int
    content_type: str
    knowledge_base_id: int

class Document(DocumentBase):
    id: int
    file_path: str
    file_hash: str
    created_at: datetime

    class Config:
        from_attributes = True

# KnowledgeBase schemas
class KnowledgeBaseBase(BaseModel):
    name: str
    description: Optional[str] = None

class KnowledgeBaseCreate(KnowledgeBaseBase):
    pass

class KnowledgeBase(KnowledgeBaseBase):
    id: int
    created_at: datetime
    updated_at: datetime
    documents: List[Document] = []

    class Config:
        from_attributes = True

# RAG & API Query schemas
class QueryRequest(BaseModel):
    query: str
    top_k: int = 4

class ChunkResponse(BaseModel):
    content: str
    metadata: Dict[str, Any]
    score: float

class QueryResponse(BaseModel):
    results: List[ChunkResponse]
