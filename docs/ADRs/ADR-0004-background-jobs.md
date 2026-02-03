# ADR-0004: Background Job Processing Model

Date: 2024-01-15  
Status: Accepted (In-Process ThreadPoolExecutor; To Be Evolved for Production)  
Deciders: Architecture Team  

## Context

StudyScribe has long-running operations:
- **Audio transcription**: 10–30 min per hour of audio (on CPU).
- **AI note generation**: 5–10 sec per generation (API call to Gemini).
- **Export packaging**: 1–5 sec per export (ZIP assembly).

These operations block the web request if synchronous. The team needs to decide on a background job model that:
- Works locally without external infrastructure.
- Allows job status polling (progress, completion, errors).
- Is simple to reason about and debug.
- Can be evolved for production scaling.

## Decision

**Use an in-process `ThreadPoolExecutor` (4 workers) to run background jobs. Persist job state in SQLite for polling.**

### Rationale:
- **Simplicity**: no external job queue (Redis, RabbitMQ) to set up locally.
- **Local-first**: jobs run in the same process; suitable for single-instance deployments.
- **Persistence**: job state stored in `jobs` table (`studyscribe/core/db.py` `SCHEMA`) allows web handlers to query status.
- **Polling UI**: client polls `/api/jobs/<job_id>` to read status from DB; no WebSockets needed.
- **Error handling**: exceptions in job functions are caught and stored as job errors (see `studyscribe/services/jobs.py` `enqueue_job()`).

## Evidence in Codebase

- Job queue: `studyscribe/services/jobs.py` defines `_EXECUTOR = ThreadPoolExecutor(max_workers=4)`.
- Job creation: `create_job()` inserts row into `jobs` table with `status='queued'`.
- Job dispatch: `enqueue_job(fn, *args, **kwargs)` submits `_run()` wrapper to `_EXECUTOR`.
- Status updates: `update_job(job_id, status=..., progress=..., message=...)` updates job row.
- Retrieval: `get_job(job_id)` fetches job state from DB (see [studyscribe/services/jobs.py](../studyscribe/services/jobs.py#L67)).
- **Job Status Endpoint**: `GET /jobs/<job_id>` (see [studyscribe/app.py](../studyscribe/app.py#L1153-L1163)) returns JSON with `{id, status, progress, message, result_path}` — called by client polling (see [studyscribe/web/static/js/app.js](../studyscribe/web/static/js/app.js#L2066) `setupTranscriptionStatus()` with 2-second poll interval).
- Usage: `start_transcription(module_id, session_id)` in [studyscribe/app.py](../studyscribe/app.py#L1145-L1151) calls `enqueue_job(transcribe_audio, ...)`.
- Progress: `transcribe_audio()` in [studyscribe/services/transcribe.py](../studyscribe/services/transcribe.py) calls `update_job()` with progress % and result path.

## Alternatives Considered

1. **Celery + Redis**
   - Pros: distributed, scalable, task retries, task scheduling.
   - Cons: requires Redis server; adds deployment complexity; overkill for single-instance.
   - Rejected: local-first design; adds infrastructure.

2. **AWS Lambda / Cloud Tasks**
   - Pros: serverless, auto-scaling, managed.
   - Cons: vendor lock-in, API costs, not suitable for long-running CPU tasks (transcription).
   - Rejected: violates local-first principle.

3. **Synchronous request handling (no background jobs)**
   - Pros: simpler code flow, no job state table needed.
   - Cons: web requests hang for 10–30 min during transcription; poor UX; timeouts likely.
   - Rejected: unacceptable for user experience.

4. **APScheduler (scheduled tasks)**
   - Pros: built-in scheduler for repeating tasks.
   - Cons: overkill if we don't need recurring job scheduling; adds state management complexity.
   - Rejected: job dispatch is on-demand, not scheduled.

5. **Multiprocessing (separate process pool)**
   - Pros: true parallelism; avoids Python GIL.
   - Cons: more complex IPC, harder to debug, not suitable for local deployment.
   - Rejected: ThreadPoolExecutor sufficient for I/O-heavy work (transcription waits for ffmpeg, Gemini API); GIL not a bottleneck.

## Consequences

### Positive:
- **Minimal setup**: no external infrastructure; works on `python app.py`.
- **Easy debugging**: jobs run in same process; stack traces and debugger work naturally.
- **Persistence**: job state persisted to DB, queryable by web handlers.
- **Progress visibility**: UI can poll and display progress bar.

### Negative:
- **Limited concurrency**: 4 workers fixed; long-running transcriptions can starve other jobs. See `docs/12-Risk-Register.md` (Risk T5: Job executor thread pool exhaustion).
- **No retries**: job failures don't auto-retry; manual re-enqueue required (operators can query failed jobs and re-run).
- **In-memory state loss**: if app crashes, in-flight jobs are lost (but job state in DB is updated on error, so operators can retry).
- **Single-instance only**: if app is multi-instance, ThreadPoolExecutor runs independently on each; no shared job queue.

## Migration Path (for production scaling)

1. **Phase 1 (v1.0)**: keep ThreadPoolExecutor; add monitoring and alerting on queue depth.
2. **Phase 2 (v1.1+)**: extract job queue to Redis + Celery:
   - Implement abstract job backend in `studyscribe/services/jobs.py`.
   - Keep in-process ThreadPoolExecutor as default; make Redis/Celery optional.
   - Add configuration to select job backend (e.g., `JOB_BACKEND=redis` env var).
3. **Phase 3**: add job retries, scheduling, task prioritization.

## Worker Count & Tuning

- Current: `max_workers=4` is conservative; suitable for single-user or small team.
- Tuning: adjust based on CPU and transcription concurrency:
  - CPU-bound (transcription): `max_workers = num_cpu_cores / 2` (to avoid GIL contention).
  - I/O-bound (Gemini API): `max_workers = num_cpu_cores * 2`.
  - Recommended: start at 4, monitor, and adjust.

## Recommendations

- **Monitoring**: log job start, completion, and failure. Example log in `studyscribe/services/jobs.py` `_run()`.
- **Cleanup**: implement cron job to delete completed jobs older than N days (to avoid DB bloat).
- **Alerting**: monitor for job queue depth > 10 and emit alert (not yet implemented).
- **Testing**: mock `_EXECUTOR` in tests to avoid real background execution (see `tests/conftest.py`).
