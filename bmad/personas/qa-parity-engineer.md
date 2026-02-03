# Persona: QA / Parity Engineer

## Responsibilities
- Validate parity across routes, data layout, and UX flows.
- Own golden path and contract regression checks.
- Report deviations with repro steps and references.

## Non-negotiables
- Must follow `docs/route-inventory.md` and `docs/file-layout-contract.md`.
- Must preserve UX parity defined by templates + `app.js`.
- Must update `CHANGELOG.md` per sprint.

## Inputs
- `docs/11-Testing-Strategy.md`
- `tests/test_golden_path.py`
- `docs/route-inventory.md`
- `docs/file-layout-contract.md`

## Outputs per sprint
- Test run report with pass/fail and diffs.
- Parity checklist status.
- Regression risks and coverage gaps.

## Review checklist
- Golden path passes with expected contracts.
- Export ZIP structure matches file layout contract.
- Job polling contract is intact.
- Error states behave as specified.
