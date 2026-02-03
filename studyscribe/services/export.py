"""Export session data into a reproducible ZIP bundle."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from zipfile import ZIP_DEFLATED, ZipFile

from studyscribe.core.config import settings


ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"}
ALLOWED_ATTACHMENT_EXTENSIONS = {".pdf", ".ppt", ".pptx", ".doc", ".docx"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_name(value: str | None, fallback: str) -> str:
    raw = (value or "").strip()
    if not raw:
        raw = fallback
    safe = raw.replace("/", "_").replace("\\", "_").strip()
    return safe or fallback


def _safe_filename_component(value: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", value)
    safe = safe.strip("._")
    return safe or "export"


def _write_zip_file(zip_file: ZipFile, src: Path, dest: str, files: list[str]) -> None:
    zip_file.write(src, dest)
    files.append(dest)


def build_session_export(
    *,
    module: dict,
    session: dict,
    session_dir: Path,
    include_ai_notes: bool,
    include_personal_notes: bool,
    include_transcript: bool,
    include_audio: bool,
    include_attachments: bool,
    include_raw_chunks: bool,
    include_prompt_manifest: bool,
) -> Path:
    exports_dir = session_dir / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)

    safe_module = _safe_name(module.get("name"), "Module")
    safe_session = _safe_name(session.get("name"), "Session")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filename = _safe_filename_component(f"StudyScribe_{safe_module}_{safe_session}_{timestamp}.zip")
    zip_path = exports_dir / filename
    root = f"StudyScribe/{safe_module}/{safe_session}"

    files: list[str] = []

    with ZipFile(zip_path, "w", compression=ZIP_DEFLATED) as zip_file:
        if include_ai_notes:
            notes_path = session_dir / "notes" / "ai_notes.md"
            if notes_path.exists():
                _write_zip_file(zip_file, notes_path, f"{root}/ai_notes.md", files)

        if include_personal_notes:
            annotations_path = session_dir / "annotations.json"
            notes_html = None
            notes_markdown = None
            notes_plain = None
            if annotations_path.exists():
                data = json.loads(annotations_path.read_text(encoding="utf-8"))
                notes_html = data.get("notes_html") or None
                notes_markdown = data.get("notes_markdown") or None
                notes_plain = data.get("notes") or None
            if notes_markdown:
                markdown_path = session_dir / "notes" / "personal_notes.md"
                markdown_path.write_text(notes_markdown, encoding="utf-8")
                _write_zip_file(zip_file, markdown_path, f"{root}/personal_notes.md", files)
            elif notes_plain:
                markdown_path = session_dir / "notes" / "personal_notes.md"
                markdown_path.write_text(notes_plain, encoding="utf-8")
                _write_zip_file(zip_file, markdown_path, f"{root}/personal_notes.md", files)
            if notes_html:
                html_path = session_dir / "notes" / "personal_notes.html"
                html_path.write_text(notes_html, encoding="utf-8")
                _write_zip_file(zip_file, html_path, f"{root}/personal_notes.html", files)

        if include_transcript:
            transcript_txt = session_dir / "transcript" / "transcript.txt"
            if transcript_txt.exists():
                _write_zip_file(zip_file, transcript_txt, f"{root}/transcript.txt", files)

        if include_audio:
            audio_dir = session_dir / "audio"
            if audio_dir.exists():
                for path in audio_dir.iterdir():
                    if path.is_file() and path.suffix.lower() in ALLOWED_AUDIO_EXTENSIONS:
                        _write_zip_file(zip_file, path, f"{root}/audio/{path.name}", files)

        if include_attachments:
            attachments_dir = session_dir / "attachments"
            if attachments_dir.exists():
                for path in attachments_dir.iterdir():
                    if not path.is_file():
                        continue
                    if path.name in {"extracted.txt", "extracted_sources.json"}:
                        continue
                    if path.suffix.lower() not in ALLOWED_ATTACHMENT_EXTENSIONS:
                        continue
                    _write_zip_file(zip_file, path, f"{root}/attachments/{path.name}", files)

        if include_raw_chunks:
            chunks_path = session_dir / "transcript" / "chunks.json"
            if chunks_path.exists():
                _write_zip_file(zip_file, chunks_path, f"{root}/raw/chunks.json", files)

        if include_prompt_manifest:
            manifest_path = session_dir / "notes" / "prompt_manifest.json"
            manifest_payload = {
                "exported_at": _now_iso(),
                "meta": {"model": settings.gemini_model},
            }
            last_answer = session_dir / "notes" / "last_answer.json"
            if last_answer.exists():
                manifest_payload["last_answer"] = json.loads(last_answer.read_text(encoding="utf-8"))
            manifest_path.write_text(json.dumps(manifest_payload, indent=2), encoding="utf-8")
            _write_zip_file(zip_file, manifest_path, f"{root}/prompt_manifest.json", files)

        manifest = {
            "module": {"id": module.get("id"), "name": module.get("name")},
            "session": {"id": session.get("id"), "name": session.get("name")},
            "exported_at": _now_iso(),
            "included": {
                "include_ai_notes": include_ai_notes,
                "include_personal_notes": include_personal_notes,
                "include_transcript": include_transcript,
                "include_audio": include_audio,
                "include_attachments": include_attachments,
                "include_raw_chunks": include_raw_chunks,
                "include_prompt_manifest": include_prompt_manifest,
            },
            "files": sorted(files + [f"{root}/manifest.json"]),
        }
        manifest_path = session_dir / "exports" / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        _write_zip_file(zip_file, manifest_path, f"{root}/manifest.json", files)

    return zip_path
