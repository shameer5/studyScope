# Route Inventory

**Document**: StudyScribe HTTP API & Page Routes  
**Purpose**: Complete inventory of all application routes with signatures, parameters, responses, and evidence citations  
**Scope**: Every route cited from [studyscribe/app.py](studyscribe/app.py), templates, and [studyscribe/web/static/js/app.js](studyscribe/web/static/js/app.js)

---

## Summary

StudyScribe exposes **30 routes** across three categories:
- **Page Routes**: Render Jinja2 HTML templates for browser navigation
- **Session/Module Routes**: CRUD for modules, sessions, and file uploads
- **API Routes**: JSON endpoints for polling, Q&A, source preview, and metadata

All routes use HTTP methods: GET (read), POST (create/update), PATCH (update), DELETE (remove).

---

## Navigation & Dashboard

### GET /
- **Handler**: `index()` [app.py:713](studyscribe/app.py#L713)
- **Purpose**: Entry point; redirects to home dashboard
- **Response**: HTTP 302 redirect to `/home`
- **Called From**: Browser address bar, initial load

### GET /home
- **Handler**: `home()` [app.py:719](studyscribe/app.py#L719)
- **Purpose**: Render dashboard with module list
- **Response**: HTML page (`index.html`) with modules
- **Context Passed**:
  - `modules`: List of all modules from DB, ordered newest first
- **Called From**: Direct URL navigation, [app.js:1171](studyscribe/web/static/js/app.js#L1171) (home link in sidebar)

---

## Module Management

### POST /modules
- **Handler**: `create_module()` [app.py:726](studyscribe/app.py#L726)
- **Purpose**: Create a new module (study group/course)
- **Method**: POST  
- **Request Body** (form-data):
  - `name` (required): Module name (e.g., "Organic Chemistry", "Computer Science 101")
- **Response**: HTTP 302 redirect to `/modules/<module_id>`
- **Side Effects**: 
  - Creates row in `modules` table with generated UUID
  - Creates filesystem directory at `DATA_DIR/modules/<module_id>/`
- **Called From**:
  - [index.html](studyscribe/web/templates/index.html): form `url_for("create_module")`
  - [base.html](studyscribe/web/templates/base.html): new module form

**Example**:
```bash
POST /modules
Content-Type: application/x-www-form-urlencoded

name=Organic+Chemistry
→ HTTP 302 /modules/57819ed8-f56c-424a-97a6-6d0383493fa2
```

### GET /modules/<module_id>
- **Handler**: `view_module(module_id)` [app.py:739](studyscribe/app.py#L739)
- **Purpose**: Display module detail page with sessions
- **Parameters**:
  - `module_id`: UUID of the module
- **Response**: HTML page (`module.html`) with:
  - Module metadata (name, created_at)
  - List of sessions for this module
  - Navigation sidebar
- **Context Passed**:
  - `module`: Selected module record
  - `sessions`: All sessions in module, ordered newest first
  - `modules`: Full module list (for sidebar navigation)
- **Called From**:
  - URL redirect after POST /modules
  - [base.html](studyscribe/web/templates/base.html): module navigation links

### PATCH /modules/<module_id>
- **Handler**: `update_module(module_id)` [app.py:1983](studyscribe/app.py#L1983)
- **Purpose**: Rename a module (inline edit)
- **Method**: PATCH  
- **Request Body** (JSON):
  ```json
  { "name": "New Module Name" }
  ```
- **Response** (JSON):
  ```json
  { "id": "57819ed8-...", "name": "New Module Name" }
  ```
- **Side Effects**: Updates `name` in `modules` table
- **Called From**:
  - [app.js:2233](studyscribe/web/static/js/app.js#L2233): Inline rename via `setupEntityActions()`, sends PATCH with JSON payload

**Example**:
```bash
PATCH /modules/57819ed8-f56c-424a-97a6-6d0383493fa2
Content-Type: application/json

{ "name": "Organic Chemistry II" }
→ { "id": "57819ed8-...", "name": "Organic Chemistry II" }
```

### DELETE /modules/<module_id>
- **Handler**: `delete_module(module_id)` [app.py:1994](studyscribe/app.py#L1994)
- **Purpose**: Delete a module and all its sessions/files
- **Method**: DELETE  
- **Response** (JSON):
  ```json
  { "redirect": "/home" }
  ```
- **Side Effects**:
  - Deletes all sessions in module from DB
  - Deletes filesystem directory at `DATA_DIR/modules/<module_id>/`
  - Deletes module row from DB
- **Called From**:
  - [app.js:2290](studyscribe/web/static/js/app.js#L2290): Confirm modal, sends DELETE via `requestJson()`

**Example**:
```bash
DELETE /modules/57819ed8-f56c-424a-97a6-6d0383493fa2
→ { "redirect": "/home" }
```

---

## Session Management

### POST /modules/<module_id>/sessions
- **Handler**: `create_session(module_id)` [app.py:748](studyscribe/app.py#L748)
- **Purpose**: Create a new session (study/lab session within a module)
- **Method**: POST  
- **Request Body** (form-data):
  - `name` (optional): Session name; defaults to "Untitled"
- **Response**: HTTP 302 redirect to `/sessions/<session_id>` with optional `?rename=1` query param if name is "Untitled"
- **Side Effects**:
  - Creates row in `sessions` table with generated UUID
  - Creates filesystem directory at `DATA_DIR/modules/<module_id>/sessions/<session_id>/`
- **Called From**:
  - [module.html](studyscribe/web/templates/module.html): form `url_for("create_session", module_id=module.id)`

**Example**:
```bash
POST /modules/57819ed8-f56c-424a-97a6-6d0383493fa2/sessions
Content-Type: application/x-www-form-urlencoded

name=Lecture+1
→ HTTP 302 /sessions/c26ed045-9b3b-47a7-b430-d3e2b5476d52
```

### GET /modules/<module_id>/sessions/<session_id> (Legacy)
- **Handler**: `legacy_view_session(module_id, session_id)` [app.py:764](studyscribe/app.py#L764)
- **Purpose**: Legacy URL path for backward compatibility
- **Response**: HTTP 302 redirect to `/sessions/<session_id>` (canonical URL)
- **Called From**: Old bookmarks, external links

### GET /sessions/<session_id>
- **Handler**: `view_session(session_id)` [app.py:770](studyscribe/app.py#L770)
- **Purpose**: Display session detail page with transcript, notes, AI drawer, attachments, audio
- **Parameters**:
  - `session_id`: UUID of the session
  - `job_id` (optional): UUID of active job (for polling status)
  - `rename` (optional): "1" if session should auto-focus rename field
- **Response**: HTML page (`session.html`) with full context:
  - Transcript and annotations
  - AI notes and suggested tags
  - Audio and attachment files
  - Q&A history
  - Session metadata as JSON object `sessionMeta` (passed to Alpine/HTMX)
- **Context Passed** (to template):
  - `transcript`: Array of segment objects `{text, start, end, segment_id, tags}`
  - `annotations`: Object `{tags, notes, notes_html, notes_markdown, session_tags}`
  - `ai_notes`: Markdown string of generated notes
  - `suggested_tags`: Array of tag suggestions
  - `audio_files`: Array of audio file metadata
  - `attachment_files`: Array of attachment metadata
  - `session_meta`: Object with URLs, booleans, and metadata for client-side scripting
- **Called From**:
  - URL redirect after POST /modules/<module_id>/sessions
  - [session.html](studyscribe/web/templates/session.html): tab navigation

**Example**:
```
GET /sessions/c26ed045-9b3b-47a7-b430-d3e2b5476d52?rename=1&job_id=job-12345
→ HTML page (session.html) with sessionMeta = {
    sessionId: "c26ed045-...",
    hasTranscript: false,
    hasAttachments: true,
    qaMessagesUrl: "/api/sessions/c26ed045-9b3b-47a7-b430-d3e2b5476d52/ai/messages",
    transcriptUrl: "/modules/57819.../sessions/c26ed045.../transcript",
    ...
  }
```

### PATCH /sessions/<session_id>
- **Handler**: `update_session(session_id)` [app.py:2009](studyscribe/app.py#L2009)
- **Purpose**: Rename a session (inline edit)
- **Method**: PATCH  
- **Request Body** (JSON):
  ```json
  { "name": "New Session Name" }
  ```
- **Response** (JSON):
  ```json
  { "id": "c26ed045-...", "name": "New Session Name" }
  ```
- **Side Effects**: Updates `name` in `sessions` table
- **Called From**:
  - [app.js:2233](studyscribe/web/static/js/app.js#L2233): Inline rename, sends PATCH with JSON

**Example**:
```bash
PATCH /sessions/c26ed045-9b3b-47a7-b430-d3e2b5476d52
Content-Type: application/json

{ "name": "Lab Report Prep" }
→ { "id": "c26ed045-...", "name": "Lab Report Prep" }
```

### DELETE /sessions/<session_id>
- **Handler**: `delete_session(session_id)` [app.py:2020](studyscribe/app.py#L2020)
- **Purpose**: Delete a session and all its files
- **Method**: DELETE  
- **Response** (JSON):
  ```json
  {
    "redirect": "/modules/<module_id>"  OR  "/sessions/<next_session_id>"
  }
  ```
  - Redirects to next session in module if one exists, otherwise to parent module
- **Side Effects**:
  - Deletes filesystem directory at `DATA_DIR/modules/<module_id>/sessions/<session_id>/`
  - Deletes session row from DB
- **Called From**:
  - [app.js:2290](studyscribe/web/static/js/app.js#L2290): Confirm modal, sends DELETE

**Example**:
```bash
DELETE /sessions/c26ed045-9b3b-47a7-b430-d3e2b5476d52
→ { "redirect": "/modules/57819ed8-f56c-424a-97a6-6d0383493fa2" }
```

---

## Audio & File Management

### POST /modules/<module_id>/sessions/<session_id>/upload-audio
- **Handler**: `upload_audio(module_id, session_id)` [app.py:876](studyscribe/app.py#L876)
- **Purpose**: Upload audio file for transcription
- **Method**: POST  
- **Request Body** (multipart/form-data):
  - `audio` (required): File upload (MP3, WAV, M4A, etc.; see `ALLOWED_AUDIO_EXTENSIONS`)
  - `replace` (optional): "1" to replace existing audio (clears transcript)
- **Response**:
  - HTML: HTTP 302 redirect to `/sessions/<session_id>`
  - JSON: `{"ok": true, "filename": "..."}` when `Accept: application/json`
  - Errors: 400 on validation failures; 507 if disk space is insufficient
- **Side Effects**:
  - Saves audio file to `DATA_DIR/modules/<module_id>/sessions/<session_id>/audio/`
  - If `replace=1` and existing audio exists: deletes old audio and clears transcript
  - Flash message: "Audio saved to {filename}."
- **Called From**:
  - [session.html:81](studyscribe/web/templates/session.html#L81): Form `url_for("upload_audio", module_id=module.id, session_id=session.id)`
  - HTMX form with `hx-post`, file input `name="audio"`

**Example**:
```bash
POST /modules/57819.../sessions/c26ed045.../upload-audio
Content-Type: multipart/form-data

audio=@lecture.mp3
→ HTTP 302 /sessions/c26ed045...
Flash: "Audio saved to lecture.mp3."
```

### POST /modules/<module_id>/sessions/<session_id>/upload-attachment
- **Handler**: `upload_attachment(module_id, session_id)` [app.py:906](studyscribe/app.py#L906)
- **Purpose**: Upload document/slide attachments (PDF, PPTX, DOCX)
- **Method**: POST  
- **Request Body** (multipart/form-data):
  - `attachment` (required, multiple): File uploads; see `ALLOWED_ATTACHMENT_EXTENSIONS` and `ALLOWED_ATTACHMENT_MIME_TYPES`
- **Response**:
  - HTML: HTTP 302 redirect to `/sessions/<session_id>`
  - JSON: `{"ok": true}` when `Accept: application/json`
  - Errors: 400 on validation failures; 507 if disk space is insufficient
- **Side Effects**:
  - Saves files to `DATA_DIR/modules/<module_id>/sessions/<session_id>/attachments/`
  - Rebuilds attachment text index via `_rebuild_attachment_index()` (extracts text from PDFs, PPTXs, DOCXs)
  - Flash messages: varies (success, warning about PPTX without python-pptx, etc.)
- **Called From**:
  - [session.html:153](studyscribe/web/templates/session.html#L153): Form `url_for("upload_attachment", module_id=module.id, session_id=session.id)`
  - HTMX form with `hx-post`, file inputs `name="attachment"` (multiple)

**Example**:
```bash
POST /modules/57819.../sessions/c26ed045.../upload-attachment
Content-Type: multipart/form-data

attachment=@slides.pdf
attachment=@notes.docx
→ HTTP 302 /sessions/c26ed045...
Flash: "Attachment uploaded."
```

### POST /modules/<module_id>/sessions/<session_id>/delete-audio
- **Handler**: `delete_audio(module_id, session_id)` [app.py:943](studyscribe/app.py#L943)
- **Purpose**: Delete an uploaded audio file
- **Method**: POST  
- **Request Body** (form-data):
  - `filename`: Name of the audio file to delete
- **Response**: 
  - If JSON accepted: `{"ok": true}` (HTTP 200)
  - Else: HTML 302 redirect to `/sessions/<session_id>`
- **Side Effects**:
  - Deletes file from `DATA_DIR/modules/<module_id>/sessions/<session_id>/audio/<filename>`
- **Called From**:
  - [session.html:135](studyscribe/web/templates/session.html#L135): Form with `data-confirm-delete`, `url_for("delete_audio", ...)`
  - [app.js:2337](studyscribe/web/static/js/app.js#L2337): `setupConfirmDeleteForms()` intercepts, shows confirm modal, sends POST

**Example**:
```bash
POST /modules/57819.../sessions/c26ed045.../delete-audio
Content-Type: application/x-www-form-urlencoded
Accept: application/json

filename=lecture.mp3
→ {"ok": true}
```

### POST /modules/<module_id>/sessions/<session_id>/delete-attachment
- **Handler**: `delete_attachment(module_id, session_id)` [app.py:967](studyscribe/app.py#L967)
- **Purpose**: Delete an attachment file
- **Method**: POST  
- **Request Body** (form-data):
  - `filename`: Name of the attachment file to delete
- **Response**: 
  - If JSON accepted: `{"ok": true}` (HTTP 200)
  - Else: HTML 302 redirect to `/sessions/<session_id>`
- **Side Effects**:
  - Deletes file from `DATA_DIR/modules/<module_id>/sessions/<session_id>/attachments/<filename>`
  - Rebuilds attachment text index
- **Called From**:
  - [session.html:186](studyscribe/web/templates/session.html#L186): Form with `data-confirm-delete`, `url_for("delete_attachment", ...)`
  - [app.js:2337](studyscribe/web/static/js/app.js#L2337): `setupConfirmDeleteForms()` intercepts

**Example**:
```bash
POST /modules/57819.../sessions/c26ed045.../delete-attachment
Content-Type: application/x-www-form-urlencoded
Accept: application/json

filename=slides.pdf
→ {"ok": true}
```

### GET /modules/<module_id>/sessions/<session_id>/attachments/<filename>
- **Handler**: `open_attachment(module_id, session_id, filename)` [app.py:994](studyscribe/app.py#L994)
- **Purpose**: Serve attachment file for download/viewing
- **Method**: GET  
- **Response**: File bytes with appropriate Content-Type header (application/pdf, application/vnd.openxmlformats-officedocument.presentationml.presentation, etc.)
- **Called From**:
  - [attachment_preview.html](studyscribe/web/templates/attachment_preview.html): PDF.js iframe `src=` attribute
  - [app.js](studyscribe/web/static/js/app.js): Download links for attachments

**Example**:
```bash
GET /modules/57819.../sessions/c26ed045.../attachments/slides.pdf
→ PDF file (binary)
```

### GET /attachments/<attachment_id>/open
- **Handler**: `open_attachment()` [app.py:1008](studyscribe/app.py#L1008)
- **Purpose**: Serve attachment by ID (legacy/alternative path)
- **Method**: GET  
- **Parameters**:
  - `attachment_id`: Filename or UUID
  - `session_id` (query): Session UUID (for source lookup)
- **Response**: File bytes or HTML error page
- **Called From**: Source preview links in Q&A answers

### GET /modules/<module_id>/sessions/<session_id>/attachments/<filename>/preview
- **Handler**: `attachment_preview()` [app.py:1029](studyscribe/app.py#L1029)
- **Purpose**: Render preview panel for attachment (PDF with excerpt highlighting, PPTX thumbnail, etc.)
- **Method**: GET  
- **Response**: HTML (`attachment_preview.html`) with:
  - PDF.js viewer (for PDFs)
  - Excerpt highlighting
  - File metadata
- **Called From**:
  - [app.js:1491](studyscribe/web/static/js/app.js#L1491): Source preview modal, HTMX `hx-get`

**Example**:
```bash
GET /modules/57819.../sessions/c26ed045.../attachments/slides.pdf/preview
→ HTML with PDF.js iframe and excerpt highlights
```

---

## Transcript & Transcription

### POST /modules/<module_id>/sessions/<session_id>/transcribe
- **Handler**: `start_transcription(module_id, session_id)` [app.py:1139](studyscribe/app.py#L1139)
- **Purpose**: Kick off background transcription (Whisper) for uploaded audio
- **Method**: POST  
- **Request Body**: None (uses latest uploaded audio)
- **Response**: HTTP 302 redirect to `/sessions/<session_id>?job_id=<job_id>`
- **Side Effects**:
  - Enqueues `transcribe_audio(audio_path, session_dir)` as background job via ThreadPoolExecutor
  - Job processes audio → writes JSON segments to `session_dir/transcript/transcript.json`
  - Flash message: "Transcription started."
- **Called From**:
  - [session.html:207](studyscribe/web/templates/session.html#L207): Form `url_for("start_transcription", module_id=module.id, session_id=session.id)`

**Example**:
```bash
POST /modules/57819.../sessions/c26ed045.../transcribe
→ HTTP 302 /sessions/c26ed045...?job_id=job-abc123
Flash: "Transcription started."
```

### GET /jobs/<job_id>
- **Handler**: `job_status(job_id)` [app.py:1153](studyscribe/app.py#L1153)
- **Purpose**: Poll background job status (transcription, note generation, etc.)
- **Method**: GET  
- **Parameters**:
  - `job_id`: Job UUID
- **Response** (JSON):
  ```json
  {
    "id": "job-abc123",
    "status": "in_progress" | "success" | "error",
    "progress": 45,
    "message": "Processing audio...",
    "result": "path/to/transcript.json"  (if success)
  }
  ```
- **Called From**:
  - [app.js:2144](studyscribe/web/static/js/app.js#L2144): `setupTranscriptionStatus()` polls every 2 seconds via `fetchJson(`/jobs/${jobId}`)`

**Polling Contract** (used by client):
```javascript
// app.js line 2144
const poll = async () => {
  const { response, data } = await fetchJson(`/jobs/${jobId}`);
  if (data.status === "success") {
    // Transcription done; refresh transcript panel
    await refreshTranscript();
  } else if (data.status === "error") {
    // Show error message
    showToast("error", data.message || "Transcription failed.");
  } else {
    // Still in progress; update progress bar
    statusEl.textContent = `${data.status} (${data.progress}%)${data.message ? ' ' + data.message : ''}`;
    window.setTimeout(poll, 2000);  // Poll again in 2 seconds
  }
};
```

**Example**:
```bash
GET /jobs/job-abc123
→ {"id": "job-abc123", "status": "in_progress", "progress": 45, "message": "Processing chunk 3/5"}

(After 2s) GET /jobs/job-abc123
→ {"id": "job-abc123", "status": "success", "result": "session_dir/transcript/transcript.json"}
```

### GET /modules/<module_id>/sessions/<session_id>/transcript
- **Handler**: `fetch_transcript(module_id, session_id)` [app.py:1089](studyscribe/app.py#L1089)
- **Purpose**: Return transcript HTML fragment for panel refresh (after transcription completes)
- **Method**: GET  
- **Response** (JSON):
  ```json
  {
    "html": "<div class='transcript'>...",
    "has_transcript": true
  }
  ```
- **Side Effects**: None (read-only)
- **Called From**:
  - [app.js:1991](studyscribe/web/static/js/app.js#L1991): `setupTranscriptControls()` calls `refreshTranscript()`, which fetches this endpoint and updates DOM via HTMX or direct innerHTML update

**Example**:
```bash
GET /modules/57819.../sessions/c26ed045.../transcript
→ {
  "html": "<div><div class='segment'>[00:00-00:05] Hello everyone...</div>...",
  "has_transcript": true
}
```

### POST /modules/<module_id>/sessions/<session_id>/delete-transcript
- **Handler**: `delete_transcript(module_id, session_id)` [app.py:1071](studyscribe/app.py#L1071)
- **Purpose**: Remove transcript artifacts and reset related state
- **Method**: POST  
- **Request Body**: None
- **Response**: 
  - If JSON accepted: `{"ok": true, "message": "Transcript deleted."}`
  - Else: HTTP 302 redirect to `/sessions/<session_id>`
- **Side Effects**:
  - Deletes `session_dir/transcript/` directory
  - Clears transcript from memory/cache
  - Flash message: "Transcript deleted."
- **Called From**:
  - [session.html](studyscribe/web/templates/session.html): Delete transcript button (HTMX or form)

**Example**:
```bash
POST /modules/57819.../sessions/c26ed045.../delete-transcript
Content-Type: application/json

→ {"ok": true, "message": "Transcript deleted."}
```

---

## Annotations & Tags

### POST /modules/<module_id>/sessions/<session_id>/segment-tags
- **Handler**: `update_segment_tags(module_id, session_id)` [app.py:1113](studyscribe/app.py#L1113)
- **Purpose**: Update per-segment tags (IMPORTANT, CONFUSING, EXAM-SIGNAL)
- **Method**: POST  
- **Request Body** (JSON):
  ```json
  {
    "segment_id": "seg_0",
    "label": "IMPORTANT",
    "checked": true
  }
  ```
- **Response** (JSON):
  ```json
  {
    "ok": true,
    "tags": ["IMPORTANT", "CONFUSING"]
  }
  ```
- **Side Effects**:
  - Updates/persists tags in `session_dir/annotations.json` under key `tags[segment_id]`
  - Tags are enum: `{"IMPORTANT", "CONFUSING", "EXAM-SIGNAL"}`
- **Called From**:
  - [app.js:1954](studyscribe/web/static/js/app.js#L1954): `bindSegmentTags()`, listens to checkbox clicks on `[data-segment-tag]` elements, sends POST with JSON

**Example**:
```bash
POST /modules/57819.../sessions/c26ed045.../segment-tags
Content-Type: application/json

{"segment_id": "seg_0", "label": "IMPORTANT", "checked": true}
→ {"ok": true, "tags": ["IMPORTANT"]}

(Click again to add CONFUSING)
POST /modules/57819.../sessions/c26ed045.../segment-tags
Content-Type: application/json

{"segment_id": "seg_0", "label": "CONFUSING", "checked": true}
→ {"ok": true, "tags": ["IMPORTANT", "CONFUSING"]}
```

### POST /modules/<module_id>/sessions/<session_id>/annotations
- **Handler**: `save_annotations(module_id, session_id)` [app.py:1162](studyscribe/app.py#L1162)
- **Purpose**: Persist personal notes, tags, and session-level tags
- **Method**: POST  
- **Request Body** (form-data or JSON):
  - `tags` (optional, list): Segment tags in format "segment_id:TAG"
  - `session_tags` (optional, list): Session-level tags
  - `personal_notes_html` (optional): HTML-formatted notes
  - `personal_notes_markdown` (optional): Markdown-formatted notes
  - `personal_notes` (optional, legacy): Plain text notes
- **Response**: HTTP 302 redirect to `/sessions/<session_id>`
- **Side Effects**:
  - Writes JSON to `session_dir/annotations.json`:
    ```json
    {
      "tags": { "seg_0": ["IMPORTANT"], "seg_1": ["EXAM-SIGNAL"] },
      "notes": "...",
      "notes_html": "...",
      "notes_markdown": "...",
      "session_tags": ["Chemistry", "Organic"]
    }
    ```
  - Flash message: "Annotations saved."
- **Called From**:
  - [session.html](studyscribe/web/templates/session.html): Form submission for note saving

**Example**:
```bash
POST /modules/57819.../sessions/c26ed045.../annotations
Content-Type: application/x-www-form-urlencoded

tags=seg_0%3AIMPORTANT&tags=seg_1%3ACONFUSING&session_tags=Chemistry&session_tags=Organic&personal_notes_markdown=My+notes
→ HTTP 302 /sessions/c26ed045...
Flash: "Annotations saved."
```

---

## Notes Generation

### POST /modules/<module_id>/sessions/<session_id>/generate-notes
- **Handler**: `start_notes(module_id, session_id)` [app.py:1199](studyscribe/app.py#L1199)
- **Purpose**: Generate AI notes in background using transcript + attachments
- **Method**: POST  
- **Request Body**: None (uses existing transcript/attachments in session)
- **Response**:
  - If JSON accepted: `{"job_id": "...", "redirect": "/sessions/..."}`
  - Else: HTTP 302 redirect to `/sessions/<session_id>?job_id=<job_id>`
- **Side Effects**:
  - Validates that transcript, attachments, or notes exist (raises RuntimeError if not)
  - Enqueues `generate_notes(payload)` job (calls Gemini API)
  - Job writes `session_dir/notes/ai_notes.json` and `ai_notes.md` with summary and tags
  - Flash message: "Generating notes..."
- **Called From**:
  - [session.html](studyscribe/web/templates/session.html): "Generate Notes" button form
  - [app.js:1860](studyscribe/web/static/js/app.js#L1860): `setupGenerateNotes()` can submit as form or JSON

**Example**:
```bash
POST /modules/57819.../sessions/c26ed045.../generate-notes
→ HTTP 302 /sessions/c26ed045...?job_id=job-xyz789
Flash: "Generating notes..."

(Poll /jobs/job-xyz789 for completion, then fetch /modules/.../sessions/.../ai-notes)
```

### GET /modules/<module_id>/sessions/<session_id>/ai-notes
- **Handler**: `fetch_ai_notes(module_id, session_id)` [app.py:1266](studyscribe/app.py#L1266)
- **Purpose**: Fetch generated AI notes markdown + suggested tags
- **Method**: GET  
- **Response** (JSON):
  ```json
  {
    "notes": "# Summary\n\n## Key Topics\n...",
    "suggested_tags": ["Important Concept", "Exam Topic", ...]
  }
  ```
- **Status Codes**:
  - 200: Notes found and returned
  - 404: Notes not yet generated
- **Called From**:
  - [app.js:1835](studyscribe/web/static/js/app.js#L1835): `setupGenerateNotes()` refreshes notes after job completes

**Example**:
```bash
GET /modules/57819.../sessions/c26ed045.../ai-notes
→ {"notes": "# Summary\n...", "suggested_tags": ["Organic Chemistry", "Mechanism"]}
```

---

## Q&A (Chat Interface)

### POST /api/ai/ask
- **Handler**: `api_ai_ask()` [app.py:1593](studyscribe/app.py#L1593)
- **Purpose**: Answer a question using transcript + attachments as context (JSON endpoint)
- **Method**: POST  
- **Request Body** (JSON):
  ```json
  {
    "session_id": "c26ed045-...",
    "question": "What is the mechanism of reaction X?",
    "scope": "session" | "module"
  }
  ```
- **Response** (JSON):
  ```json
  {
    "answer": "The mechanism involves...",
    "answer_markdown": "The mechanism involves... [1][2]",
    "sources": [
      {
        "id": 1,
        "source_id": "src_abc123",
        "kind": "transcript",
        "title": "Transcript [00:32–01:15]",
        "excerpt": "...relevant segment...",
        "locator": {
          "type": "transcript",
          "session_id": "...",
          "segment_id": 5,
          "t_start": 32.5,
          "t_end": 75.2,
          "t_start_ms": 32500,
          "t_end_ms": 75200,
          "anchor": "seg-5"
        }
      },
      {
        "id": 2,
        "source_id": "src_def456",
        "kind": "attachment",
        "title": "Attachment: slides.pdf",
        "excerpt": "...",
        "locator": {
          "type": "attachment",
          "attachment_id": "slides.pdf",
          "file_name": "slides.pdf",
          "mime": "application/pdf",
          "page": 3,
          "chunk_id": "chunk_12"
        }
      }
    ],
    "user_message_id": 42,
    "assistant_message_id": 43
  }
  ```
- **Error Responses** (JSON):
  - `400 {"error": "Session and question are required."}` — Missing params
  - `404 {"error": "Session not found."}` — Invalid session_id
  - `400 {"error": "Upload transcript or attachments to enable Q&A."}` — No content
- **Side Effects**:
  - Calls Gemini API via `answer_question(payload)` with retrieval context
  - Stores user message in DB (`ai_messages` table)
  - Stores assistant response in DB
  - Stores sources in DB (`ai_message_sources` table)
- **Called From**:
  - [app.js:1651](studyscribe/web/static/js/app.js#L1651): `setupQaChat()` form submission, fetches JSON

**Example**:
```bash
POST /api/ai/ask
Content-Type: application/json

{
  "session_id": "c26ed045-...",
  "question": "What is oxidation?",
  "scope": "session"
}
→ {
  "answer": "Oxidation is the loss of electrons...",
  "answer_markdown": "Oxidation is the loss of electrons... [1]",
  "sources": [...],
  "user_message_id": 42,
  "assistant_message_id": 43
}
```

### GET /api/sessions/<session_id>/ai/messages
- **Handler**: `api_ai_messages(session_id)` [app.py:1627](studyscribe/app.py#L1627)
- **Purpose**: Retrieve persisted AI chat messages and sources for a session
- **Method**: GET  
- **Response** (JSON):
  ```json
  {
    "messages": [
      {
        "id": 42,
        "session_id": "c26ed045-...",
        "role": "user",
        "content": "What is oxidation?",
        "created_at": "2024-01-15T10:30:45+00:00",
        "sources": []
      },
      {
        "id": 43,
        "session_id": "c26ed045-...",
        "role": "assistant",
        "content": "Oxidation is the loss of electrons... [1]",
        "created_at": "2024-01-15T10:30:50+00:00",
        "sources": [
          {
            "id": 1,
            "message_id": 43,
            "source_id": "src_abc123",
            "kind": "transcript",
            "label": "Transcript [00:32–01:15]",
            "snippet": "...",
            "url": "..."
          }
        ]
      }
    ]
  }
  ```
- **Error Responses**:
  - `404 {"error": "Session not found."}` — Invalid session_id
- **Called From**:
  - [app.js:1613](studyscribe/web/static/js/app.js#L1613): `setupQaChat()` initial load, fetches chat history

**Example**:
```bash
GET /api/sessions/c26ed045-9b3b-47a7-b430-d3e2b5476d52/ai/messages
→ {
  "messages": [
    {"id": 42, "role": "user", "content": "What is oxidation?", ...},
    {"id": 43, "role": "assistant", "content": "Oxidation is...", "sources": [...]}
  ]
}
```

### POST /modules/<module_id>/sessions/<session_id>/qa (Form-based Q&A)
- **Handler**: `ask_question(module_id, session_id)` [app.py:1570](studyscribe/app.py#L1570)
- **Purpose**: Answer question via form submission (HTML response alternative)
- **Method**: POST  
- **Request Body** (form-data):
  - `question`: User question text
  - `scope`: "session" or "module"
- **Response**: HTTP 302 redirect to `/sessions/<session_id>`
- **Side Effects**: Same as `POST /api/ai/ask` (stores messages/sources, calls Gemini)
- **Called From**: Legacy form-based endpoints or fallback if JSON not supported

---

## Source Preview

### GET /api/source_preview (Multiple Aliases)
### GET /api/source-preview (Alias)
### GET /api/sources/<source_id>/preview (Alias)
- **Handler**: `api_source_preview(source_id)` [app.py:1964](studyscribe/app.py#L1964)
- **Purpose**: Return JSON preview payload for a stored source (used for rendering source preview modal in Q&A)
- **Method**: GET  
- **Parameters** (query or path):
  - `source_id`: Source UUID or "src_abc123" or "12" (index)
  - `session_id`: Session UUID (required for source lookup)
- **Response** (JSON):
  ```json
  {
    "source_id": "src_abc123",
    "kind": "transcript",
    "title": "Transcript [00:32–01:15]",
    "excerpt": "...",
    "excerpt_full": "...",
    "open_url": "/modules/.../sessions/.../attachments/slides.pdf#page=3",
    "meta": {
      "file_name": "slides.pdf",
      "mime": "application/pdf",
      "page": 3,
      "start_time": 32.5,
      "end_time": 75.2
    },
    "highlight": {
      "text": "oxidation",
      "timeout_ms": 5000
    }
  }
  ```
- **Error Responses**:
  - `400 {"ok": false, "error": "source_id and session_id are required."}`
  - `404 {"ok": false, "error": "Session not found."}` 
  - `404 {"ok": false, "error": "Source not found."}`
- **Called From**:
  - [app.js:1410](studyscribe/web/static/js/app.js#L1410): Source link click in Q&A answer, fetches preview payload and renders modal

**Example**:
```bash
GET /api/source_preview?source_id=src_abc123&session_id=c26ed045-...
→ {
  "source_id": "src_abc123",
  "kind": "transcript",
  "title": "Transcript [00:32–01:15]",
  "excerpt": "...oxidation is...",
  "open_url": "/modules/.../sessions/.../attachments/slides.pdf#page=3"
}
```

---

## Export

### GET /modules/<module_id>/sessions/<session_id>/export (Export Form)
### POST /modules/<module_id>/sessions/<session_id>/export (Export Download)
- **Handler**: `export_pack(module_id, session_id)` [app.py:2036](studyscribe/app.py#L2036)
- **Purpose**: Export session as ZIP archive (GET shows form, POST generates/downloads)
- **Method**: GET | POST  
- **GET Response**: HTML export options form (checkboxes for what to include)
- **POST Request Body** (form-data):
  ```
  include_ai_notes=1
  include_personal_notes=1
  include_transcript=1
  include_audio=1
  include_attachments=1
  include_raw_chunks=0
  include_prompt_manifest=0
  ```
- **POST Response**: ZIP file download
  - Content-Type: application/zip
  - Content-Disposition: attachment; filename="StudyScribe_ModuleName_SessionName_20240115-103045.zip"
- **ZIP Contents** (based on selections):
  - `session.json`: Session metadata
  - `manifest.json`: File manifest
  - `notes/`: AI notes and personal notes
  - `transcript/`: Transcript JSON
  - `audio/`: Audio file(s)
  - `attachments/`: Attachment files
  - `chunks/` (if include_raw_chunks): Raw retrieval chunks
- **Error Responses**:
  - `404 {"ok": false, "error": "Session not found."}`
  - `400 {"ok": false, "error": "Select at least one item to export."}`
  - `500 {"ok": false, "error": "Export failed. Please try again."}`
- **Called From**:
  - [session.html](studyscribe/web/templates/session.html): Export button form
  - [app.js:984](studyscribe/web/static/js/app.js#L984): `setupExportModal()` shows/submits export options

**Example**:
```bash
POST /modules/57819.../sessions/c26ed045.../export
Content-Type: application/x-www-form-urlencoded

include_ai_notes=1&include_transcript=1&include_attachments=1
→ [Binary ZIP file download]
Content-Disposition: attachment; filename="StudyScribe_Organic_Lecture1_20240115-103045.zip"
```

---

## Error Handling

### TranscriptionError Handler
- **Handler**: `handle_transcription_error(error)` [app.py:2101](studyscribe/app.py#L2101)
- **Purpose**: Catch transcription failures and flash user-friendly message
- **Response**: 
  - Flash message: "Transcription failed. Check file type and try again."
  - HTTP 302 redirect to referrer or home
- **Called From**: Background transcription job or sync transcription call that raises `TranscriptionError`

---

## Request/Response Conventions

### Success Responses
- **Page Routes**: HTTP 200 with HTML body, or HTTP 302 redirect
- **Form Submissions**: HTTP 302 redirect to next page + optional flash message
- **API Routes**: HTTP 200 with JSON body:
  ```json
  { "ok": true, "data": ... }
  ```
  or just data:
  ```json
  { "id": "...", "name": "...", ... }
  ```

### Error Responses
- **Form Routes**: HTTP 302 + flash message (shown on next page load)
- **API Routes**: HTTP 400/404/500/507 with JSON body:
  ```json
  { "error": "Human-readable error message" }
  ```
  or:
  ```json
  { "ok": false, "error": "..." }
  ```

### Content Negotiation
- If request `Accept: application/json` header present → JSON response
- If form-data or form-urlencoded → HTML redirect (unless Accept is json)
- API routes always return JSON

---

## Route Map Summary Table

| Method | Path | Handler | Purpose | Response |
|--------|------|---------|---------|----------|
| GET | `/` | `index()` | Redirect to home | 302 → /home |
| GET | `/home` | `home()` | Module list | HTML (index.html) |
| POST | `/modules` | `create_module()` | Create module | 302 → /modules/<id> |
| GET | `/modules/<id>` | `view_module()` | Module detail | HTML (module.html) |
| PATCH | `/modules/<id>` | `update_module()` | Rename module | JSON {id, name} |
| DELETE | `/modules/<id>` | `delete_module()` | Delete module | JSON {redirect} |
| POST | `/modules/<mid>/sessions` | `create_session()` | Create session | 302 → /sessions/<id> |
| GET | `/modules/<mid>/sessions/<sid>` | `legacy_view_session()` | Legacy redirect | 302 → /sessions/<sid> |
| GET | `/sessions/<id>` | `view_session()` | Session detail | HTML (session.html) |
| PATCH | `/sessions/<id>` | `update_session()` | Rename session | JSON {id, name} |
| DELETE | `/sessions/<id>` | `delete_session()` | Delete session | JSON {redirect} |
| POST | `/modules/<mid>/sessions/<sid>/upload-audio` | `upload_audio()` | Upload audio | 302 → /sessions/<sid>, or JSON; 400/507 on error |
| POST | `/modules/<mid>/sessions/<sid>/upload-attachment` | `upload_attachment()` | Upload attachment | 302 → /sessions/<sid>, or JSON; 400/507 on error |
| POST | `/modules/<mid>/sessions/<sid>/delete-audio` | `delete_audio()` | Delete audio | JSON {ok} or 302 |
| POST | `/modules/<mid>/sessions/<sid>/delete-attachment` | `delete_attachment()` | Delete attachment | JSON {ok} or 302 |
| GET | `/modules/<mid>/sessions/<sid>/attachments/<fn>` | `open_attachment()` | Serve attachment | File bytes |
| GET | `/attachments/<id>/open` | `open_attachment()` | Serve attachment (alt) | File bytes |
| GET | `/modules/<mid>/sessions/<sid>/attachments/<fn>/preview` | `attachment_preview()` | Preview attachment | HTML (attachment_preview.html) |
| POST | `/modules/<mid>/sessions/<sid>/transcribe` | `start_transcription()` | Start transcription job | 302 → /sessions/<sid>?job_id=... |
| GET | `/jobs/<id>` | `job_status()` | Poll job status | JSON {status, progress, ...} |
| GET | `/modules/<mid>/sessions/<sid>/transcript` | `fetch_transcript()` | Fetch transcript HTML | JSON {html, has_transcript} |
| POST | `/modules/<mid>/sessions/<sid>/delete-transcript` | `delete_transcript()` | Delete transcript | JSON {ok} or 302 |
| POST | `/modules/<mid>/sessions/<sid>/segment-tags` | `update_segment_tags()` | Update segment tags | JSON {ok, tags} |
| POST | `/modules/<mid>/sessions/<sid>/annotations` | `save_annotations()` | Save annotations | 302 → /sessions/<sid> |
| POST | `/modules/<mid>/sessions/<sid>/generate-notes` | `start_notes()` | Generate AI notes job | JSON {job_id, redirect} or 302 |
| GET | `/modules/<mid>/sessions/<sid>/ai-notes` | `fetch_ai_notes()` | Fetch AI notes | JSON {notes, suggested_tags} |
| POST | `/modules/<mid>/sessions/<sid>/qa` | `ask_question()` | Ask question (form) | 302 → /sessions/<sid> |
| POST | `/api/ai/ask` | `api_ai_ask()` | Ask question (JSON) | JSON {answer, sources, ...} |
| GET | `/api/sessions/<sid>/ai/messages` | `api_ai_messages()` | Fetch chat history | JSON {messages} |
| GET | `/api/source_preview` | `api_source_preview()` | Preview source | JSON {source info} |
| GET | `/api/source-preview` | `api_source_preview()` | Preview source (alt) | JSON {source info} |
| GET | `/api/sources/<id>/preview` | `api_source_preview()` | Preview source (alt) | JSON {source info} |
| GET\|POST | `/modules/<mid>/sessions/<sid>/export` | `export_pack()` | Export session | HTML form or ZIP file |

---

## Key Patterns & Observations

### 1. Content Negotiation
- Routes check `_wants_json()` to return JSON vs. redirect
- Most mutation routes support both form (redirect + flash) and JSON (app.js fetch)

### 2. Job Polling
- Long-running operations (transcription, note generation) use background jobs
- Client polls `/jobs/<job_id>` every 2 seconds to track progress
- When job completes, client fetches updated content (e.g., `/modules/.../transcript`)

### 3. File Storage
- Audio: `DATA_DIR/modules/<module_id>/sessions/<session_id>/audio/`
- Attachments: `DATA_DIR/modules/<module_id>/sessions/<session_id>/attachments/`
- Annotations: `DATA_DIR/modules/<module_id>/sessions/<session_id>/annotations.json`
- Transcript: `DATA_DIR/modules/<module_id>/sessions/<session_id>/transcript/`
- AI Notes: `DATA_DIR/modules/<module_id>/sessions/<session_id>/notes/`

### 4. AI Integration
- Transcript + attachments → Gemini API for note generation
- Transcript + attachments + question → Retrieval + Gemini API for Q&A
- All Gemini requests include payload validation via pydantic models (`NotesOutput`, `AnswerOutput`)

### 5. Source Attribution
- Every Q&A answer includes `sources` list with locator metadata
- Locator types: transcript (segment_id + timestamps), attachment (file_name + page), ai_notes (anchor), personal_notes
- Client renders source links that open preview modal via `/api/source_preview`

### 6. Tag System
- Segment tags (IMPORTANT, CONFUSING, EXAM-SIGNAL) stored per-segment in `annotations.json`
- Session tags (user-defined labels like "Chemistry", "Organic") stored per-session
- Suggested tags auto-generated by Gemini during note generation

---

## Testing Checklist (All Routes)

- [ ] GET / → redirects to /home
- [ ] GET /home → renders module list
- [ ] POST /modules → creates module, redirects to /modules/<id>
- [ ] GET /modules/<id> → renders sessions list
- [ ] PATCH /modules/<id> (JSON) → renames module
- [ ] DELETE /modules/<id> (JSON) → deletes module, returns redirect
- [ ] POST /modules/<id>/sessions → creates session, redirects to /sessions/<id>
- [ ] GET /modules/<id>/sessions/<id> → redirects to /sessions/<id>
- [ ] GET /sessions/<id> → renders full session page with transcripts, notes, Q&A
- [ ] PATCH /sessions/<id> (JSON) → renames session
- [ ] DELETE /sessions/<id> (JSON) → deletes session, returns redirect
- [ ] POST .../upload-audio → saves audio, redirects
- [ ] POST .../upload-attachment → saves attachment, extracts text, redirects
- [ ] POST .../delete-audio (JSON) → deletes audio
- [ ] POST .../delete-attachment (JSON) → deletes attachment
- [ ] GET .../attachments/<filename> → serves file
- [ ] GET .../attachments/<filename>/preview → renders preview HTML
- [ ] POST .../transcribe → enqueues job, redirects with job_id param
- [ ] GET /jobs/<job_id> → returns job status/progress (polling)
- [ ] GET .../transcript → returns transcript HTML fragment (JSON)
- [ ] POST .../delete-transcript → deletes transcript
- [ ] POST .../segment-tags (JSON) → updates segment tag, returns tags
- [ ] POST .../annotations → saves annotations, redirects
- [ ] POST .../generate-notes → enqueues job, returns redirect or JSON with job_id
- [ ] GET .../ai-notes → returns markdown notes + suggested tags
- [ ] POST .../qa → asks question (form), redirects
- [ ] POST /api/ai/ask (JSON) → asks question, returns answer + sources
- [ ] GET /api/sessions/<id>/ai/messages → returns chat history
- [ ] GET /api/source_preview (JSON) → returns source metadata for preview
- [ ] GET /api/source-preview (JSON) → alias
- [ ] GET /api/sources/<id>/preview (JSON) → alias
- [ ] GET/POST .../export → GET shows form, POST returns ZIP download

---

## Deployment Notes

- All routes use relative URLs via Flask `url_for()` and are framework-agnostic
- Routes assume single-user, local-first operation (no authentication)
- Background jobs use ThreadPoolExecutor (not scalable to multi-process; consider Celery for production)
- File paths use `Path` from pathlib for cross-platform compatibility
- Secrets: `FLASK_SECRET` env var (default: "studyscribe-dev"); should be overridden in production

---

*Last updated: 2024-01-15 | Evidence: /studyscribe/app.py (all @app.route/@app.get/@app.post/@app.patch/@app.delete decorators) | Cross-references: app.js, templates/*
