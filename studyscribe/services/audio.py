"""Audio upload utilities."""

from __future__ import annotations

from pathlib import Path
from werkzeug.utils import secure_filename

from studyscribe.core.storage import check_disk_space, ensure_private_dir


def save_audio(file_storage, session_dir: Path) -> Path:
    audio_dir = session_dir / "audio"
    ensure_private_dir(audio_dir)
    check_disk_space(session_dir)
    filename = secure_filename(file_storage.filename or "") or "audio"
    dest = audio_dir / filename
    file_storage.save(dest)
    return dest
