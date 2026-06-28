import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Invenix"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    # Storage and DB paths relative to backend root
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    @property
    def DATA_DIR(self) -> str:
        data_path = os.path.join(self.BASE_DIR, "data")
        os.makedirs(data_path, exist_ok=True)
        return data_path
        
    @property
    def DATABASE_URL(self) -> str:
        return f"sqlite:///{os.path.join(self.DATA_DIR, 'invenix.db')}"
        
    @property
    def UPLOAD_DIR(self) -> str:
        upload_path = os.path.join(self.DATA_DIR, "uploads")
        os.makedirs(upload_path, exist_ok=True)
        return upload_path

    @property
    def CHROMA_PERSIST_DIR(self) -> str:
        chroma_path = os.path.join(self.DATA_DIR, "chromadb")
        os.makedirs(chroma_path, exist_ok=True)
        return chroma_path

    # Provider settings (ollama, groq, grok)
    LLM_PROVIDER: str = "ollama"
    EMBEDDINGS_PROVIDER: str = "ollama"
    
    # Ollama settings
    OLLAMA_API_BASE: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:1.5b"
    OLLAMA_EMBEDDINGS_MODEL: str = "nomic-embed-text"

    # Hugging Face embeddings
    HF_EMBEDDINGS_MODEL: str = "all-MiniLM-L6-v2"

    # Groq/Grok settings
    GROK_API_KEY: str = ""
    GROK_MODEL: str = "llama-3.3-70b-versatile"

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
