# Data Architecture

This document describes database schemas, file-backed artifacts, caching, and data flows for key journeys. All claims reference repository artifacts.

1) Relational models / schemas

**SQLite Database Schema** (see [studyscribe/core/db.py](studyscribe/core/db.py#L13-L73))

StudyScribe persists all structured data in a single SQLite database file (`studyscribe/studyscribe.db`) initialized at startup via `init_db()`. The schema consists of 8 tables:

- **`modules`** — Learning module container
  - `id TEXT PRIMARY KEY` — UUID for module
  - `name TEXT NOT NULL` — Module title (e.g., "Organic Chemistry")
  - `created_at TEXT NOT NULL` — ISO 8601 timestamp

- **`sessions`** — Study session within a module
  - `id TEXT PRIMARY KEY` — UUID for session
  - `module_id TEXT NOT NULL` — FK to modules.id
  - `name TEXT NOT NULL` — Session title (e.g., "Lecture 3: Mechanisms")
  - `created_at TEXT NOT NULL` — ISO 8601 timestamp

- **`jobs`** — Background job tracking (transcription, AI generation)
  - `id TEXT PRIMARY KEY` — UUID for job
  - `status TEXT NOT NULL` — 'pending'|'running'|'complete'|'error'
  - `progress INTEGER NOT NULL` — 0-100 for progress indication
  - `message TEXT` — User-facing status message (e.g., "Transcribing chunk 3/5")
  - `result_path TEXT` — Path or JSON result when complete
  - `created_at TEXT NOT NULL` — ISO 8601 timestamp
  - `updated_at TEXT NOT NULL` — ISO 8601 timestamp (updated on status changes)

- **`session_summaries`** — Cached session content summaries for fast retrieval
  - `session_id TEXT PRIMARY KEY` — FK to sessions.id
  - `content_hash TEXT NOT NULL` — Hash of combined transcript + attachments (cache key)
  - `summary TEXT NOT NULL` — AI-generated summary
  - `updated_at TEXT NOT NULL` — ISO 8601 timestamp

- **`module_summaries`** — Cached module-level summaries across all sessions
  - `module_id TEXT PRIMARY KEY` — FK to modules.id
  - `content_hash TEXT NOT NULL` — Hash of all session content hashes (invalidation key)
  - `summary TEXT NOT NULL` — Cross-session summary
  - `updated_at TEXT NOT NULL` — ISO 8601 timestamp

- **`ai_messages`** — Chat history for Q&A interactions
  - `id INTEGER PRIMARY KEY AUTOINCREMENT` — Auto-incrementing PK
  - `session_id TEXT NOT NULL` — FK to sessions.id
  - `role TEXT NOT NULL` — 'user'|'assistant'
  - `content TEXT NOT NULL` — Message text (question or answer)
  - `created_at TEXT NOT NULL` — ISO 8601 timestamp

- **`ai_message_sources`** — Structured citations for AI-generated answers
  - `id INTEGER PRIMARY KEY AUTOINCREMENT` — Auto-incrementing PK
  - `message_id INTEGER NOT NULL` — FK to ai_messages.id
  - `source_id TEXT NOT NULL` — UUID of source (attachment, transcript segment)
  - `kind TEXT NOT NULL` — 'transcript_segment'|'attachment_excerpt'|'ai_notes'
  - `label TEXT NOT NULL` — Human-readable label (e.g., "Transcript 3:45-4:15")
  - `snippet TEXT` — Preview text of source
  - `session_name TEXT` — Session context (for module-level searches)
  - `url TEXT` — Optional URL to open source
  - `source_json TEXT` — Structured metadata added via migration (see `_ensure_column()` line 78)

**Access Patterns**:
- Reads: `fetch_one(sql, params)` / `fetch_all(sql, params)` (see [studyscribe/core/db.py](studyscribe/core/db.py#L116-L135)) used for lookups by ID, module queries
- Writes: `execute(sql, params)` / `execute_returning_id(sql, params)` (see [studyscribe/core/db.py](studyscribe/core/db.py#L137-L145)) used for inserts, updates, schema migrations
- All connections use `row_factory=sqlite3.Row` for dict-style access: `row['column_name']`

1) Relational models / schemas
- Schema is defined in `studyscribe/core/db.py`: `SCHEMA`.
  - `modules` table: columns `id TEXT PRIMARY KEY`, `name TEXT NOT NULL`, `created_at TEXT NOT NULL`.
  - `sessions` table: columns `id TEXT PRIMARY KEY`, `module_id TEXT NOT NULL`, `name TEXT NOT NULL`, `created_at TEXT NOT NULL` (FK -> `modules.id`).
  - `jobs` table: columns `id TEXT PRIMARY KEY`, `status TEXT`, `progress INTEGER`, `message TEXT`, `result_path TEXT`, `created_at TEXT`, `updated_at TEXT`.
  - `session_summaries` and `module_summaries`: store content hashes and summaries.
  - `ai_messages` and `ai_message_sources`: store persisted model chat messages and structured sources (see `SCHEMA` for columns and `ai_message_sources` includes `source_json` added via `_ensure_column()` in `studyscribe/core/db.py`).

2) File-backed artifacts
- Configured `DATA_DIR` path: `studyscribe/core/config.py`: `DATA_DIR`.
- Per-module/session layout (helpers): `studyscribe/app.py`: `_module_dir(module_id)`, `_session_dir(module_id, session_id)`.
- Session files:
  - `audio/` — uploaded audio files saved by `studyscribe/services/audio.py`: `save_audio()`.
  - `transcript/transcript.json` — array of segments (objects with `start`, `end`, `text`) produced by `studyscribe/services/transcribe.py`: `transcribe_audio()`.
  - `transcript/chunks.json` — retrieval chunks built by `studyscribe/services/retrieval.py`: `build_chunks()` and written by `transcribe_audio()`.
  - `notes/ai_notes.md`, `notes/ai_notes.json`, `notes/last_answer.json` — AI outputs saved by handlers in `studyscribe/app.py` and `studyscribe/services/gemini.py` outputs.
  - `attachments/` — stored uploaded attachments and optionally `extracted.txt` / `extracted_sources.json` (see `studyscribe/app.py` attachment extraction code and `studyscribe/web/templates/session.html` which displays `attachments_with_text`).

## File Layout Contract

For complete specification of deterministic folder structure, naming conventions, file formats, and artifact lifecycle, see [/docs/file-layout-contract.md](file-layout-contract.md). This document covers:
- **Filesystem hierarchy**: 8 subdirectories per session (`audio/`, `attachments/`, `transcript/`, `notes/`, `work/`, `exports/`, `annotations.json`)
- **Sanitization rules**: `_safe_filename_component()` for ZIP names, `_safe_name()` for ZIP paths (see [studyscribe/app.py](studyscribe/app.py#L704-L709), [studyscribe/services/export.py](studyscribe/services/export.py#L25-L31))
- **Export flow**: GET form → POST download → ZIP with `manifest.json` (see [studyscribe/services/export.py](studyscribe/services/export.py))
- **File extension & MIME type enforcement**: audio (wav, mp3, m4a, aac, flac, ogg), attachments (pdf, ppt, pptx, doc, docx)

**Key Data Separation**: 
- **SQLite (transactional, queryable)**: Modules, sessions, jobs, messages, summaries — enables searches, sorting, status queries
- **Filesystem (durable artifacts)**: Raw audio, transcripts, notes, attachments — enables restore, export, native file access
- Separation enforced via `DATA_DIR` path isolation and no raw file paths stored in SQLite (only `result_path` for jobs)

2) File-backed artifacts
- Configured `DATA_DIR` path: `studyscribe/core/config.py`: `DATA_DIR`.
- Per-module/session layout (helpers): `studyscribe/app.py`: `_module_dir(module_id)`, `_session_dir(module_id, session_id)`.
- Session files:
  - `audio/` — uploaded audio files saved by `studyscribe/services/audio.py`: `save_audio()`.
  - `transcript/transcript.json` — array of segments (objects with `start`, `end`, `text`) produced by `studyscribe/services/transcribe.py`: `transcribe_audio()`.
  - `transcript/chunks.json` — retrieval chunks built by `studyscribe/services/retrieval.py`: `build_chunks()` and written by `transcribe_audio()`.
  - `notes/ai_notes.md`, `notes/ai_notes.json`, `notes/last_answer.json` — AI outputs saved by handlers in `studyscribe/app.py` and `studyscribe/services/gemini.py` outputs.
  - `attachments/` — stored uploaded attachments and optionally `extracted.txt` / `extracted_sources.json` (see `studyscribe/app.py` attachment extraction code and `studyscribe/web/templates/session.html` which displays `attachments_with_text`).

3) Caching
- `chunks.json` is used as a cache of merged transcript text for retrieval; `studyscribe/app.py` `_load_chunks()` returns cached chunks or rebuilds via `load_transcript()` and `build_chunks()` when missing.
- Export manifests: `build_session_export()` can optionally include a prompt manifest to record inputs used for AI generation (see `studyscribe/services/export.py`: `_build_prompt_manifest()`).

4) Persistence layer & access patterns
- Reads: templates and handlers read small lookups from SQLite using `fetch_one()` / `fetch_all()` (`studyscribe/core/db.py`) to populate `modules`, `sessions`, and job state. Template rendering functions in `studyscribe/app.py` call these helpers.
- Writes: create/update operations use `execute()` and `execute_returning_id()` (`studyscribe/core/db.py`) — used by `_store_ai_message()` in `studyscribe/app.py` and `create_job()` in `studyscribe/services/jobs.py`.

5) Data flow (key journeys)
- Audio → Transcript → Chunks
  - Upload: `upload_audio()` calls `save_audio()` which writes to `session_dir/audio/` (`studyscribe/services/audio.py`).
  - Start transcription: `start_transcription()` enqueues `transcribe_audio()` (`studyscribe/services/transcribe.py`) via `enqueue_job()` (`studyscribe/services/jobs.py`).
  - Transcription process: `_ensure_wav()` converts to WAV (calls `ffmpeg`), `_chunk_wav()` splits into chunk files, `_load_model()` loads `faster_whisper`, model transcribes chunks into `segments`, then writes `transcript/transcript.json` and `transcript/chunks.json`.

- Transcript → Retrieval → Q&A / Notes
  - `build_chunks()` merges segments into overlapping text chunks (`studyscribe/services/retrieval.py`).
  - `answer_question()` builds a JSON-schema constrained prompt and calls Gemini via `_client()` (`studyscribe/services/gemini.py`) returning `AnswerOutput` which is validated and may be persisted as `ai_messages` via `_store_ai_message()` (`studyscribe/app.py`).
  - `generate_notes()` builds a markdown notes prompt (`_build_notes_prompt()`), calls Gemini, extracts summary and suggested tags (`_extract_summary()`, `_extract_suggested_tags()`) and returns `NotesOutput`.

6) Migrations & schema evolution
- `init_db()` in `studyscribe/core/db.py` executes `SCHEMA` and calls `_ensure_column(conn, 'ai_message_sources', 'source_json', 'TEXT')` to add the `source_json` column when missing; this demonstrates simple in-code migrations handled at init time.

7) Backups & exports
- Session ZIP export is implemented by `studyscribe/services/export.py`: `build_session_export()` which composes selected artifacts into a zip and writes `manifest.json` alongside included files for reproducibility.

8) Privacy considerations
- AI requests include transcript and attachment snippets; prompt manifests are optionally included in exports (`include_prompt_manifest` flag in `build_session_export()`), verify that exported prompt manifests may contain user content (see `_build_prompt_manifest()` in `studyscribe/services/export.py`).
