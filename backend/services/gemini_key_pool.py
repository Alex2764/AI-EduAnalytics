"""
Rotate between multiple Gemini API keys when quota (429) is hit.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Callable, List, Optional, TypeVar

from config import CONFIG_FILE_PATH, get_settings, mask_gemini_api_key_hint

logger = logging.getLogger(__name__)

LOCAL_KEYS_FILE = Path(__file__).resolve().parent.parent / "gemini_api_keys.local.json"

ALL_KEYS_EXHAUSTED_MESSAGE = "Лимитът е изчерпан. Опитай пак, утре!"

T = TypeVar("T")


def _read_config_data() -> dict:
    if not CONFIG_FILE_PATH.exists():
        return {}
    try:
        with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning("Could not read config.json for Gemini keys: %s", e)
        return {}


def _write_config_data(data: dict) -> None:
    with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _normalize_keys(raw: object) -> List[str]:
    if not isinstance(raw, list):
        return []
    keys: List[str] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, str):
            continue
        key = item.strip()
        if len(key) < 20 or key in seen:
            continue
        seen.add(key)
        keys.append(key)
    return keys


def load_gemini_api_keys(settings: Optional[object] = None) -> List[str]:
    """Load key pool: config array → local file → single UI key → .env."""
    data = _read_config_data()
    ai = data.get("ai_settings") or {}

    keys = _normalize_keys(ai.get("gemini_api_keys"))
    if keys:
        return keys

    if LOCAL_KEYS_FILE.exists():
        try:
            with open(LOCAL_KEYS_FILE, "r", encoding="utf-8") as f:
                local = json.load(f)
            keys = _normalize_keys(local.get("keys"))
            if keys:
                return keys
        except Exception as e:
            logger.warning("Could not read %s: %s", LOCAL_KEYS_FILE, e)

    single = ai.get("gemini_api_key")
    if isinstance(single, str):
        single = single.strip()
        if len(single) >= 20:
            return [single]

    env_key = None
    if settings is not None and getattr(settings, "gemini_api_key", None):
        env_key = settings.gemini_api_key
    else:
        try:
            env_key = get_settings().gemini_api_key
        except Exception:
            env_key = None
    if isinstance(env_key, str):
        env_key = env_key.strip()
        if len(env_key) >= 20:
            return [env_key]

    return []


def _key_fingerprint(key: str) -> str:
    return key[-8:] if len(key) >= 8 else key


class GeminiKeyPool:
    def __init__(self) -> None:
        self._keys: List[str] = []
        self._exhausted_until: dict[str, str] = {}
        self._active_index: int = 0
        self.reload()

    def reload(self) -> None:
        self._keys = load_gemini_api_keys(None)
        self._load_state()
        self._prune_expired()
        logger.info(
            "Gemini key pool: %d key(s), %d marked exhausted today",
            len(self._keys),
            sum(1 for k in self._keys if self._is_exhausted(k)),
        )

    def _load_state(self) -> None:
        data = _read_config_data()
        state = data.get("gemini_key_state") or {}
        exhausted = state.get("exhausted_until") or {}
        if isinstance(exhausted, dict):
            self._exhausted_until = {
                str(k): str(v) for k, v in exhausted.items() if v
            }
        idx = state.get("active_index", 0)
        self._active_index = int(idx) if isinstance(idx, int) else 0

    def _save_state(self) -> None:
        data = _read_config_data()
        data["gemini_key_state"] = {
            "exhausted_until": self._exhausted_until,
            "active_index": self._active_index,
        }
        _write_config_data(data)

    def _prune_expired(self) -> None:
        today = date.today().isoformat()
        changed = False
        for fp, until in list(self._exhausted_until.items()):
            if until < today:
                del self._exhausted_until[fp]
                changed = True
        if changed:
            self._save_state()

    def _is_exhausted(self, key: str) -> bool:
        until = self._exhausted_until.get(_key_fingerprint(key))
        if not until:
            return False
        return until >= date.today().isoformat()

    def mark_exhausted(self, key: str) -> None:
        fp = _key_fingerprint(key)
        self._exhausted_until[fp] = date.today().isoformat()
        self._save_state()
        logger.warning(
            "Gemini key marked exhausted for today (hint: %s)",
            mask_gemini_api_key_hint(key),
        )

    def available_indices(self) -> List[int]:
        return [i for i, k in enumerate(self._keys) if not self._is_exhausted(k)]

    def get_key_for_attempt(self, attempt: int) -> Optional[str]:
        available = self.available_indices()
        if not available:
            return None
        if len(self._keys) == 0:
            return None
        start = self._active_index % len(self._keys)
        ordered: List[int] = []
        for offset in range(len(self._keys)):
            idx = (start + offset) % len(self._keys)
            if idx in available and idx not in ordered:
                ordered.append(idx)
        for idx in available:
            if idx not in ordered:
                ordered.append(idx)
        if attempt >= len(ordered):
            return None
        chosen = ordered[attempt]
        return self._keys[chosen]

    def set_active_after_success(self, key: str) -> None:
        try:
            self._active_index = self._keys.index(key)
            self._save_state()
        except ValueError:
            pass

    @property
    def key_count(self) -> int:
        return len(self._keys)

    def status_hint(self) -> str:
        available = len(self.available_indices())
        return f"{available}/{len(self._keys)} налични ключове днес"


_pool: Optional[GeminiKeyPool] = None


def get_gemini_key_pool() -> GeminiKeyPool:
    global _pool
    if _pool is None:
        _pool = GeminiKeyPool()
    return _pool


def reload_gemini_key_pool() -> None:
    get_gemini_key_pool().reload()


def get_active_gemini_api_key() -> Optional[str]:
    pool = get_gemini_key_pool()
    return pool.get_key_for_attempt(0)


def call_gemini_with_key_rotation(
    operation: Callable[["GeminiService"], T],  # noqa: F821
) -> T:
    from services.gemini_service import (
        GeminiAPIError,
        GeminiService,
        get_gemini_service,
        reset_gemini_service,
    )

    pool = get_gemini_key_pool()
    if pool.key_count == 0:
        raise GeminiAPIError(
            ALL_KEYS_EXHAUSTED_MESSAGE,
            is_rate_limit=True,
            all_keys_exhausted=True,
        )

    last_error: Optional[GeminiAPIError] = None
    max_attempts = pool.key_count

    for attempt in range(max_attempts):
        api_key = pool.get_key_for_attempt(attempt)
        if not api_key:
            break

        reset_gemini_service()
        logger.info(
            "Trying Gemini key %d/%d (%s)",
            attempt + 1,
            max_attempts,
            pool.status_hint(),
        )

        try:
            service = get_gemini_service(api_key=api_key)
            result = operation(service)
            pool.set_active_after_success(api_key)
            return result
        except GeminiAPIError as e:
            if e.all_keys_exhausted:
                raise
            msg = str(e).lower()
            try_next_key = e.is_rate_limit or (
                "api key" in msg
                and ("invalid" in msg or "not valid" in msg)
            )
            if try_next_key:
                from services.gemini_service import GeminiService

                mark_daily = e.is_rate_limit and GeminiService._is_daily_quota_exhausted(
                    str(e)
                )
                if mark_daily:
                    pool.mark_exhausted(api_key)
                last_error = e
                logger.warning(
                    "Gemini key attempt %d failed (%s), trying next key...",
                    attempt + 1,
                    "quota" if e.is_rate_limit else "invalid key",
                )
                continue
            raise

    raise GeminiAPIError(
        ALL_KEYS_EXHAUSTED_MESSAGE,
        is_rate_limit=True,
        all_keys_exhausted=True,
    ) from last_error
