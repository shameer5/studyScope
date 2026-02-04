# StudyScribe (StudyScope)

Local-first study session workspace.

**Problem & Intended Users**
- Problem solved: capture and organize study sessions with searchable transcripts, notes, and exports without relying on always-on cloud services.
- Intended users: single-user, local-first students and educators who want private, offline-friendly study workflows.
- Business/organizational relevance: improves knowledge capture, training retention, and documentation workflows for education teams or small organizations.

**Key Functions**
- Create modules and sessions to organize coursework.
- Upload audio, transcribe sessions, and review timestamped transcripts.
- Generate AI notes and run Q&A over transcripts and attachments.
- Export session packs as ZIP archives for sharing or backup.

## Sprint 1 scope
- Create modules and sessions.
- Upload audio to a session.
- Start transcription jobs and view transcript segments.
- Parity-first UI using the StudyScribe Design System.

## Sprint 2 scope
- Port StudyScribe reference UI layout, modals, and interactions.
- Ensure offline-first static assets (no CDN dependencies).
- Provide UI stubs for AI/Q&A/export until Sprint 3.

## Sprint 3 scope
- Transcript search with relevance ranking and highlight.
- Generate AI notes and suggested tags.
- Q&A with citations over transcript and attachments.
- Export session ZIP with selected artifacts and manifest.

## Sprint 4 scope
- Containerized runtime (Dockerfile with Python 3.12 + ffmpeg + pinned deps).
- CI workflow for pytest and Docker build verification.
- Security hardening: enforced `FLASK_SECRET` in production and CSRF protection.

## Sprint 5 scope
- Stabilization and polish only (no new features or route/contract changes).
- Reliability hardening: retries/backoff, disk-space guardrails, and job queue tuning.
- Performance validation (100+ minute transcription) documented in sprint gate.

## Setup
1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Install system dependency for audio conversion:
   - `ffmpeg` (required for non-WAV uploads).

## Run
```bash
export STUDYSCRIBE_ENV=development
# or set a real secret instead of dev mode:
# export FLASK_SECRET="change-me"
python app.py
```

Open http://127.0.0.1:5000/home.
Local-first only: keep the server bound to localhost or place it behind a trusted proxy if exposing it.

## Important (runtime secrets)
- `FLASK_SECRET` is required in production. For local development, either set `FLASK_SECRET` or set `STUDYSCRIBE_ENV=development` (or `FLASK_DEBUG=1`) to allow the dev fallback secret.

## Sprint gate
- Role-based sprint gate reviews are recorded in `docs/16-Sprint-Gate.md`.

## Environment variables
- `FLASK_SECRET`: Flask session secret (required in production; set `STUDYSCRIBE_ENV=development` or `FLASK_DEBUG=1` for local dev fallback).
- `TRANSCRIBE_CHUNK_SECONDS`: Chunk size for transcription (default `600` seconds).
- `GEMINI_API_KEY`: Required for AI features (Sprint 2+).
- `GEMINI_MODEL`: Optional override for the Gemini model.
- `GEMINI_MAX_RETRIES`: Retry attempts for Gemini calls (default `3`).
- `GEMINI_RETRY_BASE_SECONDS`: Base backoff seconds for Gemini retries (default `1.0`).
- `JOBS_MAX_WORKERS`: Background worker count (default `2`).
- `JOBS_QUEUE_WARN`: Warn when background queue depth exceeds this value (default disabled).
- `DATA_DIR_WARN_PERCENT`: Warn when disk usage exceeds this percent (default `80`).
- `DATA_DIR_MIN_FREE_PERCENT`: Block writes if free space drops below this percent (default `5`).
- `DATA_DIR_MIN_FREE_MB`: Block writes if free space drops below this MB (default `0`).

**AI Tools Used**
- Google Gemini (`google-genai`) for AI notes generation and Q&A responses (default model: `gemini-2.5-flash`).
- faster-whisper for on-device transcription of audio into timestamped text.

**AI Usage & Verification**
- AI tools were used to draft and review code, documentation, and test plans.
- All AI-generated output was reviewed and edited; final decisions and changes were verified by the developer.

To enable AI features locally:
```bash
export GEMINI_API_KEY="your-key-here"
export GEMINI_MODEL="gemini-2.5-flash" # optional
```
See `docs/09-Dev-Setup-and-Runbook.md` for full setup and troubleshooting.

## Tests
```bash
pytest -q
```

Dev/test dependencies live in `requirements-dev.txt`.

## Docker
```bash
docker build -t studyscribe .
docker run --rm -p 5000:5000 -e FLASK_SECRET="change-me" studyscribe
```

## Repository
- GitHub: https://github.com/shameer5/studyScope (version history and commits).

## Notes
- Transcription requires the `faster-whisper` Python package and `ffmpeg` installed.
- Attachment text extraction uses `pdfplumber`, `python-docx`, and `python-pptx` when available.
- All assets are local; no CDN dependencies.
