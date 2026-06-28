import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

def get_embeddings():
    """
    Returns embeddings based on config (Ollama or HuggingFace).
    """
    provider = settings.EMBEDDINGS_PROVIDER.lower()

    if provider in ["huggingface", "hf"]:
        logger.info(f"Initializing local HuggingFace embeddings: {settings.HF_EMBEDDINGS_MODEL}")
        from langchain_huggingface import HuggingFaceEmbeddings
        return HuggingFaceEmbeddings(model_name=settings.HF_EMBEDDINGS_MODEL)
    else:
        logger.info(f"Initializing Ollama embeddings using model: {settings.OLLAMA_EMBEDDINGS_MODEL}")
        from langchain_ollama import OllamaEmbeddings
        return OllamaEmbeddings(
            model=settings.OLLAMA_EMBEDDINGS_MODEL,
            base_url=settings.OLLAMA_API_BASE
        )
