# Architecture (C4-style)

This file describes Context, Container, and Component views with references to the code artifacts that implement each part.

Context
- Primary actor: Local user (learner/instructor) interacting via browser UI — templates: `studyscribe/web/templates/base.html` and `studyscribe/web/templates/session.html` (UI affordances and forms).
- External systems:
  - Google GenAI / Gemini API (optional): referenced in `studyscribe/services/gemini.py`: `_client()` (imports `google.genai`).
  - Local system binaries / libraries: `ffmpeg` (called in `studyscribe/services/transcribe.py`: `_ensure_wav()`), `faster_whisper` Python package (loaded in `_load_model()`).

Container
- Web application (Flask process)
  - Implemented by `studyscribe/app.py`: defines `app` and route handlers (`view_session()`, `upload_audio()`, `start_transcription()`, `start_notes()`, `ask_question()`, etc.). Startup bootstraps via top-level `/app.py` which imports `studyscribe.app:app` and calls `app.run()`.
  - Responsibilities: render templates (`web/templates`), handle uploads, validate inputs, orchestrate services, persist DB rows via `studyscribe/core/db.py`.

- Background job executor (in-process)
  - Implemented by `studyscribe/services/jobs.py`: `_EXECUTOR` (ThreadPoolExecutor), `enqueue_job()`, `create_job()`, `update_job()`.
  - Responsibilities: run long-running tasks (transcription, exports) asynchronously and persist job state in `jobs` table (`studyscribe/core/db.py`: `SCHEMA`).

- Persistence (relational + file storage)
  - SQLite DB: implemented by `studyscribe/core/db.py`: `get_connection()`, `init_db()` and `SCHEMA` (table definitions).
  - File storage: `DATA_DIR` defined in `studyscribe/core/config.py` and used by `studyscribe/app.py` helpers `_module_dir()` / `_session_dir()`.

- Third-party model runtimes
  - Gemini (remote): `studyscribe/services/gemini.py`: `generate_notes()`, `answer_question()`.
  - Local transcription model (`faster_whisper`): loaded in `studyscribe/services/transcribe.py`: `_load_model()`.

Component (inside the Flask web application)
- Routes / Request handlers
  - `studyscribe/app.py`: contains handlers for module/session CRUD, uploads, transcription kick-off, notes and QA endpoints. Example handlers: `create_module()`, `view_module()`, `create_session()`, `view_session()`, `upload_audio()`, `upload_attachment()`, `start_transcription()`, `start_notes()`, `ask_question()`, `api_ai_ask()`.

- Core helpers
  - Configuration: `studyscribe/core/config.py`: `Settings`, `DATA_DIR`, `DB_PATH`.
  - DB helpers & schema: `studyscribe/core/db.py`: `SCHEMA`, `execute()`, `fetch_all()`, `fetch_one()`.

- Services (business logic components)
  - Audio persistence: `studyscribe/services/audio.py`: `save_audio()`.
  - Transcription pipeline: `studyscribe/services/transcribe.py`: `_ensure_wav()`, `_chunk_wav()`, `transcribe_audio()`, `load_transcript()`.
  - Retrieval & chunking: `studyscribe/services/retrieval.py`: `build_chunks()`, `retrieve_chunks()`.
  - AI integration: `studyscribe/services/gemini.py`: `_client()`, `generate_notes()`, `answer_question()`, `NotesOutput`, `AnswerOutput`.
  - Export builder: `studyscribe/services/export.py`: `build_session_export()` and helpers for converting notes and building manifests.

- Web UI & Static
  - Templates: `studyscribe/web/templates/base.html`, `session.html`, `index.html`, `_transcript_panel.html` (rendering and UI placeholders).
  - Static assets: `studyscribe/web/static/js/app.js`, `studyscribe/web/static/css/app.css` (client interactivity and styles).

Deployment notes
- The repo contains a development entrypoint at `/app.py` which runs Flask directly (`/app.py` imports `studyscribe.app:app` and runs `app.run(...)`). For production please front with a WSGI server (e.g., Gunicorn) and consider moving background jobs out of the web worker into a separate worker process (current jobs executor is `ThreadPoolExecutor` in `studyscribe/services/jobs.py`).

References
- See `studyscribe/app.py` (routes & orchestration), `studyscribe/core/db.py` (schema), `studyscribe/core/config.py` (`DATA_DIR`, `DB_PATH`), and `studyscribe/services/*` for component responsibilities.
