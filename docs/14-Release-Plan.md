# Release Plan

This document outlines release milestones, sprint plan, version strategy, and go-to-market guidance.

1) Version & Release Strategy
- Version scheme: Semantic Versioning (MAJOR.MINOR.PATCH), e.g., 1.0.0.
- Release cadence: bi-weekly sprints (2 weeks); releases after each sprint or on-demand.
- Artifacts: GitHub/GitLab releases with release notes; Docker image tags matching version.

2) Milestones & Roadmap

Milestone v0.1 (Alpha / Proof-of-Concept)
- Target: end of Sprint 1.
- Goal: validate core transcription + export flow.
- Deliverables:
  - Module/session management (US-1-1, US-1-2).
  - Transcription pipeline (US-2-1).
  - Export basic (US-4-1).
- Success criteria: users can upload audio, transcribe, export session ZIP.
- Risk: transcription runtime (ffmpeg, faster_whisper) — see `docs/12-Risk-Register.md` T1.

Milestone v0.2 (Beta / AI-Ready)
- Target: end of Sprint 2.
- Goal: add AI notes and Q&A features; gather user feedback.
- Deliverables:
  - AI notes generation (US-3-1).
  - Q&A with citations (US-3-2).
  - Transcript search (US-2-2).
  - Improved UI/UX refinements.
- Success criteria: AI features functional and accurate; users can ask questions and get cited answers.
- Risk: Gemini API quota/rate limits — see `docs/12-Risk-Register.md` T2.

Milestone v1.0 (General Availability)
- Target: end of Sprint 3 or 4.
- Goal: production-ready, documented, deployable.
- Deliverables:
  - Container images (Dockerfile, CI/CD).
  - Complete documentation (all `/docs` files).
  - Security hardening (CSRF tokens, auth framework, FLASK_SECRET enforcement).
  - Monitoring & observability (logging, job dashboards).
  - Performance optimization (tested with 100+ min audio).
- Success criteria: can be deployed by operators with confidence; all risks from `docs/12-Risk-Register.md` addressed.

Milestone v1.1 (Enhanced)
- Target: future, based on user feedback.
- Possible features:
  - Multi-user support with authentication.
  - Module/session collaboration.
  - Advanced analytics (session summaries, tag analysis).
  - Mobile UI improvements.
  - Performance tuning (GPU transcription, distributed job queue).

3) Sprint Plan (Detailed)

Sprint 1: Foundation (Weeks 1–2)
- Focus: core session management and transcription.
- Stories:
  - US-1-1 (module create): Task list in `docs/13-Backlog.md`.
  - US-1-2 (audio upload): Tasks T-1-2-1 through T-1-2-3.
  - US-2-1 (transcription): Tasks T-2-1-1 through T-2-1-5.
  - US-5-1 (unit tests): Tasks T-5-1-1 through T-5-1-3.
- Estimated points: 23.
- Key deliverables:
  - v0.1-alpha tag pushed to GitHub.
  - Release notes: "Transcription MVP with export".
  - Tested with WAV files up to 10 minutes.

Sprint 2: AI & Q&A (Weeks 3–4)
- Focus: AI features and advanced transcript interaction.
- Stories:
  - US-2-2 (search): Tasks T-2-2-1, T-2-2-2.
  - US-3-1 (AI notes): Tasks T-3-1-1 through T-3-1-5.
  - US-3-2 (Q&A): Tasks T-3-2-1 through T-3-2-5.
  - US-4-1 (export): Tasks T-4-1-1 through T-4-1-4.
- Estimated points: 26.
- Key deliverables:
  - v0.2-beta tag.
  - Release notes: "AI notes, Q&A, export enhancements".
  - Test with real Gemini API (if quota available).

Sprint 3: DevOps & Hardening (Weeks 5–6)
- Focus: production readiness, CI/CD, security.
- Stories:
  - US-5-2 (containerization): Tasks T-5-2-1 through T-5-2-3.
  - Risk mitigations: from `docs/12-Risk-Register.md`
    - T-S1 (FLASK_SECRET default) — make required.
    - T-S2 (CSRF tokens) — add Flask-WTF.
    - T-D1 (CI/CD pipeline) — GitHub Actions workflow.
    - T-T1 (runtime deps) — Dockerfile verified in CI.
- Estimated points: 20.
- Key deliverables:
  - v1.0-stable tag.
  - Release notes: "Production-ready, containerized, hardened".
  - Dockerfile builds and runs successfully.
  - CI/CD pipeline green.

Sprint 4 (optional): Stabilization & Polish
- Focus: bug fixes, performance, documentation polish.
- Estimated points: 15.
- Key deliverables:
  - v1.0.1 patch (if bugs found).
  - Updated `/docs` with operator feedback.

4) Go-to-Market & Deployment

For v0.1 Alpha (internal/trusted users):
- Distribute via GitHub releases as source code.
- Document in `docs/09-Dev-Setup-and-Runbook.md`.
- Set `GEMINI_API_KEY` optional (AI features disabled without it).
- Gather feedback on transcription accuracy, UI usability.

For v0.2 Beta (expanded users):
- Push Docker image to Docker Hub or GHCR.
- Provide `docker-compose.yml` for one-command setup.
- AI features become primary (market as "AI notes generator").
- Collect usage metrics: avg session length, notes quality, user retention.

For v1.0 GA (general availability):
- Full documentation and tutorials.
- Support channels (GitHub issues, email).
- Publish to package managers (e.g., Homebrew for macOS).
- Announce on relevant communities (Reddit, Product Hunt, Hacker News).

5) Post-Release (Maintenance)

For v1.0 and beyond:
- Issue triage: respond to bugs within 5 business days.
- Security patches: 24–48 hour turnaround for critical vulnerabilities.
- Feature requests: evaluate and plan into future sprints.
- Performance monitoring: track transcription latency, API costs, database size.

6) Success Metrics (per release)

v0.1 Alpha:
- Users can upload audio and generate transcript (pass/fail).
- Transcription latency < 2x audio duration (on CPU).
- No data loss or crashes during use.

v0.2 Beta:
- AI notes are meaningful and useful (subjective user feedback).
- Q&A citations are accurate (>80% cited snippets match user queries).
- Users prefer AI+search over raw transcript (survey).

v1.0 GA:
- Deployment & setup take < 10 minutes (timed).
- Zero unplanned outages in first month.
- User adoption rate (number of active sessions created) > 100 in first quarter.
- Support response time < 2 hours.

7) Dependencies & Constraints

External dependencies (versions pinned in `requirements.txt`):
- Flask >= 2.x
- Pydantic >= 2.x (for schema validation in `studyscribe/services/gemini.py`)
- google.genai (Gemini SDK) — optional but required for AI features
- faster-whisper (transcription model) — optional but required for transcription

System dependencies:
- Python 3.12 (recommended; 3.10–3.13 compatible)
- ffmpeg (for audio conversion in `studyscribe/services/transcribe.py`)

Infrastructure:
- Disk space: ≥10 GB for `DATA_DIR` (scales with session artifacts).
- Memory: ≥2 GB (for Python + model loading).
- CPU: ≥2 cores (transcription benefits from multi-core).
- Network: optional (only if Gemini AI is enabled).

8) Assumption Summary

- ASSUMPTION: Operators provision `GEMINI_API_KEY` and infrastructure for v1.0+ (see `docs/10-Deployment-and-Ops.md`).
- ASSUMPTION: single-user, local-first deployment is the primary use case (no auth required until v1.1+).
- ASSUMPTION: team capacity is ~3 developers (velocity ~23–26 points per 2-week sprint).

---

Release checklist (for each milestone):
- [ ] All sprint stories closed.
- [ ] Tests passing (>70% coverage).
- [ ] Code reviewed and merged.
- [ ] Release notes written.
- [ ] Version tag created and pushed.
- [ ] Docker image built and pushed (for v1.0+).
- [ ] `/docs` updated with new features/changes.
- [ ] Changelog updated (`CHANGELOG.md` if present).
- [ ] Announcement drafted (if public release).
