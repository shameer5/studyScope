# StudyScribe (StudyScope)

Local-first study session workspace. Sprint 1 delivers module/session management, audio upload, and transcription with background job polling.

## Sprint 1 scope
- Create modules and sessions.
- Upload audio to a session.
- Start transcription jobs and view transcript segments.
- Parity-first UI using the StudyScribe Design System.

## Sprint 2 scope
- Upload attachments and extract text for retrieval.
- Generate AI notes and suggested tags.
- Q&A with citations over transcript and attachments.
- Export session ZIP with selected artifacts.
- Transcript tagging and personal notes.

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

## Sprint gate
- Role-based sprint gate reviews are recorded in `docs/16-Sprint-Gate.md`.

## Environment variables
- `FLASK_SECRET`: Flask session secret (optional; defaults to `studyscribe-dev`).
- `TRANSCRIBE_CHUNK_SECONDS`: Chunk size for transcription (default `600` seconds).
- `GEMINI_API_KEY`: Required for AI features (Sprint 2+).
- `GEMINI_MODEL`: Optional override for the Gemini model.

## Tests
```bash
pytest -q
```

## Notes
- Transcription requires the `faster-whisper` Python package and `ffmpeg` installed.
- Attachment text extraction uses `pdfplumber`, `python-docx`, and `python-pptx` when available.
- All assets are local; no CDN dependencies.
