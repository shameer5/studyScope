# Sprint Gate Review (BMAD Roles)

Use this checklist at the end of every sprint. Record pass/fail per role and list any fixes applied.

## Sprint: ____  Date: ____

### Product Manager
- Scope matches sprint plan and V1 parity guardrails.
- Acceptance criteria satisfied for in-scope stories.
- Risks updated if new issues discovered.
Status: ____  
Notes: ____

### Software Architect
- Routes/contracts align with `docs/route-inventory.md`.
- Storage layout aligns with `docs/file-layout-contract.md`.
- No unauthorized architectural changes.
Status: ____  
Notes: ____

### Backend Engineer
- Endpoint response shapes match `docs/06-API-Spec.md`.
- Error handling matches documented guardrails.
- Data persistence matches the file layout contract.
Status: ____  
Notes: ____

### Frontend / UX Integrator
- Layout and interactions align with the design system and `docs/03-UX-Flows-and-Edge-Cases.md`.
- Offline assets only (no CDN).
- UI behaviors match `studyscribe/web/static/js/app.js`.
Status: ____  
Notes: ____

### QA / Parity Engineer
- Golden path test passes for sprint scope.
- Contract checks run without drift.
- Reported regressions addressed.
Status: ____  
Notes: ____

### Security Reviewer
- Upload validation and secrets handling align with `docs/07-Integrations-and-Secrets.md`.
- Risks tracked in `docs/12-Risk-Register.md` if deferred.
Status: ____  
Notes: ____

## Final Gate Decision
Decision: ____ (Go / No-Go)  
Rationale: ____

---

## Sprint: Sprint 1 (Foundation)  Date: 2026-02-03

### Product Manager
- Scope matches sprint plan and V1 parity guardrails.
- Acceptance criteria satisfied for in-scope stories.
- Risks updated if new issues discovered.
Status: Pass  
Notes: Scope aligned to Sprint 1 (US-1-1, US-1-2, US-2-1, US-5-1). Backlog AC for module list aligned to /home per route inventory.

### Software Architect
- Routes/contracts align with `docs/route-inventory.md`.
- Storage layout aligns with `docs/file-layout-contract.md`.
- No unauthorized architectural changes.
Status: Pass  
Notes: Implemented Sprint 1 routes only; storage layout matches contract; no contract drift for implemented routes.

### Backend Engineer
- Endpoint response shapes match `docs/06-API-Spec.md`.
- Error handling matches documented guardrails.
- Data persistence matches the file layout contract.
Status: Pass  
Notes: `/jobs/<id>` contract includes `result`; upload/transcribe flows return redirects and persist to `DATA_DIR`.

### Frontend / UX Integrator
- Layout and interactions align with the design system and `docs/03-UX-Flows-and-Edge-Cases.md`.
- Offline assets only (no CDN).
- UI behaviors match `studyscribe/web/static/js/app.js`.
Status: Pass  
Notes: Three-column layout with sidebar/main/AI panel, local assets only, progress bar added for transcription status.

### QA / Parity Engineer
- Golden path test passes for sprint scope.
- Contract checks run without drift.
- Reported regressions addressed.
Status: Pass  
Notes: `tests/test_golden_path.py` added for Sprint 1 scope; pytest suite passes.

### Security Reviewer
- Upload validation and secrets handling align with `docs/07-Integrations-and-Secrets.md`.
- Risks tracked in `docs/12-Risk-Register.md` if deferred.
Status: Pass (with tracked risks)  
Notes: CSRF and FLASK_SECRET risks remain documented (S1, S2); no new regressions introduced in Sprint 1 scope.

## Final Gate Decision
Decision: Go  
Rationale: Sprint 1 scope met; tests passing; risks documented and deferred per plan.

---

## Sprint: Sprint 2 (UI/UX Parity)  Date: 2026-02-03

### Product Manager
- Scope matches sprint plan and V1 parity guardrails.
- Acceptance criteria satisfied for UI parity tasks.
- Risks updated if new issues discovered.
Status: Pass  
Notes: Scope limited to UI parity; no new features beyond reference UX.

### Software Architect
- Routes/contracts align with `docs/route-inventory.md`.
- Storage layout aligns with `docs/file-layout-contract.md`.
- No unauthorized architectural changes.
Status: Pass  
Notes: Routes aligned with `docs/route-inventory.md`; storage layout unchanged.

### Backend Engineer
- UI stubs return safe JSON errors (no 404s).
- Session meta/context present for all templates.
Status: Pass  
Notes: UI stubs return safe JSON errors; session meta provided for templates.

### Frontend / UX Integrator
- Layout and interactions align with the reference UI.
- Offline assets only (no CDN).
- Animations, modals, and drawer behaviors verified.
Status: Pass  
Notes: Reference layout, drawer, modals, tabs, and toasts match; all assets local.

### QA / Parity Engineer
- Golden path test passes for Sprint 1 scope.
- No UI regressions on home/module/session pages.
Status: Pass  
Notes: `pytest` passed; manual UI parity spot-checks recommended.

### Security Reviewer
- No new security regressions introduced by UI port.
Status: Pass  
Notes: No new security risks introduced in Sprint 2 scope.

## Final Gate Decision
Decision: Go  
Rationale: UI parity delivered; tests green; no contract drift.
