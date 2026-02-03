# StudyScribe (StudyScope)

Local-first study session workspace. Sprint 1 delivers module/session management, audio upload, and transcription with background job polling.

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

## Setup
1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Install system dependency for audio conversion:
   - `ffmpeg` (required for non-WAV uploads).

## Run
```bash
python app.py
```

Open http://127.0.0.1:5000/home.

## Important (runtime secrets)
- `FLASK_SECRET` is required in production. For local development, either set `FLASK_SECRET` or set `STUDYSCRIBE_ENV=development` (or `FLASK_DEBUG=1`) to allow the dev fallback secret.

## Sprint gate
- Role-based sprint gate reviews are recorded in `docs/16-Sprint-Gate.md`.

## Environment variables
- `FLASK_SECRET`: Flask session secret (required in production; set `STUDYSCRIBE_ENV=development` or `FLASK_DEBUG=1` for local dev fallback).
- `TRANSCRIBE_CHUNK_SECONDS`: Chunk size for transcription (default `600` seconds).
- `GEMINI_API_KEY`: Required for AI features (Sprint 2+).
- `GEMINI_MODEL`: Optional override for the Gemini model.

## Tests
```bash
pytest -q
```

## Docker
```bash
docker build -t studyscribe .
docker run --rm -p 5000:5000 -e FLASK_SECRET="change-me" studyscribe
```

## Notes
- Transcription requires the `faster-whisper` Python package and `ffmpeg` installed.
- Attachment text extraction uses `pdfplumber`, `python-docx`, and `python-pptx` when available.
- All assets are local; no CDN dependencies.
