# Developer Setup & Runbook

This runbook provides step-by-step local setup, environment variables, DB initialization, seed options, and troubleshooting tied to repo artifacts.

Prerequisites
- Recommended Python: 3.10 ≤ Python < 3.14 (code checks in `studyscribe/services/transcribe.py`: `_load_model()` require Python 3.10+ and explicitly disallow 3.14+). For reproducible runs use Python 3.12.
- System binary for transcription: `ffmpeg` (used by `_ensure_wav()` in `studyscribe/services/transcribe.py`).
- Optional: `faster_whisper` Python package for transcription (loaded by `_load_model()` in `studyscribe/services/transcribe.py`).

Install & virtualenv (macOS example)
```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt
```
Reference: `requirements.txt` (root) for Python deps.

Install system deps (macOS)
```bash
brew install ffmpeg
```
Verify `ffmpeg` is on PATH:
```bash
which ffmpeg
```

Environment variables
- `FLASK_SECRET` — required for production. For local dev you can either set `FLASK_SECRET` directly or set `STUDYSCRIBE_ENV=development` / `FLASK_DEBUG=1` to allow the dev fallback secret.
- `GEMINI_API_KEY` — required to enable AI features (notes/Q&A). Referenced in `studyscribe/core/config.py`: `Settings.gemini_api_key` and used in `studyscribe/services/gemini.py` `_client()`.
- `GEMINI_MODEL` — optional override for model name (defaults to `gemini-2.5-flash`) in `studyscribe/core/config.py`.
- `TRANSCRIBE_CHUNK_SECONDS` — optional override for chunk duration; default in `studyscribe/core/config.py`.
Optional tuning
- `GEMINI_MAX_RETRIES` / `GEMINI_RETRY_BASE_SECONDS` — retry attempts and base backoff for Gemini calls.
- `JOBS_MAX_WORKERS` / `JOBS_QUEUE_WARN` — background worker count and queue warning threshold.
- `DATA_DIR_WARN_PERCENT` / `DATA_DIR_MIN_FREE_PERCENT` / `DATA_DIR_MIN_FREE_MB` — disk usage warnings and minimum free-space checks.

Starting the app (development)
```bash
# from repo root
python app.py
```
This runs the development server in `/app.py`, which calls `studyscribe.app:create_app()` and then `app.run(...)`.

Database & DATA_DIR
- DB path: `studyscribe/core/config.py`: `DB_PATH` (default `studyscribe.db` inside package base). `init_db()` is called during app startup via `_init()` in `studyscribe/app.py`, so launching the app creates schema automatically.
- DATA_DIR: `studyscribe/core/config.py`: `DATA_DIR` — created by `_init()` and used for per-module/session storage.

Seed data
- No seed script provided. To create initial module/session use the web UI (create module form in `studyscribe/web/templates/index.html`) or insert rows directly into SQLite:
```bash
sqlite3 "$(python -c 'from studyscribe.core.config import DB_PATH; print(DB_PATH)')"
-- inside sqlite3 shell
INSERT INTO modules (id, name, created_at) VALUES ('mod-1', 'Demo Module', datetime('now'));
INSERT INTO sessions (id, module_id, name, created_at) VALUES ('sess-1','mod-1','Demo Session', datetime('now'));
```
Reference: table definitions in `studyscribe/core/db.py`: `SCHEMA`.

Running tests
```bash
pytest -q
```
Tests live in `tests/` (e.g., `tests/test_app.py`, `tests/test_golden_path.py`, `tests/test_sprint2.py`).

Common pitfalls & troubleshooting
- Transcription fails with "ffmpeg not available":
  - Cause: `ffmpeg` not on PATH. Error raised in `_ensure_wav()` in `studyscribe/services/transcribe.py`.
  - Fix: install `ffmpeg` and retry; verify `which ffmpeg` returns a path.
- Transcription fails due to missing `faster_whisper`:
  - Cause: `_load_model()` cannot find the `faster_whisper` package.
  - Fix: `pip install faster-whisper` (check `requirements.txt` for additional dependencies).
- AI notes/Q&A fail with `GeminiError: GEMINI_API_KEY is not set.`:
  - Cause: `GEMINI_API_KEY` not provided; `_client()` in `studyscribe/services/gemini.py` raises this error.
  - Fix: set `GEMINI_API_KEY` in your environment before starting the server.
- App cookies fail or sessions are insecure:
  - Cause: `FLASK_SECRET` missing in production mode.
  - Fix: set a strong `FLASK_SECRET` environment variable (or set `STUDYSCRIBE_ENV=development` only for local dev).
- Jobs appear stuck or errors in jobs table:
  - Inspect jobs table with sqlite3:
```bash
sqlite3 "$(python -c 'from studyscribe.core.config import DB_PATH; print(DB_PATH)')" "SELECT id, status, progress, message, updated_at FROM jobs ORDER BY updated_at DESC;"
```
  - Job state transitions are managed by `studyscribe/services/jobs.py`: `create_job()`, `update_job()`, `enqueue_job()`. Exceptions during job execution are logged and the job status is set to `error` with a safe message.

Resetting local state (development)
- Remove DB and DATA_DIR to start fresh (destructive):
```bash
python - <<'PY'
from studyscribe.core.config import DB_PATH, DATA_DIR
print('DB_PATH:', DB_PATH)
print('DATA_DIR:', DATA_DIR)
PY
rm -rf "$(python -c 'from studyscribe.core.config import DB_PATH; print(DB_PATH)')" "$(python -c 'from studyscribe.core.config import DATA_DIR; print(DATA_DIR)')"
```
Note: `init_db()` runs on server start and will recreate schema.

Logging & debugging tips
- Run the server in the foreground (`python app.py`) to see printed logs and job executor exceptions.
- Add logging in `studyscribe/services/transcribe.py` and `studyscribe/services/gemini.py` to capture external call inputs/outputs (respecting privacy).

If you want, I can prepare a small `dev/README.md` with copy-paste commands and a sample `.env` file example.
