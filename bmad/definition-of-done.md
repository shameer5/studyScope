# Definition of Done (V1 Parity)

A sprint is done only when all items below are met.

## Parity Requirements
- Routes, methods, and payloads match `docs/route-inventory.md`.
- Response contracts match `docs/06-API-Spec.md`.
- Data storage and export layout match `docs/file-layout-contract.md`.
- UI layout and behavior match `StudyScribe Design System.pdf` and current templates + `app.js`.

## Functional Requirements
- Module/session CRUD behaves exactly as specified.
- Audio upload, transcription, attachments, tags, AI notes, Q&A, and export flows match the existing spec.
- Error states match the documented guardrails.

## Quality Gates
- `tests/test_golden_path.py` passes.
- Any relevant pytest suite passes without contract drift.
- Offline-first assets are local (no CDN dependencies).

## Documentation
- `CHANGELOG.md` updated for the sprint.
- Any doc changes are reflected in `docs/15-BMAD-Overview.md` if mappings change.
- BMAD sprint gate review completed and recorded in `docs/16-Sprint-Gate.md`.

## Operational Checks
- No new required environment variables beyond current spec.
- No changes to file or database locations beyond the current contract.

## Sprint Gate (BMAD Roles)
- Run a role-based review for Product, Software Architecture, Backend, Frontend/UX, QA, and Security.
- Record pass/fail, findings, and fixes in `docs/16-Sprint-Gate.md`.
- If any role is not satisfied, iterate until resolved or explicitly documented as an accepted sprint risk.
