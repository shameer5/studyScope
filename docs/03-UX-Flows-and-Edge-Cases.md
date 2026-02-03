# UX Flows and Edge Cases

This document inventories screens, primary and alternate flows, and edge/error states with links to the implementing templates and handlers.

1) Screen / Page Inventory (template → purpose)
- Home / Index: `studyscribe/web/templates/index.html` — create modules and view recent modules; backed by `studyscribe/app.py`: `index()`.
- Module page (sidebar + sessions list): implemented in `studyscribe/web/templates/base.html` (sidebar) and `studyscribe/web/templates/session.html` for session details; handlers: `view_module()` and `view_session()` in `studyscribe/app.py`.
- Session view: `studyscribe/web/templates/session.html` — primary workspace for audio, attachments, transcript, AI notes, Q&A. See `studyscribe/app.py`: `view_session()`, `upload_audio()`, `upload_attachment()`, `start_transcription()`, `start_notes()`, `ask_question()`.
- Transcript panel partial: `studyscribe/web/templates/_transcript_panel.html` — renders transcript segments and actions used inside session page.

2) Primary Flows (step-by-step with handlers)
- Create module → create session → upload audio → transcribe → view transcript
  - Create module: POST to `create_module()` (`studyscribe/app.py`), which inserts `modules` row (`studyscribe/core/db.py`: `execute()`), then `view_module()` renders sessions.
  - Create session: POST to `create_session(module_id)` in `studyscribe/app.py` (creates `sessions` row).
  - Upload audio: form in `session.html` posts to `upload_audio(module_id, session_id)` which calls `save_audio()` (`studyscribe/services/audio.py`).`
  - Start transcription: button posts to `start_transcription(module_id, session_id)` which enqueues `transcribe_audio()` via `enqueue_job()` (`studyscribe/services/jobs.py`) and writes `transcript/transcript.json` on success (`studyscribe/services/transcribe.py`).

- Generate AI notes flow
  - User clicks generate notes in `session.html` (form posts to `start_notes()` in `studyscribe/app.py`).
  - Handler enqueues/requests `generate_notes()` in `studyscribe/services/gemini.py`. Output saved to `session_dir/notes/ai_notes.md` and shown in `session.html`.

- Q&A flow
  - User opens AI drawer and asks a question in the UI (client posts to `api_ai_ask()` in `studyscribe/app.py`).
  - Server calls `answer_question()` in `studyscribe/services/gemini.py`, which returns `AnswerOutput` and persisted messages via `_store_ai_message()` in `studyscribe/app.py`.

3) Alternate flows
- Replace audio: `session.html` provides a replace form posting `replace=1` to `upload_audio()` which clears existing transcript via `_clear_transcript()` (`studyscribe/app.py`).
- Attachments present without text: attachment listing in `session.html` shows status pill using `attachments_with_text` logic; PDF text extraction attempted via `_extract_pdf_text()` in `studyscribe/app.py` and stored under `attachments/extracted.txt`.
- Regenerate AI notes: same `start_notes()` route supports regenerating and overwrites `ai_notes.md` displayed in `session.html`.

## Session Page Interaction Model

The session page (`studyscribe/web/templates/session.html`) implements a reactive UI pattern where user actions trigger API calls and update the DOM without page reload:

```
User Form Submit (audio, attachment, notes, Q&A)
                    ↓
JS intercepts submit event (app.js:form handlers)
                    ↓
Validate file type, show spinner
                    ↓
POST to Flask endpoint (upload_audio, start_notes, api_ai_ask, etc.)
                    ↓
Backend processes, enqueues jobs or returns response
                    ↓
Client receives JSON response {ok, error, result_path, etc.}
                    ↓
JS updates DOM (render message, clear input, update status)
                    ↓
If job enqueued: start polling GET /jobs/<job_id> every 2 seconds (app.js:2066)
                    ↓
Poll returns {status: 'running'|'complete'|'error', progress, result_path}
                    ↓
On complete: call GET endpoint to fetch final result HTML/JSON
                    ↓
DOM updated with result, spinner removed, user notified
```

**Key Client-Side Handlers** (see [studyscribe/web/static/js/app.js](studyscribe/web/static/js/app.js)):
- Q&A Form: `setupQaChat()` (line 1257) intercepts Q&A form submits, POSTs to `/api/ai/ask`, renders messages in real-time, manages sources modal
- Transcription Status: `setupTranscriptionStatus()` (line 2014) polls `/jobs/<job_id>` every 2 seconds, updates progress UI, triggers transcript refresh on completion
- Confirm Delete Forms: `setupConfirmDeleteForms()` (line 2195) intercepts delete forms, opens confirm modal, submits on user confirmation
- Export Modal: Event handlers (line 985) manage export modal backdrop click, checkbox tracking, form submission to POST endpoint

**UI State Management**: Alpine.js manages tab switching (Transcript/AI Notes/Q&A tabs), native `<details>` elements manage accordion states, inline data attributes coordinate modals (`data-export-form`, `data-sources-list`, etc.)

3) Alternate flows
- Replace audio: `session.html` provides a replace form posting `replace=1` to `upload_audio()` which clears existing transcript via `_clear_transcript()` (`studyscribe/app.py`).
- Attachments present without text: attachment listing in `session.html` shows status pill using `attachments_with_text` logic; PDF text extraction attempted via `_extract_pdf_text()` in `studyscribe/app.py` and stored under `attachments/extracted.txt`.
- Regenerate AI notes: same `start_notes()` route supports regenerating and overwrites `ai_notes.md` displayed in `session.html`.

## Modals & Confirmation Dialogs

**Export Modal** (see [studyscribe/web/templates/session.html](studyscribe/web/templates/session.html#L366-L430))
- **Trigger**: Button `#exportOpen` (id="exportOpen") in session header
- **Form**: `#exportForm` with POST to `export_pack()` endpoint
- **Options (checkboxes)**:
  - `include_ai_notes` (default checked) — include ai_notes.md in ZIP
  - `include_personal_notes` (default checked) — include user annotations and notes
  - `include_transcript` (default checked) — include transcript.md and transcript.json
  - `include_audio` (default checked) — include original audio file
  - `include_attachments` (default checked) — include extracted attachments
- **Advanced Options** (in collapsed `<details>` element):
  - `include_raw_chunks` — include chunks.json for vector search debugging
  - `include_prompt_manifest` — include LLM prompt history and citation metadata
- **Submit**: POST form triggers download of ZIP blob; app.js manages backdrop dismiss and loading state

**Confirm Delete Modal** (see [studyscribe/web/static/js/app.js](studyscribe/web/static/js/app.js#L2195-L2240))
- **Trigger**: Submit buttons on delete forms (session.html: `data-confirm-delete`)
- **Form data attributes**:
  - `data-confirm-type="audio"|"attachment"` — determines label text
  - `data-confirm-name="filename"` — shows filename in confirmation message
- **Behavior**: `setupConfirmDeleteForms()` intercepts form submit, prevents default, opens generic confirm modal, re-submits on user confirmation
- **Response**: Server returns JSON `{ok: true, message: "Deleted"}` or `{ok: false, error: "..."}`

**Sources Modal** (see [studyscribe/web/templates/session.html](studyscribe/web/templates/session.html#L418-L440))
- **Trigger**: User clicks source link in Q&A message (app.js: `setupQaChat()` line ~1350)
- **Content**: Dynamically populated with source excerpt and metadata (title, filename, page, URL)
- **Actions**: Click source item to toggle details, close button to dismiss modal
- **Integration**: Rendered inside Q&A drawer, sources list managed by `setupQaChat()` via `currentSources` array and `selectedSourceId` state

4) Edge cases and recommendations
- No audio uploaded but transcription requested: `start_transcription()` checks audio presence and will flash an error and not enqueue job — see `start_transcription()` in `studyscribe/app.py` and `_reject_upload()` helper.
- Large files & timeouts: transcription chunks audio using `settings.chunk_seconds` from `studyscribe/core/config.py` and chunking is implemented in `_chunk_wav()` in `studyscribe/services/transcribe.py` — recommend server timeouts and background worker that supports long-running jobs (currently `enqueue_job()` uses local ThreadPoolExecutor in `studyscribe/services/jobs.py`).
- Missing system deps: lack of `ffmpeg` or `faster_whisper` raises `TranscriptionError` in `studyscribe/services/transcribe.py` — UI surfaces `user_message` via job status updates.
- Missing `GEMINI_API_KEY`: `studyscribe/services/gemini.py` `_client()` raises `GeminiError` and `start_notes()` must handle and surface `user_message` (see error handling paths in `studyscribe/app.py`).

5) Loading / Empty / Error states (templates + handlers)
- Empty module/session lists: `base.html` and `index.html` show "No modules yet" / "No sessions yet" blocks (see `studyscribe/web/templates/base.html` and `studyscribe/web/templates/index.html`).
- Transcription job status: `session.html` includes `data-job-status` element updated by client JS; job rows persisted in `jobs` table (`studyscribe/core/db.py`) and queried via `studyscribe/services/jobs.py`: `get_job()`.
- AI notes loading state: `session.html` has `data-ai-notes-status` and `data-ai-notes-output` placeholders; server-side generation errors should map `GeminiError.user_message` into the UI (see `studyscribe/services/gemini.py`: `GeminiError`).
- Attachment with no extracted text: session UI shows status pill "No text found" when extraction fails; extraction uses `_extract_pdf_text()` in `studyscribe/app.py` and attachments are listed by `_collect_files()`.

6) Edge-case interaction matrix (concise)
- Upload non-audio file to audio input → `_reject_upload()` returns 400 and flashes error (`studyscribe/app.py`).
- Replace audio during in-progress transcription → `start_transcription()` runs in background; replacing audio calls `_clear_transcript()` which removes transcript artifacts (`studyscribe/app.py`). Race between job and replace is possible; recommend cancelling jobs or locking per-session (not currently implemented).
- Corrupted transcript JSON → `_load_chunks()` in `studyscribe/app.py` handles missing/invalid `chunks.json` by rebuilding via `load_transcript()`.

7) Recommendations (small, code-linked)
- Add session-level locks or job cancellation: job helpers are in `studyscribe/services/jobs.py` — extend `enqueue_job()` to support cancellation tokens.
- Improve error propagation to UI: ensure `GeminiError.user_message` and `TranscriptionError.user_message` are surfaced in `start_notes()` and job failure paths in `studyscribe/app.py`.

## Notes Editor

The personal notes section in the session page uses a contenteditable div for inline editing:

- **Element**: `[data-notes-editor]` in session.html (rendered as contenteditable div with placeholder)
- **Auto-save**: app.js monitors input events and POSTs to endpoint (not yet implemented; currently manual save button)
- **Rich text**: Supports basic markdown-like formatting (users type markdown, rendered on display)
- **Persistence**: Notes saved to `annotations.json` via `update_session_annotations()` in studyscribe/app.py
- **Display**: Switches between edit mode (contenteditable) and display mode (rendered HTML) on blur/focus



4) Edge cases and recommendations
- No audio uploaded but transcription requested: `start_transcription()` checks audio presence and will flash an error and not enqueue job — see `start_transcription()` in `studyscribe/app.py` and `_reject_upload()` helper.
- Large files & timeouts: transcription chunks audio using `settings.chunk_seconds` from `studyscribe/core/config.py` and chunking is implemented in `_chunk_wav()` in `studyscribe/services/transcribe.py` — recommend server timeouts and background worker that supports long-running jobs (currently `enqueue_job()` uses local ThreadPoolExecutor in `studyscribe/services/jobs.py`).
- Missing system deps: lack of `ffmpeg` or `faster_whisper` raises `TranscriptionError` in `studyscribe/services/transcribe.py` — UI surfaces `user_message` via job status updates.
- Missing `GEMINI_API_KEY`: `studyscribe/services/gemini.py` `_client()` raises `GeminiError` and `start_notes()` must handle and surface `user_message` (see error handling paths in `studyscribe/app.py`).

5) Loading / Empty / Error states (templates + handlers)
- Empty module/session lists: `base.html` and `index.html` show "No modules yet" / "No sessions yet" blocks (see `studyscribe/web/templates/base.html` and `studyscribe/web/templates/index.html`).
- Transcription job status: `session.html` includes `data-job-status` element updated by client JS; job rows persisted in `jobs` table (`studyscribe/core/db.py`) and queried via `studyscribe/services/jobs.py`: `get_job()`.
- AI notes loading state: `session.html` has `data-ai-notes-status` and `data-ai-notes-output` placeholders; server-side generation errors should map `GeminiError.user_message` into the UI (see `studyscribe/services/gemini.py`: `GeminiError`).
- Attachment with no extracted text: session UI shows status pill "No text found" when extraction fails; extraction uses `_extract_pdf_text()` in `studyscribe/app.py` and attachments are listed by `_collect_files()`.

6) Edge-case interaction matrix (concise)
- Upload non-audio file to audio input → `_reject_upload()` returns 400 and flashes error (`studyscribe/app.py`).
- Replace audio during in-progress transcription → `start_transcription()` runs in background; replacing audio calls `_clear_transcript()` which removes transcript artifacts (`studyscribe/app.py`). Race between job and replace is possible; recommend cancelling jobs or locking per-session (not currently implemented).
- Corrupted transcript JSON → `_load_chunks()` in `studyscribe/app.py` handles missing/invalid `chunks.json` by rebuilding via `load_transcript()`.

7) Recommendations (small, code-linked)
- Add session-level locks or job cancellation: job helpers are in `studyscribe/services/jobs.py` — extend `enqueue_job()` to support cancellation tokens.
- Improve error propagation to UI: ensure `GeminiError.user_message` and `TranscriptionError.user_message` are surfaced in `start_notes()` and job failure paths in `studyscribe/app.py`.
