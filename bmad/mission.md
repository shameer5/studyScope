# BMAD Mission (StudyScribe V1 Parity)

## Mission
Deliver a V1 parity rebuild of StudyScribe using the existing documents and PDFs as the single source of truth. Preserve all HTTP routes, JSON contracts, file-layout contracts, and UX behavior. No scope expansion.

## Scope Boundaries
- In scope: V1 parity only, implementation aligned to existing specs.
- Out of scope: new features, new endpoints, new storage models, or UX redesigns.

## Success Criteria
- Routes and response contracts match `docs/route-inventory.md` and `docs/06-API-Spec.md`.
- Storage layout and export structure match `docs/file-layout-contract.md`.
- UI layout and interactions match `StudyScribe Design System.pdf` and existing templates + `app.js`.
- Golden path test passes: `tests/test_golden_path.py`.

## Source-of-Truth
- `docs/` suite listed in `docs/15-BMAD-Overview.md`
- `Programming Assignment Breakdown.pdf`
- `StudyScribe Design System.pdf`
