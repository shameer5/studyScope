# Integrations & Secrets

This document lists external integrations used by StudyScribe, their purpose, where configuration/secrets are read, common failure modes, and retry/timeouts behavior as implemented in code.

1) Google GenAI / Gemini
- Purpose: generate AI study notes and answer questions (Q&A) over session/module content. Implemented in `studyscribe/services/gemini.py`: `generate_notes()` and `answer_question()`.
- Config location: `studyscribe/core/config.py`: `Settings.gemini_api_key` and `Settings.gemini_model` (`settings.gemini_api_key`, `settings.gemini_model`).
- Secrets required: `GEMINI_API_KEY` environment variable (see `studyscribe/core/config.py`: `Settings.gemini_api_key`).
- Failure modes: missing or invalid API key triggers `GeminiError` in `_client()` (see `studyscribe/services/gemini.py`); invalid/ill-formed model responses can cause JSON validation errors in `answer_question()` which raise `GeminiError`.
- Retries/timeouts: no retry or timeout logic is implemented in the code. `_client()` loads `google.genai` and `generate_content()` is invoked directly (see `studyscribe/services/gemini.py`). Operators should add retries or proxying if required.

2) Local transcription runtime (`faster_whisper`) and `ffmpeg`
- Purpose: convert audio to text segments and produce transcript chunks. Implemented in `studyscribe/services/transcribe.py`: `transcribe_audio()`, `_ensure_wav()`, `_chunk_wav()`, `_load_model()`.
- Config/location: chunk duration controlled by `TRANSCRIBE_CHUNK_SECONDS` env var → `studyscribe/core/config.py`: `Settings.chunk_seconds`.
- Secrets needed: none.
- Failure modes:
  - Missing `ffmpeg` binary: `_ensure_wav()` checks `shutil.which('ffmpeg')` and raises `TranscriptionError` with `user_message` instructing to upload WAV or install `ffmpeg`.
  - Missing `faster_whisper` package: `_load_model()` uses `importlib.util.find_spec('faster_whisper')` and raises `TranscriptionError` if not installed.
  - Model loading/runtime errors: `_load_model()` wraps module import in try/except and raises `TranscriptionError` with `user_message`.
- Retries/timeouts: transcription uses `subprocess.run([...], check=True, capture_output=True)` for `ffmpeg` conversion (no retry). Chunk transcription loops through chunks and updates job progress; there is no retry/backoff for per-chunk failures — `TranscriptionError` will propagate and mark job failed (see `studyscribe/services/jobs.py`).

3) SQLite (local DB)
- Purpose: persist modules, sessions, jobs, summaries, AI messages, and ai_message_sources. Schema defined in `studyscribe/core/db.py`: `SCHEMA` and initialized via `init_db()`.
- Config location: DB file path `DB_PATH` in `studyscribe/core/config.py`.
- Secrets needed: none.
- Failure modes: DB file permission issues, disk full, or concurrent write limits — code uses SQLite and opens short-lived connections via `get_connection()` which sets `row_factory` to `sqlite3.Row` (`studyscribe/core/db.py`). For production scaling consider migrating to a client-server DB.
- Retries/timeouts: no explicit retry logic; writes and schema migrations are executed synchronously at startup in `init_db()`.

4) Local filesystem (`DATA_DIR`)
- Purpose: store per-module and per-session artifacts (audio, transcript, notes, attachments). `DATA_DIR` is defined in `studyscribe/core/config.py` and used by helpers `_module_dir()` and `_session_dir()` in `studyscribe/app.py`.
- Secrets needed: none.
- Failure modes: disk full, permission errors; operations use `Path` and naive filesystem calls (no transaction/atomic rename semantics documented).

5) Other libraries & system deps
- `google.genai` (Gemini SDK) — imported in `studyscribe/services/gemini.py` via `_client()` and required when `GEMINI_API_KEY` is present.
- `faster_whisper` — optional transcription engine loaded in `studyscribe/services/transcribe.py` via `_load_model()`.
- `ffmpeg` — system binary invoked in `studyscribe/services/transcribe.py`: `_ensure_wav()` using `subprocess.run()`.

6) Secrets inventory (env vars and where referenced)
- `GEMINI_API_KEY` — referenced in `studyscribe/core/config.py` as `Settings.gemini_api_key` and used by `studyscribe/services/gemini.py` `_client()`.
- `GEMINI_MODEL` — referenced in `studyscribe/core/config.py` as `Settings.gemini_model` (optional, default `gemini-2.5-flash`).
- `TRANSCRIBE_CHUNK_SECONDS` — referenced in `studyscribe/core/config.py` as `Settings.chunk_seconds` (affects `_chunk_wav()` behavior).
- `FLASK_SECRET` — referenced in `studyscribe/app.py` and required for production; the app raises on startup if it is missing when not in dev/test mode. For local development, set `STUDYSCRIBE_ENV=development` or `FLASK_DEBUG=1` to allow the dev fallback secret.

7) Failure handling summary & recommendations
- Current code surfaces failures via `GeminiError` and `TranscriptionError` which include `user_message` intended for UI display (`studyscribe/services/gemini.py`, `studyscribe/services/transcribe.py`). Background jobs catch exceptions and set job `status='error'` with a safe `message` via `enqueue_job()` in `studyscribe/services/jobs.py`.
- Retries/timeouts: none implemented for external calls — recommend adding retry wrappers around Gemini calls and `ffmpeg` conversion, and timeouts when calling model SDKs.

8) CSRF protection
- Flask-WTF `CSRFProtect` is enabled; templates include `csrf_token()` inputs and JS adds the `X-CSRFToken` header for JSON/form submissions.

## Assignment LLM Requirement Satisfaction

StudyScribe integrates Google's GenAI SDK to satisfy LLM usage requirements:

**Model Selection & Default Behavior**
- Default model: `gemini-2.5-flash` (see [studyscribe/core/config.py](studyscribe/core/config.py#L22): `Settings.gemini_model`)
- Configurable via `GEMINI_MODEL` environment variable (optional; falls back to gemini-2.5-flash if not set)
- All LLM calls routed through [studyscribe/services/gemini.py](studyscribe/services/gemini.py): `_client()` which creates single authenticated client instance

**LLM Requirement Fulfillment**
- ✅ **LLM Usage**: Two primary use cases implemented:
  1. **Generate AI Notes** — POST `.../generate-notes` endpoint calls `generate_notes()` to summarize session content into study guide using Gemini (see [studyscribe/app.py](studyscribe/app.py#L1355))
  2. **Q&A over Content** — POST `/api/ai/ask` endpoint calls `answer_question()` to field user questions about transcripts, notes, attachments using Gemini (see [studyscribe/app.py](studyscribe/app.py#L1487) and [studyscribe/services/gemini.py](studyscribe/services/gemini.py#L78))

- ✅ **API Key Management**: `GEMINI_API_KEY` environment variable required (see [studyscribe/core/config.py](studyscribe/core/config.py#L21): `Settings.gemini_api_key`)
  - Must be set before application startup
  - Not committed to version control (see .gitignore)
  - Runtime check in `_client()` raises `GeminiError` if missing or invalid

- ✅ **Prompt Guidance**: All LLM operations send structured prompts with explicit role/purpose:
  - `generate_notes()` — passes transcript + attachments with explicit summary instruction (see [studyscribe/services/gemini.py](studyscribe/services/gemini.py#L45-L65))
  - `answer_question()` — passes user question + session context (transcript, notes, attachment excerpts) as structured multi-part prompt (see [studyscribe/services/gemini.py](studyscribe/services/gemini.py#L78-L110))

**Setup Checklist**
1. Obtain Google GenAI API key from Google Cloud console (gen-ai setup required; see https://ai.google.dev/)
2. Set `GEMINI_API_KEY` in environment before running app: `export GEMINI_API_KEY="your-key-here"`
3. Optionally override model: `export GEMINI_MODEL="gemini-2.5-flash"` (or another gemini-* model)
4. Start application; first Gemini call will validate key via `_client()` authentication
