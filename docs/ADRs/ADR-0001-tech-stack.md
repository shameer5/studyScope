# ADR-0001: Technology Stack

Date: 2024-01-15  
Status: Accepted  
Deciders: Architecture Team  

## Context

StudyScribe is a study session capture and AI-assisted note-taking tool for local learners. The system must support:
- Local-first data storage (no external database infrastructure).
- Integration with AI APIs (Google Gemini).
- Audio transcription on commodity hardware (CPU-based).
- Lightweight web UI for session management.
- Fast iteration and low operational overhead.

The team needed to select a cohesive tech stack that balances simplicity, performance, and feature velocity.

## Decision

**Adopt Python + Flask as the web framework, SQLite for relational persistence, and local filesystem for artifact storage.**

### Rationale:
- **Python**: rapid development, rich ecosystem (google.genai SDK, faster-whisper, Pydantic for schema validation).
- **Flask**: lightweight, minimal boilerplate, ideal for a single-developer or small-team project. Evidence: `studyscribe/app.py` uses Flask as primary framework.
- **SQLite**: zero-configuration, single-file DB, suitable for local deployment. No separate infrastructure needed. Evidence: `studyscribe/core/db.py` defines SQLite schema (`SCHEMA`).
- **Local filesystem**: `DATA_DIR` (see `studyscribe/core/config.py`) for per-module/session artifacts (audio, transcripts, notes, attachments). Simple, debuggable, no cloud overhead.
- **Jinja2 templates**: Flask's default templating, used for all UIs (see `studyscribe/web/templates/*.html`).

## Alternatives Considered

1. **Node.js + Express**
   - Pros: strong async I/O, npm ecosystem.
   - Cons: slower iteration for data processing; fragmented AI SDK support vs. Python.
   - Rejected: team expertise in Python; Python-first AI libraries.

2. **Django + PostgreSQL**
   - Pros: batteries-included ORM, migrations.
   - Cons: heavier than needed; requires external DB; more deployment complexity.
   - Rejected: local-first design doesn't need pg + complex migration system.

3. **Cloud-hosted SaaS (AWS Lambda + DynamoDB)**
   - Pros: auto-scaling, no ops.
   - Cons: API costs, vendor lock-in, data residency concerns (privacy), complexity for local use.
   - Rejected: contradicts local-first philosophy.

4. **Next.js + Node (full-stack JS)**
   - Pros: single language, React components.
   - Cons: heavier runtime; transcription/AI integration less mature in Node.
   - Rejected: Python dominates ML/AI tooling.

## Consequences

### Positive:
- **Developer velocity**: Python + Flask allows rapid feature development. See `studyscribe/services/*.py` for business logic written in ~500–1000 LOC per module.
- **Single dependency model**: minimal external services. Code is self-contained for local deployment.
- **AI integration**: seamless use of `google.genai` and `faster-whisper` SDKs (both Python-first).

### Negative:
- **Scaling limitations**: SQLite is single-writer; multi-instance deployments require migration to PostgreSQL/MySQL. See `studyscribe/core/db.py` and `docs/10-Deployment-and-Ops.md` for scaling caveats.
- **Async handling**: Flask uses synchronous request handling; long-running operations (transcription) must use background workers (`ThreadPoolExecutor` in `studyscribe/services/jobs.py`). For high concurrency, consider async frameworks (FastAPI, Quart).
- **Deployment**: no built-in container support; operators must provision Dockerfile and CI/CD (see `docs/10-Deployment-and-Ops.md` for guidance).

## Evidence in Codebase

- Framework: `studyscribe/app.py` defines Flask `app` instance and all route handlers.
- Database: `studyscribe/core/db.py` implements SQLite schema and helpers (`init_db()`, `execute()`, `fetch_all()`).
- Config: `studyscribe/core/config.py` defines `DB_PATH` and `DATA_DIR` using Python pathlib.
- Services: `studyscribe/services/*.py` uses Python for business logic (audio, transcription, AI, retrieval, export).
- Templates: `studyscribe/web/templates/*.html` renders Jinja2 templates.
- Entry point: `/app.py` (root) launches Flask dev server via `app.run()`.

## Mitigations for Future Scaling

- **Multi-instance DB**: if needed, migrate schema to PostgreSQL (abstract `studyscribe/core/db.py` to support multiple backends).
- **Async workloads**: extract transcription/export jobs to a dedicated queue (e.g., Celery + Redis) instead of in-process `ThreadPoolExecutor`.
- **Containerization**: provide Dockerfile and Kubernetes manifests (to be added in v1.0+).
