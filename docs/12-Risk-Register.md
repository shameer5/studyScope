# Risk Register

This document identifies and tracks technical, delivery, and security risks with mitigations and links to code artifacts.

1) Technical Risks

Risk T1: Transcription runtime dependency failure
- Description: `faster_whisper` or `ffmpeg` are missing or incompatible, causing all transcription to fail.
- Evidence: `studyscribe/services/transcribe.py` checks `_load_model()` (raises `TranscriptionError` if `faster_whisper` missing), `_ensure_wav()` (raises `TranscriptionError` if `ffmpeg` missing).
- Likelihood: Medium (runtime deps can be installed incorrectly or become unavailable in CI).
- Impact: High (transcription is core feature).
- Mitigation: 
  - Add Dockerfile with explicit `ffmpeg` installation (`apt-get install ffmpeg` for Debian-based images).
  - Pin `faster_whisper` version in `requirements.txt`.
  - CI should verify both are available before running transcription tests.
 - Status: Mitigated in Sprint 4 with Dockerfile + CI runtime dependency checks.

Risk T2: Gemini API quota/rate limits exceeded
- Description: User generates notes/Q&A frequently and hits Gemini API quota or rate limits.
- Evidence: `studyscribe/services/gemini.py` `generate_notes()` and `answer_question()` call Gemini directly with no retry or rate-limiting logic.
- Likelihood: Medium (quota depends on API plan; not visible in code).
- Impact: High (AI features become unavailable).
- Mitigation:
  - Add retry logic with exponential backoff in `_client()` calls.
  - Log API errors with quota info.
  - Recommend operators monitor API usage via Gemini dashboard.

Risk T3: SQLite concurrency/locking
- Description: Multiple requests write to SQLite simultaneously, causing lock timeouts or data loss.
- Evidence: `studyscribe/core/db.py` uses SQLite with short-lived connections; no transaction isolation or locking strategy is documented.
- Likelihood: Low (single-node, local deployment); Medium if multi-instance without shared DB.
- Impact: Medium (data corruption or request failures).
- Mitigation:
  - For single-instance: acceptable; SQLite is sufficient.
  - For multi-instance: upgrade to PostgreSQL (see `studyscribe/core/db.py` to abstract DB calls).
  - Add connection pool / write queue if scaling to multiple writers.

Risk T4: Disk space exhaustion
- Description: Large audio files or many transcripts fill up `DATA_DIR` or DB file grows without bounds.
- Evidence: `studyscribe/core/config.py` `DATA_DIR` and `DB_PATH` are local filesystem; no quota or cleanup is enforced.
- Likelihood: Medium (depends on usage patterns).
- Impact: Medium (app stops accepting uploads; old jobs not cleaned from DB).
- Mitigation:
  - Implement quota enforcement or alerts at 80% disk usage.
  - Add cleanup job to delete old jobs and optionally old session artifacts.
  - Monitor `DATA_DIR` and DB file size periodically.

Risk T5: Job executor thread pool exhaustion
- Description: `_EXECUTOR` in `studyscribe/services/jobs.py` has 4 workers; if too many long-running transcriptions queue up, new jobs are delayed.
- Evidence: `studyscribe/services/jobs.py`: `_EXECUTOR = ThreadPoolExecutor(max_workers=4)`.
- Likelihood: Low (local single-user); High if many concurrent sessions.
- Impact: Medium (jobs are delayed, not lost).
- Mitigation:
  - Monitor queue depth and job wait times.
  - For production: offload to a separate job queue (Celery + Redis, etc.).

2) Delivery Risks

Risk D1: No CI/CD pipeline
- Description: No automated testing, deployment, or rollback in repo; all manual.
- Evidence: `.github/workflows/ci.yml` runs pytest and Docker build verification.
- Likelihood: High.
- Impact: High (slow iteration, human error).
- Mitigation:
  - Set up GitHub Actions or GitLab CI to run `pytest` on PRs.
  - Automate deployments with a simple shell script or container orchestration (Docker Compose, Kubernetes).
 - Status: Mitigated in Sprint 4 via `.github/workflows/ci.yml`.

Risk D2: Documentation drift
- Description: Code changes but `/docs` are not updated, causing stale guidance.
- Evidence: this risk register itself.
- Likelihood: Medium.
- Impact: Low (docs are guidance; code is source of truth).
- Mitigation:
  - Require docs updates in PR reviews when code changes.
  - Link PRs to docs updates in the backlog.

Risk D3: Dependency version conflicts or obsolescence
- Description: `requirements.txt` may include outdated or conflicting packages; `faster_whisper` or `google.genai` may have breaking changes.
- Evidence: see `requirements.txt` (root) for pinned versions.
- Likelihood: Medium.
- Impact: Medium (app fails to install or run).
- Mitigation:
  - Use tools like Dependabot or Renovate to auto-update and alert on major version changes.
  - Pin major versions; allow patch updates.

3) Security Risks

Risk S1: Weak default FLASK_SECRET
- Description: Missing `FLASK_SECRET` could allow weak session signing if not enforced in production.
- Evidence: `studyscribe/app.py` now raises when `FLASK_SECRET` is missing outside dev/test (`_resolve_flask_secret`).
- Likelihood: Low (enforced in production mode).
- Impact: High (session cookies are unsigned; attacker can forge sessions).
- Mitigation:
  - Remove the insecure default; raise an error if `FLASK_SECRET` is not set in production.
  - Document requirement in deployment guide (e.g., `docs/10-Deployment-and-Ops.md`).
 - Status: Mitigated in Sprint 4 by enforcing `FLASK_SECRET` outside dev/test.

Risk S2: CSRF vulnerability
- Description: CSRF could allow forged requests if protection were absent and the app is exposed.
- Evidence: Flask-WTF CSRF is enabled; templates include `csrf_token()` and JS sends `X-CSRFToken` headers.
- Likelihood: Low (CSRF protection enabled; local-first by design).
- Impact: High (attacker can delete sessions, upload malicious files, etc.).
- Mitigation:
  - Add Flask-WTF or similar for CSRF token generation and validation.
  - Document network-level access controls (e.g., VPN, firewall, localhost-only).
 - Status: Mitigated in Sprint 4 via Flask-WTF CSRF tokens and JS headers.

Risk S3: Unauthenticated endpoints
- Description: All routes in `studyscribe/app.py` are unauthenticated. Any user on the network can access sessions.
- Evidence: no auth decorators or user checks in route handlers.
- Likelihood: Low (local-first); High if deployed to a shared/public network.
- Impact: High (unauthorized access to all sessions, audio, notes).
- Mitigation:
  - Document single-user, local-only deployment model.
  - If multi-user access is needed, add authentication (e.g., Flask-Login, OAuth2).

Risk S4: Prompt injection attacks
- Description: User input in questions or personal notes could be crafted to manipulate Gemini model outputs or leak internal prompts.
- Evidence: `studyscribe/services/gemini.py` `_build_notes_prompt()` interpolates user content into the prompt without sanitization.
- Likelihood: Medium.
- Impact: Medium (attacker could manipulate AI output, learn prompt structure).
- Mitigation:
  - Review and sanitize user inputs before including in prompts.
  - Add input validation and rate-limiting on Q&A endpoints in `studyscribe/app.py`.

Risk S5: Audio/attachment exposure
- Description: Stored audio files and attachments in `DATA_DIR` could be accessed by unauthorized users if filesystem permissions are misconfigured.
- Evidence: `studyscribe/core/config.py` `DATA_DIR` and `studyscribe/app.py` `_session_dir()` helpers use standard filesystem paths without explicit permission checks.
- Likelihood: Low (local-first); High if network share or cloud storage is used.
- Impact: High (sensitive data exposure).
- Mitigation:
  - Set restrictive file permissions on `DATA_DIR` (700 for owner only).
  - If using cloud storage, encrypt at rest and in transit.
  - Document data residency and privacy requirements for users.

4) Risk prioritization

High priority (address before production deployment):
- T2: Gemini quota/rate limits → add retry logic.
- D1: CI/CD pipeline → set up automated tests.
- S1: Weak default FLASK_SECRET → remove default or raise error.
- S2: CSRF vulnerability → add CSRF tokens or document access controls.
- S3: Unauthenticated endpoints → document single-user model or add auth.

Medium priority (address in near-term):
- T1: Transcription runtime deps → add Dockerfile and CI checks.
- T3: SQLite concurrency → acceptable for single-instance; document for multi-instance.
- T4: Disk space → add quota and cleanup.
- D2: Documentation drift → process improvement.
- D3: Dependency conflicts → set up Dependabot.

Low priority (nice-to-have):
- T5: Job executor → monitor and optimize if needed.
- S4: Prompt injection → add input sanitization.
- S5: Audio/attachment exposure → document and test permissions.

5) Risk review schedule
- Review this register quarterly.
- Update risk scores after each major release or incident.
- Link mitigations to backlog items and track closure.
