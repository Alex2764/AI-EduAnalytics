"""
Groq AI Service — stage 1: generate full test analysis draft (Bulgarian).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

from config import get_settings

logger = logging.getLogger(__name__)

GROQ_MAX_OUTPUT_TOKENS = 2048
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"


class GroqAPIError(Exception):
    def __init__(
        self,
        message: str,
        is_rate_limit: bool = False,
        unavailable: bool = False,
    ):
        super().__init__(message)
        self.is_rate_limit = is_rate_limit
        self.unavailable = unavailable


class GroqService:
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        settings = get_settings()
        self.api_key = (api_key or settings.groq_api_key or os.getenv("GROQ_API_KEY") or "").strip()
        if not self.api_key:
            raise GroqAPIError(
                "GROQ_API_KEY не е настроен. Добавете ключа в .env.",
                unavailable=True,
            )
        self.model = model or settings.groq_model or DEFAULT_GROQ_MODEL
        try:
            from groq import Groq

            self._client = Groq(api_key=self.api_key)
        except ImportError as e:
            raise GroqAPIError(
                "Пакетът groq не е инсталиран. pip install groq",
                unavailable=True,
            ) from e

    def generate_analysis_text(self, prompt: str) -> str:
        """Call Groq with the full analysis prompt (max 2048 output tokens)."""
        try:
            logger.info("Groq: generating analysis draft (model=%s)", self.model)
            response = self._client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=GROQ_MAX_OUTPUT_TOKENS,
                temperature=0.7,
            )
            text = (response.choices[0].message.content or "").strip()
            if not text:
                raise GroqAPIError("Празен отговор от Groq API")
            logger.info("Groq: received %d characters", len(text))
            return text
        except GroqAPIError:
            raise
        except Exception as e:
            err = str(e).lower()
            if "429" in err or "rate" in err or "quota" in err:
                raise GroqAPIError(
                    f"Groq API лимит: {e}",
                    is_rate_limit=True,
                ) from e
            raise GroqAPIError(f"Groq API грешка: {e}") from e


_groq_service: Optional[GroqService] = None


def get_groq_service() -> Optional[GroqService]:
    """Return Groq client or None if not configured / unavailable."""
    global _groq_service
    try:
        if _groq_service is None:
            _groq_service = GroqService()
        return _groq_service
    except GroqAPIError as e:
        if e.unavailable:
            logger.info("Groq not available: %s", e)
            return None
        raise


def reset_groq_service() -> None:
    global _groq_service
    _groq_service = None


def try_groq_generate(prompt: str) -> Optional[str]:
    """Generate text with Groq; None if Groq is not configured."""
    service = get_groq_service()
    if service is None:
        return None
    return service.generate_analysis_text(prompt)
