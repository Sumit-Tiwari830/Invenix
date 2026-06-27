from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import os

from app import models, schemas
from app.db.session import get_db
from app.services.document_processor import process_document, delete_document
from app.services.vector_store import VectorStoreManager

router = APIRouter()

@router.post("/", response_model=schemas.KnowledgeBase)
def create_knowledge_base(kb: schemas.KnowledgeBaseCreate, db: Session = Depends(get_db)):
    db_kb = models.models.KnowledgeBase(name=kb.name, description=kb.description)
    db.add(db_kb)
    db.commit()
    db.refresh(db_kb)
    return db_kb

@router.get("/", response_model=List[schemas.KnowledgeBase])
def list_knowledge_bases(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.models.KnowledgeBase).offset(skip).limit(limit).all()

@router.get("/{kb_id}", response_model=schemas.KnowledgeBase)
def get_knowledge_base(kb_id: int, db: Session = Depends(get_db)):
    kb = db.query(models.models.KnowledgeBase).filter(models.models.KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return kb

@router.delete("/{kb_id}")
def delete_knowledge_base(kb_id: int, db: Session = Depends(get_db)):
    kb = db.query(models.models.KnowledgeBase).filter(models.models.KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # 1. Prune Chroma vector index
    try:
        vector_store = VectorStoreManager(f"kb_{kb_id}")
        vector_store.delete_collection()
    except Exception as e:
        pass
        
    # 2. Prune local files on disk
    kb_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "uploads", f"kb_{kb_id}")
    if os.path.exists(kb_dir):
        import shutil
        try:
            shutil.rmtree(kb_dir)
        except Exception as e:
            pass
            
    # 3. Delete knowledge base from SQLite (cascades document deletes)
    db.delete(kb)
    db.commit()
    return {"message": f"Knowledge base ID {kb_id} deleted successfully."}

@router.post("/{kb_id}/upload", response_model=schemas.Document)
async def upload_file(
    kb_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Verify knowledge base exists
    kb = db.query(models.models.KnowledgeBase).filter(models.models.KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
        
    # Standard file check
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".pdf", ".docx", ".txt", ".md"]:
        raise HTTPException(status_code=400, detail="Unsupported file format. Use PDF, DOCX, TXT or MD.")
        
    try:
        content = await file.read()
        doc = process_document(db=db, file=file, file_content=content, kb_id=kb_id)
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload processing failed: {str(e)}")

@router.get("/{kb_id}/documents", response_model=List[schemas.Document])
def list_documents(kb_id: int, db: Session = Depends(get_db)):
    kb = db.query(models.models.KnowledgeBase).filter(models.models.KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return db.query(models.models.Document).filter(models.models.Document.knowledge_base_id == kb_id).all()

@router.get("/{kb_id}/documents/{doc_id}", response_model=schemas.Document)
def get_document(kb_id: int, doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.models.Document).filter(
        models.models.Document.knowledge_base_id == kb_id,
        models.models.Document.id == doc_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.delete("/{kb_id}/documents/{doc_id}")
def remove_document(kb_id: int, doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(models.models.Document).filter(
        models.models.Document.knowledge_base_id == kb_id,
        models.models.Document.id == doc_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    delete_document(db, kb_id, doc_id)
    return {"message": "Document deleted successfully"}

@router.post("/{kb_id}/query", response_model=schemas.QueryResponse)
def query_kb(kb_id: int, req: schemas.QueryRequest, db: Session = Depends(get_db)):
    kb = db.query(models.models.KnowledgeBase).filter(models.models.KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
        
    try:
        # Check if KB is empty
        doc_count = db.query(models.models.Document).filter(models.models.Document.knowledge_base_id == kb_id).count()
        if doc_count == 0:
            return {"results": []}

        vector_store = VectorStoreManager(f"kb_{kb_id}")
        results = vector_store.similarity_search_with_score(req.query, k=req.top_k)
        
        response_data = []
        for doc, score in results:
            response_data.append({
                "content": doc.page_content,
                "metadata": doc.metadata,
                "score": float(score)
            })
        return {"results": response_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
