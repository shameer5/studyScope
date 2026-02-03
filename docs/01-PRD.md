# Product Requirements Document (PRD)

Project: StudyScribe — local-first study session capture and AI-assisted notes

1) Problem
- Students and learners need a simple, local tool to capture audio, attachments and generate concise study notes and Q&A from meeting/lecture recordings. Evidence: app exposes audio uploads and attachment handling in `studyscribe/web/templates/session.html` and `studyscribe/app.py`: `upload_audio()`.

2) Users
- Primary: individual students or instructors running a local instance (single-user). Evidence: no auth present (`studyscribe/app.py` route handlers are unauthenticated).

3) Jobs-to-be-done
- Save class/session audio and attachments for later review — see `studyscribe/services/audio.py`: `save_audio()` and `studyscribe/app.py`: `_session_dir()`.
- Produce searchable, timestamped transcripts and chunked text for retrieval — see `studyscribe/services/transcribe.py`: `transcribe_audio()` and `studyscribe/services/retrieval.py`: `build_chunks()`.
- Generate concise AI notes and suggested tags from session content — see `studyscribe/services/gemini.py`: `generate_notes()` and `studyscribe/services/gemini.py`: `_build_notes_prompt()`.
- Ask targeted questions with cited transcript snippets — see `studyscribe/services/gemini.py`: `answer_question()` and `studyscribe/app.py`: `ask_question()`/`api_ai_ask()`.

4) Goals
- Reliable local storage of sessions and attachments (`studyscribe/core/config.py`: `DATA_DIR`).
- Clear, reproducible exports including notes, transcript, audio, and an optional prompt manifest (`studyscribe/services/export.py`: `build_session_export()`).
- Lightweight, privacy-friendly AI features that require an explicit API key to enable (`studyscribe/services/gemini.py`: `_client()` checks `settings.gemini_api_key`).

5) Non-Goals
- Multi-tenant authentication, user accounts, or hosted SaaS deployment (no auth module; DB is local SQLite: `studyscribe/core/db.py`: `DB_PATH`).
- High-throughput distributed transcription scaling (transcription uses local `faster_whisper` / `ffmpeg` in `studyscribe/services/transcribe.py`).

6) Constraints
- Local filesystem storage (see `studyscribe/core/config.py`: `DATA_DIR`) and SQLite (`studyscribe/core/db.py`: `SCHEMA`).
- AI features gated by `GEMINI_API_KEY` and availability of the `google.genai` SDK (`studyscribe/services/gemini.py`: `_client()`).
- Transcription requires `ffmpeg` and the `faster_whisper` package (`studyscribe/services/transcribe.py`: `_ensure_wav()`, `_load_model()`).

7) Success metrics
- Functional: ability to upload audio and generate a transcript saved at `session_dir/transcript/transcript.json` (verify via `studyscribe/services/transcribe.py`).
- UX: user can generate AI notes and see them in the session UI (`studyscribe/web/templates/session.html`: AI Notes section triggered by `start_notes()` route in `studyscribe/app.py`).
- Reliability: export ZIP produced including selected artifacts (`studyscribe/services/export.py`: `build_session_export()` writes `manifest.json`).

8) Assumptions
- ASSUMPTION: Intended for local/single-user use (no auth and in-code comments implying local-first design). Evidence: `studyscribe/core/config.py`: `DATA_DIR` usage and lack of auth handlers in `studyscribe/app.py`.
- ASSUMPTION: Operators will provide `GEMINI_API_KEY` to enable AI features; otherwise app still functions for uploads and transcription. Evidence: `studyscribe/services/gemini.py`: `_client()` raises `GeminiError` when `settings.gemini_api_key` is missing.
