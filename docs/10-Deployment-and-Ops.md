# Deployment & Operations

This document describes deployment models, CI/CD, hosting options, configuration, monitoring, logging, and rollback strategy. Evidence is cited from code; where not found, assumptions are labeled.

1) CI/CD Pipeline
- Current state: no CI/CD configuration files present in repo (no `.github/workflows/`, `Jenkinsfile`, or `.gitlab-ci.yml`).
- ASSUMPTION: CI/CD must be configured by operators; recommend adding GitHub Actions or GitLab CI to run `pytest` (see `tests/` and test imports in `tests/test_gemini_schema.py`).
- Suggested pipeline:
  - On PR/MR: lint (optional), run `pytest` against `tests/` directory.
  - On merge to main: build a container (if applicable), run full test suite, optionally deploy to staging.

2) Hosting & Deployment Options
- Local single-node: simplest option. Run `python app.py` from `/app.py` (entrypoint in root). See `studyscribe/app.py` which imports and bootstraps via `_init()`.
- Container (Docker): no Dockerfile present in repo. Suggested Dockerfile pattern:
  ```dockerfile
  FROM python:3.12-slim
  RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
  WORKDIR /app
  COPY requirements.txt .
  RUN pip install -r requirements.txt
  COPY . .
  ENV FLASK_SECRET=<provide-at-runtime>
  ENV GEMINI_API_KEY=<provide-at-runtime>
  CMD ["python", "app.py"]
  ```
  Note: system dependency `ffmpeg` is required by `studyscribe/services/transcribe.py`: `_ensure_wav()`.

- Background workers: transcription and notes generation run in a `ThreadPoolExecutor` (see `studyscribe/services/jobs.py`: `_EXECUTOR` with `max_workers=4`). For production, extract jobs to a separate worker process/service and use a message queue (e.g., Celery + Redis).

3) Configuration management
- Environment variables (see `studyscribe/core/config.py`):
  - `GEMINI_API_KEY` — AI features (optional).
  - `GEMINI_MODEL` — Gemini model choice (optional, defaults to `gemini-2.5-flash`).
  - `TRANSCRIBE_CHUNK_SECONDS` — transcription chunk duration (optional, default 30).
  - `FLASK_SECRET` — session secret (optional, defaults to `studyscribe-dev`; unsafe default for production).

- File paths (hardcoded in `studyscribe/core/config.py`):
  - `DB_PATH` — SQLite file location (default inside package base).
  - `DATA_DIR` — per-module/session artifact storage (default inside package base).
  
- For production: mount external volumes or set environment variables pointing to shared storage (`DATA_DIR`) and a persistent DB location (`DB_PATH`).

4) Database schema & upgrades
- Schema is defined in `studyscribe/core/db.py`: `SCHEMA` and initialized via `init_db()` (called on app startup in `studyscribe/app.py`: `_init()`).
- Simple migrations: `_ensure_column()` in `studyscribe/core/db.py` adds missing columns (example: `source_json` in `ai_message_sources`).
- For major migrations: stop the app, perform manual ALTER TABLE statements, then restart.

5) Monitoring & logging
- Job state: stored in `jobs` table (`studyscribe/core/db.py`: `SCHEMA`) and queryable via `get_job()` in `studyscribe/services/jobs.py`. Client polls job state.
- Application logging: Python `logging` module is used in `studyscribe/services/jobs.py` (logger `_LOGGER`). No centralized log aggregation is configured.
- Recommended monitoring:
  - Job failure rates: query `jobs` table for `status='error'`.
  - Background worker health: monitor `_EXECUTOR` queue depth and worker utilization (not instrumented in code).
  - Gemini API quota: log API calls and responses in `studyscribe/services/gemini.py`: `_client()` and `generate_notes()`.

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
  - SQLite is not concurrent (single writer); upgrade to PostgreSQL for multiple app instances.
  - Local `DATA_DIR` must be replaced with shared storage (S3, NFS) for multi-instance deployments.
  - `ThreadPoolExecutor` with 4 workers is in-process; offload to a job queue (e.g., Celery) and worker pool for production.

10) ASSUMPTION Summary
- Operators will provision environment variables (`GEMINI_API_KEY`, `FLASK_SECRET`) at runtime.
- Database and data storage are local; for HA deployments, operators must provide shared infra.
- No built-in CI/CD, Dockerfile, or production-grade monitoring; operators must add these.
