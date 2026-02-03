# BMAD Overview (V1 Parity)

## Purpose
This document defines the BMAD framework for the StudyScribe V1 parity rebuild and maps each phase to the current source-of-truth artifacts. The scope is fixed to V1 parity only. No changes to HTTP routes, JSON contracts, or file-layout contracts are permitted.

## BMAD Definition
- **Business**: product goals, user needs, success criteria, non-goals
- **Model**: domain model, data architecture, storage contracts
- **Architecture**: system components, APIs, integrations, and routing
- **Design**: UX flows, interaction rules, and visual system

## Source-of-Truth Rules
- The canonical specification is the existing docs under `docs/` plus the two PDFs at repo root.
- If conflicts arise, resolve them by prioritizing:
  - `docs/route-inventory.md` and `docs/file-layout-contract.md` for behavior and storage
  - `docs/06-API-Spec.md` for response contracts
  - `StudyScribe Design System.pdf` for UI tokens and interaction intent
  - `Programming Assignment Breakdown.pdf` for PRD scope and constraints

## Artifact Mapping (BMAD)

### Business
- `docs/01-PRD.md`
- `docs/12-Risk-Register.md`
- `docs/13-Backlog.md`
- `docs/14-Release-Plan.md`
- `docs/personas/persona-student.md`
- `docs/personas/persona-instructor.md`
- `docs/personas/persona-assessor.md`
- `Programming Assignment Breakdown.pdf`

### Model
- `docs/05-Data-Architecture.md`
- `docs/file-layout-contract.md`
- `docs/02-Functional-Spec.md` (domain rules and acceptance criteria)

### Architecture
- `docs/04-Architecture-C4.md`
- `docs/06-API-Spec.md`
- `docs/route-inventory.md`
- `docs/07-Integrations-and-Secrets.md`
- `docs/09-Dev-Setup-and-Runbook.md`
- `docs/10-Deployment-and-Ops.md`

### Design
- `docs/03-UX-Flows-and-Edge-Cases.md`
- `StudyScribe Design System.pdf`
- Templates and client logic as implemented in `studyscribe/web/templates/` and `studyscribe/web/static/js/app.js`

## Parity Guardrails
- All routes, request parameters, and response payloads must match `docs/route-inventory.md` and `docs/06-API-Spec.md`.
- All data placement and export structure must match `docs/file-layout-contract.md`.
- UI layout, tokens, and interaction rules must match `StudyScribe Design System.pdf` and existing templates/JS behavior.

## Delivery Process
- Sprint gate reviews are recorded in `docs/16-Sprint-Gate.md`.
