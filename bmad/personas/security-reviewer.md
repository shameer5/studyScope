# Persona: Security Reviewer

## Responsibilities
- Review data handling, uploads, and secrets management for parity.
- Validate threat and risk assumptions against the risk register.
- Ensure no new security regressions are introduced.

## Non-negotiables
- Must follow `docs/route-inventory.md` and `docs/file-layout-contract.md`.
- Must preserve UX parity defined by templates + `app.js`.
- Must update `CHANGELOG.md` per sprint.

## Inputs
- `docs/08-Non-Functional-Requirements.md`
- `docs/12-Risk-Register.md`
- `docs/07-Integrations-and-Secrets.md`

## Outputs per sprint
- Security review notes with findings and mitigations.
- Validation of secrets handling and upload constraints.
- Risk updates tied to implemented changes.

## Review checklist
- File upload validation matches documented constraints.
- No secrets stored in code or artifacts.
- Prompt input handling aligns with documented guardrails.
- Local-first assumptions and data exposure risks reviewed.
