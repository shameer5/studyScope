# Non-Functional Requirements (NFRs)

This document lists NFRs (performance, reliability, security, privacy, accessibility) grounded in the code and configuration. Where I infer something not explicit, I label it ASSUMPTION.

1) Performance
- Transcription throughput and latency: audio is split into fixed-size chunks using `TRANSCRIBE_CHUNK_SECONDS` defined in `studyscribe/core/config.py`: `Settings.chunk_seconds`, and `_chunk_wav()` in `studyscribe/services/transcribe.py` performs chunking. Larger chunk sizes reduce overhead but increase per-chunk transcription time.
- Concurrent jobs: job executor uses `ThreadPoolExecutor(max_workers=4)` in `studyscribe/services/jobs.py` (`_EXECUTOR`) limiting parallel background work to 4 threads by default.
- CPU/GPU: `_load_model()` in `studyscribe/services/transcribe.py` selects device and compute type when instantiating `WhisperModel("base", device="cpu", compute_type="int8")` — code targets CPU inference; GPU support is not configured.
- ASSUMPTION: real-time or low-latency use is not an explicit goal; transcription is batch/background oriented (see use of `enqueue_job()` in `studyscribe/services/jobs.py`).

2) Reliability
- Schema & migrations: `init_db()` in `studyscribe/core/db.py` executes `SCHEMA` and runs `_ensure_column()` to add missing columns (example `source_json` in `ai_message_sources`), which tolerates simple schema evolution at init.
- Job robustness: `enqueue_job()` wraps job execution and marks failures by updating job row to `status='error'` and storing a `message` (see `studyscribe/services/jobs.py`).
- File integrity: transcripts and chunks are written atomically via simple writes to `session_dir/transcript/` (no explicit transactional semantics), and `_load_chunks()` in `studyscribe/app.py` will rebuild chunks if missing.

3) Security
- Secret management: `FLASK_SECRET` is read in `studyscribe/app.py` with a default fallback `studyscribe-dev` (see `app.secret_key = os.getenv("FLASK_SECRET", "studyscribe-dev")`) — this is insecure for production. Operators must set `FLASK_SECRET`.
- Authentication: no auth middleware or user accounts are present; routes in `studyscribe/app.py` are unauthenticated. This implies the app is intended for local, single-user deployment or requires network-level protections.
- Upload validation: `ALLOWED_AUDIO_EXTENSIONS`, `ALLOWED_ATTACHMENT_EXTENSIONS`, and `ALLOWED_ATTACHMENT_MIME_TYPES` are declared in `studyscribe/app.py` and used to validate uploads; `_reject_upload()` in `studyscribe/app.py` flashes an error and returns 400 on validation failure.
- CSRF: forms are plain HTML forms rendered in Jinja templates (e.g., `studyscribe/web/templates/session.html`) with no CSRF tokens — web forms are vulnerable to CSRF if deployed unprotected.
- ASSUMPTION: app will be run locally or behind a network boundary; if public exposure is required, add authentication and CSRF protections.

4) Privacy
- Local-first storage: `DATA_DIR` in `studyscribe/core/config.py` is used to store all session artifacts locally — audio, transcripts, notes, attachments (see `_module_dir()` / `_session_dir()` in `studyscribe/app.py`).
- AI requests: `generate_notes()` and `answer_question()` send transcript/attachment content to Gemini (see `studyscribe/services/gemini.py`); prompt manifests can be included in exports via `build_session_export()` (`include_prompt_manifest`) which may contain user content (see `_build_prompt_manifest()` in `studyscribe/services/export.py`).
- Recommendation: document that exported zips and prompt manifests may contain sensitive user content and provide an opt-out (already present as an option) when exporting.

5) Accessibility
- Templates include ARIA attributes and roles in key UI elements (see `studyscribe/web/templates/base.html` and `studyscribe/web/templates/session.html` where dialogs have `role="dialog"` and inputs/controls have labels). Example: export modal uses `role="dialog"` and `aria-labelledby` in `session.html`.
- ASSUMPTION: basic ARIA hints exist but the app lacks automated accessibility testing and may not be fully WCAG-compliant; consider running axe or equivalent checks.

6) Observability & monitoring
- Job state persisted to `jobs` table (`studyscribe/core/db.py`) and accessible via `get_job()` (`studyscribe/services/jobs.py`); client polls job state via JS hooks in `studyscribe/web/static/js/app.js`.
- Application logging: standard Python logging is used in services (e.g., `studyscribe/services/jobs.py` uses `_LOGGER`), but no centralized log aggregation is provided.

7) Assumptions (labelled)
- ASSUMPTION: single-node, local deployment is the expected mode (evidence: filesystem-backed `DATA_DIR`, SQLite `DB_PATH`, and no auth). See `studyscribe/core/config.py` and `studyscribe/app.py`.
- ASSUMPTION: transcription runs on CPU for baseline; GPU support is not configured in repository. See `studyscribe/services/transcribe.py` where `WhisperModel` is instantiated with `device="cpu"`.

*** End of NFRs
