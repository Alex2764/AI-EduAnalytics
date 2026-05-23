"""
Two-stage AI analysis: Groq generates → Gemini edits (with fallbacks).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from services.gemini_key_pool import (
    ALL_KEYS_EXHAUSTED_MESSAGE,
    call_gemini_with_key_rotation,
)
from services.gemini_service import (
    GeminiAPIError,
    build_analysis_prompt,
    parse_and_validate_analysis,
)
from services.groq_service import GroqAPIError, get_groq_service

GROQ_NOT_CONFIGURED_HINT = (
    " Gemini лимитът е изчерпан за днес. Добавете GROQ_API_KEY в backend/.env "
    "(безплатен ключ: https://console.groq.com) — анализът ще се генерира с Groq."
)

logger = logging.getLogger(__name__)


class AnalysisGenerationError(Exception):
    """Both providers failed or analysis could not be produced."""

    def __init__(self, message: str, is_rate_limit: bool = False):
        super().__init__(message)
        self.is_rate_limit = is_rate_limit


def _gemini_all_exhausted(exc: GeminiAPIError) -> bool:
    return bool(getattr(exc, "all_keys_exhausted", False))


def _parse_raw_analysis(ai_text: str) -> Dict[str, str]:
    return parse_and_validate_analysis(ai_text)


def generate_test_analysis(test_data: Dict[str, Any]) -> Dict[str, str]:
    """
    Stage 1: Groq draft (2048 tokens, full prompt).
    Stage 2: Gemini edit (800 tokens, style only).

    Fallbacks:
    - No Groq → Gemini generates alone.
    - Groq OK, Gemini exhausted → return Groq text parsed.
    - Both fail → AnalysisGenerationError.
    """
    prompt = build_analysis_prompt(test_data)
    groq_text: Optional[str] = None
    groq_failed_rate_limit = False

    groq = get_groq_service()
    if groq is not None:
        try:
            groq_text = groq.generate_analysis_text(prompt)
            logger.info("Pipeline stage 1 (Groq) succeeded")
        except GroqAPIError as e:
            if e.unavailable:
                logger.info("Groq unavailable, falling back to Gemini-only")
            elif e.is_rate_limit:
                groq_failed_rate_limit = True
                logger.warning("Groq rate limit: %s", e)
            else:
                logger.warning("Groq error: %s — trying Gemini-only", e)
    else:
        logger.info("Groq not configured — Gemini-only mode")

    if groq_text:
        try:
            edited_text = call_gemini_with_key_rotation(
                lambda svc: svc.edit_analysis_text(groq_text)
            )
            logger.info("Pipeline stage 2 (Gemini edit) succeeded")
            return _parse_raw_analysis(edited_text)
        except GeminiAPIError as e:
            if _gemini_all_exhausted(e) or e.is_rate_limit:
                logger.warning(
                    "Gemini exhausted after Groq — using Groq draft without edit"
                )
                return _parse_raw_analysis(groq_text)
            raise AnalysisGenerationError(str(e)) from e

    # Groq did not produce text — full Gemini generation
    try:
        logger.info("Pipeline: Gemini-only generation")
        return call_gemini_with_key_rotation(
            lambda svc: svc.generate_analysis(test_data)
        )
    except GeminiAPIError as e:
        if _gemini_all_exhausted(e) or e.is_rate_limit:
            msg = ALL_KEYS_EXHAUSTED_MESSAGE
            if get_groq_service() is None:
                msg = ALL_KEYS_EXHAUSTED_MESSAGE + GROQ_NOT_CONFIGURED_HINT
            raise AnalysisGenerationError(msg, is_rate_limit=True) from e
        raise AnalysisGenerationError(str(e), is_rate_limit=e.is_rate_limit) from e
