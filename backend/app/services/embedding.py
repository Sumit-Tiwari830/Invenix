import logging
from langchain_ollama import OllamaEmbeddings
from app.core.config import settings

logger = logging.getLogger(__name__)

def get_embeddings():
    """
    Returns Ollama embeddings based on config.
    """
    logger.info(f"Initializing Ollama embeddings using model: {settings.OLLAMA_EMBEDDINGS_MODEL}")
    return OllamaEmbeddings(
        model=settings.OLLAMA_EMBEDDINGS_MODEL,
        base_url=settings.OLLAMA_API_BASE
    )
