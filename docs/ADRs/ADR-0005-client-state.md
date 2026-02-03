# ADR-0005: Client State Management & UI Interactivity

Date: 2024-01-15  
Status: Accepted  
Deciders: Architecture Team  

## Context

StudyScribe's frontend needs to:
- Display dynamic UI states (loading, empty, error, content).
- Provide real-time job status feedback (transcription progress, notes generation status).
- Enable lightweight interactivity (tab switching, file input handling, form submission).
- Maintain simplicity and ease of debugging.

Key constraints:
- No build toolchain (no webpack, TypeScript compiler).
- Minimal JavaScript dependencies (reduce bundle size and maintenance).
- Jinja2 templates (server-side rendering).

## Decision

**Use Alpine.js for lightweight client-side reactivity and HTMX for server-driven UI updates. Avoid a SPA framework (React, Vue) and JavaScript bundlers.**

### Rationale:
- **Alpine.js**: lightweight (~15 KB), requires no build step, works inline in HTML (`x-data`, `x-show`, `x-on`). Suitable for progressive enhancement.
- **HTMX**: enables server-driven HTML updates without page reloads; reduces JavaScript complexity (server remains source of truth).
- **Jinja2 + HTML**: server-side rendering provides robust foundation; progressive enhancement with Alpine for UX polish.
- **Maintainability**: all business logic remains in Python; frontend is thin and stateless.

## Evidence in Codebase

**Confirmed in production code** (not speculative):
- **Alpine.js**: included in [studyscribe/web/templates/base.html](../studyscribe/web/templates/base.html#L9) via `<script src="vendor/alpine.min.js">`
- **HTMX**: included in [studyscribe/web/templates/base.html](../studyscribe/web/templates/base.html#L8) via `<script src="vendor/htmx.min.js">`
- **Custom JS**: [studyscribe/web/static/js/app.js](../studyscribe/web/static/js/app.js) implements client behaviors:
  - Tab switching using Alpine `x-data` bindings (see session.html tabs with `x-data="{ tab: 'notes' }"`)
  - Job polling (`setupTranscriptionStatus()` line 2014) polls `/jobs/<job_id>` every 2 seconds
  - Export modal management (`setupExportModal()` line 985)
  - Confirm delete dialogs (`setupConfirmDeleteForms()` line 2195)
  - AI drawer state management (`setupQaChat()` line 1257)
  - File input handling (drag-drop and form submission)
- **CSS**: [studyscribe/web/static/css/app.css](../studyscribe/web/static/css/app.css) provides base styles, CSS variables, and class-based styling

## Actual Usage Patterns (Verified)

Alpine.js is used for:
- **Tab switching**: Session page tabs (Transcript, AI Notes, Q&A) use `x-data` with `:class` binding to update active state
- **Conditional visibility**: Modals use `x-show` to toggle display based on data state

HTMX is bundled but **currently used minimally**:
- Library included for future use and potential enhancement
- Most form submissions still use vanilla JS (see `setupQaChat()` and form handlers in app.js)
- Represents intentional design choice: lightweight foundation with room to grow

## Alternatives Considered

1. **React + TypeScript + webpack**
   - Pros: mature ecosystem, component reusability, powerful state management (Redux).
   - Cons: complex build setup, large bundle size, overkill for simple UI, steep learning curve for maintenance.
   - Rejected: adds build complexity; violates local-first, minimal-dependencies philosophy.

2. **Vue.js**
   - Pros: simpler than React, good documentation.
   - Cons: requires build toolchain or CDN; component model adds overhead; still overkill.
   - Rejected: same complexity concerns as React.

3. **htmx alone (no Alpine.js)**
   - Pros: pure server-driven updates, minimal client code.
   - Cons: no local state management; tab switching, modals require full page interactions (slow UX).
   - Rejected: loses interactivity for simple cases (e.g., tab switches require server round-trip).

4. **jQuery + vanilla JavaScript**
   - Pros: familiar, minimal setup.
   - Cons: verbose, prone to callback hell, poor for reactive UI.
   - Rejected: Alpine.js is more concise for reactive cases.

5. **WebAssembly (Rust/WASM)**
   - Pros: performance, type safety.
   - Cons: complex build, overkill for UI logic, poor accessibility and debugging.
   - Rejected: not needed for StudyScribe's UI complexity.

## Consequences

### Positive:
- **Zero build step**: `git clone` → `python app.py` works immediately; no `npm install`, webpack, or TypeScript compilation.
- **Server-centric**: business logic stays in Python; templates render server state directly. Easy to understand data flow.
- **Small bundle**: Alpine.js (~15 KB) + HTMX (~14 KB) vs. React (~35+ KB) bundle.
- **Accessible**: server-rendered HTML ensures good baseline accessibility; progressive enhancement with Alpine adds polish.
- **Easy debugging**: open DevTools, inspect HTML, check server logs. No compiled code or source maps needed.

### Negative:
- **Limited composability**: no component reuse across pages (unlike React/Vue); duplication in templates.
- **Progressive enhancement complexity**: some UX patterns (drag-and-drop, real-time collab) are harder without a dedicated framework.
- **Scaling UX**: if UI becomes very interactive (e.g., rich text editor, complex tables), maintenance burden grows.
- **Team skill variance**: requires JavaScript fluency; not ideal if team is primarily backend-focused.

## Client State Management Pattern

- **Server-driven state**: modules, sessions, job status live on server (DB). Templates render current state.
- **Client-local state**: UI state (expanded/collapsed sections, active tab) stored in Alpine data or query params.
- **Job polling**: client polls `/api/jobs/<job_id>` every 1–2 sec; server returns JSON; HTMX or vanilla JS updates DOM.
- **Form submission**: forms POST to server; server updates state and renders redirect or returns HTML fragment.

## Recommended Evolution

- **If UX becomes more interactive** (v1.1+): consider migrating to a lightweight framework like Preact or Lit.
- **If team grows**: document Alpine/HTMX patterns and maintain a component library in templates.
- **If offline support needed**: add Service Workers to cache static assets and enable offline mode.

## Code Examples

```html
<!-- Alpine.js: tab switching -->
<div class="tabs" x-data="{ tab: 'notes' }">
  <div class="tab" :class="{ 'tabActive': tab === 'notes' }" @click="tab = 'notes'">Notes</div>
  <div x-show="tab === 'notes'" class="stack16"><!-- content --></div>
</div>

<!-- HTMX: job polling -->
<div id="job-status" hx-poll="2s" hx-get="/api/jobs/{{ job_id }}">
  <span>Transcribing... 45%</span>
</div>

<!-- Vanilla JS: file input handling -->
<input id="audioInput" type="file" data-file-input data-file-kind="audio">
<div class="chips" data-file-chips><!-- populated by app.js --></div>
```

## Testing Strategy

- **Unit**: test Alpine data bindings and computed properties in isolation (e.g., form validation).
- **Integration**: use Playwright/Selenium to test end-to-end flows (upload, transcribe, see progress).
- **Accessibility**: use axe or similar to check contrast, ARIA labels, keyboard navigation.

## Recommendations

- **Performance**: use `hx-boost` for navigation to cache requests and improve perceived speed.
- **Error handling**: display user-friendly error messages in toasts; see `base.html` for toast markup.
- **Responsiveness**: use CSS Grid and Flexbox; test on mobile (even if not primary target, prevents accidental breakage).
