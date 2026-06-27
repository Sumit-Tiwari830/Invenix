import os
import hashlib
import logging
from typing import List
from fastapi import UploadFile
from sqlalchemy.orm import Session
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document as LangchainDocument

from app.core.config import settings
from app.models.models import Document, DocumentChunk
from app.services.vector_store import VectorStoreManager

logger = logging.getLogger(__name__)

def get_file_hash(file_content: bytes) -> str:
    """Calculate SHA-256 hash of file content"""
    return hashlib.sha256(file_content).hexdigest()

def load_document(file_path: str) -> List[LangchainDocument]:
    """Loads document text using appropriate loader based on file extension"""
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()
    
    if ext == ".pdf":
        loader = PyPDFLoader(file_path)
    elif ext == ".docx":
        loader = Docx2txtLoader(file_path)
    else:  # Default to text loader for .txt, .md, etc.
        loader = TextLoader(file_path, encoding="utf-8")
        
    return loader.load()

def process_document(
    db: Session,
    file: UploadFile,
    file_content: bytes,
    kb_id: int,
    chunk_size: int = 1000,
    chunk_overlap: int = 200
) -> Document:
    """
    Saves document to disk, splits it, stores chunks in SQLite and ChromaDB.
    Handles overwriting if file already exists in same knowledge base.
    """
    file_name = file.filename
    file_hash = get_file_hash(file_content)
    
    # Check if this file name already exists in this KB
    existing_doc = db.query(Document).filter(
        Document.knowledge_base_id == kb_id,
        Document.file_name == file_name
    ).first()
    
    if existing_doc:
        logger.info(f"Document '{file_name}' already exists in KB {kb_id}. Deleting old version first.")
        delete_document(db, kb_id, existing_doc.id)
        
    # Create KB upload folder
    kb_upload_dir = os.path.join(settings.UPLOAD_DIR, f"kb_{kb_id}")
    os.makedirs(kb_upload_dir, exist_ok=True)
    
    # Save file to disk
    file_path = os.path.join(kb_upload_dir, file_name)
    with open(file_path, "wb") as f:
        f.write(file_content)
        
    # Create DB entry for Document
    db_doc = Document(
        file_name=file_name,
        file_path=file_path,
        file_size=len(file_content),
        content_type=file.content_type or "application/octet-stream",
        file_hash=file_hash,
        knowledge_base_id=kb_id
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    
    try:
        # Load and parse text
        docs = load_document(file_path)
        
        # Split into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        split_docs = text_splitter.split_documents(docs)
        
        vector_store = VectorStoreManager(f"kb_{kb_id}")
        
        chunks_to_save = []
        documents_for_vector_db = []
        
        for i, chunk in enumerate(split_docs):
            # Generate unique ID for this chunk
            chunk_content = chunk.page_content
            chunk_metadata = chunk.metadata or {}
            
            # Combine content + metadata + index for unique chunk id hash
            chunk_hash = hashlib.sha256((chunk_content + str(chunk_metadata)).encode("utf-8")).hexdigest()
            chunk_id = f"{kb_id}_{db_doc.id}_{i}_{chunk_hash[:16]}"
            
            # Prepare metadata for LangChain Document
            extended_metadata = {
                **chunk_metadata,
                "chunk_id": chunk_id,
                "file_name": file_name,
                "kb_id": kb_id,
                "document_id": db_doc.id
            }
            
            # 1. SQL Chunk Record
            db_chunk = DocumentChunk(
                id=chunk_id,
                kb_id=kb_id,
                document_id=db_doc.id,
                file_name=file_name,
                chunk_metadata={
                    "page_content": chunk_content,
                    **extended_metadata
                },
                hash=chunk_hash
            )
            chunks_to_save.append(db_chunk)
            
            # 2. LangChain Document for VectorDB
            langchain_doc = LangchainDocument(
                page_content=chunk_content,
                metadata=extended_metadata
            )
            # Add custom id attribute for Chroma
            langchain_doc.id = chunk_id
            documents_for_vector_db.append(langchain_doc)
            
        # Bulk save chunks in SQLite
        db.add_all(chunks_to_save)
        db.commit()
        
        # Save to Chroma DB
        vector_store.add_documents(documents_for_vector_db)
        logger.info(f"Ingested document '{file_name}' successfully into {len(split_docs)} chunks.")
        
        return db_doc
        
    except Exception as e:
        logger.error(f"Failed to process document {file_name}: {str(e)}")
        # Rollback SQLite entry if chunking fails
        db.delete(db_doc)
        db.commit()
        if os.path.exists(file_path):
            os.remove(file_path)
        raise e

def delete_document(db: Session, kb_id: int, doc_id: int) -> None:
    """Deletes document file, SQLite chunk records, and Chroma vector database records"""
    doc = db.query(Document).filter(
        Document.knowledge_base_id == kb_id,
        Document.id == doc_id
    ).first()
    
    if not doc:
        return
        
    # 1. Get all chunks from SQLite
    chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).all()
    chunk_ids = [c.id for c in chunks]
    
    # 2. Delete from ChromaDB
    if chunk_ids:
        try:
            vector_store = VectorStoreManager(f"kb_{kb_id}")
            vector_store.delete(chunk_ids)
        except Exception as e:
            logger.error(f"Error deleting vectors from Chroma for document {doc.file_name}: {str(e)}")
            
    # 3. Delete chunks from SQLite
    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).delete()
    db.commit()
    
    # 4. Delete document row from SQLite
    db.delete(doc)
    db.commit()
    
    # 5. Delete local file
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            logger.error(f"Error removing physical file {doc.file_path}: {str(e)}")
            
    logger.info(f"Deleted document ID {doc_id} successfully.")
