# Functional Specification

This document maps features to code artifacts, lists user stories, acceptance criteria, and error states. Every feature cites the implementing symbol(s).

1) Features (with evidence)
- Module & Session management (create/list/rename/delete): routes and handlers in `studyscribe/app.py`: `create_module()`, `view_module()`, `create_session()`, `view_session()`.
- Audio upload & persistence: UI and handler `upload_audio(module_id, session_id)` in `studyscribe/app.py` calling `studyscribe/services/audio.py`: `save_audio()`.
- Attachment upload & text extraction: upload handlers in `studyscribe/app.py`: `upload_attachment()` and helper `_extract_pdf_text()` used in `studyscribe/app.py`.
- Transcription job queue and processing: `start_transcription(module_id, session_id)` in `studyscribe/app.py` enqueues `studyscribe/services/transcribe.py`: `transcribe_audio()` via `studyscribe/services/jobs.py`: `enqueue_job()`.
- AI Notes generation: `start_notes()` in `studyscribe/app.py` calls `studyscribe/services/gemini.py`: `generate_notes()` and persists outputs (notes files under `session_dir/notes`).
- Q&A over session/module: `ask_question()` and `api_ai_ask()` in `studyscribe/app.py` call `studyscribe/services/gemini.py`: `answer_question()` and use `studyscribe/services/retrieval.py`: `retrieve_chunks()`.
- Export session pack: `export_pack()` route in `studyscribe/app.py` calls `studyscribe/services/export.py`: `build_session_export()`.

2) User Stories and Acceptance Criteria

- Story: As a student, I can create a module and add sessions so I can organise recordings.
  - Acceptance: posting to `create_module()` creates a DB row in `modules` table (`studyscribe/core/db.py`: `execute()`) and `view_module()` lists modules in template `studyscribe/web/templates/index.html`.

- Story: As a student, I can upload audio and see it listed in the session UI.
  - Acceptance: `upload_audio()` saves file via `save_audio()` (file exists at `session_dir/audio/<filename>`), and `session.html` shows `audio_files` listing.
  - Error state: uploading an unsupported extension is rejected by `upload_audio()` using `ALLOWED_AUDIO_EXTENSIONS` in `studyscribe/app.py`.

- Story: As a student, I can transcribe uploaded audio and inspect timestamped segments.
  - Acceptance: `start_transcription()` enqueues `transcribe_audio()`; after completion, `transcript/transcript.json` contains segments per `transcribe_audio()` and `session.html` renders transcript via `_transcript_panel.html`.
  - Error states: missing `ffmpeg` or `faster_whisper` raises `TranscriptionError` in `studyscribe/services/transcribe.py` which surfaces a user message.

- Story: As a student, I can generate AI notes from transcript and attachments.
  - Acceptance: `start_notes()` triggers `generate_notes()` in `studyscribe/services/gemini.py`; output `ai_notes.md` and `ai_notes.json` are saved to `session_dir/notes` and shown in `session.html`.
  - Error states: missing `GEMINI_API_KEY` causes `_client()` to raise `GeminiError` and UI shows a friendly message (handled in `studyscribe/app.py`).

- Story: As a student, I can ask questions with cited transcript snippets.
  - Acceptance: UI calls `api_ai_ask()` which calls `answer_question()`; response matches `AnswerOutput` model in `studyscribe/services/gemini.py`.
  - Error states: malformed model JSON triggers `GeminiError` in `answer_question()`.

- Story: As a student, I can export a session ZIP with selected artifacts.
  - Acceptance: `export_pack()` calls `build_session_export()` which writes a ZIP with `manifest.json` and selected files (`studyscribe/services/export.py`).

3) Detailed Acceptance Criteria (examples)
- Transcription output format: `transcript.json` must be an array of objects with `start`, `end`, `text` — produced by `transcribe_audio()` in `studyscribe/services/transcribe.py`.
- Chunk file format: `chunks.json` must be present after transcription and created by `build_chunks()` in `studyscribe/services/retrieval.py`.
- Job lifecycle: `enqueue_job()` creates a job row in `jobs` table and `update_job()` updates `status`/`progress` — see `studyscribe/services/jobs.py`.

4) Error states and handling
- Missing AI key: `studyscribe/services/gemini.py` `_client()` raises `GeminiError` with `user_message` instructing to set `GEMINI_API_KEY`.
- Transcription missing runtime: `_ensure_wav()` raises `TranscriptionError` if `ffmpeg` missing; `_load_model()` raises `TranscriptionError` if `faster_whisper` absent.
- Invalid uploads: `_reject_upload()` in `studyscribe/app.py` flashes an error and returns a 400 redirect when file validation fails.
