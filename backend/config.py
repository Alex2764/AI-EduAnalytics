"""
Application configuration with Pydantic Settings
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional, Union
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables
    
    All settings can be overridden via environment variables or .env file
    """
    
    # Environment
    environment: str = "development"
    
    # API Configuration
    api_version: str = "1.0.0"
    api_title: str = "AI EduAnalytics API"
    api_description: str = "AI-powered educational test analysis and document generation"
    port: int = 8000
    
    # Gemini AI Configuration
    gemini_api_key: str
    
    # Supabase Configuration
    supabase_url: str
    supabase_anon_key: Optional[str] = None
    supabase_key: Optional[str] = None  # Alternative to anon_key
    
    # CORS Configuration
    # Can be set via ALLOWED_ORIGINS environment variable as comma-separated string
    # Example: ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://example.com
    # Default: localhost origins for development
    allowed_origins: Union[List[str], str] = [
        "http://localhost:5173",  # Vite default
        "http://localhost:5174",  # Alternative Vite port
        "http://localhost:5175",  # Alternative Vite port
        "http://localhost:5176",  # Alternative Vite port
        "http://localhost:3000",  # Create React App default
    ]
    
    @field_validator('allowed_origins', mode='before')
    @classmethod
    def parse_allowed_origins(cls, v: Union[List[str], str]) -> List[str]:
        """
        Parse allowed_origins from environment variable
        
        Supports:
        - Comma-separated string: "http://localhost:5173,http://localhost:3000"
        - JSON array string: '["http://localhost:5173","http://localhost:3000"]'
        - List of strings: ["http://localhost:5173", "http://localhost:3000"]
        """
        # Default origins for development
        default_origins = [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://localhost:5176",
            "http://localhost:3000",
        ]
        
        if isinstance(v, str):
            # Try to parse as JSON first
            if v.strip().startswith('['):
                try:
                    import json
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(origin).strip() for origin in parsed if origin]
                except (json.JSONDecodeError, TypeError):
                    pass
            
            # Parse as comma-separated string
            origins = [origin.strip() for origin in v.split(',') if origin.strip()]
            return origins if origins else default_origins
        
        # Already a list
        if isinstance(v, list):
            return [str(origin).strip() for origin in v if origin]
        
        # Fallback to default
        return default_origins
    
    # API Documentation
    enable_docs: bool = True
    
    # Cleanup Endpoint Protection
    cleanup_api_key: Optional[str] = None
    
    # Supabase Storage (for templates)
    use_supabase_storage: bool = False
    supabase_storage_bucket: str = "templates"
    
    # Logging
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        # Allow reading from both UPPERCASE and lowercase env vars
        # Pydantic will automatically convert to lowercase for field names
        
        @classmethod
        def customise_sources(
            cls,
            init_settings,
            env_settings,
            file_secret_settings,
        ):
            # Prioritize .env file, then environment variables
            return (
                init_settings,
                env_settings,
                file_secret_settings,
            )


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance
    
    Uses lru_cache to ensure settings are loaded only once
    """
    settings = Settings()
    
    # Validate required settings
    validate_settings(settings)
    
    return settings


def validate_settings(settings: Settings) -> None:
    """
    Validate that required settings are present
    
    Args:
        settings: Settings instance to validate
    
    Raises:
        ValueError: If required settings are missing
    """
    errors = []
    
    # Check Gemini API key
    if not settings.gemini_api_key:
        errors.append("GEMINI_API_KEY is required")
    
    # Check Supabase configuration
    if not settings.supabase_url:
        errors.append("SUPABASE_URL is required")
    
    if not settings.supabase_anon_key and not settings.supabase_key:
        errors.append("SUPABASE_ANON_KEY or SUPABASE_KEY is required")
    
    if errors:
        error_msg = "Missing required environment variables:\n" + "\n".join(f"  - {e}" for e in errors)
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    # Log configuration status
    logger.info("Settings validated successfully")
    logger.debug(f"Environment: {settings.environment}")
    logger.debug(f"Gemini API Key: {'Set' if settings.gemini_api_key else 'Missing'}")
    logger.debug(f"Supabase URL: {'Set' if settings.supabase_url else 'Missing'}")
    logger.debug(f"Supabase Key: {'Set' if (settings.supabase_anon_key or settings.supabase_key) else 'Missing'}")
    logger.debug(f"CORS Origins: {len(settings.allowed_origins)} origins")
    logger.debug(f"API Docs: {'Enabled' if settings.enable_docs else 'Disabled'}")

