# Product Backlog

This document outlines epics, user stories, and tasks organized by priority. Each epic includes acceptance criteria and a Definition of Done (DoD).

1) Epics

EPIC 1: Core Session Capture & Management
- Objective: Enable users to create modules, sessions, upload audio/attachments, and manage metadata.
- Scope: module/session CRUD, upload handling, persistence. Implemented in `studyscribe/app.py` (routes) and `studyscribe/core/db.py` (schema).
- Stories:
  - US-1-1: As a student, I can create a module and organize sessions within it.
    - AC: POST /modules creates a row in `modules` table; GET /home shows list (per `docs/route-inventory.md`); UI renders in `index.html`.
    - Tasks:
      - T-1-1-1: Implement `create_module()` handler in `studyscribe/app.py`.
      - T-1-1-2: Add module list view template `index.html`.
      - T-1-1-3: Test module creation via `tests/test_app.py` (create if missing).
  - US-1-2: As a student, I can upload audio and see it listed.
    - AC: file upload validates extension; file saved to `session_dir/audio/`; UI shows file list with size.
    - Tasks:
      - T-1-2-1: Implement `upload_audio()` in `studyscribe/app.py` with `ALLOWED_AUDIO_EXTENSIONS` check.
      - T-1-2-2: Use `save_audio()` from `studyscribe/services/audio.py`.
      - T-1-2-3: Add file listing UI to `session.html`.

- DoD (Def of Done):
  - Code changes merged and reviewed.
  - All unit/integration tests pass (`pytest tests/`).
  - Manual testing via UI confirms functionality.
  - Documentation updated (code comments + `/docs` if applicable).

EPIC 2: Transcription Pipeline
- Objective: Convert uploaded audio to timestamped transcript segments and retrieve-friendly chunks.
- Scope: WAV conversion, chunking, transcription model call, artifact persistence. Implemented in `studyscribe/services/transcribe.py` and `studyscribe/services/retrieval.py`.
- Stories:
  - US-2-1: As a student, I can transcribe uploaded audio and see a timestamped transcript.
    - AC: UI button "Run Transcription" enqueues job; job status shown; on completion, transcript.json contains segments with start/end/text; UI renders transcript in Transcript tab.
    - Tasks:
      - T-2-1-1: Implement `start_transcription()` route in `studyscribe/app.py`.
      - T-2-1-2: Implement `transcribe_audio()` in `studyscribe/services/transcribe.py` (WAV conversion, chunking, model call).
      - T-2-1-3: Implement background job enqueueing via `studyscribe/services/jobs.py`.
      - T-2-1-4: Add job polling UI in `session.html`.
      - T-2-1-5: Test full flow with mock `faster_whisper` in `tests/test_transcribe.py`.

  - US-2-2: As a student, I can search or filter within the transcript using keywords.
    - AC: keywords match text chunks; UI highlights matches; ranked by relevance.
    - Tasks:
      - T-2-2-1: Implement `retrieve_chunks()` in `studyscribe/services/retrieval.py` with scoring.
      - T-2-2-2: Add search UI in transcript panel.

- DoD:
  - All tasks in stories marked complete.
  - Transcription tested with small WAV file (< 1 min).
  - Error messages shown on failure (missing ffmpeg, etc.).

EPIC 3: AI-Assisted Notes & Q&A
- Objective: Generate study notes and answer questions with citations using Gemini.
- Scope: prompt building, model calls, schema validation, message/source persistence. Implemented in `studyscribe/services/gemini.py` and `studyscribe/app.py`.
- Stories:
  - US-3-1: As a student, I can generate AI study notes from transcript and attachments.
    - AC: UI button "Generate Notes" triggers `start_notes()` route; server calls `generate_notes()`; output rendered in AI Notes tab with tags.
    - Tasks:
      - T-3-1-1: Implement `generate_notes()` in `studyscribe/services/gemini.py` with `_build_notes_prompt()`.
      - T-3-1-2: Implement `start_notes()` route in `studyscribe/app.py`.
      - T-3-1-3: Validate `NotesOutput` schema in tests (`tests/test_gemini_schema.py`).
      - T-3-1-4: Add UI for notes generation and display in `session.html`.
      - T-3-1-5: Handle missing `GEMINI_API_KEY` with user-friendly error.

  - US-3-2: As a student, I can ask questions and get answers with transcript citations.
    - AC: Q&A drawer shows messages; ask endpoint returns `AnswerOutput` with citations; citations link to transcript segments.
    - Tasks:
      - T-3-2-1: Implement `answer_question()` in `studyscribe/services/gemini.py`.
      - T-3-2-2: Implement `ask_question()` and `api_ai_ask()` routes in `studyscribe/app.py`.
      - T-3-2-3: Use `retrieve_chunks()` for context assembly.
      - T-3-2-4: Persist AI messages and sources in DB via `_store_ai_message()` and `_store_ai_sources()`.
      - T-3-2-5: Add Q&A UI in `session.html` and `base.html`.

- DoD:
  - Gemini SDK mocked or real API available in test/dev.
  - Schema validation passes.
  - Citations are accurate and linked to transcript.

EPIC 4: Export & Reproducibility
- Objective: Export session as a ZIP file with notes, transcript, audio, attachments, and optional prompt manifest.
- Scope: ZIP assembly, manifest generation, optional includes. Implemented in `studyscribe/services/export.py`.
- Stories:
  - US-4-1: As a student, I can export a session pack with selected artifacts.
    - AC: export modal shows checkboxes for ai_notes, personal_notes, transcript, audio, attachments; ZIP created with manifest.json; ZIP downloaded to user's computer.
    - Tasks:
      - T-4-1-1: Implement `build_session_export()` in `studyscribe/services/export.py`.
      - T-4-1-2: Implement `export_pack()` route in `studyscribe/app.py`.
      - T-4-1-3: Add export UI modal in `session.html`.
      - T-4-1-4: Test ZIP contents and manifest validity.

- DoD:
  - ZIP generation tested with multiple artifact combinations.
  - Manifest.json is valid JSON.
  - All included files present and intact.

EPIC 5: Foundation & DevOps
- Objective: Set up project structure, tests, CI/CD, documentation, deployment guidance.
- Scope: repo structure, test suite, documentation, Docker/k8s readiness. Partially implemented; `/docs` and `tests/` present.
- Stories:
  - US-5-1: As a developer, I can run local tests and know test coverage.
    - AC: `pytest` runs all tests; coverage report generated; ≥70% coverage target.
    - Tasks:
      - T-5-1-1: Set up test fixtures in `tests/conftest.py`.
      - T-5-1-2: Add unit tests for core services.
      - T-5-1-3: Generate coverage report.

  - US-5-2: As an operator, I can deploy StudyScribe in a container.
    - AC: Dockerfile provided; CI/CD builds and pushes image; deployment instructions in docs.
    - Tasks:
      - T-5-2-1: Create Dockerfile with ffmpeg, Python 3.12, dependencies.
      - T-5-2-2: Set up GitHub Actions workflow.
      - T-5-2-3: Document deployment in `docs/10-Deployment-and-Ops.md`.

- DoD:
  - Tests pass locally and in CI.
  - Dockerfile builds successfully.
  - Deployment docs are clear and tested.

2) Backlog by priority

P0 (Must-have for MVP):
- US-1-1, US-1-2 (module/session + audio upload)
- US-2-1 (transcription)
- US-4-1 (export)

P1 (Should-have for v1):
- US-2-2 (search/filter transcript)
- US-3-1 (generate AI notes)
- US-3-2 (Q&A)
- US-5-1 (testing)

P2 (Nice-to-have):
- US-5-2 (containerization & CI/CD)
- Advanced features (e.g., module summaries, collaborative notes, etc.)

3) Sprint planning

Sprint 1 (2 weeks):
- US-1-1 (module create): 5 points
- US-1-2 (audio upload): 5 points
- US-2-1 (transcription): 8 points
- US-5-1 (unit tests): 5 points
- Estimated velocity: 23 points

Sprint 2 (2 weeks):
- US-2-2 (search): 5 points
- US-3-1 (AI notes): 8 points
- US-3-2 (Q&A): 8 points
- US-4-1 (export): 5 points
- Estimated velocity: 26 points

Sprint 3+ (Ops & scaling):
- US-5-2 (Docker/CI/CD): 8 points
- Risk mitigations (from `docs/12-Risk-Register.md`)
- Performance optimization

4) Acceptance & review criteria
- All AC met for user stories.
- Code reviewed and approved.
- Tests green; coverage maintained.
- DoD checklist completed.
- Docs updated.
