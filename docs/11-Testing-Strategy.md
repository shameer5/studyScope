# Testing Strategy

This document describes the parity-first testing approach grounded in actual implementation, existing test suite, and critical-path validation.

## Core Philosophy: Parity-First Testing

Rather than aspirational coverage targets, StudyScribe uses parity-first testing: every documented API contract and user-facing flow must have a corresponding test or golden artifact that validates behavior remains consistent across changes. The priority is catching breaking changes, not achieving coverage numbers.

## 1) Existing Test Suite

**Current tests** (in `/tests/`; see [conftest.py](../tests/conftest.py)):
- `test_gemini_schema.py` — validates `NotesOutput` and `AnswerOutput` dataclass schemas from [studyscribe/services/gemini.py](../studyscribe/services/gemini.py#L15-L40)
- `test_retrieval.py` — tests `build_chunks()`, `retrieve_chunks()` chunk merging and ranking logic from [studyscribe/services/retrieval.py](../studyscribe/services/retrieval.py)
- `test_transcribe.py` — tests `_chunk_wav()`, `_load_model()`, error handling from [studyscribe/services/transcribe.py](../studyscribe/services/transcribe.py)

**Run tests**: `pytest tests/ -v` (from repo root)

## 2) Parity Test Categories

### A. Contract Tests (API Response Shapes)

**Job Polling Contract** — `/jobs/<job_id>` must return consistent shape:
```python
# Expected contract (from app.py get_job handler):
response = {
    "id": "uuid",
    "status": "pending"|"running"|"complete"|"error",
    "progress": 0-100,
    "message": "Human-readable status",
    "result_path": "path/to/result.json or null"
}

# Test: verify response structure across all job states
# - Fixture: create job via enqueue_job(), poll multiple times, verify JSON shape never changes
# - Failure condition: if response adds/removes fields → breaks app.js polling (setupTranscriptionStatus line 2066)
```

**Q&A Endpoint Contract** — `POST /api/ai/ask` must return:
```python
{
    "answer": "text response",
    "answer_markdown": "formatted response",
    "sources": [{"source_id": "...", "kind": "...", "snippet": "..."}],
    "user_message_id": 123,
    "assistant_message_id": 124
}

# Test: POST valid question, verify response matches schema
# - Cite: app.py answer_question() response building (line ~1500)
```

**Source Preview Contract** — `GET /api/source_preview?source_id=X&session_id=Y` must return:
```python
{
    "source_id": "...",
    "kind": "transcript_segment|attachment|ai_notes",
    "title": "...",
    "excerpt": "short preview",
    "excerpt_full": "full text",
    "open_url": "url or null",
    "meta": {"page": 5, ...}
}

# Test: Verify structure doesn't drift
# - Cite: app.py get_source_preview() handler
```

### B. Golden Path Tests (End-to-End Export Validation)

**Export ZIP Structure** — Golden standard for export validation (cite [/docs/file-layout-contract.md](file-layout-contract.md#export-zip-structure)):
```
Test: Create session → upload audio → generate notes → export with all options checked
Expected ZIP:
  StudyScribe/
    <module_name>/
      <session_name>/
        manifest.json (metadata, selected options, file list)
        ai_notes.md
        personal_notes.md
        transcript.md
        transcript.json (raw segments)
        audio.wav
        attachments/
          document.pdf
    
Manifest schema (see export.py _build_session_export):
{
  "module": {"id": "...", "name": "...", "created_at": "..."},
  "session": {"id": "...", "name": "...", "created_at": "..."},
  "exported_at": "ISO 8601",
  "included": {
    "include_ai_notes": true,
    "include_personal_notes": true,
    "include_transcript": true,
    "include_audio": true,
    "include_attachments": true
  },
  "files": ["ai_notes.md", "personal_notes.md", ...]
}

Test assertion: For each included option, assert corresponding files exist in ZIP
- Failure condition: If export changes ZIP structure or manifest format → users cannot restore exports
```

### Sprint 1 Golden Path (Current Scope)

Sprint 1 delivers module/session creation, audio upload, and transcription with job polling. The golden path test for this sprint exercises:
- Create module → create session → upload audio → start transcription (mocked) → poll `/jobs/<id>` → refresh transcript.

**Test file**: `tests/test_golden_path.py`

This is a scope-aligned subset until Sprint 2/3 features (AI notes, Q&A, export) are implemented.

### Sprint 2 Contract Coverage
- AI notes generation: `tests/test_sprint2.py::test_generate_notes_flow`
- Q&A API contract: `tests/test_sprint2.py::test_api_ai_ask_flow`
- Export ZIP creation: `tests/test_sprint2.py::test_export_pack`

### C. Snapshot Tests (Transcript Rendering)

**Transcript Panel HTML** — Render transcript segments consistently:
```python
# Test: Load session with transcript, render _transcript_panel.html partial
# Verify HTML structure for each segment (see session.html _transcript_panel reference)
# Save as snapshot; fail if rendered HTML changes unexpectedly
# Cite: studyscribe/web/templates/_transcript_panel.html rendering logic in app.py view_session()
```

### D. Unit Tests (Core Business Logic)

- **Retrieval**: `test_retrieval.py` validates `build_chunks()` always produces consistent overlapping chunks from segments
- **Transcription**: `test_transcribe.py` validates `load_transcript()` rebuilds consistent JSON from raw segments
- **Schema Validation**: `test_gemini_schema.py` validates Gemini response JSON parses into dataclass schemas without errors

## 3) Critical Path Definition of Done (DoD)

**All PRs must pass**:
1. ✅ **Unit tests pass**: `pytest tests/unit/` (or all tests if not separated)
2. ✅ **Contract tests pass**: JSON response shapes from `/jobs/<id>`, `/api/ai/ask`, `/api/source_preview` match expected schemas
3. ✅ **Export ZIP passes**: Golden export test creates valid ZIP with correct structure and manifest
4. ✅ **No template regressions**: Diff of rendered HTML for transcript panel, modals unchanged

**Acceptance**: A PR is ready for merging if:
- All unit/contract/snapshot tests pass locally: `pytest tests/ -v`
- Export golden ZIP validates successfully
- User can complete full workflow: upload → transcribe → generate notes → ask question → export → restore

## 4) Test Infrastructure

### Fixtures (see [tests/conftest.py](../tests/conftest.py))
- `tmp_db`: Temporary in-memory SQLite database per test
- `tmp_data_dir`: Isolated filesystem for artifacts per test (prevents pollution)
- `app_client`: Flask test client for HTTP endpoint testing
- `sample_audio`: Small WAV file for transcription tests (or mock model)

### Mock Strategy
- **Gemini API** (expensive, quota-limited): Mock in CI using pre-recorded responses; allow real API in local dev with `GEMINI_API_KEY`
- **Transcription Model** (slow): Mock `faster_whisper` model loading; provide pre-computed `transcript.json` for tests
- **ffmpeg** (system dependency): Skip transcription tests if binary missing; use pre-recorded WAV segments instead

## 5) Test Organization (Recommended)

```
tests/
  conftest.py                    # Shared fixtures
  test_contracts.py              # Job, Q&A, source_preview response shapes
  test_export_golden.py          # Export ZIP structure validation
  test_snapshots.py              # Transcript HTML rendering
  test_gemini_schema.py          # Schema validation (existing)
  test_retrieval.py              # Chunk building logic (existing)
  test_transcribe.py             # Transcription helpers (existing)
```

## 6) CI/CD Integration

- **On PR**: Run `pytest tests/ -v --tb=short` (all tests)
- **Failure gates**:
  - Any contract test fails → block merge (API stability)
  - Export golden test fails → block merge (user data integrity)
  - Unit tests fail → block merge (logic regression)
- **Coverage reporting**: Optional; aim for ≥70% on critical services (`retrieval.py`, `gemini.py`, `export.py`)

## 7) Running Tests Locally

```bash
# Install test dependencies (if not in requirements.txt)
pip install pytest pytest-cov

# Run all tests with verbose output
pytest tests/ -v

# Run specific test file
pytest tests/test_contracts.py -v

# Run with coverage
pytest tests/ --cov=studyscribe --cov-report=term-missing

# Run and show full error output
pytest tests/ -vv --tb=long
```

## 8) Known Gaps & Future Improvements

- **Load Testing**: No transcription throughput or concurrent request benchmarks
- **Security Testing**: No CSRF, XSS, SQL injection validation
- **Performance Baseline**: No API latency or memory usage profiling
- **Browser Compatibility**: No multi-browser E2E tests (could add Playwright/Selenium later)

**These are aspirational**; parity-first means starting with contract + golden path validation, then adding specialized tests as needs emerge.
