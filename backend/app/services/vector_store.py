import os
import shutil
import logging
from typing import List, Tuple, Any
from langchain_core.documents import Document
from langchain_chroma import Chroma
from app.core.config import settings
from app.services.embedding import get_embeddings

logger = logging.getLogger(__name__)

class VectorStoreManager:
    def __init__(self, collection_name: str):
        self.collection_name = collection_name
        self.embeddings = get_embeddings()
        
        # Determine the path for this specific collection
        self.persist_directory = os.path.join(settings.CHROMA_PERSIST_DIR, collection_name)
        
        self.db = Chroma(
            collection_name=collection_name,
            embedding_function=self.embeddings,
            persist_directory=self.persist_directory
        )
        
    def add_documents(self, documents: List[Document]) -> None:
        """Add documents to the collection"""
        if not documents:
            return
        logger.info(f"Adding {len(documents)} chunks to vector store collection: {self.collection_name}")
        self.db.add_documents(documents)

    def delete(self, ids: List[str]) -> None:
        """Delete chunks by IDs"""
        if not ids:
            return
        logger.info(f"Deleting {len(ids)} chunks from vector store collection: {self.collection_name}")
        self.db.delete(ids)

    def similarity_search_with_score(self, query: str, k: int = 4) -> List[Tuple[Document, float]]:
        """Search similar documents and return list of tuples (Document, score)"""
        logger.info(f"Performing similarity search for query: '{query}' (k={k}) in collection: {self.collection_name}")
        return self.db.similarity_search_with_score(query, k=k)

    def as_retriever(self, search_kwargs: dict = None):
        """Get retriever interface"""
        kwargs = search_kwargs or {"k": 4}
        return self.db.as_retriever(search_kwargs=kwargs)

    def delete_collection(self) -> None:
        """Delete the collection files from the filesystem and reinitialize"""
        logger.info(f"Pruning collection folder: {self.persist_directory}")
        try:
            # Recreate db connection to release files, then delete
            self.db = None
            if os.path.exists(self.persist_directory):
                shutil.rmtree(self.persist_directory)
            logger.info("Collection deleted successfully.")
        except Exception as e:
            logger.error(f"Error deleting collection folder: {str(e)}")
