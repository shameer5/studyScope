# Repository Map — StudyScribe

This document maps the codebase into a concise reference that supports rebuilding the system with feature and UX parity. Every factual claim below references a concrete repository artifact (file path + symbol).

---

1) Quick Summary

- Local-first web app to capture study sessions (modules → sessions) with attachments and audio uploads — see `studyscribe/app.py`: `app`, `create_module()` and `view_module()`.
- Persist session/module metadata in SQLite and store per-session files on disk under `DATA_DIR` — see `studyscribe/core/db.py`: `SCHEMA`, `init_db()` and `studyscribe/core/config.py`: `DATA_DIR`.
- Record and persist uploaded audio, then transcribe into timestamped segments and chunks — see `studyscribe/services/audio.py`: `save_audio()` and `studyscribe/services/transcribe.py`: `transcribe_audio()`.
- Provide lightweight retrieval and Q&A over transcripts via chunking and model calls — see `studyscribe/services/retrieval.py`: `build_chunks()` / `retrieve_chunks()` and `studyscribe/services/gemini.py`: `answer_question()`.
- Generate AI study notes and persist AI messages/sources for sessions — see `studyscribe/services/gemini.py`: `generate_notes()` and `studyscribe/app.py`: `_store_ai_message()` / `_store_ai_sources()`.
- Export a session as a reproducible ZIP containing notes, transcript, audio, attachments, and an optional prompt manifest — see `studyscribe/services/export.py`: `build_session_export()`.

2) Tech Stack (evidence)

- Front-end: Jinja templates + minimal client JS — see `studyscribe/web/templates/base.html`: layout blocks and `studyscribe/web/templates/session.html`: session UI; client behaviour in `studyscribe/web/static/js/app.js`.
- Back-end: Python + Flask — see `studyscribe/app.py`: `app` (Flask instance) and route handlers such as `view_session()`.
- Database: SQLite with schema defined in code — see `studyscribe/core/db.py`: `SCHEMA`, `get_connection()` and `init_db()`.
- Authentication: no auth implementation found in code (no auth decorators or auth module) — see `studyscribe/app.py` (route handlers are unauthenticated) and absence of an `auth` package under `studyscribe/`.
- AI model SDK: Google GenAI / Gemini client is referenced — see `studyscribe/services/gemini.py`: `_client()` (imports `google.genai`) and `Settings.gemini_api_key` in `studyscribe/core/config.py`.
- Transcription engine: optional Python package `faster_whisper` and system `ffmpeg` are required by the transcription path — see `studyscribe/services/transcribe.py`: `_load_model()` (checks `faster_whisper`) and `_ensure_wav()` (requires `ffmpeg`).
- Tooling: dependencies listed in `requirements.txt`; tests in `tests/` use pytest (see `tests/test_gemini_schema.py`).

3) Folder Map

- `/studyscribe/` — application package and Flask wiring: see `studyscribe/app.py`: `app` and route handlers.
- `/studyscribe/core/` — core configuration and DB helpers: see `studyscribe/core/config.py`: `Settings`, `DATA_DIR`; and `studyscribe/core/db.py`: `SCHEMA`, `init_db()`.
- `/studyscribe/services/` — business logic helpers: `audio.py` (`save_audio()`), `transcribe.py` (`transcribe_audio()`), `retrieval.py` (`build_chunks()`), `gemini.py` (`generate_notes()`, `answer_question()`), `export.py` (`build_session_export()`), `jobs.py` (`enqueue_job()`).
- `/studyscribe/web/templates/` — Jinja templates for pages: `base.html`, `session.html`, `index.html` (UI blocks and client hooks).
- `/studyscribe/web/static/` — static assets: `js/app.js` (client logic) and `css/app.css` (styling).
- `/data/` (runtime) — configured via `studyscribe/core/config.py`: `DATA_DIR` (runtime per-module/session file storage).
- `/tests/` — test suite; see `tests/test_gemini_schema.py` for schema tests.
- `/docs/` — comprehensive documentation.
- `/docs/logs/` (standardized) — contains `ai-log.md` (AI decisions), `dev-log.md` (dev activity), `changelog-policy.md` (release policy).

4) Entry Points (startup flow)

- Development runner: top-level `app.py` (root) runs the Flask app: see `/app.py`: imports `studyscribe.app:app` and calls `app.run(...)`.
- Primary application module import side-effects: `studyscribe/app.py` defines `app` and calls `_init()` at module import — see `studyscribe/app.py`: `_init()` (ensures DB and `DATA_DIR`).
- Initialization sequence: `app.py` (root) imports `studyscribe.app` → `studyscribe/app.py` executes `_init()` which calls `studyscribe/core/db.py`: `init_db()` and references `studyscribe/core/config.py`: `DATA_DIR`.

5) Routing / Navigation Inventory

- All route handlers are defined in `studyscribe/app.py`.
  - Home / index: see `studyscribe/app.py`: `index()` (root page rendering uses `studyscribe/web/templates/index.html`).
  - Module management: `create_module()` and `view_module(module_id)` — see `studyscribe/app.py`: `create_module()`, `view_module()`.
  - Session view and management: `view_session(session_id)`, `create_session(module_id)` — see `studyscribe/app.py`: `view_session()` and `create_session()`.
  - Upload audio: `upload_audio(module_id, session_id)` — see `studyscribe/app.py`: `upload_audio()` which delegates to `studyscribe/services/audio.py`: `save_audio()`.
  - Start transcription: `start_transcription(module_id, session_id)` — see `studyscribe/app.py`: `start_transcription()` which enqueues `studyscribe/services/transcribe.py`: `transcribe_audio()` via `studyscribe/services/jobs.py`: `enqueue_job()`.
  - Generate AI notes: `start_notes(module_id, session_id)` and fetch endpoints — see `studyscribe/app.py`: `start_notes()` and `fetch_ai_notes()` (handlers call `studyscribe/services/gemini.py`: `generate_notes()`).
  - Q&A endpoints: `ask_question(module_id, session_id)` and API endpoint `api_ai_ask()` — see `studyscribe/app.py`: `ask_question()` and `api_ai_ask()` which call `studyscribe/services/gemini.py`: `answer_question()`.
  - Export pack: `export_pack(module_id, session_id)` — see `studyscribe/app.py` route for `/modules/<module_id>/sessions/<session_id>/export` and `studyscribe/services/export.py`: `build_session_export()`.

6) State + Data Flow Overview

- Persistent relational state: SQLite DB stores modules, sessions, jobs, summaries, and AI messages — see `studyscribe/core/db.py`: `SCHEMA` and table definitions (e.g., `modules`, `sessions`, `jobs`, `ai_messages`).
- File-backed session artifacts: per-session directories under `DATA_DIR` store `audio/`, `transcript/`, `notes/`, `attachments/` — see `studyscribe/app.py`: `_module_dir()` and `_session_dir()` and `studyscribe/core/config.py`: `DATA_DIR`.
- Transcription flow: audio file saved via `save_audio()` → `start_transcription()` enqueues `transcribe_audio()` via `enqueue_job()` → `transcribe_audio()` converts to WAV (`_ensure_wav()`), chunks WAV (`_chunk_wav()`), calls model via `_load_model()` and writes `transcript.json` and `chunks.json` — see `studyscribe/services/audio.py`: `save_audio()` and `studyscribe/services/transcribe.py`: `transcribe_audio()`, `_ensure_wav()`, `_chunk_wav()`.
- Retrieval + Q&A: transcripts are merged into text chunks with `build_chunks()`; queries use `retrieve_chunks()` to rank candidate chunks; model calls (`answer_question()`) assemble payloads and call Gemini via `_client()` — see `studyscribe/services/retrieval.py`: `build_chunks()`, `retrieve_chunks()` and `studyscribe/services/gemini.py`: `answer_question()`.
- AI notes: `generate_notes()` builds a prompt (`_build_notes_prompt()`), calls the Gemini client, and the result is parsed into `NotesOutput` then persisted into `notes/` via handlers in `studyscribe/app.py` and exported by `build_session_export()` — see `studyscribe/services/gemini.py`: `generate_notes()` and `studyscribe/services/export.py`: `_notes_payload()` / `build_session_export()`.

7) Auth / Permissions

- No authentication or authorization middleware is implemented in the application code: route handlers in `studyscribe/app.py` are not decorated with auth checks and there is no `auth` module in `studyscribe/`. This implies an unauthenticated, local-first deployment model by design or omission (ASSUMPTION — see `studyscribe/app.py`: route handlers such as `upload_audio()` and `view_session()`).

8) External Integrations

- Google GenAI / Gemini SDK: invoked via `studyscribe/services/gemini.py`: `_client()` attempts `from google import genai` and uses `settings.gemini_api_key` from `studyscribe/core/config.py`.
- Transcription model package: `faster_whisper` is required at runtime and loaded in `studyscribe/services/transcribe.py`: `_load_model()`; absence raises `TranscriptionError`.
- System dependency `ffmpeg` is invoked by `studyscribe/services/transcribe.py`: `_ensure_wav()` to convert non-wav uploads via `subprocess`.

9) Env Vars Inventory

- `GEMINI_API_KEY` — referenced and loaded in `studyscribe/core/config.py`: `Settings.gemini_api_key` (optional; `_client()` raises `GeminiError` if missing).
- `GEMINI_MODEL` — referenced in `studyscribe/core/config.py`: `Settings.gemini_model` (defaults to `gemini-2.5-flash`).
- `TRANSCRIBE_CHUNK_SECONDS` — referenced in `studyscribe/core/config.py`: `Settings.chunk_seconds` (default `30`) and used by `studyscribe/services/transcribe.py` when chunking audio.
- `FLASK_SECRET` — referenced in `studyscribe/app.py`: `app.secret_key = os.getenv("FLASK_SECRET", "studyscribe-dev")` (optional; fallback provided).

10) Build, Run, Test Commands

- Install dependencies: see `requirements.txt` (root) — use `pip install -r requirements.txt`.
- Run development server: top-level `app.py` runs Flask (`if __name__ == "__main__": app.run(...)`) — see `/app.py` (root) and `studyscribe/app.py`: `app`.
- Tests: run `pytest` against the `tests/` directory — see `tests/test_gemini_schema.py` which imports `studyscribe/services/gemini.py`: `NotesOutput`.

11) Known Gaps / Unclear Areas

- Authentication & multi-user model: not implemented — see `studyscribe/app.py` (no auth decorators) and no `studyscribe/auth` module. (ASSUMPTION: app is intended for single-user/local use.)
- Deployment configuration (containers, process managers) absent — repository exposes a dev runner at `/app.py` but no Dockerfile/Procfile or CI configs; the codebase relies on local filesystem `DATA_DIR` (see `studyscribe/core/config.py`: `DATA_DIR`) which complicates horizontal scaling.
- Transcription runtime constraints: `faster_whisper` and `ffmpeg` are required — see `studyscribe/services/transcribe.py`: `_load_model()` and `_ensure_wav()`; hardware requirements (CPU vs GPU) are not specified in repo.
- Gemini usage: the repo assumes a Google GenAI SDK and an API key; how prompt costs, rate-limits, or quota are handled is not specified — see `studyscribe/services/gemini.py`: `_client()` and `generate_notes()`.

---



## Configuration & runtime defaults

- File-system and DB locations + runtime settings: See `studyscribe/core/config.py`: `DATA_DIR`, `DB_PATH`, and `Settings` / `settings`.

## Persistence layer

- SQLite schema and helpers: See `studyscribe/core/db.py`: `SCHEMA`, `init_db()`, `get_connection()`, `execute()`, `fetch_all()`, `fetch_one()`, `execute_returning_id()`.

## Background jobs

- Lightweight job queue, persistence and helpers: See `studyscribe/services/jobs.py`: `create_job()`, `enqueue_job()`, `update_job()`, `get_job()`.

## Core services (business logic)

- Audio persistence: See `studyscribe/services/audio.py`: `save_audio()` (saves uploads into session `audio/` directory).
- Transcription: See `studyscribe/services/transcribe.py`: `transcribe_audio()`, `load_transcript()`, and `TranscriptionError` (handles audio -> transcript segments and chunking via `build_chunks`).
- Retrieval & chunking: See `studyscribe/services/retrieval.py`: `build_chunks()`, `retrieve_chunks()`, `_tokenize()` (lightweight lexical ranking used for Q&A and citation selection).
- AI assistant (Gemini) utilities: See `studyscribe/services/gemini.py`: `generate_notes()`, `answer_question()`, `_client()` and `GeminiError` (wraps missing API key / SDK issues), and `NotesOutput` / `AnswerOutput` schemas.
- Export builder: See `studyscribe/services/export.py`: `build_session_export()` (creates ZIP export with configurable inclusions) and auxiliary helpers `_html_to_markdown()` and `_notes_payload()`.

## Web UI and templates (UX)

- Base shell, layout, and global blocks: See `studyscribe/web/templates/base.html`: Jinja blocks `list_column`, `workspace_header`, `workspace_actions`, `content`, `ai_drawer`, `extra_modals` used by page templates.
- Index (home): See `studyscribe/web/templates/index.html`: uses `modules` list and block `list_column` to present modules (module creation form posts to `create_module` route in `studyscribe/app.py`).
- Session view and UX flow: See `studyscribe/web/templates/session.html`: template uses upload forms and tabs for Notes / Transcript / AI Notes, references `data-*` attributes used by `web/static/js/app.js` (client behaviour). Key template features: audio upload forms, attachment upload forms, transcription start button, AI Notes generation UI.
- Transcript partial: See `studyscribe/web/templates/_transcript_panel.html`: transcript rendering and segment actions (used inside `session.html`).

## Static assets (client behaviour)

- JS entry and client logic: See `studyscribe/web/static/js/app.js` (client-side handlers for file inputs, job polling, AI drawer, etc.).
- CSS theme: See `studyscribe/web/static/css/app.css` (visual styles used by templates).

## Data layout on disk

- Per-module / per-session layout: See `studyscribe/app.py`: helper functions `_module_dir(module_id)`, `_session_dir(module_id, session_id)` which map to `DATA_DIR/modules/<module_id>/sessions/<session_id>/`.
- Session artifacts: transcripts at `.../transcript/transcript.json` and `.../transcript/chunks.json` (produced by `transcribe_audio()` and `build_chunks()` — see `studyscribe/services/transcribe.py` and `studyscribe/services/retrieval.py`).
- Notes and AI outputs: See `studyscribe/services/export.py`: `notes_dir = session_dir / "notes"` and export reads `notes/ai_notes.md`, `notes/ai_notes.json`, `notes/last_answer.json`.

## Routes and handlers (where HTTP behavior is implemented)

- All route definitions and HTTP handlers live in: See `studyscribe/app.py` — this module defines the Flask `app` and contains handlers that call services (e.g., routes that call `transcribe_audio`, `save_audio`, `build_session_export`, `generate_notes`, `answer_question`).

## Tests (validation and contracts)

- Gemini schema test: See `tests/test_gemini_schema.py`: asserts expected fields for `NotesOutput` from `studyscribe/services/gemini.py`.
- Retrieval/transcription tests: See `tests/test_retrieval.py` and `tests/test_transcribe.py` for unit tests covering chunking and transcription helpers (they reference `studyscribe/services/retrieval.py` and `studyscribe/services/transcribe.py`).

## Notable constants and guards

- Allowed audio/attachment extensions and MIME types: See `studyscribe/app.py`: `ALLOWED_AUDIO_EXTENSIONS`, `ALLOWED_ATTACHMENT_EXTENSIONS`, `ALLOWED_ATTACHMENT_MIME_TYPES` (server-side enforcement) and `studyscribe/services/export.py` for export-specific allowed lists.
- Gemini and transcription runtime guards: See `studyscribe/services/gemini.py`: `_client()` validates `settings.gemini_api_key`; see `studyscribe/services/transcribe.py`: `_load_model()` checks Python and presence of `faster_whisper`.

---

## Quick rebuild checklist (minimal artifacts to implement for parity)

Each checklist item below cites the canonical implementation used in this repo.

- Web server + templates: implement a Flask `app` with the same template blocks and static assets. See `studyscribe/app.py`: `app` and `studyscribe/web/templates/base.html` (layout blocks).
- Data & DB: persist session/module metadata in SQLite with the schema in `studyscribe/core/db.py`: `SCHEMA` and helpers `init_db()`, `get_connection()`.
- Audio upload and storage: implement `save_audio()` per `studyscribe/services/audio.py`.
- Transcription pipeline: implement WAV conversion, chunking, and transcription to `transcript.json` and `chunks.json` as in `studyscribe/services/transcribe.py`: `transcribe_audio()` and `_chunk_wav()`.
- Retrieval and Q&A helpers: implement `build_chunks()` and `retrieve_chunks()` per `studyscribe/services/retrieval.py` and wire to a model client like `generate_notes()` / `answer_question()` in `studyscribe/services/gemini.py`.
- Background jobs: implement `create_job()`, `enqueue_job()` and status updates per `studyscribe/services/jobs.py`.
- Export: implement a ZIP export that includes notes, transcript, audio, and attachments per `studyscribe/services/export.py`: `build_session_export()`.

---

## ASSUMPTIONS

- ASSUMPTION: The intended production deployment is a single-process web server serving local disk-backed data ("local-first"), inferred from `DATA_DIR` usage and direct filesystem reads/writes across the codebase (see `studyscribe/core/config.py`: `DATA_DIR` and `studyscribe/app.py`: `_module_dir`, `_session_dir`).
  - Rationale: the repository contains explicit filesystem helpers and no cloud storage adapters; if you intend a distributed deployment, you must replace filesystem paths with a shared storage layer and make `DB_PATH` a networked DB.

- ASSUMPTION: The AI features rely on an external Google GenAI / Gemini SDK when `GEMINI_API_KEY` is present; code checks and error messages are implemented in `studyscribe/services/gemini.py`: `_client()` and `GeminiError`.
  - Rationale: the code conditionally imports `google.genai` and reads `settings.gemini_api_key` from `studyscribe/core/config.py`.

---

## Parity Truth Sources (Rebuild Checklist)

When rebuilding the system with feature and UX parity, consult these authoritative sources:

- **Templates + app.js define UX parity**: See `studyscribe/web/templates/base.html`, `studyscribe/web/templates/session.html`, and `studyscribe/web/static/js/app.js` for exact UI structure, form fields, data attributes, client-side event handlers, and polling logic. These sources define what the end user sees and how they interact.

- **config.py defines runtime env vars**: See `studyscribe/core/config.py`: `Settings` class (loaded via `os.getenv()`) for the authoritative list of configuration variables: `gemini_api_key`, `gemini_model`, `chunk_seconds`, `FLASK_SECRET`. Environment defaults and constraints are captured here.

- **DB schema is authoritative**: See `studyscribe/core/db.py`: `SCHEMA` constant for the exact SQL table definitions, column types, and foreign keys. This is the contract for persistent state. Any migration must preserve backward compatibility or document breaking changes.

- **Docs are derived (not authoritative)**: This documentation set is derived from code and is meant as a guide for engineers unfamiliar with the codebase. If docs and code conflict, code is correct; file an issue to update docs.

---

## Next steps (suggested files to generate next)

- `docs/10-Architecture.md` — component diagrams and data flows (will reference `studyscribe/app.py`, `studyscribe/core/db.py`, `studyscribe/services/*`).
- `docs/20-Setup-Run.md` — environment variables, dependency notes (referencing `requirements.txt` and runtime guards in `studyscribe/services/transcribe.py` and `studyscribe/services/gemini.py`).

---

## File provenance

This document was generated programmatically by scanning repository artifacts and referencing the symbols above.
