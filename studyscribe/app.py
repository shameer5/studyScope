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


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _module_dir(module_id: str) -> Path:
    return config.DATA_DIR / "modules" / module_id


def _session_dir(module_id: str, session_id: str) -> Path:
    return _module_dir(module_id) / "sessions" / session_id


def _ensure_session_dirs(session_dir: Path) -> None:
    for name in ("audio", "attachments", "transcript", "notes", "exports", "work"):
        (session_dir / name).mkdir(parents=True, exist_ok=True)


def _collect_audio_files(session_dir: Path) -> list[dict]:
    audio_dir = session_dir / "audio"
    if not audio_dir.exists():
        return []
    files = []
    for path in sorted(audio_dir.iterdir()):
        if path.is_file():
            files.append(
                {
                    "name": path.name,
                    "size": path.stat().st_size,
                }
            )
    return files


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


def _init() -> None:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    db.init_db()


@app.template_filter("format_ts")
def _format_ts_filter(seconds: float) -> str:
    return _format_ts(seconds)


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
    session_dir = _session_dir(session["module_id"], session_id)
    _ensure_session_dirs(session_dir)
    transcript_path = session_dir / "transcript" / "transcript.json"
    transcript = load_transcript(transcript_path)
    job_id = request.args.get("job_id")
    modules = db.fetch_all("SELECT * FROM modules ORDER BY created_at DESC")
    return render_template(
        "session.html",
        module=dict(module),
        session=dict(session),
        modules=[dict(row) for row in modules],
        audio_files=_collect_audio_files(session_dir),
        transcript=transcript,
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
        flash("No audio file selected.", "error")
        return redirect(url_for("view_session", session_id=session_id)), 400
    ext = Path(file_storage.filename).suffix.lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        flash("Unsupported audio file type.", "error")
        return redirect(url_for("view_session", session_id=session_id)), 400
    session_dir = _session_dir(module_id, session_id)
    _ensure_session_dirs(session_dir)
    if request.form.get("replace") == "1":
        audio_dir = session_dir / "audio"
        if audio_dir.exists():
            shutil.rmtree(audio_dir)
        _clear_transcript(session_dir)
    saved_path = save_audio(file_storage, session_dir)
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
    html = render_template("_transcript_panel.html", transcript=transcript)
    return jsonify({"html": html, "has_transcript": bool(transcript)})


def create_app(*, testing: bool = False, data_dir: Path | None = None, db_path: Path | None = None) -> Flask:
    if data_dir or db_path:
        config.override_paths(data_dir=data_dir, db_path=db_path)
    app.config["TESTING"] = testing
    _init()
    return app


_init()
