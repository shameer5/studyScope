"""Runtime configuration for StudyScribe."""

from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = BASE_DIR / "studyscribe.db"


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str | None
    gemini_model: str
    chunk_seconds: int


def load_settings() -> Settings:
    chunk_str = os.getenv("TRANSCRIBE_CHUNK_SECONDS", "600")
    try:
        chunk_seconds = int(chunk_str)
    except ValueError as exc:
        raise ValueError(
            f"TRANSCRIBE_CHUNK_SECONDS must be an integer, got: {chunk_str!r}"
        ) from exc
    if chunk_seconds <= 0:
        raise ValueError("TRANSCRIBE_CHUNK_SECONDS must be positive")
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY"),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        chunk_seconds=chunk_seconds,
    )


settings = load_settings()


def override_paths(data_dir: Path | None = None, db_path: Path | None = None) -> None:
    """Override DATA_DIR or DB_PATH (used by tests)."""
    global DATA_DIR, DB_PATH
    if data_dir is not None:
        DATA_DIR = Path(data_dir)
    if db_path is not None:
        DB_PATH = Path(db_path)
