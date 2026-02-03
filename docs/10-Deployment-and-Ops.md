# Deployment & Operations

This document describes deployment models, CI/CD, hosting options, configuration, monitoring, logging, and rollback strategy. Evidence is cited from code; where not found, assumptions are labeled.

1) CI/CD Pipeline
- Current state: GitHub Actions workflow present at `.github/workflows/ci.yml`.
- Pipeline behavior:
  - On PR/push: installs deps, runs `pytest`, builds the Docker image, and verifies runtime deps inside the container (`ffmpeg`, `faster_whisper`, `google.genai`).

2) Hosting & Deployment Options
- Local single-node: simplest option. Run `python app.py` from `/app.py` (entrypoint in root). This uses `studyscribe.app:create_app()` for initialization.
- Container (Docker): Dockerfile present at repo root. It uses Python 3.12, installs `ffmpeg`, and installs pinned Python deps from `requirements.txt`.
  - Default data paths inside container:
    - `DATA_DIR`: `/app/studyscribe/data`
    - `DB_PATH`: `/app/studyscribe/studyscribe.db`
  - For persistence, mount volumes to those paths (or override via `config.override_paths()` in a custom entrypoint).
  - Note: system dependency `ffmpeg` is required by `studyscribe/services/transcribe.py`: `_ensure_wav()`.

- Background workers: transcription and notes generation run in a `ThreadPoolExecutor` (see `studyscribe/services/jobs.py`: `_EXECUTOR`). Defaults to 2 workers; override with `JOBS_MAX_WORKERS`. For production, extract jobs to a separate worker process/service and use a message queue (e.g., Celery + Redis).
- Security note: the app is designed for single-user, local-first deployments. Bind to `127.0.0.1` or place it behind a trusted reverse proxy/VPN if exposing it on a network.

3) Configuration management
- Environment variables (see `studyscribe/core/config.py`):
  - `GEMINI_API_KEY` — AI features (optional).
  - `GEMINI_MODEL` — Gemini model choice (optional, defaults to `gemini-2.5-flash`).
  - `TRANSCRIBE_CHUNK_SECONDS` — transcription chunk duration (optional, default 600).
  - `FLASK_SECRET` — session secret (required in production; app raises if missing outside dev/test mode).
  - `GEMINI_MAX_RETRIES` — Gemini retry attempts (default 3).
  - `GEMINI_RETRY_BASE_SECONDS` — base backoff seconds for Gemini retries (default 1.0).
  - `JOBS_MAX_WORKERS` — background worker count (default 2).
  - `JOBS_QUEUE_WARN` — warn when executor queue length exceeds this value (default disabled).
  - `DATA_DIR_WARN_PERCENT` — warn when disk usage exceeds this percent (default 80).
  - `DATA_DIR_MIN_FREE_PERCENT` — block writes if free space falls below this percent (default 5).
  - `DATA_DIR_MIN_FREE_MB` — block writes if free space falls below this MB (default 0).

- File paths (hardcoded in `studyscribe/core/config.py`):
  - `DB_PATH` — SQLite file location (default inside package base).
  - `DATA_DIR` — per-module/session artifact storage (default inside package base).
  - `DATA_DIR` and session subfolders are created with owner-only permissions on POSIX systems (mode 700).
  
- For production: mount external volumes or set environment variables pointing to shared storage (`DATA_DIR`) and a persistent DB location (`DB_PATH`).

4) Database schema & upgrades
- Schema is defined in `studyscribe/core/db.py`: `SCHEMA` and initialized via `init_db()` (called on app startup in `studyscribe/app.py`: `_init()`).
- SQLite tuning: `journal_mode=WAL` and `busy_timeout` are enabled in `studyscribe/core/db.py` for improved concurrency.
- Simple migrations: no automated migrations are included; perform manual ALTER TABLE statements as needed.
- For major migrations: stop the app, perform manual ALTER TABLE statements, then restart.

5) Monitoring & logging
- Job state: stored in `jobs` table (`studyscribe/core/db.py`: `SCHEMA`) and queryable via `get_job()` in `studyscribe/services/jobs.py`. Client polls job state.
- Application logging: Python `logging` module is used in `studyscribe/services/jobs.py` and `studyscribe/services/gemini.py`. No centralized log aggregation is configured.
- Recommended monitoring:
  - Job failure rates: query `jobs` table for `status='error'`.
  - Background worker health: set `JOBS_QUEUE_WARN` to log queue depth warnings.
  - Gemini API quota: logs include retry attempts and rate-limit status codes.
  - Disk usage: `DATA_DIR_WARN_PERCENT` logs once when usage exceeds threshold.

6) Rollback strategy
- Stateless app: Flask server is stateless; no in-memory state. Rollback is a container restart or redeployment.
- DB: SQLite is local to the instance; backups must be managed separately (recommend periodic `DATA_DIR` and `DB_PATH` snapshots).
- Gradual rollout: use a load balancer in front to drain connections before stopping old containers.
- ASSUMPTION: for multi-instance deployments, a shared DB (PostgreSQL) and shared `DATA_DIR` (S3 or NFS) are required; current code uses local SQLite and filesystem.

7) Backup & disaster recovery
- Artifacts: `DATA_DIR` must be backed up (audio, transcripts, notes, attachments). `DB_PATH` must be backed up separately.
- Frequency: recommend daily snapshots or continuous backup for production.
- Restore: copy backup files to correct paths and restart the app. Schema is auto-initialized by `init_db()` on startup.

8) Operations & day-2 tasks
- Database inspection:
  ```bash
  sqlite3 "$(python -c 'from studyscribe.core.config import DB_PATH; print(DB_PATH)')"
  -- List tables
  .tables
  -- Inspect jobs
  SELECT id, status, progress, message FROM jobs ORDER BY updated_at DESC LIMIT 10;
  ```

- Clean up old jobs: no auto-cleanup is implemented; recommend a cron job or admin script to delete completed jobs older than N days.

- Transcription failures: check job `message` in jobs table and `error` logs for missing `ffmpeg` or `faster_whisper` (see `studyscribe/services/transcribe.py`).

9) Scaling considerations
- ASSUMPTION: single-node, local-first deployment is the current design. See `studyscribe/core/config.py` and `studyscribe/app.py`.
- Limitations:
  - SQLite is limited to a single writer; WAL and busy_timeout help but do not replace PostgreSQL for multi-instance deployments.
  - Local `DATA_DIR` must be replaced with shared storage (S3, NFS) for multi-instance deployments.
  - `ThreadPoolExecutor` is in-process; offload to a job queue (e.g., Celery) and worker pool for production.

10) ASSUMPTION Summary
- Operators will provision environment variables (`GEMINI_API_KEY`, `FLASK_SECRET`) at runtime.
- Database and data storage are local; for HA deployments, operators must provide shared infra.
- Production-grade monitoring and external job queues are not included; operators must add these.
