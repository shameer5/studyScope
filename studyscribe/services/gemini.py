"""Gemini AI helpers for notes and Q&A."""

from __future__ import annotations

import json
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
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:].strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise GeminiError("Model returned invalid JSON.", user_message="AI response was invalid.") from exc


def generate_notes(prompt: str) -> NotesOutput:
    client = _client()
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
    )
    data = _extract_json(response.text or "")
    try:
        return NotesOutput(**data)
    except ValidationError as exc:
        raise GeminiError("Notes schema invalid.", user_message="AI notes response was invalid.") from exc


def answer_question(prompt: str, sources: list[dict]) -> AnswerOutput:
    client = _client()
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
    )
    data = _extract_json(response.text or "")
    try:
        answer = AnswerOutput(**data)
    except ValidationError as exc:
        raise GeminiError("Answer schema invalid.", user_message="AI answer response was invalid.") from exc
    answer.sources = sources
    return answer
