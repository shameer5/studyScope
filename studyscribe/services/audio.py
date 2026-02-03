"""Audio upload utilities."""

from __future__ import annotations

from pathlib import Path
from werkzeug.utils import secure_filename


def save_audio(file_storage, session_dir: Path) -> Path:
    audio_dir = session_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    filename = secure_filename(file_storage.filename or "") or "audio"
    dest = audio_dir / filename
    file_storage.save(dest)
    return dest
