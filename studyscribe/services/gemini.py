"""Gemini AI helpers for notes and Q&A."""

from __future__ import annotations

import json
import logging
import os
import random
import time
from typing import Any

from pydantic import BaseModel, ValidationError

from studyscribe.core.config import settings


class GeminiError(RuntimeError):
    def __init__(self, message: str, user_message: str | None = None) -> None:
        super().__init__(message)
        self.user_message = user_message or message


class NotesOutput(BaseModel):
    summary: str
    suggested_tags: list[str]
    notes_markdown: str


class AnswerOutput(BaseModel):
    answer: str
    answer_markdown: str
    sources: list[dict] = []


_LOGGER = logging.getLogger(__name__)
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}


def _retry_settings() -> tuple[int, float]:
    raw_attempts = os.getenv("GEMINI_MAX_RETRIES", "3")
    raw_base = os.getenv("GEMINI_RETRY_BASE_SECONDS", "1.0")
    try:
        attempts = int(raw_attempts)
    except ValueError:
        _LOGGER.warning("Invalid GEMINI_MAX_RETRIES=%r; using 3", raw_attempts)
        attempts = 3
    try:
        base_delay = float(raw_base)
    except ValueError:
        _LOGGER.warning("Invalid GEMINI_RETRY_BASE_SECONDS=%r; using 1.0", raw_base)
        base_delay = 1.0
    return max(1, attempts), max(0.1, base_delay)


def _extract_status(exc: Exception) -> int | None:
    for attr in ("status_code", "code", "status", "http_status"):
        value = getattr(exc, attr, None)
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)
    return None


def _is_retryable(exc: Exception) -> bool:
    status = _extract_status(exc)
    if status in _RETRYABLE_STATUS:
        return True
    message = str(exc).lower()
    if "rate" in message or "quota" in message or "429" in message:
        return True
    return False


def _generate_content(prompt: str) -> str:
    client = _client()
    max_attempts, base_delay = _retry_settings()
    for attempt in range(1, max_attempts + 1):
        try:
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
            )
            return response.text or ""
        except Exception as exc:  # noqa: BLE001
            retryable = _is_retryable(exc)
            status = _extract_status(exc)
            if retryable and attempt < max_attempts:
                # Exponential backoff with jitter to reduce thundering herds on 429/5xx.
                delay = base_delay * (2 ** (attempt - 1)) + random.uniform(0, base_delay)
                _LOGGER.warning(
                    "Gemini API error (status=%s, attempt %s/%s). Retrying in %.1fs: %s",
                    status,
                    attempt,
                    max_attempts,
                    delay,
                    exc,
                )
                time.sleep(delay)
                continue
            _LOGGER.warning("Gemini API request failed (status=%s): %s", status, exc)
            if status == 429:
                user_message = "AI request was rate-limited. Please retry in a moment."
            else:
                user_message = "AI request failed. Please try again."
            raise GeminiError("Gemini API request failed.", user_message=user_message) from exc
    raise GeminiError("Gemini API request failed.", user_message="AI request failed. Please try again.")

def _client():
    if not settings.gemini_api_key:
        raise GeminiError(
            "Missing GEMINI_API_KEY",
            user_message="GEMINI_API_KEY is not set. Add it to enable AI features.",
        )
    try:
        from google import genai  # type: ignore
    except ImportError as exc:
        raise GeminiError(
            "google-genai package not installed",
            user_message="Gemini SDK is not installed. Install google-genai to enable AI features.",
        ) from exc
    return genai.Client(api_key=settings.gemini_api_key)


def _extract_json(text: str) -> dict[str, Any]:
    raw = text.strip()
    if "```" in raw:
        fence_start = raw.find("```")
        fence_end = raw.rfind("```")
        if fence_end > fence_start:
            raw = raw[fence_start + 3 : fence_end].strip()
            if raw.lower().startswith("json"):
                raw = raw[4:].strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidate = raw[start : end + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError as exc:
                raise GeminiError(
                    "Model returned invalid JSON.", user_message="AI response was invalid."
                ) from exc
        raise GeminiError("Model returned invalid JSON.", user_message="AI response was invalid.")


def generate_notes(prompt: str) -> NotesOutput:
    data = _extract_json(_generate_content(prompt))
    try:
        return NotesOutput(**data)
    except ValidationError as exc:
        raise GeminiError("Notes schema invalid.", user_message="AI notes response was invalid.") from exc


def answer_question(prompt: str, sources: list[dict]) -> AnswerOutput:
    data = _extract_json(_generate_content(prompt))
    try:
        answer = AnswerOutput(**data)
    except ValidationError as exc:
        raise GeminiError("Answer schema invalid.", user_message="AI answer response was invalid.") from exc
    answer.sources = sources
    return answer
