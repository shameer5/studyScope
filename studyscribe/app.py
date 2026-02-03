"""Flask app module."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import os
import shutil

from flask import Flask, abort, flash, jsonify, redirect, render_template, request, url_for

from studyscribe.core import config, db
from studyscribe.services.audio import save_audio
from studyscribe.services.jobs import create_job, enqueue_job, get_job
from studyscribe.services.transcribe import TranscriptionError, load_transcript, transcribe_audio


BASE_DIR = Path(__file__).resolve().parent
app = Flask(
    __name__,
    static_folder=str(BASE_DIR / "web" / "static"),
    template_folder=str(BASE_DIR / "web" / "templates"),
)
app.secret_key = os.getenv("FLASK_SECRET", "studyscribe-dev")

ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg"}
ALLOWED_ATTACHMENT_EXTENSIONS = {".pdf", ".ppt", ".pptx", ".doc", ".docx"}


@app.context_processor
def inject_config():
    return {"config": config.settings}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _module_dir(module_id: str) -> Path:
    return config.DATA_DIR / "modules" / module_id


def _session_dir(module_id: str, session_id: str) -> Path:
    return _module_dir(module_id) / "sessions" / session_id


def _ensure_session_dirs(session_dir: Path) -> None:
    for name in ("audio", "attachments", "transcript", "notes", "exports", "work"):
        (session_dir / name).mkdir(parents=True, exist_ok=True)

def _format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes / (1024 * 1024):.1f} MB"


def _collect_files(directory: Path, allowed_extensions: set[str] | None = None) -> list[dict]:
    if not directory.exists():
        return []
    files = []
    for path in sorted(directory.iterdir(), key=lambda item: item.stat().st_mtime, reverse=True):
        if not path.is_file():
            continue
        if allowed_extensions is not None and path.suffix.lower() not in allowed_extensions:
            continue
        files.append(
            {
                "name": path.name,
                "size": _format_size(path.stat().st_size),
            }
        )
    return files


def _collect_audio_files(session_dir: Path) -> list[dict]:
    return _collect_files(session_dir / "audio", ALLOWED_AUDIO_EXTENSIONS)


def _select_latest_audio(session_dir: Path) -> Path | None:
    audio_dir = session_dir / "audio"
    if not audio_dir.exists():
        return None
    files = [p for p in audio_dir.iterdir() if p.is_file()]
    if not files:
        return None
    return max(files, key=lambda p: p.stat().st_mtime)


def _clear_transcript(session_dir: Path) -> None:
    transcript_dir = session_dir / "transcript"
    if transcript_dir.exists():
        shutil.rmtree(transcript_dir)


def _format_ts(seconds: float) -> str:
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes:02d}:{secs:02d}"


def _format_datetime(value: str | None) -> str:
    if not value:
        return ""
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return value
    return parsed.astimezone(timezone.utc).strftime("%d %b %Y, %I:%M %p")


def _wants_json() -> bool:
    accept = request.headers.get("Accept", "")
    return "application/json" in accept.lower()


def _json_error(message: str, status: int = 400):
    return jsonify({"ok": False, "error": message}), status


def _json_not_implemented(message: str = "Not implemented in Sprint 2 (UI/UX parity)."):
    return _json_error(message, status=501)


def _init() -> None:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    db.init_db()


@app.template_filter("format_ts")
def _format_ts_filter(seconds: float) -> str:
    return _format_ts(seconds)


@app.template_filter("format_dt")
def _format_dt_filter(value: str | None) -> str:
    return _format_datetime(value)


@app.route("/")
def index():
    return redirect(url_for("home"))


@app.route("/home")
def home():
    modules = db.fetch_all("SELECT * FROM modules ORDER BY created_at DESC")
    return render_template("index.html", modules=[dict(row) for row in modules])


@app.route("/modules", methods=["POST"])
def create_module():
    name = (request.form.get("name") or "").strip()
    if not name:
        flash("Module name is required.", "error")
        return redirect(url_for("home")), 400
    module_id = str(uuid4())
    db.execute(
        "INSERT INTO modules (id, name, created_at) VALUES (?, ?, ?)",
        (module_id, name, _now_iso()),
    )
    _module_dir(module_id).mkdir(parents=True, exist_ok=True)
    flash("Module created.", "success")
    return redirect(url_for("view_module", module_id=module_id))


@app.route("/modules/<module_id>")
def view_module(module_id: str):
    module = db.fetch_one("SELECT * FROM modules WHERE id = ?", (module_id,))
    if not module:
        abort(404)
    sessions = db.fetch_all(
        "SELECT * FROM sessions WHERE module_id = ? ORDER BY created_at DESC", (module_id,)
    )
    modules = db.fetch_all("SELECT * FROM modules ORDER BY created_at DESC")
    return render_template(
        "module.html",
        module=dict(module),
        sessions=[dict(row) for row in sessions],
        modules=[dict(row) for row in modules],
    )


@app.route("/modules/<module_id>/sessions", methods=["POST"])
def create_session(module_id: str):
    module = db.fetch_one("SELECT * FROM modules WHERE id = ?", (module_id,))
    if not module:
        abort(404)
    name = (request.form.get("name") or "").strip() or "Untitled"
    session_id = str(uuid4())
    db.execute(
        "INSERT INTO sessions (id, module_id, name, created_at) VALUES (?, ?, ?, ?)",
        (session_id, module_id, name, _now_iso()),
    )
    session_dir = _session_dir(module_id, session_id)
    session_dir.mkdir(parents=True, exist_ok=True)
    _ensure_session_dirs(session_dir)
    rename = "1" if name == "Untitled" else None
    return redirect(
        url_for("view_session", session_id=session_id, rename=rename) if rename else url_for("view_session", session_id=session_id)
    )


@app.route("/modules/<module_id>/sessions/<session_id>")
def legacy_view_session(module_id: str, session_id: str):
    return redirect(url_for("view_session", session_id=session_id))


@app.route("/sessions/<session_id>")
def view_session(session_id: str):
    session = db.fetch_one("SELECT * FROM sessions WHERE id = ?", (session_id,))
    if not session:
        abort(404)
    module = db.fetch_one("SELECT * FROM modules WHERE id = ?", (session["module_id"],))
    if not module:
        abort(404)
    sessions = db.fetch_all(
        "SELECT * FROM sessions WHERE module_id = ? ORDER BY created_at DESC",
        (session["module_id"],),
    )
    session_dir = _session_dir(session["module_id"], session_id)
    _ensure_session_dirs(session_dir)
    transcript_path = session_dir / "transcript" / "transcript.json"
    transcript = load_transcript(transcript_path)
    job_id = request.args.get("job_id")
    modules = db.fetch_all("SELECT * FROM modules ORDER BY created_at DESC")
    audio_files = _collect_audio_files(session_dir)
    attachment_files: list[dict] = []
    attachments_with_text: set[str] = set()
    attachment_warning = ""
    annotations = {"tags": {}, "notes": "", "notes_html": "", "notes_markdown": "", "session_tags": []}
    notes_html = ""
    ai_notes = ""
    suggested_tags: list[str] = []
    session_tags: list[str] = []
    has_transcript = bool(transcript)
    has_attachments = bool(attachment_files)
    has_attachment_text = False
    has_notes = False
    has_generate_content = has_transcript or has_attachment_text or has_notes
    has_qa_content = has_transcript or has_attachment_text
    generate_hint = "Upload audio or attachments to generate notes."
    qa_hint = "Upload transcript or attachments to enable Q&A."
    session_meta = {
        "hasTranscript": has_transcript,
        "hasAttachments": has_attachments,
        "hasAttachmentText": has_attachment_text,
        "hasNotes": has_notes,
        "hasGenerateContent": has_generate_content,
        "hasQaContent": has_qa_content,
        "attachmentNames": [item["name"] for item in attachment_files],
        "moduleId": session["module_id"],
        "sessionId": session_id,
        "moduleName": module["name"],
        "sessionName": session["name"],
        "autoRename": request.args.get("rename") == "1",
        "exportUrl": url_for("export_pack", module_id=module["id"], session_id=session_id),
        "generateUrl": url_for("start_notes", module_id=module["id"], session_id=session_id),
        "notesUrl": url_for("fetch_ai_notes", module_id=module["id"], session_id=session_id),
        "transcriptUrl": url_for("fetch_transcript", module_id=module["id"], session_id=session_id),
        "deleteTranscriptUrl": url_for("delete_transcript", module_id=module["id"], session_id=session_id),
        "segmentTagsUrl": url_for("update_segment_tags", module_id=module["id"], session_id=session_id),
        "qaAskUrl": url_for("api_ai_ask"),
        "qaMessagesUrl": url_for("api_ai_messages", session_id=session_id),
        "hasAudio": len(audio_files) > 0,
        "suggestedTags": suggested_tags,
    }
    return render_template(
        "session.html",
        module=dict(module),
        session=dict(session),
        sessions=[dict(row) for row in sessions],
        modules=[dict(row) for row in modules],
        audio_files=audio_files,
        attachment_files=attachment_files,
        attachments_with_text=attachments_with_text,
        attachment_warning=attachment_warning,
        transcript=transcript,
        annotations=annotations,
        notes_html=notes_html,
        ai_notes=ai_notes,
        suggested_tags=suggested_tags,
        session_tags=session_tags,
        has_generate_content=has_generate_content,
        has_qa_content=has_qa_content,
        generate_hint=generate_hint,
        qa_hint=qa_hint,
        session_meta=session_meta,
        job_id=job_id,
        transcript_url=url_for("fetch_transcript", module_id=module["id"], session_id=session_id),
    )


@app.route("/modules/<module_id>/sessions/<session_id>/upload-audio", methods=["POST"])
def upload_audio(module_id: str, session_id: str):
    session = db.fetch_one(
        "SELECT * FROM sessions WHERE id = ? AND module_id = ?", (session_id, module_id)
    )
    if not session:
        abort(404)
    file_storage = request.files.get("audio")
    if not file_storage or not file_storage.filename:
        if _wants_json():
            return _json_error("No audio file selected.", status=400)
        flash("No audio file selected.", "error")
        return redirect(url_for("view_session", session_id=session_id)), 400
    ext = Path(file_storage.filename).suffix.lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        if _wants_json():
            return _json_error("Unsupported audio file type.", status=400)
        flash("Unsupported audio file type.", "error")
        return redirect(url_for("view_session", session_id=session_id)), 400
    session_dir = _session_dir(module_id, session_id)
    _ensure_session_dirs(session_dir)
    audio_dir = session_dir / "audio"
    existing_audio = list(audio_dir.glob("*")) if audio_dir.exists() else []
    replace = request.form.get("replace") == "1"
    if existing_audio and not replace:
        if _wants_json():
            return _json_error("Audio already uploaded. Replace the audio to continue.", status=400)
        flash("Audio already uploaded. Replace the audio to continue.", "error")
        return redirect(url_for("view_session", session_id=session_id)), 400
    if existing_audio and replace:
        shutil.rmtree(audio_dir)
        _clear_transcript(session_dir)
    saved_path = save_audio(file_storage, session_dir)
    if _wants_json():
        return jsonify({"ok": True, "filename": saved_path.name})
    flash(f"Audio saved to {saved_path.name}.", "success")
    return redirect(url_for("view_session", session_id=session_id))


@app.route("/modules/<module_id>/sessions/<session_id>/transcribe", methods=["POST"])
def start_transcription(module_id: str, session_id: str):
    session = db.fetch_one(
        "SELECT * FROM sessions WHERE id = ? AND module_id = ?", (session_id, module_id)
    )
    if not session:
        abort(404)
    session_dir = _session_dir(module_id, session_id)
    audio_path = _select_latest_audio(session_dir)
    if not audio_path:
        flash("Upload an audio file before transcribing.", "error")
        return redirect(url_for("view_session", session_id=session_id)), 400
    job_id = create_job("Queued for transcription.")
    try:
        enqueue_job(job_id, transcribe_audio, audio_path, session_dir)
    except TranscriptionError as exc:
        flash(exc.user_message, "error")
        return redirect(url_for("view_session", session_id=session_id)), 500
    flash("Transcription started.", "success")
    return redirect(url_for("view_session", session_id=session_id, job_id=job_id))


@app.route("/jobs/<job_id>")
def job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        abort(404)
    return jsonify(
        {
            "id": job["id"],
            "status": job["status"],
            "progress": job["progress"],
            "message": job["message"],
            "result": job.get("result_path"),
        }
    )


@app.route("/modules/<module_id>/sessions/<session_id>/transcript")
def fetch_transcript(module_id: str, session_id: str):
    session = db.fetch_one(
        "SELECT * FROM sessions WHERE id = ? AND module_id = ?", (session_id, module_id)
    )
    if not session:
        abort(404)
    session_dir = _session_dir(module_id, session_id)
    transcript_path = session_dir / "transcript" / "transcript.json"
    transcript = load_transcript(transcript_path)
    html = render_template("_transcript_panel.html", transcript=transcript, annotations={"tags": {}})
    return jsonify({"html": html, "has_transcript": bool(transcript)})


@app.route("/modules/<module_id>/sessions/<session_id>/upload-attachment", methods=["POST"])
def upload_attachment(module_id: str, session_id: str):
    if _wants_json():
        return _json_not_implemented("Attachments are not available in Sprint 2.")
    flash("Attachments are not available in Sprint 2 (UI/UX parity).", "warning")
    return redirect(url_for("view_session", session_id=session_id))


@app.route("/modules/<module_id>/sessions/<session_id>/delete-audio", methods=["POST"])
def delete_audio(module_id: str, session_id: str):
    return _json_not_implemented("Audio deletion is not available in Sprint 2.")


@app.route("/modules/<module_id>/sessions/<session_id>/delete-attachment", methods=["POST"])
def delete_attachment(module_id: str, session_id: str):
    return _json_not_implemented("Attachment deletion is not available in Sprint 2.")


@app.route("/modules/<module_id>/sessions/<session_id>/annotations", methods=["POST"])
def save_annotations(module_id: str, session_id: str):
    if _wants_json():
        return _json_not_implemented("Notes are not available in Sprint 2.")
    flash("Notes are not available in Sprint 2 (UI/UX parity).", "warning")
    return redirect(url_for("view_session", session_id=session_id))


@app.route("/modules/<module_id>/sessions/<session_id>/transcript/delete", methods=["POST"])
def delete_transcript(module_id: str, session_id: str):
    return _json_not_implemented("Transcript deletion is not available in Sprint 2.")


@app.route("/modules/<module_id>/sessions/<session_id>/transcript/tags", methods=["POST"])
def update_segment_tags(module_id: str, session_id: str):
    return _json_not_implemented("Transcript tagging is not available in Sprint 2.")


@app.route("/modules/<module_id>/sessions/<session_id>/notes", methods=["POST"])
def start_notes(module_id: str, session_id: str):
    return _json_not_implemented("AI notes are not available in Sprint 2.")


@app.route("/modules/<module_id>/sessions/<session_id>/notes", methods=["GET"])
def fetch_ai_notes(module_id: str, session_id: str):
    return _json_not_implemented("AI notes are not available in Sprint 2.")


@app.route("/modules/<module_id>/sessions/<session_id>/export", methods=["POST"])
def export_pack(module_id: str, session_id: str):
    return _json_not_implemented("Export is not available in Sprint 2.")


@app.route("/modules/<module_id>/sessions/<session_id>/ask", methods=["POST"])
def ask_question(module_id: str, session_id: str):
    if _wants_json():
        return _json_not_implemented("Q&A is not available in Sprint 2.")
    flash("Q&A is not available in Sprint 2 (UI/UX parity).", "warning")
    return redirect(url_for("view_session", session_id=session_id))


@app.route("/api/ai/ask", methods=["POST"])
def api_ai_ask():
    return _json_not_implemented("Q&A is not available in Sprint 2.")


@app.route("/api/sessions/<session_id>/ai/messages", methods=["GET"])
def api_ai_messages(session_id: str):
    return jsonify({"messages": []})


@app.route("/modules/<module_id>", methods=["PATCH"])
def update_module(module_id: str):
    return _json_not_implemented("Module rename is not available in Sprint 2.")


@app.route("/modules/<module_id>", methods=["DELETE"])
def delete_module(module_id: str):
    return _json_not_implemented("Module delete is not available in Sprint 2.")


@app.route("/sessions/<session_id>", methods=["PATCH"])
def update_session(session_id: str):
    return _json_not_implemented("Session rename is not available in Sprint 2.")


@app.route("/sessions/<session_id>", methods=["DELETE"])
def delete_session(session_id: str):
    return _json_not_implemented("Session delete is not available in Sprint 2.")


def create_app(*, testing: bool = False, data_dir: Path | None = None, db_path: Path | None = None) -> Flask:
    if data_dir or db_path:
        config.override_paths(data_dir=data_dir, db_path=db_path)
    app.config["TESTING"] = testing
    _init()
    return app


_init()
