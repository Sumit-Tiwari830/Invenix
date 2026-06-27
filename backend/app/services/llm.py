import logging
from langchain_ollama import ChatOllama
from app.core.config import settings

logger = logging.getLogger(__name__)

def get_llm(temperature: float = 0.0, streaming: bool = True):
    """
    Returns Ollama LLM chat model based on config.
    """
    logger.info(f"Initializing ChatOllama model: {settings.OLLAMA_MODEL}")
    return ChatOllama(
        model=settings.OLLAMA_MODEL,
        base_url=settings.OLLAMA_API_BASE,
        temperature=temperature,
        streaming=streaming
    )
