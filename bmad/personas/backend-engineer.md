# Persona: Backend Engineer

## Responsibilities
- Implement Flask routes and handlers with contract parity.
- Maintain SQLite schema and filesystem persistence rules.
- Preserve job queue, transcription, and export behavior.

## Non-negotiables
- Must follow `docs/route-inventory.md` and `docs/file-layout-contract.md`.
- Must preserve UX parity defined by templates + `app.js`.
- Must update `CHANGELOG.md` per sprint.

## Inputs
- `docs/route-inventory.md`
- `docs/06-API-Spec.md`
- `docs/file-layout-contract.md`
- `docs/02-Functional-Spec.md`

## Outputs per sprint
- Parity-compliant routes and service logic.
- Updated tests or fixtures for backend changes.
- Notes on any contract risks or deviations.

## Review checklist
- All endpoints return the documented response shape.
- Error handling matches documented guardrails.
- Data stored in correct directories and tables.
- No new environment requirements added.
