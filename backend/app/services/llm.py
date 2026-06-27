import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

def get_llm(temperature: float = 0.0, streaming: bool = True):
    """
    Returns LLM chat model (Ollama, Groq, or Grok) based on config.
    """
    provider = settings.LLM_PROVIDER.lower()
    api_key = settings.GROK_API_KEY.strip()
    
    # Auto-detect Groq keys starting with gsk_ even if provider is set to grok/groq
    is_groq_key = api_key.startswith("gsk_")
    
    if provider == "groq" or is_groq_key:
        # Default to a highly-rated Groq model if the user kept default grok settings
        model_name = settings.GROK_MODEL
        if model_name == "grok-beta" or model_name == "llama-3.3-7b-versatile":
            # Make sure we use a model that exists on Groq. 
            # llama-3.3-7b-versatile is the current standard free Groq model.
            # deepseek-r1-distill-llama-70b is also excellent.
            model_name = "llama-3.3-7b-versatile"
            
        logger.info(f"Initializing Groq ChatOpenAI model: {model_name}")
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1",
            model=model_name,
            temperature=temperature,
            streaming=streaming
        )
    elif provider == "grok":
        logger.info(f"Initializing xAI Grok ChatOpenAI model: {settings.GROK_MODEL}")
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            api_key=api_key,
            base_url="https://api.x.ai/v1",
            model=settings.GROK_MODEL,
            temperature=temperature,
            streaming=streaming
        )
    else:
        logger.info(f"Initializing ChatOllama model: {settings.OLLAMA_MODEL}")
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=settings.OLLAMA_MODEL,
            base_url=settings.OLLAMA_API_BASE,
            temperature=temperature,
            streaming=streaming
        )
