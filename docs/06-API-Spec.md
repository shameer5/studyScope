# API Specification

This spec lists HTTP endpoints and the shapes of requests/responses to the best extent possible from the code. All endpoints are implemented in `studyscribe/app.py` unless otherwise noted.

1) Convention
- Error handling: handlers typically flash errors or raise `TranscriptionError` / `GeminiError` which include `user_message` for UI-friendly messages (`studyscribe/services/transcribe.py` and `studyscribe/services/gemini.py`). Background jobs update `jobs` table (`studyscribe/services/jobs.py`).

2) Endpoints (summary)
- `GET /` — index page. Handler: `index()` in `studyscribe/app.py`. Response: HTML rendered from `studyscribe/web/templates/index.html`.

- `POST /modules` — create module. Handler: `create_module()` in `studyscribe/app.py`. Request form: `name` (string). Response: redirect to module view; DB write to `modules` table (`studyscribe/core/db.py`.

- `GET /modules/<module_id>` — view module. Handler: `view_module(module_id)` in `studyscribe/app.py`. Response: HTML rendering sessions and module metadata.

- `POST /modules/<module_id>/sessions` — create session. Handler: `create_session(module_id)` in `studyscribe/app.py`. Request form: `name` (string). Response: redirect to session view; DB write to `sessions` table.

- `GET /sessions/<session_id>` — view session. Handler: `view_session(session_id)` in `studyscribe/app.py`. Response: HTML rendering session workspace (`session.html`).

- `POST /modules/<module_id>/sessions/<session_id>/upload-audio` — upload audio. Handler: `upload_audio(module_id, session_id)` in `studyscribe/app.py`. Request: multipart `audio` file; optional `replace=1`. Validated against `ALLOWED_AUDIO_EXTENSIONS` in `studyscribe/app.py`. On success, `save_audio()` stores file under `session_dir/audio/`. Returns JSON when `Accept: application/json`; returns 507 if disk space is insufficient.

- `POST /modules/<module_id>/sessions/<session_id>/upload-attachment` — upload attachment. Handler: `upload_attachment(module_id, session_id)` in `studyscribe/app.py`. Request: multipart file(s) `attachment` (multiple). Validated against `ALLOWED_ATTACHMENT_EXTENSIONS` and MIME types (`ALLOWED_ATTACHMENT_MIME_TYPES`). On upload, server attempts text extraction via `_extract_pdf_text()` and writes `attachments/extracted.txt`. Returns JSON when `Accept: application/json`; returns 507 if disk space is insufficient.

- `POST /modules/<module_id>/sessions/<session_id>/transcribe` — start transcription. Handler: `start_transcription(module_id, session_id)` in `studyscribe/app.py`. Response: job id (job row created via `create_job()` in `studyscribe/services/jobs.py`). Background execution via `enqueue_job()` runs `transcribe_audio()` which writes `transcript/transcript.json`.

- `POST /modules/<module_id>/sessions/<session_id>/generate-notes` — start AI notes generation. Handler: `start_notes(module_id, session_id)` in `studyscribe/app.py`. Request: form/button trigger. Response: job id or blocking generation depending on implementation; server calls `generate_notes()` in `studyscribe/services/gemini.py` which returns `NotesOutput`.

- `POST /modules/<module_id>/sessions/<session_id>/export` — export pack. Handler: `export_pack(module_id, session_id)` in `studyscribe/app.py`. Request: form values `include_ai_notes`, `include_personal_notes`, `include_transcript`, `include_audio`, `include_attachments` (checkboxes). Response: ZIP file path / streamed ZIP produced by `build_session_export()` in `studyscribe/services/export.py`.

- `POST /modules/<module_id>/sessions/<session_id>/qa` — ask question from UI. Handler: `ask_question(module_id, session_id)` in `studyscribe/app.py`. The UI posts `question` and `scope` (session|module). Server persists chat messages via `_store_ai_message()` and calls `answer_question()` in `studyscribe/services/gemini.py` which returns `AnswerOutput` with fields `answer` (string), `answer_markdown` (string), and `sources` (list of dicts).

- `POST /api/ai/ask` — API endpoint used by the client (see `session.html` data-qa-url). Handler: `api_ai_ask()` in `studyscribe/app.py`. Accepts JSON payload: `question`, `scope`, `session_id` / `module_id` (best-effort). Returns JSON matching `AnswerOutput` schema: see `studyscribe/services/gemini.py`: `AnswerOutput` pydantic model.

3) Request / Response shapes (best-effort)
- Create module (form): `{ name: string }` → 302 redirect on success; DB insert to `modules` table.
- Upload audio: multipart form-data with `audio` file field. On validation failure returns 400 with flashed error; success redirects to session view showing `audio_files`.
- Start transcription: returns job id in UI (job row `id` string) and job status read from `jobs` table (`studyscribe/services/jobs.py`: `create_job()` / `get_job()`). Job record fields: `id`, `status`, `progress`, `message`, `result_path`, `created_at`, `updated_at`.
- AI answers (`api_ai_ask()` and `answer_question()`): JSON matching `AnswerOutput` model in `studyscribe/services/gemini.py`:
  - `answer`: string
  - `answer_markdown`: string
  - `sources`: list[dict]

4) Error conventions
- Model runtime and API errors are surfaced as `GeminiError` / `TranscriptionError` with `user_message` attribute intended for UI display (`studyscribe/services/gemini.py` and `studyscribe/services/transcribe.py`).
- Upload validation flashes an error and responds with a 400 redirect (or JSON when `Accept: application/json` is present). Storage failures return 507.
- Background job failures update the job row to `status='error'` and set `message` to a safe user message (see `studyscribe/services/jobs.py` exception handling in `enqueue_job()`).

5) Auth & Rate limits
- No authentication is implemented in code; endpoints are unauthenticated (see absence of auth middleware in `studyscribe/app.py`).
- No rate-limiting or quota enforcement present in repo; external API usage (Gemini) must be rate-limited by operator or proxied if needed (see `studyscribe/services/gemini.py`).

6) Pagination & filtering
- The UI lists modules and sessions via simple queries (no explicit pagination) in `studyscribe/app.py` handlers and templates `base.html` / `session.html`. For large datasets, pagination would need to be added server-side using `fetch_all()` filters in `studyscribe/core/db.py`.

7) Events / Webhooks
- No webhook endpoints implemented. Background progress is polled by client via job state stored in DB and exposed by app routes using `get_job()` (`studyscribe/services/jobs.py`).

## Appendix: Route Inventory (for UI contract)

This appendix lists every HTTP endpoint actually used by the UI (templates + app.js) with exact request/response shapes derived from the code.

### Job Polling

**GET /jobs/<job_id>** — Poll background job status (transcription, note generation, etc.)
- **Handler**: `studyscribe/app.py`: `job_status(job_id)`
- **Response** (JSON):
  ```json
  {
    "id": "job-uuid",
    "status": "queued" | "in_progress" | "success" | "error",
    "progress": 0-100,
    "message": "Transcribing chunk 3/5",
    "result_path": "path/to/transcript.json"
  }
  ```
- **Usage**: `studyscribe/web/static/js/app.js`: `setupTranscriptionStatus()` polls every 2 seconds until `status` is `success` or `error`.
- **Evidence**: [studyscribe/app.py](studyscribe/app.py#L1153), [app.js](studyscribe/web/static/js/app.js#L2066)

### AI Q&A Endpoints

**POST /api/ai/ask** — Ask a question and get an answer with sources
- **Handler**: `studyscribe/app.py`: `api_ai_ask()`
- **Request** (JSON):
  ```json
  {
    "session_id": "session-uuid",
    "question": "What is oxidation?",
    "scope": "session" | "module"
  }
  ```
- **Response** (JSON):
  ```json
  {
    "answer": "Oxidation is the loss of electrons...",
    "answer_markdown": "Oxidation is the loss of electrons... [1][2]",
    "sources": [
      {
        "id": 1,
        "source_id": "src_abc123",
        "kind": "transcript" | "attachment" | "ai_notes",
        "title": "Transcript [00:32–01:15]",
        "excerpt": "...relevant segment...",
        "locator": {
          "type": "transcript",
          "session_id": "...",
          "segment_id": 5,
          "t_start": 32.5,
          "t_end": 75.2,
          "t_start_ms": 32500,
          "t_end_ms": 75200
        }
      }
    ],
    "user_message_id": 42,
    "assistant_message_id": 43
  }
  ```
- **Usage**: `studyscribe/web/static/js/app.js`: `setupQaChat()` submits form as JSON via `fetchJson()`.
- **Evidence**: [studyscribe/app.py](studyscribe/app.py#L1593), [app.js](studyscribe/web/static/js/app.js#L1360)

**GET /api/sessions/<session_id>/ai/messages** — Fetch chat history and messages
- **Handler**: `studyscribe/app.py`: `api_ai_messages(session_id)`
- **Response** (JSON):
  ```json
  {
    "messages": [
      {
        "id": 42,
        "role": "user",
        "content": "What is oxidation?",
        "created_at": "2024-01-15T10:30:45+00:00",
        "sources": []
      },
      {
        "id": 43,
        "role": "assistant",
        "content": "Oxidation is the loss of electrons...",
        "created_at": "2024-01-15T10:30:50+00:00",
        "sources": [
          {
            "id": 1,
            "source_id": "src_abc123",
            "kind": "transcript",
            "label": "Transcript [00:32–01:15]",
            "snippet": "...",
            "open_url": "..."
          }
        ]
      }
    ]
  }
  ```
- **Usage**: `studyscribe/web/static/js/app.js`: `setupQaChat()` fetches on initial load.
- **Evidence**: [studyscribe/app.py](studyscribe/app.py#L1627)

### Source Preview

**GET /api/source_preview?source_id=...&session_id=...** — Fetch source preview for modal
- **Aliases**: `/api/source-preview`, `/api/sources/<source_id>/preview`
- **Handler**: `studyscribe/app.py`: `api_source_preview(source_id)`
- **Query Parameters**:
  - `source_id`: "src_abc123" or numeric index
  - `session_id`: session UUID (required)
- **Response** (JSON):
  ```json
  {
    "source_id": "src_abc123",
    "kind": "transcript",
    "title": "Transcript [00:32–01:15]",
    "excerpt": "...",
    "excerpt_full": "...",
    "open_url": "/modules/.../attachments/slides.pdf#page=3",
    "meta": {
      "file_name": "slides.pdf",
      "mime": "application/pdf",
      "page": 3
    }
  }
  ```
- **Usage**: `studyscribe/web/static/js/app.js`: Source link click in Q&A opens preview modal.
- **Evidence**: [studyscribe/app.py](studyscribe/app.py#L1964)

### Transcript Refresh

**GET /modules/<module_id>/sessions/<session_id>/transcript** — Fetch transcript HTML fragment
- **Handler**: `studyscribe/app.py`: `fetch_transcript(module_id, session_id)`
- **Response** (JSON):
  ```json
  {
    "html": "<div class='transcript'><div class='segment' data-segment-id='0'>[00:00-00:05] Hello everyone...</div>...",
    "has_transcript": true
  }
  ```
- **Usage**: `studyscribe/web/static/js/app.js`: `setupTranscriptControls()` calls `refreshTranscript()` after transcription job completes.
- **Evidence**: [studyscribe/app.py](studyscribe/app.py#L1089), [app.js](studyscribe/web/static/js/app.js#L2000)

### Segment Tags

**POST /modules/<module_id>/sessions/<session_id>/segment-tags** — Update per-segment tags
- **Handler**: `studyscribe/app.py`: `update_segment_tags(module_id, session_id)`
- **Request** (JSON):
  ```json
  {
    "segment_id": "seg_0",
    "label": "IMPORTANT" | "CONFUSING" | "EXAM-SIGNAL",
    "checked": true | false
  }
  ```
- **Response** (JSON):
  ```json
  {
    "ok": true,
    "tags": ["IMPORTANT", "CONFUSING"]
  }
  ```
- **Usage**: `studyscribe/web/static/js/app.js`: `bindSegmentTags()` listens to checkbox clicks and sends POST.
- **Evidence**: [studyscribe/app.py](studyscribe/app.py#L1113), [app.js](studyscribe/web/static/js/app.js#L1845)

References
- Primary handler implementations and models: `studyscribe/app.py`, `studyscribe/services/gemini.py`, `studyscribe/services/transcribe.py`, `studyscribe/services/jobs.py`, `studyscribe/core/db.py`.
- Client-side usage: `studyscribe/web/static/js/app.js`.
